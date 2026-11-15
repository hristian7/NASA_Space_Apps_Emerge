import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import AnchorHeading from "@/components/explain/anchor-heading";
import InfoPage from "@/components/explain/info-page";
import SatelliteTimeline from "@/components/explain/satellite-timeline";
import {
  bootstrapDraws,
  capture,
  continuing,
  conversion,
  dailyLog,
  featureGroups,
  gains,
  gridDeg,
  hitRate,
  levelBands,
  lowBin,
  methodOrder,
  modelVersion,
  newFires,
  published,
  regionDays,
  scopes,
  sensorYears,
  sofiaTimesHistory,
  testYear,
  week,
} from "./facts";
import "./how-it-works.css";

type T = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("how");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "article", siteName: "Emerge" },
    twitter: { card: "summary", title: t("metaTitle"), description: t("metaDescription") },
  };
}

function formatters(locale: string) {
  const pct = (value: number, digits = 1) =>
    new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const num = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return { pct, num };
}
type Fmt = ReturnType<typeof formatters>;

const sections = ["sources", "record", "model", "compare", "limits"] as const;

export default async function HowItWorksPage() {
  const t = (await getTranslations("how")) as unknown as T;
  const fmt = formatters(await getLocale());

  return (
    <InfoPage current="how" className="hw">
      <header>
        <h1>{t("title")}</h1>
        <p>{t("lead")}</p>
      </header>

      <nav className="hw-toc" aria-label={t("onThisPage")}>
        {sections.map((id, i) => (
          <a key={id} className="hw-toc-item" href={`#${id}`}>
            <span className="hw-toc-num">{i + 1}</span>
            {t(`toc.${id}`)}
          </a>
        ))}
      </nav>

      <Sources t={t} />
      <Record t={t} fmt={fmt} />
      <Model t={t} fmt={fmt} />
      <Compare t={t} fmt={fmt} />
      <Limits t={t} fmt={fmt} />
    </InfoPage>
  );
}

function Section({ id, t, children }: { id: string; t: T; children: React.ReactNode }) {
  return (
    <section id={id} className="hw-section">
      <AnchorHeading id={id} label={t("anchorLabel")}>
        {t(`${id}.title`)}
      </AnchorHeading>
      {children}
    </section>
  );
}

/* 1. The data */


