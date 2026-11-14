"use client";

import { useTranslations } from "next-intl";
import type { WindowComparison, WindowYear } from "@/types/ui";
import { windowRankText } from "./lib/sentences";
import {
  formatCount,
  formatIsoDate,
  type ReportLocale,
} from "./lib/format";
import styles from "./report.module.css";

export interface WindowCardProps {
  comparison: WindowComparison;
  locale: ReportLocale;
}

/** M27: the last days against the same calendar days in every past year. */
export default function WindowCard({ comparison, locale }: WindowCardProps) {
  const t = useTranslations("report");

  const rows: WindowYear[] = [comparison.current, ...comparison.past].sort(
    (a, b) => b.year - a.year,
  );
  const max = Math.max(
    1,
    ...rows.map((row) => (row.hot === null ? 0 : row.hot)),
  );

  return (
    <section className={styles.section} aria-labelledby="report-window">
      <h2 className={styles.heading} id="report-window">
        {t("window.heading", { days: formatCount(comparison.days, locale) })}
      </h2>
      <p className={styles.cardLine}>{windowRankText(comparison, { t, locale })}</p>
      <p className={styles.sub}>
        {t("window.endsOn", { date: formatIsoDate(comparison.end, locale) })}
      </p>
      <div className={styles.bars} role="list" aria-label={t("window.chartLabel")}>
        {rows.map((row) => {
          const current = row.year === comparison.current.year;
          const missing = row.hot === null;
          const label = missing
            ? t("window.yearNoData", { year: row.year })
            : t("window.yearValue", {
                year: row.year,
                value: formatCount(row.hot, locale),
                unit: t("unit.hot.short"),
              });
          return (
            <div
              key={row.year}
              className={styles.barRow}
              role="listitem"
              aria-label={`${label}${row.estimated ? `, ${t("source.estimated")}` : ""}`}
            >
              <span
                className={`${styles.barLabel} ${row.estimated ? styles.barLabelEstimated : ""}`}
              >
                {row.year}
              </span>
              <span className={styles.barTrack}>
                <span
                  className={`${styles.barFill} ${current ? styles.barFillCurrent : ""} ${row.estimated ? styles.barFillEstimated : ""}`}
                  style={{
                    width: missing
                      ? "0%"
                      : `${Math.max(1, ((row.hot ?? 0) / max) * 100)}%`,
                  }}
                />
              </span>
              <span className={styles.barValue}>
                {missing ? t("table.noData") : formatCount(row.hot, locale)}
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.sub}>{t("window.estimatedNote")}</p>
    </section>
  );
}
