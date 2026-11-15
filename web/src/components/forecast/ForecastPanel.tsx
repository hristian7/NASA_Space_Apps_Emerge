"use client";
import { LevelInfo, RiskContextChips, UsualArrow, useRiskContext } from '@/components/risk/RiskContext';

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import type { RiskIndex, RiskSpot } from "@/types/risk";
import { exampleMode, loadRiskCountry, loadRiskIndex, loadRiskWeek, showForecast } from "@/lib/risk/loaders";
import { distanceKm, nearestSpot as nearestSpotOf } from "@/lib/risk/geo";
import { pointScore, type PointSpot } from "@/lib/risk/here";
import { riskSquare } from "@/lib/risk/spot-scores";
import { dangerDate } from "@/lib/layers/danger";
import { pickModelDay } from "@/lib/risk/model-day";
import { fetchPower, type PowerData, type PowerParameter } from "@/lib/forecast/power";
import Sparkline from "./Sparkline";
import { useCountryBoxes } from "@/lib/ui/use-countries";
import {
  blowsToward,
  compassPoint,
  fetchWeather,
  parseWeather,
  roundedPlace,
  selectionPoint,
  type ForecastDay,
} from "@/lib/forecast/weather";
import styles from "@/components/report/styles";
import { RiskLinks } from "@/components/risk/RiskLinks";
import "@/components/risk/risk.css";
import "./forecast.css";
import Roll from "@/components/ui/roll";
import ActiveFireCard, { useActiveFire } from "@/components/risk/ActiveFireCard";

type Props = {
  selection: Selection;
  /** Day offset on the timeline: 0 today, 1 tomorrow, up to 9. */
  day: number;
  onPickPoint?: (lat: number, lon: number) => void;
};

type ScoreResult =
  | { key: string; status: "failed" }
  | {
      key: string;
      status: "ready";
      example: boolean;
      search: string;
      index: RiskIndex;
      open: boolean;
      spot: PointSpot | null;
      /** The closest ranked spot when the place itself is not one. */
      nearest: { spot: RiskSpot; km: number } | null;
      /** The place's own square, scored for every land square. */
      square: { p: number; level: number; usual: number | null; fwi: number | null; context?: [number | null, number | null] } | null;
      /** Past tomorrow our model has no score: that day's fire-weather value instead. */
      weekly: { fwi: number | null; date: string } | null;
      /** The published model day shown, which can lag the calendar by a day. */
      modelDate: string | null;
      /** True when no model day matches the viewed day and the latest one is shown. */
      latest: boolean;
      top: RiskSpot[] | null;
      countryMissing: boolean;
      country: string;
    };

type WeatherResult = { key: string; json: unknown } | { key: string; failed: true };

const TOP_COUNT = 5;
const noCountries = new Map<string, { lat: number; lon: number }>();

/**
 * Our model scores only the highest-risk places each day, so a point is
 * matched to a scored spot within that spot's own radius (forest and
 * wildland first, then all vegetation), and otherwise to the closest scored
 * spot in the same countries, shown with its distance.
 */
async function lookupOnDay(
  index: RiskIndex,
  lat: number,
  lon: number,
  day: string,
  example: boolean,
): Promise<{ spot: PointSpot | null; nearest: { spot: RiskSpot; km: number } | null; square: { p: number; level: number; usual: number | null; fwi: number | null; context?: [number | null, number | null] } | null }> {
  if (!index.meta || !Number.isFinite(lat) || !Number.isFinite(lon)) return { spot: null, nearest: null, square: null };
  const reach = index.meta.grid_g * 112;
  const countries = [
    ...new Set(
      index.regions
        .filter(({ bbox: [w, s, e, n] }) => distanceKm(lat, lon, Math.max(s, Math.min(n, lat)), Math.max(w, Math.min(e, lon))) <= reach)
        .map((region) => region.country),
    ),
  ];
  const files = await Promise.all(countries.map((country) => loadRiskCountry(country, example)));
  const forest = files.flatMap(({ file }) => Object.values(file.regions).flatMap((days) => days[day] ?? []));
  const all = files.flatMap(({ file }) => Object.values(file.all_vegetation ?? {}).flatMap((days) => days[day] ?? []));
  const point = await pointScore(index, lat, lon, day, example);
  if (point?.ranked) return { spot: point, nearest: null, square: null };
  const scored = [...forest, ...all].filter((candidate) => candidate.p !== null);
  let nearest: { spot: RiskSpot; km: number } | null = null;
  for (const candidate of scored) {
    const km = distanceKm(lat, lon, candidate.lat, candidate.lon);
    if (nearest === null || km < nearest.km) nearest = { spot: candidate, km };
  }
  const square = point !== null && point.p !== null ? { p: point.p, level: point.level, usual: point.usual ?? null, fwi: point.inputs?.fwi ?? null, context: point.context } : null;
  return { spot: null, nearest, square };
}

