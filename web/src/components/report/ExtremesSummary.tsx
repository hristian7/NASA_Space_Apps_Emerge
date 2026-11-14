"use client";

import { useTranslations } from "next-intl";
import type { Extremes, Trend } from "@/types/ui";
import {
  formatCount,
  formatPercent,
  formatSigned,
  monthYearLong,
  type ReportLocale,
} from "./lib/format";
import styles from "./report.module.css";

export interface ExtremesSummaryProps {
  extremes: Extremes;
  trend: Trend;
  locale: ReportLocale;
  unitShortKey?: "cd" | "hot";
}

/** M4's summary statistics: worst month, worst year, trend. */
export default function ExtremesSummary({
  extremes,
  trend,
  locale,
  unitShortKey = "cd",
}: ExtremesSummaryProps) {
  const t = useTranslations("report");
  const unit = t(`unit.${unitShortKey}.short`);

  return (
    <div className={styles.cards}>
      <section className={styles.card} aria-labelledby="report-worst-month">
        <h2 className={styles.heading} id="report-worst-month">
          {t("extremes.worstMonth")}
        </h2>
        {extremes.worstMonth === null ? (
          <p className={styles.cardLine}>{t("extremes.none")}</p>
        ) : (
          <>
            <p className={styles.cardFigure}>
              {formatCount(extremes.worstMonth.value, locale)}
            </p>
            <p className={styles.cardLine}>
              {monthYearLong(
                extremes.worstMonth.y,
                extremes.worstMonth.m,
                locale,
              )}
              {` · ${unit}`}
            </p>
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="report-worst-year">
        <h2 className={styles.heading} id="report-worst-year">
          {t("extremes.worstYear")}
        </h2>
        {extremes.worstYear === null ? (
          <p className={styles.cardLine}>{t("extremes.none")}</p>
        ) : (
          <>
            <p className={styles.cardFigure}>
              {formatCount(extremes.worstYear.value, locale)}
            </p>
            <p className={styles.cardLine}>
              {extremes.worstYear.y}
              {` · ${unit}`}
            </p>
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="report-trend">
        <h2 className={styles.heading} id="report-trend">
          {t("extremes.trend")}
        </h2>
        {trend.slopePerYear === null ? (
          <p className={styles.cardLine}>
            {t("extremes.trendTooShort", {
              years: formatCount(trend.years, locale),
            })}
          </p>
        ) : (
          <>
            <p className={styles.cardFigure}>
              {trend.perDecadeShare === null
                ? formatSigned(trend.slopePerYear, locale)
                : formatPercent(trend.perDecadeShare, locale)}
            </p>
            <p className={styles.cardLine}>
              {trend.perDecadeShare === null
                ? t("extremes.trendPerYear", { unit })
                : t("extremes.trendPerDecade")}
            </p>
            <p className={styles.sub}>
              {t("extremes.trendBase", {
                years: formatCount(trend.years, locale),
                perYear: formatSigned(trend.slopePerYear, locale),
                unit,
              })}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