function Sources({ t }: { t: T }) {
  return (
    <Section id="sources" t={t}>
      <p className="hw-prose">{t("sources.body")}</p>

      <div className="hw-split">
        <figure className="hw-figure">
          <figcaption className="label">{t("sources.timelineCaption")}</figcaption>
          <SatelliteTimeline />
        </figure>

        <figure className="hw-figure">
          <figcaption className="label">{t("sources.pixelCaption")}</figcaption>
          <div className="hw-pixels">
            <div className="hw-pixel-modis" role="img" aria-label={t("sources.pixelModis")}>
              <span className="hw-pixel-viirs" />
            </div>
            <dl className="hw-pixel-key">
              <div>
                <dt data-family="modis" />
                <dd>{t("sources.pixelModis")}</dd>
              </div>
              <div>
                <dt data-family="viirs" />
                <dd>{t("sources.pixelViirs")}</dd>
              </div>
            </dl>
          </div>
        </figure>
      </div>

      <h3 className="hw-subhead">{t("sources.matrixTitle")}</h3>
      <div className="hw-matrix">
        <div className="hw-matrix-col" data-kind="record">
          <h4>{t("sources.colRecord")}</h4>
          <ul>
            {["recordModis", "recordViirs", "recordNoaa20"].map((key) => (
              <li key={key}>
                <strong>{t(`sources.${key}`)}</strong>
                <span>{t(`sources.${key}Note`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hw-matrix-col" data-kind="model">
          <h4>{t("sources.colModel")}</h4>
          <ul>
            {["modelFwi", "modelFires", "modelLand", "modelCalendar"].map((key) => (
              <li key={key}>
                <strong>{t(`sources.${key}`)}</strong>
                <span>{t(`sources.${key}Note`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hw-matrix-col" data-kind="map">
          <h4>{t("sources.colMap")}</h4>
          <ul className="hw-map-list">
            {["mapRain", "mapSoil", "mapGreen", "mapTemp", "mapLand", "mapDanger", "mapRecent"].map((key) => (
              <li key={key}>{t(`sources.${key}`)}</li>
            ))}
          </ul>
          <p className="hw-small">{t("sources.mapNote")}</p>
        </div>
      </div>
    </Section>
  );
}

/* 2. The fair record */

function Record({ t, fmt }: { t: T; fmt: Fmt }) {
  const max = Math.max(...sensorYears.map((y) => y.snpp));
  const h = (v: number) => `${(v / max) * 100}%`;
  const bg = conversion.rangeHeld.find((r) => r.country === "Bulgaria");
  const us = conversion.rangeHeld.find((r) => r.country === "United_States");
  const steps = [1, 2, 3, 4, 5];

  return (
    <Section id="record" t={t}>
      <p className="hw-prose">{t("record.body", { ratio: fmt.num(conversion.ratio, 1) })}</p>

      <figure className="hw-figure">
        <figcaption className="label">{t("record.chartCaption")}</figcaption>
        <div className="hw-legend">
          <span data-family="terra">{t("record.legendTerra")}</span>
          <span data-family="modis">{t("record.legendAqua")}</span>
          <span data-family="viirs">{t("record.legendSnpp")}</span>
        </div>
        <div className="hw-pairs">
          {sensorYears.map((y) => (
            <div key={y.year} className="hw-pair">
              <span className="hw-pair-ratio">{t("record.chartRatio", { ratio: fmt.num(y.ratio, 2) })}</span>
              <div className="hw-pair-bars">
                <div className="hw-stack" title={`MODIS ${fmt.num(y.terra + y.aqua, 2)} M`}>
                  <span className="hw-vbar" data-family="modis" style={{ height: h(y.aqua) }} />
                  <span className="hw-vbar" data-family="terra" style={{ height: h(y.terra) }} />
                </div>
                <div className="hw-stack" title={`VIIRS ${fmt.num(y.snpp, 2)} M`}>
                  <span className="hw-vbar" data-family="viirs" style={{ height: h(y.snpp) }} />
                </div>
              </div>
              <span className="hw-pair-values">
                {fmt.num(y.terra + y.aqua, 1)} · {fmt.num(y.snpp, 1)}
              </span>
              <span className="hw-pair-year">{y.year}</span>
            </div>
          ))}
        </div>
      </figure>

      <p className="hw-prose">{t("record.cellDay")}</p>
      <p className="hw-prose">
        {t("record.agreement", {
          pct: fmt.pct(conversion.agreement.diff_pct / 100, 0),
          from: conversion.agreement.years[0],
          to: conversion.agreement.years[1],
        })}
      </p>

      <h3 className="hw-subhead">{t("record.stepsTitle")}</h3>
      <ol className="hw-steps">
        {steps.map((n) => (
          <li key={n} className="hw-step">
            <span className="hw-step-num">{n}</span>
            <strong>{t(`record.step${n}Title`)}</strong>
            <p>
              {t(`record.step${n}`, { months: conversion.fitMonths, countries: conversion.countries })}
            </p>
            {n === 1 ? (
              <span className="hw-keys">
                <span>{t("record.keyCountry")}</span>×<span>{t("record.keyBand")}</span>×
                <span>{t("record.keyMonth")}</span>
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <h3 className="hw-subhead">{t("record.testTitle")}</h3>
      <div className="hw-stats">
        <div className="hw-stat">
          <strong>{fmt.pct(conversion.pooledForward)}</strong>
          <span>{t("record.statForward")}</span>
        </div>
        <div className="hw-stat">
          <strong>{fmt.pct(conversion.pooledReverse)}</strong>
          <span>{t("record.statReverse")}</span>
        </div>
        <div className="hw-stat">
          <strong>{fmt.pct(conversion.medianAll, 0)}</strong>
          <span>{t("record.statCountry", { n: conversion.scored })}</span>
          <span className="hw-small">
            {t("record.statCountryRange", {
              large: fmt.pct(conversion.medianLarge, 0),
              small: fmt.pct(conversion.medianSmall, 0),
            })}
          </span>
        </div>
        {bg && us ? (
          <div className="hw-stat">
            <strong>{fmt.pct(bg.observed / 100, 0)}</strong>
            <span>{t("record.statRange")}</span>
            <span className="hw-small">
              {t("record.statRangeValues", { bg: fmt.pct(bg.observed / 100, 1), us: fmt.pct(us.observed / 100, 1) })}
            </span>
          </div>
        ) : null}
      </div>
      <p className="hw-small">{t("record.errorNote")}</p>
    </Section>
  );
}

/* 3. The next-day model */

function Model({ t, fmt }: { t: T; fmt: Fmt }) {
  const featureCount = featureGroups.reduce((sum, g) => sum + g.features.length, 0);
  const inputs = ["Fwi", "Fires", "Land", "Place"];
  const days = ["dayEarlier", "D-4", "D-3", "D-2", "D-1", "D"];

  return (
    <Section id="model" t={t}>
      <p className="hw-prose">{t("model.body", { grid: fmt.num(gridDeg, 2) })}</p>

      <figure className="hw-figure">
        <figcaption className="label">{t("model.outlookName")}</figcaption>
        <div className="hw-flow">
          <div className="hw-flow-col">
            <h4>{t("model.colInputs")}</h4>
            {inputs.map((key) => (
              <div key={key} className="hw-node">
                <strong>{t(`model.in${key}`)}</strong>
                <span>{t(`model.in${key}Note`)}</span>
              </div>
            ))}
          </div>
          <div className="hw-flow-col">
            <h4>{t("model.colFeatures", { count: featureCount })}</h4>
            {featureGroups.map((group) => (
              <div key={group.id} className="hw-node">
                <strong>
                  {t(`model.f${group.id}`)} <em className="hw-count">{group.features.length}</em>
                </strong>
                <span>{t(`model.f${group.id}Note`)}</span>
              </div>
            ))}
          </div>
          <div className="hw-flow-col">
            <h4>{t("model.colModel")}</h4>
            <div className="hw-node hw-core">
              <strong>{t("model.lgbm")}</strong>
              <span className="hw-small">{t("model.lgbmVersion", { version: modelVersion.replace(/^lightgbm-/, "") })}</span>
              <span>{t("model.lgbmNote")}</span>
            </div>
          </div>
          <div className="hw-flow-col">
            <h4>{t("model.colMap")}</h4>
            <div className="hw-node">
              <strong>{t("model.outRank")}</strong>
              <span>{t("model.outRankNote")}</span>
            </div>
            <div className="hw-node">
              <strong>{t("model.outLevels")}</strong>
              <span className="hw-bands">
                {levelBands.map((band, i) => (
                  <span key={band} data-level={i + 1}>
                    {fmt.pct(band, 0)}
                  </span>
                ))}
              </span>
              <span>{t("model.outLevelsNote", { bands: levelBands.map((b) => fmt.pct(b, 0)).join(", ") })}</span>
            </div>
          </div>
        </div>
      </figure>

      <h3 className="hw-subhead">{t("model.timingTitle")}</h3>
      <p className="hw-prose">{t("model.timingBody")}</p>
      <div className="hw-timing" role="img" aria-label={t("model.timingBody")}>
        {days.map((day, i) => (
          <span key={day} className="hw-day-head" style={{ gridColumn: i + 2 }} data-day={day}>
            {day === "dayEarlier" ? t("model.dayEarlier") : day}
          </span>
        ))}
        <span className="hw-lane-name" style={{ gridRow: 2 }}>
          {t("model.laneHistory")}
        </span>
        <span className="hw-bar" data-kind="history" style={{ gridColumn: "2 / 3", gridRow: 2 }} />
        <span className="hw-lane-name" style={{ gridRow: 3 }}>
          {t("model.laneNearby")}
        </span>
        <span className="hw-bar" data-kind="nearby" style={{ gridColumn: "3 / 6", gridRow: 3 }} />
        <span className="hw-lane-name" style={{ gridRow: 4 }}>
          {t("model.laneWeather")}
        </span>
        <span className="hw-arrow" style={{ gridColumn: "4 / 8", gridRow: 4 }}>
          <span>{t("model.issued")}</span>
          <span>{t("model.validFor")}</span>
        </span>
        <span className="hw-gap" style={{ gridColumn: "6 / 7", gridRow: "2 / 5" }}>
          {t("model.notUsed")}
        </span>
        <span className="hw-target" style={{ gridColumn: "7 / 8", gridRow: "2 / 4" }}>
          {t("model.forecastDay")}
        </span>
        <span className="hw-cutoff" style={{ gridColumn: "6 / 8", gridRow: 5 }}>
          <span>{t("model.cutoff")}</span>
        </span>
      </div>

      <h3 className="hw-subhead">{t("model.splitTitle")}</h3>
      <div className="hw-year-split">
        <span data-kind="train">{t("model.splitTrain", { year: testYear - 1 })}</span>
        <span data-kind="tune">{t("model.splitTune", { year: testYear - 1 })}</span>
        <span data-kind="test">{t("model.splitTest", { year: testYear })}</span>
      </div>
    </Section>
  );
}

/* 4. How it compares */

function Compare({ t, fmt }: { t: T; fmt: Fmt }) {
  const gainMax = Math.ceil(Math.max(...gains.map((g) => g.high)) * 100 / 5) * 5;
  const gainMin = -2;
  const gx = (v: number) => `${((v * 100 - gainMin) / (gainMax - gainMin)) * 100}%`;
  const weekMax = Math.ceil(Math.max(...week.flatMap((w) => [w.world.model, w.world.history])) * 100 / 5) * 5;
  const ratio = capture.world.model / capture.world.fwi;

  return (
    <Section id="compare" t={t}>
      <p className="hw-prose">{t("compare.body", { year: testYear })}</p>

      <figure className="hw-figure">
        <figcaption className="label">{t("compare.chartCaption", { year: testYear })}</figcaption>
        <div className="hw-scopes">
          {scopes.map((scope) => {
            const top = Math.ceil(Math.max(...methodOrder.map((m) => capture[scope][m])) * 10) / 10;
            return (
              <div key={scope} className="hw-scope">
                <div className="hw-scope-head">
                  <strong>{t(`compare.${scope}`)}</strong>
                  <span className="hw-small">
                    {t("compare.scopeDetail", { days: fmt.num(regionDays[scope]), fires: fmt.num(newFires[scope]) })}
                  </span>
                </div>
                {methodOrder.map((m) => (
                  <div key={m} className="hw-hrow" data-method={m}>
                    <span className="hw-hlabel">{t(`compare.${m}`)}</span>
                    <span className="hw-htrack">
                      <span className="hw-hbar" style={{ width: `${(capture[scope][m] / top) * 100}%` }} />
                    </span>
                    <span className="hw-hvalue">{fmt.pct(capture[scope][m])}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </figure>

      <p className="hw-callout">
        {t("compare.headline", {
          year: testYear,
          ratio: fmt.num(ratio, 1),
          model: fmt.pct(capture.world.model),
          fwi: fmt.pct(capture.world.fwi),
        })}
      </p>
      <p className="hw-prose">{t("compare.randomNote", { random: fmt.pct(capture.europe.random) })}</p>
      <p className="hw-prose">
        {t("compare.hitRate", { europe: fmt.pct(hitRate.europe), world: fmt.pct(hitRate.world) })}
      </p>

      <h3 className="hw-subhead">{t("compare.gainTitle")}</h3>
      <p className="hw-prose">{t("compare.gainBody", { draws: fmt.num(bootstrapDraws) })}</p>
      <figure className="hw-figure">
        <div className="hw-gains">
          {gains.map((g) => (
            <div key={`${g.scope}-${g.against}`} className="hw-gain-row">
              <span className="hw-gain-label">
                {t("compare.gainRow", { scope: t(`compare.${g.scope}`), against: t(g.against === "fwi" ? "compare.vsFwi" : "compare.vsHistory") })}
              </span>
              <span className="hw-gain-track">
                <span className="hw-zero" style={{ left: gx(0) }} />
                <span className="hw-whisker" style={{ left: gx(g.low), width: `calc(${gx(g.high)} - ${gx(g.low)})` }} />
                <span className="hw-dot" style={{ left: gx(g.difference) }} />
              </span>
              <span className="hw-gain-value">
                {t("compare.gainValue", {
                  diff: fmt.num(g.difference * 100, 1),
                  low: fmt.num(g.low * 100, 1),
                  high: fmt.num(g.high * 100, 1),
                })}
              </span>
            </div>
          ))}
          <div className="hw-gain-axis" aria-hidden="true">
            <span />
            <span className="hw-gain-ticks">
              {[0, 5, 10, 15].filter((v) => v <= gainMax).map((v) => (
                <span key={v} style={{ left: gx(v / 100) }}>
                  {v}
                </span>
              ))}
            </span>
            <span className="hw-small">{t("compare.points")}</span>
          </div>
        </div>
      </figure>

      {week.length > 0 ? (
        <>
          <h3 className="hw-subhead">{t("compare.weekTitle")}</h3>
          <p className="hw-prose">{t("compare.weekBody", { year: testYear })}</p>
          <figure className="hw-figure">
            <figcaption className="label">{t("compare.weekCaption")}</figcaption>
            <div className="hw-legend">
              <span data-method="model">{t("compare.model")}</span>
              <span data-method="history">{t("compare.history")}</span>
            </div>
            <div className="hw-week">
              {week.map((w) => (
                <div key={w.lead} className="hw-week-group">
                  <div className="hw-week-bars">
                    <span className="hw-wbar" data-method="model" style={{ height: `${(w.world.model / (weekMax / 100)) * 100}%` }}>
                      <em>{fmt.pct(w.world.model)}</em>
                    </span>
                    <span className="hw-wbar" data-method="history" style={{ height: `${(w.world.history / (weekMax / 100)) * 100}%` }}>
                      <em>{fmt.pct(w.world.history)}</em>
                    </span>
                  </div>
                  <span className="hw-pair-year">{t("compare.lead", { n: w.lead })}</span>
                </div>
              ))}
            </div>
          </figure>
        </>
      ) : null}

      {dailyLog.length > 0 ? (
        <>
          <h3 className="hw-subhead">{t("compare.logTitle")}</h3>
          <p className="hw-prose">{t("compare.logBody")}</p>
          <table className="hw-log">
            <thead>
              <tr>
                <th scope="col">{t("compare.logDate")}</th>
                <th scope="col">{t("compare.logScope")}</th>
                <th scope="col">{t("compare.logFires")}</th>
                <th scope="col">{t("compare.logUs")}</th>
                <th scope="col">{t("compare.logIndex")}</th>
                <th scope="col">{t("compare.logRegions")}</th>
              </tr>
            </thead>
            <tbody>
              {dailyLog.map((row) => (
                <tr key={`${row.date}-${row.scope}`}>
                  <td>{row.date}</td>
                  <td>{t(`compare.${row.scope}`)}</td>
                  <td>{fmt.num(row.new_fires)}</td>
                  <td>
                    <strong>{fmt.num(row.captured_by_us)}</strong>
                  </td>
                  <td>{fmt.num(row.captured_by_index)}</td>
                  <td>{fmt.num(row.regions_scored)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h3 className="hw-subhead">{t("compare.publishedTitle")}</h3>
      <p className="hw-prose">{t("compare.publishedBody")}</p>
      <ul className="hw-published">
        {published.map((p) => (
          <li key={p.id}>
            <span className="hw-pub-figure">{p.figure ?? t(`compare.${p.id}Figure`)}</span>
            <span className="hw-pub-text">
              <strong>{t(`compare.${p.id}Name`)}</strong>
              <span className="hw-pub-measure">{t(`compare.${p.id}Measure`)}</span>
              <span>{t(`compare.${p.id}Note`)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="hw-prose">
        <Link href="/proof">{t("compare.proofLink")}</Link>
      </p>
    </Section>
  );
}

/* 5. Limits */

function Limits({ t, fmt }: { t: T; fmt: Fmt }) {
  return (
    <Section id="limits" t={t}>
      <ul className="hw-limits">
        <li>{t("limits.inputs")}</li>
        <li>{t("limits.grid")}</li>
        <li>{t("limits.city", { n: sofiaTimesHistory })}</li>
        <li>{t("limits.calibration", { predicted: fmt.pct(lowBin.predicted, 2), observed: fmt.pct(lowBin.observed, 2) })}</li>
        <li>
          {t("limits.continuing", {
            history: fmt.pct(continuing.europe.history),
            model: fmt.pct(continuing.europe.model),
          })}
        </li>
        <li>{t("limits.testYear", { year: testYear })}</li>
        <li>{t("limits.notOfficial")}</li>
      </ul>
    </Section>
  );
}