function topSpots(spots: RiskSpot[]): RiskSpot[] {
  return [...spots]
    .sort((a, b) => (b.p ?? -1) - (a.p ?? -1) || a.rank - b.rank)
    .slice(0, TOP_COUNT);
}

const metricPaths: Record<string, ReactNode> = {
  temp: <path d="M10 3.5a1.8 1.8 0 0 0-1.8 1.8v6.6a3.2 3.2 0 1 0 3.6 0V5.3A1.8 1.8 0 0 0 10 3.5zM10 9v4.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  humidity: <path d="M10 3.2C8 6 5.8 8.6 5.8 11.4a4.2 4.2 0 0 0 8.4 0C14.2 8.6 12 6 10 3.2z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  wind: <path d="M3.5 8h9a2.3 2.3 0 1 0-2.3-2.3M3.5 12h11.5a2.3 2.3 0 1 1-2.3 2.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  rain: <path d="M6 11.5a3.3 3.3 0 0 1 .6-6.5 4 4 0 0 1 7.6 1.4A2.6 2.6 0 0 1 14 11.5zM7.5 14l-.8 2M10.5 14l-.8 2M13.5 14l-.8 2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />,
  dry: <><circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10 2.8v1.8M10 15.4v1.8M2.8 10h1.8M15.4 10h1.8M4.9 4.9l1.3 1.3M13.8 13.8l1.3 1.3M4.9 15.1l1.3-1.3M13.8 6.2l1.3-1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
  soil: <path d="M3 9.5h14M3 12.5h14M3 15.5h14M7 9.5c0-2 1.3-3.5 3-4.5 1.7 1 3 2.5 3 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
};

function MetricIcon({ name }: { name: string }) {
  return (
    <svg className="fc-icon" viewBox="0 0 20 20" aria-hidden="true">
      {metricPaths[name]}
    </svg>
  );
}

