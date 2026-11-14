"use client";

import { useTranslations } from "next-intl";
import type { ReportedFile } from "@/types/data";
import type { Scope, YearTotal } from "./types";
import { seriesViews, type SeriesView } from "@/components/app/reported";
import { formatCount, formatIsoDate, type ReportLocale } from "./lib/format";
import styles from "./styles";

export interface ReportedCardProps {
  /** null when nobody publishes figures for this place (M28). */
  reported: ReportedFile | null;
  /** Satellite yearly totals, to sit next to the published ones. */
  satelliteYears: YearTotal[];
  scope: Scope;
  locale: ReportLocale;
  unitShortKey?: "cd" | "hot";
}

/**
 * M28: what people publish about fires here, next to what the satellites saw.
 *
 * Each series stands under its own label, because a count of fires from a
 * national authority, an area mapped from satellite images, and our own
 * detections are three different measures. Only the first is "reported".
 */
export default function ReportedCard({
  reported,
  satelliteYears,
  scope,
  locale,
  unitShortKey = "cd",
}: ReportedCardProps) {
  const t = useTranslations("report");

  if (reported === null) {
    return (
      <section className={styles.card} aria-labelledby="report-reported">
        <h2 className={styles.heading} id="report-reported">
          {t("reported.heading")}
        </h2>
        <p className={styles.cardLine}>{t("reported.none")}</p>
      </section>
    );
  }

  const views = seriesViews(reported);
  const ours = satelliteYears
    .filter((total) => total.value !== null)
    .sort((a, b) => b.y - a.y);

  return (
    <section className={styles.section} aria-labelledby="report-reported">
      <h2 className={styles.heading} id="report-reported">
        {t("reported.heading")}
      </h2>
      {scope === "area" ? (
        <p className={styles.sub}>{t("reported.countryContext")}</p>
      ) : null}

      {!views.some((view) => view.kind === "national_report") ? (
        <p className={styles.cardLine}>{t("reported.none")}</p>
      ) : null}

      {views.length === 0 ? (
        <p className={styles.cardLine}>{t("reported.noYears")}</p>
      ) : (
        views.map((view, at) => (
          <Series
            key={`${view.kind}-${view.name}-${at}`}
            view={view}
            locale={locale}
            t={t}
          />
        ))
      )}

      <OurDetections
        ours={ours}
        locale={locale}
        t={t}
        unitShortKey={unitShortKey}
      />
      <p className={styles.sub}>{t("reported.notComparable")}</p>
    </section>
  );
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** One published series: what it is, who made it, and its years. */
function Series({
  view,
  locale,
  t,
}: {
  view: SeriesView;
  locale: ReportLocale;
  t: Translate;
}) {
  const national = view.kind === "national_report";
  const latest = view.latest;

  return (
    <div className={styles.card} data-kind={view.kind}>
      <h3 className={styles.heading}>
        {national ? t("reported.kindNational") : t("reported.kindEstimate")}
      </h3>
      <p className={styles.sub}>{view.name}</p>

      {latest === null ? null : (
        <p className={styles.cardLine}>
          {t("reported.latest", {
            year: latest.y,
            fires:
              latest.fires === null
                ? t("table.noData")
                : formatCount(latest.fires, locale),
            burned:
              latest.burned_ha === null
                ? t("table.noData")
                : formatCount(latest.burned_ha, locale),
          })}
        </p>
      )}

      {view.oneYear ? (
        <p className={styles.sub}>{t("reported.oneYear", { year: view.span?.[0] ?? "" })}</p>
      ) : view.span === null ? null : (
        <p className={styles.sub}>
          {t("reported.covers", { first: view.span[0], last: view.span[1] })}
        </p>
      )}

      {view.years.length <= 1 ? null : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("table.year")}</th>
                <th scope="col">
                  {national ? t("reported.fires") : t("reported.firesMapped")}
                </th>
                <th scope="col">
                  {national ? t("reported.burned") : t("reported.burnedMapped")}
                </th>
              </tr>
            </thead>
            <tbody>
              {view.years.map((row) => (
                <tr key={row.y}>
                  <th scope="row">{row.y}</th>
                  <td className={styles.num}>
                    {row.fires === null
                      ? t("table.noData")
                      : formatCount(row.fires, locale)}
                  </td>
                  <td className={styles.num}>
                    {row.burned_ha === null
                      ? t("table.noData")
                      : formatCount(row.burned_ha, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view.note === null ? null : <p className={styles.sub}>{view.note}</p>}
      <p className={styles.sub}>
        {view.url === null ? null : (
          <a href={view.url} target="_blank" rel="noreferrer">
            {t("reported.sourceLink")}
          </a>
        )}
        {view.url === null || view.fetched === null ? null : " · "}
        {view.fetched === null
          ? null
          : t("reported.fetched", { date: formatIsoDate(view.fetched, locale) })}
      </p>
    </div>
  );
}

/** Our own detections, stated as a different measure from the figures above. */
function OurDetections({
  ours,
  locale,
  t,
  unitShortKey,
}: {
  ours: YearTotal[];
  locale: ReportLocale;
  t: Translate;
  unitShortKey: "cd" | "hot";
}) {
  const unit = t(`unit.${unitShortKey}.short`);
  const latest = ours[0];

  return (
    <div className={styles.card} data-kind="detections">
      <h3 className={styles.heading}>{t("reported.kindOurs")}</h3>
      <p className={styles.sub}>{t("reported.oursNote", { unit })}</p>
      {latest === undefined || latest.value === null ? (
        <p className={styles.cardLine}>{t("reported.noYears")}</p>
      ) : (
        <>
          <p className={styles.cardLine}>
            {t("reported.oursLatest", {
              year: latest.y,
              value: formatCount(latest.value, locale),
              unit,
            })}
          </p>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("table.year")}</th>
                  <th scope="col">{unit}</th>
                </tr>
              </thead>
              <tbody>
                {ours.map((row) => (
                  <tr key={row.y}>
                    <th scope="row">{row.y}</th>
                    <td className={styles.num}>
                      {formatCount(row.value, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
