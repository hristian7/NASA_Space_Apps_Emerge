"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getMeta } from "@/lib/data/api";
import { formatIsoDate, type ReportLocale } from "@/components/report/lib/format";
import { panelLayers } from "@/lib/layers/url-state";
import type { LayerState } from "@/lib/layers/url-state";
import { dangerClasses, dangerDate, dangerDays } from "@/lib/layers/danger";
import { historyBreaks, historyRampTokens, historyYears } from "@/lib/layers/history";
import { recentWindows, type RecentWindow } from "@/lib/layers/firms";
import type { RecentPayload } from "@/lib/layers/recent";
import type { LayerDefinition } from "@/config/layers";
import Disclaimer from "./disclaimer";
import "@/styles/layers.css";

export type LoadStatus = "off" | "loading" | "ready" | "empty" | "failed";

type Props = {
  state: LayerState;
  lastMonth: string | null;
  historyStatus: LoadStatus;
  historyCellCount: number;
  recentStatus: LoadStatus;
  recent: RecentPayload | null;
  onToggle: (id: string) => void;
  onYear: (year: number) => void;
  onWindow: (window: RecentWindow) => void;
  onDay: (day: number) => void;
  /** True while a menu from the top bar covers the same corner. */
  covered: boolean;
};

/** Registry keys carry their namespace; `useTranslations` already has it. */
function short(key: string): string {
  return key.startsWith("layers.") ? key.slice("layers.".length) : key;
}

/** "1 to 2", "21 or more": the numbers a ramp colour stands for. */
function breakLabel(index: number, more: string): string {
  const low = historyBreaks[index];
  const next = historyBreaks[index + 1];
  if (next === undefined) return `${low}${more}`;
  return next - low === 1 ? `${low}` : `${low} to ${next - 1}`;
}