export default function ForecastPanel({ selection, day, onPickPoint }: Props) {
  const t = useTranslations("forecast");
  const tr = useTranslations("risk");
  const locale = useLocale();
  const boxes = useCountryBoxes();

  const selectionKey = JSON.stringify(selection);
  const sel = useMemo(() => JSON.parse(selectionKey) as Selection, [selectionKey]);
  const scoreKey = `${selectionKey}|${day}`;
  const named = day === 0 ? "today" : day === 1 ? "tomorrow" : null;
  const viewedDate = dangerDate(day);

  const place = useMemo(() => selectionPoint(sel, boxes), [sel, boxes]);
  const placeKey = place ? `${roundedPlace(place.lat, place.lon).lat},${roundedPlace(place.lat, place.lon).lon}` : null;
  const countryEntry = sel.kind === "country" ? boxes.get(sel.iso3) : undefined;
  const countryKnown = sel.kind !== "country" || boxes.size > 0;

  const [score, setScore] = useState<ScoreResult | null>(null);
  // A place already burning gets a near-zero model chance, which would read as safe.
  const firePlace = useMemo(() => (sel.kind === "point" ? { lat: sel.lat, lon: sel.lon, radiusKm: sel.radiusKm } : null), [sel]);
  const fireCheck = useActiveFire(firePlace, score?.status === "ready" ? score.index.meta?.grid_g : undefined);
  const [weather, setWeather] = useState<WeatherResult | null>(null);

  useEffect(() => {
    let live = true;
    const search = window.location.search;
    const example = exampleMode(search);
    (async (): Promise<ScoreResult> => {
      const index = await loadRiskIndex(example);
      const base = { key: scoreKey, status: "ready" as const, example, search, index, spot: null, nearest: null, square: null, weekly: null, top: null, countryMissing: false, modelDate: null, latest: false };
      if (!index.meta || !showForecast(index.meta, example)) {
        return { ...base, open: false, country: sel.kind === "country" ? sel.iso3 : "" };
      }
      const picked = pickModelDay(index.meta.days, viewedDate, day);
      const modelDate = picked?.date ?? null;
      if (modelDate === null) {
        // Our model scores today and tomorrow only; later days carry the
        // NASA fire-weather index from the week files, never a model score.
        const date = dangerDate(day);
        const at = selectionPoint(sel, boxes);
        const countries =
          sel.kind === "country"
            ? [sel.iso3]
            : at === null
              ? []
              : [...new Set(index.regions.filter(({ bbox: [w, s2, e, n] }) => at.lon >= w && at.lon <= e && at.lat >= s2 && at.lat <= n).map((region) => region.country))];
        let fwi: number | null = null;
        for (const country of countries) {
          const { file } = await loadRiskWeek(country, example);
          const spots = Object.values(file.regions).flatMap((days) => days[date] ?? []);
          const values = (list: typeof spots) => list.map((spot) => spot.inputs?.fwi).filter((value): value is number => typeof value === "number");
          if (sel.kind === "country") {
            const all = values(spots);
            if (all.length > 0) fwi = Math.max(fwi ?? 0, ...all);
          } else if (at !== null) {
            const square = riskSquare(at.lat, at.lon, index.meta.grid_g).spot_id;
            const own = spots.find((spot) => spot.spot_id === square) ?? nearestSpotOf(spots, at.lat, at.lon);
            const value = own ? values([own])[0] : undefined;
            if (value !== undefined) {
              fwi = value;
              break;
            }
          }
        }
        return { ...base, open: true, weekly: { fwi, date }, country: sel.kind === "country" ? sel.iso3 : (countries[0] ?? "") };
      }
      const dayKey = modelDate;
      const dated = { modelDate, latest: picked?.latest === true };
      if (sel.kind === "country") {
        const { status, file } = await loadRiskCountry(sel.iso3, example);
        const spots = Object.values(file.regions).flatMap((days) => days[dayKey] ?? []);
        return { ...base, ...dated, open: true, top: topSpots(spots), countryMissing: status === "missing", country: sel.iso3 };
      }
      const at = selectionPoint(sel, noCountries);
      const found = at ? await lookupOnDay(index, at.lat, at.lon, dayKey, example) : { spot: null, nearest: null, square: null };
      const regionOf = found.spot?.region_id ?? found.nearest?.spot.region_id;
      const country = index.regions.find((region) => region.region_id === regionOf)?.country ?? "";
      return { ...base, ...dated, open: true, spot: found.spot, nearest: found.nearest, square: found.square, country };
    })()
      .then((result) => {
        if (live) setScore(result);
      })
      .catch(() => {
        if (live) setScore({ key: scoreKey, status: "failed" });
      });
    return () => {
      live = false;
    };
    // `named` and `boxes` follow from `day` and the country file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, day, scoreKey]);

  useEffect(() => {
    if (placeKey === null) return;
    const [lat, lon] = placeKey.split(",").map(Number);
    const controller = new AbortController();
    fetchWeather(lat, lon, controller.signal)
      .then((json) => {
        if (!controller.signal.aborted) setWeather({ key: placeKey, json });
      })
      .catch(() => {
        if (!controller.signal.aborted) setWeather({ key: placeKey, failed: true });
      });
    return () => controller.abort();
  }, [placeKey]);

  // Thirty days of NASA POWER model estimates for the same place, as trend lines.
  const [power, setPower] = useState<{ key: string; data: PowerData | null } | null>(null);
  useEffect(() => {
    if (placeKey === null) return;
    const [lat, lon] = placeKey.split(",").map(Number);
    const controller = new AbortController();
    fetchPower(lat, lon, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPower({ key: placeKey, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPower({ key: placeKey, data: null });
      });
    return () => controller.abort();
  }, [placeKey]);
  const powerData = placeKey !== null && power?.key === placeKey ? power.data : null;

  const currentScore = score?.key === scoreKey ? score : null;
  const currentWeather = placeKey !== null && weather?.key === placeKey ? weather : null;
  const parsed = useMemo(
    () => (currentWeather && "json" in currentWeather ? parseWeather(currentWeather.json, day) : null),
    [currentWeather, day],
  );

  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
  const dateText = (iso: string) => {
    const date = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(date.getTime())
      ? iso
      : new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  };
  const chance = (p: number | null) =>
    p === null ? tr("noForecast") : p === 0 ? tr("zeroEstimate") : tr("chance", { n: Math.max(1, Math.round(1 / p)) });
  const fuel = (type: string) => (tr.has(`fuel.${type}`) ? tr(`fuel.${type}`) : tr("unknownFuel"));
  const countryName = (iso3: string) =>
    tr.has(`countries.${iso3}`) ? tr(`countries.${iso3}`) : boxes.get(iso3)?.name ?? iso3;
  const regionName = (regionId: string) => {
    const region = currentScore?.status === "ready" ? currentScore.index.regions.find((r) => r.region_id === regionId) : undefined;
    if (!region) return regionId;
    return locale === "bg" ? region.name_local || region.name_en : region.name_en || region.name_local;
  };

  const scoreSection = (): ReactNode => {
    if (!currentScore) return <p role="status" className="fc-muted">{tr("loading")}</p>;
    if (currentScore.status === "failed") return <p role="alert">{tr("failed")}</p>;
    const { example, open, spot, nearest, square, weekly, top, countryMissing, modelDate } = currentScore;
    if (weekly !== null) {
      return (
        <>
          <p className="fc-levelName">{t(day < 2 ? "noModelDay" : "weekOnly")}</p>
          {weekly.fwi === null ? (
            <p className="fc-muted">{t("weekNoValue")}</p>
          ) : (
            <p className="fc-facts">
              <span>
                {t(sel.kind === "country" ? "weekFwiCountry" : "weekFwi", { value: number(weekly.fwi, 1) })}
              </span>
            </p>
          )}
          <p className="fc-muted">{t("weekNote", { date: dateText(weekly.date) })}</p>
        </>
      );
    }
    const contextDay = modelDate ?? viewedDate;
    if (open && fireCheck !== null && top === null) {
      if (fireCheck.status === "loading") return <p role="status" className="fc-muted">{tr("fireChecking")}</p>;
      if (fireCheck.status === "ready" && fireCheck.fire.active) {
        return (
          <>
            {example && <p className="fc-example">{tr("example")} · {tr("exampleNote")}</p>}
            <ActiveFireCard fire={fireCheck.fire} radiusKm={sel.kind === "point" ? sel.radiusKm : 0} weather={parsed} />
          </>
        );
      }
    }
    return (
      <>
        {example && <p className="fc-example">{tr("example")} · {tr("exampleNote")}</p>}
        {!open ? (
          <p className="fc-muted">{t("scoreBuilding")}</p>
        ) : top !== null ? (
          countryMissing ? (
            <p className="fc-muted">{tr("missingCountry")}</p>
          ) : top.length === 0 ? (
            <p className="fc-muted">{tr("empty")}</p>
          ) : (
            <TopSpots
              heading={t("topSpots", { country: countryName(currentScore.country) })}
              spots={top}
              day={contextDay}
              regionName={regionName}
              chance={chance}
              onPickPoint={onPickPoint}
            />
          )
        ) : spot ? (
          spot.p === null ? (
            <>
              <p>{tr("noForecast")}</p>
              <p className="fc-muted">{tr("missingInputs")}</p>
            </>
          ) : (
            <ScoreBlock
              level={spot.level}
              fwi={spot.inputs?.fwi ?? null}
              chips={
                <>
                  <li className="fc-chip"><Roll value={chance(spot.p)} /></li>
                  <li className="fc-chip">{fuel(spot.fire_type ?? "")}</li>
                  <RiskContextChips p={spot.p} usual={spot.usual} fwi={spot.inputs?.fwi} day={spot.day} />
                  {spot.why
                    .filter((key) => tr.has(`why.${key}`))
                    .slice(0, 4)
                    .map((key) => (
                      <li key={key} className="fc-chip fc-chipWhy">{tr(`why.${key}`)}</li>
                    ))}
                </>
              }
            />
          )
        ) : square !== null ? (
          <ScoreBlock
            level={square.level}
            fwi={square.fwi}
            chips={
              <>
                <li className="fc-chip"><Roll value={chance(square.p)} /></li>
                <RiskContextChips p={square.p} usual={square.usual} fwi={square.fwi} day={contextDay} context={square.context} />
              </>
            }
            after={
              <>
                <p className="fc-muted">{t("squareNote")}</p>
                {nearest !== null ? (
                  <NearestSpot nearest={nearest} text={`${t("nearestSpot", { km: number(nearest.km, 0), level: nearest.spot.level })} ${chance(nearest.spot.p)}`} goLabel={t("goToSpot")} onPickPoint={onPickPoint} />
                ) : null}
              </>
            }
          />
        ) : nearest !== null ? (
          <div className="fc-score">
            <p className="fc-levelName">{t("notScored")}</p>
            <p className="fc-muted">{t("notScoredWhy")}</p>
            <NearestSpot nearest={nearest} text={`${t("nearestSpot", { km: number(nearest.km, 0), level: nearest.spot.level })} ${chance(nearest.spot.p)}`} goLabel={t("goToSpot")} onPickPoint={onPickPoint} />
          </div>
        ) : (
          <>
            <p>{tr("noForecast")}</p>
            <p className="fc-muted">{tr("coverage")}</p>
          </>
        )}
      </>
    );
  };

  const tile = (props: {
    icon: string;
    label: string;
    value: string | null;
    unit: string;
    wide?: boolean;
    extra?: ReactNode;
    trend?: PowerParameter;
  }) => (
    <div className={`${styles.card} fc-tile${props.wide ? " fc-tileWide" : ""}`}>
      <p className="fc-tileLabel">
        <MetricIcon name={props.icon} />
        {props.label}
      </p>
      <p className="fc-tileValue">
        {props.value === null ? (
          <span className="fc-tileNoData">{t("noData")}</span>
        ) : (
          <>
            <span className={`${styles.num} num fc-tileFigure`}><Roll value={props.value} /></span>
            <span className="fc-tileUnit">{props.unit}</span>
          </>
        )}
      </p>
      {props.extra}
      {props.trend && powerData && powerData.series[props.trend].some((entry) => entry.value !== null) ? (
        <div className="fc-trend">
          <Sparkline bare label={props.label} values={powerData.series[props.trend]} unit={powerData.units[props.trend]} />
        </div>
      ) : null}
    </div>
  );

  const weatherWhere = (): string | null => {
    if (!parsed) return null;
    return sel.kind === "country"
      ? t("atCountry", { name: countryName(sel.iso3), date: dateText(parsed.date) })
      : t("atPoint", { lat: place ? place.lat.toFixed(2) : "", lon: place ? place.lon.toFixed(2) : "", date: dateText(parsed.date) });
  };

  const weatherSection = (): ReactNode => {
    if (sel.kind === "country" && countryKnown && !countryEntry) return <p className="fc-muted">{t("noPlace")}</p>;
    if (placeKey === null && sel.kind !== "country") return <p className="fc-muted">{t("noPlace")}</p>;
    if (!currentWeather) return <p role="status" className="fc-muted">{t("loadingWeather")}</p>;
    if ("failed" in currentWeather || !parsed) return <p role="alert">{t("failedWeather")}</p>;
    const w = parsed;
    const show = (value: number | null, digits: number) => (value === null ? null : number(value, digits));
    const dry = w.dryDays;
    return (
      <>
        <div className="fc-tiles">
          {tile({ icon: "temp", label: t("tTemp"), value: show(w.tMax, 1), unit: t("unitC"), trend: "T2M_MAX" })}
          {tile({ icon: "humidity", label: t("tHumidity"), value: show(w.rhMin, 0), unit: t("unitPct"), trend: "RH2M" })}
          {tile({
            icon: "wind",
            label: t("tWind"),
            value: show(w.windMax, 0),
            unit: t("unitKmh"),
            trend: "WS10M",
            extra: (
              <p className="fc-tileLine">
                <span>{w.gustMax === null ? t("gustsNone") : t("gusts", { value: number(w.gustMax, 0) })}</span>
                {w.windFrom === null ? (
                  <span>{t("dirNone")}</span>
                ) : (
                  <span className="fc-tileLine">
                    <svg
                      className="fc-arrow"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      style={{ transform: `rotate(${blowsToward(w.windFrom)}deg)` }}
                    >
                      <path d="M8 1.5 12.5 8H9.5v6.5h-3V8h-3z" fill="currentColor" />
                    </svg>
                    <span>{t("windFrom", { dir: t(`dir${compassPoint(w.windFrom)}`) })}</span>
                  </span>
                )}
              </p>
            ),
          })}
          {tile({ icon: "rain", label: t("tRain"), value: show(w.rain, 1), unit: t("unitMm"), trend: "PRECTOTCORR" })}
          {tile({ icon: "rain", label: t("tRain7"), value: show(w.rain7, 1), unit: t("unitMm") })}
          {tile({
            icon: "dry",
            label: t("tDry"),
            value: dry === null ? null : dry.atLeast ? t("atLeast", { n: dry.days }) : number(dry.days, 0),
            unit: dry === null ? "" : t("unitDays", { n: dry.days }),
          })}
          {tile({ icon: "soil", label: t("tSoil"), value: show(w.soil, 2), unit: t("unitSoil"), trend: "GWETTOP" })}
        </div>
        <p className="fc-footnote">
          {t("sourcesNote", {
            forecast: t("sourceForecast"),
            past: t("sourcePast"),
            dry: t("tDryNote"),
            soil: t("sourceSoil"),
            trend: t("trendNote", { date: powerData?.lastDate ? dateText(powerData.lastDate) : "" }),
          })}
        </p>
      </>
    );
  };

  const dayDate = dateText(dangerDate(day));
  const readyScore = currentScore?.status === "ready" ? currentScore : null;
  const latest = readyScore?.latest === true && readyScore.modelDate !== null;
  const scoreTitle = latest
    ? t("scoreTitleLatest", { date: dateText(readyScore!.modelDate!) })
    : named === "today" ? t("scoreTitleToday") : named === "tomorrow" ? t("scoreTitleTomorrow") : t("scoreTitleDay", { date: dayDate });
  // A country list carries its date in its own header.
  const validLabel = !latest && readyScore?.open && readyScore.modelDate && readyScore.top === null ? tr("valid", { date: dateText(readyScore.modelDate) }) : null;
  const inputsTitle =
    named === "today" ? t("inputsTitleToday") : named === "tomorrow" ? t("inputsTitleTomorrow") : t("inputsTitleDay", { date: dayDate });

  const listHref = `/risk${readyScore?.search ?? ""}`;
  const where = weatherWhere();

  return (
    <div className={`${styles.report} fc-panel`}>
      <section className={styles.section} aria-label={scoreTitle}>
        <div className="fc-head">
          <h2 className={styles.heading}>{scoreTitle}</h2>
          {validLabel ? <span className="fc-where">{validLabel}</span> : null}
        </div>
        {scoreSection()}
      </section>
      <section className={styles.section} aria-label={inputsTitle}>
        <div className="fc-head">
          <h2 className={styles.heading}>{inputsTitle}</h2>
          {where ? <span className="fc-where">{where}</span> : null}
        </div>
        {weatherSection()}
      </section>
      <section className={`${styles.section} fc-links`}>
        <a href={listHref}>{t("allSpots")}</a>
        <RiskLinks country={readyScore?.country ?? (sel.kind === "country" ? sel.iso3 : "")} />
      </section>
      <p className="fc-muted">{tr("disclaimer")}</p>
    </div>
  );
}

/** Level figure, meter and name on one line, then one wrapping row of chips. */
function ScoreBlock({ level, chips, fwi, after }: { level: number; chips: ReactNode; fwi?: number | null; after?: ReactNode }) {
  const t = useTranslations("forecast");
  const tr = useTranslations("risk");
  return (
    <div className="fc-score">
      <div className="fc-scoreRow">
        <p className="fc-level" aria-label={t("levelAria", { level })}>
          <span className={`fc-levelFigure ${styles.num} num`} aria-hidden="true"><Roll value={level} ms={420} /></span>
          <span className="fc-levelOf num" aria-hidden="true">/ 5</span>
        </p>
        <div className="fc-meter" aria-hidden="true" key={level}>
          {[1, 2, 3, 4, 5].map((step) => (
            <span key={step} data-on={step <= level} />
          ))}
        </div>
        <p className="fc-levelName">{tr("level", { level })}</p>
        <LevelInfo fwi={fwi} />
      </div>
      <ul className="fc-chips">{chips}</ul>
      {after}
    </div>
  );
}

function NearestSpot({ nearest, text, goLabel, onPickPoint }: { nearest: { spot: RiskSpot; km: number }; text: string; goLabel: string; onPickPoint?: (lat: number, lon: number) => void }) {
  return (
    <div className="fc-nearest">
      <p className="fc-muted">{text}</p>
      <ul className="fc-chips">
        <RiskContextChips p={nearest.spot.p} usual={nearest.spot.usual} fwi={nearest.spot.inputs.fwi} day={nearest.spot.day} />
      </ul>
      {onPickPoint ? (
        <button type="button" className="whole-country" onClick={() => onPickPoint(nearest.spot.lat, nearest.spot.lon)}>
          {goLabel}
        </button>
      ) : null}
    </div>
  );
}

/** One dense row per spot: level, place, versus usual, fire weather, chance. */
function TopSpots({ heading, spots, day, regionName, chance, onPickPoint }: {
  heading: string;
  spots: RiskSpot[];
  day: string;
  regionName: (id: string) => string;
  chance: (p: number | null) => string;
  onPickPoint?: (lat: number, lon: number) => void;
}) {
  const t = useTranslations("forecast");
  const tr = useTranslations("risk");
  const locale = useLocale();
  const month = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return (
    <>
      <div className="fc-head">
        <h3 className={styles.heading}>{heading}</h3>
        <span className="fc-where">{tr("valid", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)) })}</span>
      </div>
      <ol className="fc-top">
        {spots.map((item) => (
          <TopSpotRow key={item.spot_id} item={item} region={regionName(item.region_id)} chance={chance(item.p)} onPickPoint={onPickPoint} />
        ))}
      </ol>
      <div className="fc-listFoot">
        <p className="fc-muted">{t("listKey", { month })}</p>
        <LevelInfo />
      </div>
    </>
  );
}

