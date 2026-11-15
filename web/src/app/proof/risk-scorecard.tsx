"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { brierSkill, claimAllowed, dailyWindow, loadScorecard, methods, weakSlices, type Aggregate, type Metric, type RiskScorecard, type Selection } from "./risk-data";
import styles from "./risk-scorecard.module.css";

type Translate = ReturnType<typeof useTranslations>;

function Comparison({ row, selection, title, t, number }: {
  row: Aggregate; selection?: Selection; title: string; t: Translate;
  number: (value: Metric | undefined, percent?: boolean) => string;
}) {
  return <table>
    <caption>{title}</caption>
    <thead><tr>{["methodLabel", "capture", "hit", "lift", ...(selection ? ["brier"] : [])].map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
    <tbody>{methods.map(method => <tr key={method}>
      <th scope="row">{t(method)}</th>
      <td className="num">{number(row.methods[method]?.capture_rate, true)}</td>
      <td className="num">{number(row.methods[method]?.hit_rate, true)}</td>
      <td className="num">{number(row.methods[method]?.lift_over_random)}</td>
      {selection ? <td className="num">{method === "fwi" || method === "random" ? t("noProbability") : number(brierSkill(selection, method))}</td> : null}
    </tr>)}</tbody>
  </table>;
}

export default function RiskScorecardSection() {
  const t = useTranslations("proof-risk");
  const locale = useLocale();
  const [state, setState] = useState<{ card: RiskScorecard | null; status: "loading" | "ready" | "failed" }>({ card: null, status: "loading" });
  useEffect(() => {
    let live = true;
    const example = new URLSearchParams(window.location.search).get("risk") === "example";
    loadScorecard(example).then(card => {
      if (live) setState({ card: card && example ? { ...card, example: true } : card, status: "ready" });
    }, () => { if (live) setState({ card: null, status: "failed" }); });
    return () => { live = false; };
  }, []);
  const number = (value: Metric | undefined, percent = false) => typeof value !== "number" || !Number.isFinite(value)
    ? t("empty") : new Intl.NumberFormat(locale, { maximumFractionDigits: percent ? 1 : 3, ...(percent ? { style: "percent" } : {}) }).format(value);
  const points = (value: Metric) => typeof value === "number" ? number(value * 100) : t("empty");
  const card = state.card;

  return <section className={styles.scorecard} id="next-day-risk" data-testid="proof-risk">
    <h2>{t("title")}</h2>
    <p>{t("experimental")}</p>
    {!card ? <p role="status">{t(state.status === "loading" ? "loading" : state.status === "failed" ? "failed" : "absent")}</p> : <>
      {card.example ? <p className="box" data-testid="proof-risk-example">{t("example")}</p> : null}
      {Object.keys(card.scopes).length === 0 ? <p>{t("absent")}</p> : null}
      {Object.entries(card.scopes).map(([scopeName, scope]) => {
        const year = scope.years[String(card.test_year)];
        return <section key={scopeName}>
          <h3>{t("scope", { scope: ["europe", "world"].includes(scopeName) ? t(scopeName) : scopeName, year: String(card.test_year), grid: number(scope.grid_g) })}</h3>
          <p>{t("period", { first: year.first_day, last: year.last_day, days: number(year.weather_days) })}</p>
          {Object.keys(year.selections).length === 0 ? <p>{t("notTested")}</p> : null}
          {Object.entries(year.selections).map(([name, selection]) => {
            const model = selection.pooled.methods.model;
            const measured = typeof model?.capture_rate === "number";
            const coverage = selection.coverage;
            const weak = weakSlices(selection);
            const slices = [...Object.values(selection.months), ...Object.values(selection.regions)];
            return <section key={name} data-testid={`risk-selection-${scopeName}-${name}`}>
              <h4>{["forest_wildland", "all_vegetation", "forest_only", "other_vegetation"].includes(name) ? t(name) : name.replaceAll("_", " ")}</h4>
              <div className="box" data-testid="risk-verdict">
                <p>{measured ? t("modelVerdict", { capture: number(model.capture_rate, true), hit: number(model.hit_rate, true) }) : t("notTested")}</p>
                {measured ? <ul>{methods.filter(method => method !== "model").map(baseline => <li key={baseline}>
                  {t(claimAllowed(card, scope, selection, baseline) ? "claim" : "noClaim", { baseline: t(baseline) })}
                </li>)}</ul> : null}
                {measured ? <p>{t("claimRule")}</p> : null}
              </div>
              <p>{t("method")}</p>
              <Comparison row={selection.pooled} selection={selection} title={t("sample", { days: number(selection.pooled.region_days), fires: number(selection.pooled.new_fires) })} t={t} number={number} />
              <ul>{methods.filter(method => method !== "model").map(baseline => {
                const boot = selection.bootstrap[baseline];
                return <li key={baseline}>{measured && boot ? t("difference", { baseline: t(baseline), difference: points(boot.difference), low: points(boot.interval_95[0]), high: points(boot.interval_95[1]), draws: number(boot.valid_draws) }) : t("noBootstrap", { baseline: t(baseline) })}</li>;
              })}</ul>
              <p>{t("coverage", { scored: number(coverage.scored_spot_days), eligible: number(coverage.eligible_spot_days), fires: number(coverage.scored_new_fires), allFires: number(coverage.eligible_new_fires), excluded: number(coverage.eligible_spot_days - coverage.scored_spot_days), missingFires: number(coverage.eligible_new_fires - coverage.scored_new_fires), days: number(selection.region_days_without_scores) })}</p>
              <p>{t("probabilityCoverage", { count: number(selection.probability.n) })}</p>
              {(["regions_under_20", "regions_20_or_more"] as const).map((key, index) => <section key={key}>
                <h4>{t(index === 0 ? "small" : "large")}</h4>
                <Comparison row={selection[key]} title={t("sample", { days: number(selection[key].region_days), fires: number(selection[key].new_fires) })} t={t} number={number} />
              </section>)}
              {selection.continuing ? <section>
                <h4>{t("continuing")}</h4>
                <p>{t("continuingSample", { days: number(selection.continuing.region_days), fires: number(selection.continuing.fires) })}</p>
                <ul>{methods.map(method => <li key={method}>{t("continuingRate", { method: t(method), capture: number(selection.continuing?.methods[method]?.capture_rate, true) })}</li>)}</ul>
              </section> : null}
              <section data-testid="risk-weak-slices">
                <h4>{t("weak")}</h4>
                <p>{t("weakIntro")}</p>
                <p>{t("sliceCoverage", { missing: number(slices.filter(row => typeof row.methods.model?.capture_rate !== "number").length), total: number(slices.length) })}</p>
                {!measured ? <p>{t("noSlices")}</p> : weak.length === 0 ? <p>{t("noWeak")}</p> : <ul>{weak.map(({kind,name: sliceName,row}) => <li key={`${kind}-${sliceName}`}>
                  {t("weakRow", { kind: t(kind), name: sliceName, model: number(row.methods.model?.capture_rate, true), fwi: number(row.methods.fwi?.capture_rate, true), history: number(row.methods.history?.capture_rate, true), random: number(row.methods.random?.capture_rate, true) })}
                </li>)}</ul>}
              </section>
            </section>;
          })}
        </section>;
      })}
    </>}
    <section data-testid="risk-daily-log">
      <h3>{t("dailyTitle")}</h3>
      <p>{t("dailyExplanation")}</p>
      {card ? ([7, 30] as const).map(days => {
        const rows = dailyWindow(card.daily_log ?? [], days);
        const count = new Set(rows.map(row => row.date)).size;
        return <section key={days}>
          <h4>{t("dailyWindow", { days })}</h4>
          {count < days ? <p>{t("dailyShort", { count })}</p> : null}
          {rows.length === 0 ? <p>{t("dailyEmpty")}</p> : <table className="dailyTable">
            <caption>{t("dailyCounts")}</caption>
            <thead><tr>{["dailyDate", "dailyScope", "dailyFires", "dailyModel", "dailyIndex", "dailyRegions"].map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={`${row.date}-${row.scope}`}>
              <th scope="row">{row.date}</th><td>{t(row.scope)}</td>
              <td>{number(row.new_fires)}</td><td>{number(row.captured_by_us)}</td>
              <td>{number(row.captured_by_index)}</td><td>{number(row.regions_scored)}</td>
            </tr>)}</tbody>
          </table>}
        </section>;
      }) : null}
    </section>
  </section>;
}