export default function LayerPanel({
  state,
  lastMonth,
  historyStatus,
  historyCellCount,
  recentStatus,
  recent,
  onToggle,
  onYear,
  onWindow,
  onDay,
  covered,
}: Props) {
  const t = useTranslations("layers");
  const locale = useLocale() as ReportLocale;
  const [lastDay, setLastDay] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getMeta().then((meta) => {
      if (!cancelled) setLastDay(meta.last_data_day);
    }).catch(() => {
      if (!cancelled) setLastDay(null);
    });
    return () => { cancelled = true; };
  }, []);
  const [open, setOpen] = useState(true);
  const [rasterErrors, setRasterErrors] = useState<string[]>([]);
  const [wind, setWind] = useState({ state: "loading", time: "" });
  useEffect(() => {
    const update = (event: Event) => setWind((event as CustomEvent<{ state: string; time: string }>).detail);
    window.addEventListener("emerge-wind", update);
    return () => window.removeEventListener("emerge-wind", update);
  }, []);

  useEffect(() => {
    const update = (event: Event) => setRasterErrors((current) => [...new Set([...current, (event as CustomEvent<string>).detail])]);
    window.addEventListener("emerge-raster-error", update);
    return () => window.removeEventListener("emerge-raster-error", update);
  }, []);

  // A phone opens with the list folded away, so the map and the report sheet
  // keep their room; a wide screen has space for it from the start.
  useEffect(() => {
    setOpen(window.innerWidth >= 768);
  }, []);

  // On a phone the list and the report sheet share the lower half of the
  // screen, so opening the list lowers the sheet, the same move the top bar's
  // own menus make.
  const show = (next: boolean) => {
    setOpen(next);
    if (next && window.innerWidth < 768) {
      document.documentElement.setAttribute("data-sheet", "peek");
    }
  };

  const layers = panelLayers();
  const onCount = layers.filter((entry) => state.on.includes(entry.id)).length;
  const years = historyYears(lastMonth);
  const dangerOn = layers.some(
    (entry) => entry.panel?.showsDisclaimer === true && state.on.includes(entry.id),
  );

  const control = (definition: LayerDefinition) => {
    switch (definition.panel?.control) {
      case "history_year":
        return (
          <div className="layer-control">
            <label className="label" htmlFor="layer-year">
              {t("yearLabel")}
            </label>
            <div className="layer-steps">
              <button
                type="button"
                className="btn step"
                onClick={() => onYear(state.historyYear - 1)}
                disabled={state.historyYear <= years[0]}
                aria-label={t("yearBack")}
              >
                {"<"}
              </button>
              <select
                id="layer-year"
                className="field num"
                value={state.historyYear}
                onChange={(event) => onYear(Number(event.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn step"
                onClick={() => onYear(state.historyYear + 1)}
                disabled={state.historyYear >= years[years.length - 1]}
                aria-label={t("yearForward")}
              >
                {">"}
              </button>
            </div>
          </div>
        );
      case "recent_window":
        return (
          <div className="layer-control">
            <span className="label" id="layer-window">
              {t("windowLabel")}
            </span>
            <div className="row" role="group" aria-labelledby="layer-window">
              {recentWindows.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className="chip"
                  aria-pressed={candidate === state.recentWindow}
                  onClick={() => onWindow(candidate)}
                >
                  {t(candidate === "24h" ? "window24h" : "window7d")}
                </button>
              ))}
            </div>
          </div>
        );
      case "danger_day":
        return (
          <div className="layer-control">
            <label className="label" htmlFor={`layer-day-${definition.id}`}>
              {t("dayLabel")}
            </label>
            <select
              id={`layer-day-${definition.id}`}
              className="field"
              value={state.dangerDay}
              onChange={(event) => onDay(Number(event.target.value))}
            >
              {dangerDays().map((day) => (
                <option key={day} value={day}>
                  {day === 0
                    ? `${t("today")} (${dangerDate(0)})`
                    : `${t("inDays", { days: day })} (${dangerDate(day)})`}
                </option>
              ))}
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  const legend = (definition: LayerDefinition) => {
    switch (definition.panel?.legend.kind) {
      case "ramp":
        return (
          <>
            <ul className="legend">
              {historyRampTokens.map((token, index) => (
                <li key={token}>
                  <span
                    className="swatch"
                    style={{ background: `var(${token})` }}
                    aria-hidden="true"
                  />
                  <span className="num">{breakLabel(index, t("orMore"))}</span>
                  <span className="legend-word">{t("fireDays")}</span>
                </li>
              ))}
            </ul>
            <p className="hint">{t("mergedNote")}</p>
          </>
        );
      case "points":
        return (
          <ul className="legend">
            <li>
              <span className="dot small" aria-hidden="true" />
              <span>{t("pointSmall")}</span>
            </li>
            <li>
              <span className="dot large" aria-hidden="true" />
              <span>{t("pointLarge")}</span>
            </li>
            <li>
              <span className="dot high" aria-hidden="true" />
              <span>{t("pointHigh")}</span>
            </li>
          </ul>
        );
      case "classes":
        if (definition.id === "wind") return <p className="hint">➤ km/h</p>;
        if (definition.id !== "fire-danger") {
          const legends: Record<string, string> = {
            "nasa-fwi": "https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&request=GetLegendGraphic&version=1.1.1&format=image/png&layer=nasa_geos5.fwi",
            "soil-moisture": "https://gibs.earthdata.nasa.gov/legends/SMAP_Soil_Moisture_H.svg",
            "greenness": "https://gibs.earthdata.nasa.gov/legends/MODIS_NDVI_H.svg",
            "land-type": "https://gibs.earthdata.nasa.gov/legends/MODIS_IGBP_Land_Cover_Type_H.svg",
            "air-temperature": "https://gibs.earthdata.nasa.gov/legends/AIRS_Temperature_H.svg",
          };
          return <><img src={legends[definition.id]} alt={t("providerLegend")} style={{ maxWidth: "100%", height: "auto", background: "white" }} />{definition.id === "land-type" ? <p className="hint">{t("landLegend")}</p> : null}</>;
        }
        return (
          <ul className="legend">
            {dangerClasses.map((entry) => (
              <li key={entry.labelKey}>
                <span className="swatch" style={{ background: entry.color }} aria-hidden="true" />
                <span>{t(short(`layers.${entry.labelKey}`))}</span>
                <span className="legend-word num">{entry.range}</span>
              </li>
            ))}
          </ul>
        );
      default:
        return null;
    }
  };

  const timeLine = (definition: LayerDefinition) => {
    const key = short(definition.panel?.timeKey ?? "");
    if (definition.id === "harmonized-history") {
      if (historyStatus === "loading") return t("loading");
      if (historyStatus === "empty") return t("noYearData", { year: state.historyYear });
      if (historyStatus === "failed") return t("failed");
      if (lastDay === undefined) return t("loading");
      if (lastDay === null) return t("failed");
      if (lastDay.slice(0, 4) === String(state.historyYear) && !lastDay.endsWith("-12-31")) {
        return t("harmonizedHistoryPartialTime", {
          year: state.historyYear, date: formatIsoDate(lastDay, locale), cells: historyCellCount,
        });
      }
      return t(key, { year: state.historyYear, cells: historyCellCount });
    }
    if (definition.id === "recent-fires") {
      if (recentStatus === "loading") return t("loading");
      if (recentStatus === "failed") return t("failed");
      if (recent === null || recent.shown === 0) return t("noRecent");
      if (recent.capped) {
        return t("recentFiresTimeCapped", {
          shown: recent.shown,
          total: recent.total,
          from: recent.dataStart ?? "",
          to: recent.dataTime ?? "",
        });
      }
      return t(key, {
        shown: recent.shown,
        total: recent.total,
        from: recent.dataStart ?? "",
        to: recent.dataTime ?? "",
      });
    }
    if (rasterErrors.includes(definition.id)) return t("failed");
    if (definition.id === "wind") {
      if (wind.state === "loading") return t("loading");
      if (wind.state !== "ready") return t("windNoData");
      return t(key, { date: wind.time });
    }
    return t(key, { date: definition.source.kind === "tile_template" ? definition.source.date ?? dangerDate(state.dangerDay) : "" });
  };

  return (
    <section className="layers glass" aria-label={t("title")} hidden={covered}>
      <h2>
        <button
          type="button"
          className="layers-head"
          aria-expanded={open}
          aria-controls="layer-list"
          onClick={() => show(!open)}
        >
          <span>{t("title")}</span>
          <span className="layers-count num">{t("onCount", { count: onCount })}</span>
        </button>
      </h2>

      <div id="layer-list" className="layers-body" hidden={!open}>
        {layers.map((definition) => {
          const on = state.on.includes(definition.id);
          return (
            <div className="layer-row" key={definition.id}>
              <label className="layer-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={on}
                  onChange={() => { setRasterErrors((current) => current.filter((id) => id !== definition.id)); onToggle(definition.id); }}
                />
                <span>{t(short(definition.nameKey))}</span>
              </label>
              <p className="hint">{t(short(definition.panel?.explainKey ?? ""))}</p>

              {on ? (
                <div className="layer-open">
                  {control(definition)}
                  {legend(definition)}
                  <p className="hint" aria-live="polite">
                    {timeLine(definition)}
                  </p>
                  <p className="hint credit">{definition.credit}</p>
                </div>
              ) : null}
            </div>
          );
        })}

        {dangerOn ? (
          <div className="layer-disclaimer">
            <Disclaimer />
          </div>
        ) : null}
      </div>
    </section>
  );
}