function TopSpotRow({ item, region, chance, onPickPoint }: { item: RiskSpot; region: string; chance: string; onPickPoint?: (lat: number, lon: number) => void }) {
  const t = useTranslations("forecast");
  const c = useRiskContext({ p: item.p, usual: item.usual, fwi: item.inputs.fwi, day: item.day });
  const spoken = [t("levelAria", { level: item.level }), chance, c.usualText, c.weatherText].filter(Boolean).join(", ");
  const content = (
    <>
      <span className="fc-topLevel" aria-hidden="true">
        <span className="fc-swatch" data-level={item.level} />
        <span className={`${styles.num} num`}><Roll value={item.level} /></span>
      </span>
      <span className="fc-topName">{region}</span>
      <span className="fc-topUsual" aria-hidden="true"><UsualArrow direction={c.direction} /></span>
      <span className="fc-topWeather" data-level={c.weatherLevel} aria-hidden="true">{c.weatherShort}</span>
      <span className="fc-topChance num" aria-hidden="true"><Roll value={chance} /></span>
    </>
  );
  return (
    <li>
      {onPickPoint ? (
        <button type="button" className="fc-topRow" aria-label={`${t("pickSpot", { region })}. ${spoken}`} onClick={() => onPickPoint(item.lat, item.lon)}>
          {content}
        </button>
      ) : (
        <div className="fc-topRow" role="group" aria-label={`${region}. ${spoken}`}>{content}</div>
      )}
    </li>
  );
}
