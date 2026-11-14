"use client";

import { useTranslations } from "next-intl";
import type { Chance } from "@/types/ui";
import { chanceText } from "./lib/sentences";
import { formatCount, monthLong, type ReportLocale } from "./lib/format";
import styles from "./report.module.css";

export interface ChanceCardProps {
  chance: Chance;
  month: number;
  locale: ReportLocale;
  /**
   * M13: for a country or an area wider than about 50 km the share is near
   * 100%, so the caller passes the expected number of fire days instead and
   * the card shows that figure. Computed by the number logic, never here.
   */
  expectedFireDays?: number | null;
  largeArea?: boolean;
}

export default function ChanceCard({
  chance,
  month,
  locale,
  expectedFireDays = null,
  largeArea = false,
}: ChanceCardProps) {
  const t = useTranslations("report");
  const text = chanceText(chance, month, { t, locale });
  const showsExpected = largeArea && expectedFireDays !== null;

  return (
    <section className={styles.card} aria-labelledby="report-chance">
      <h2 className={styles.heading} id="report-chance">
        {showsExpected ? t("chance.headingExpected") : t("chance.heading")}
      </h2>
      <p className={styles.sub}>{monthLong(month, locale)}</p>
      {showsExpected ? (
        <>
          <p className={styles.cardFigure}>
            {formatCount(expectedFireDays, locale)}
          </p>
          <p className={styles.cardLine}>
            {t("chance.expectedDetail", { month: monthLong(month, locale) })}
          </p>
        </>
      ) : (
        <>
          {text.figure === "" ? null : (
            <p className={styles.cardFigure}>{text.figure}</p>
          )}
          {text.range === "" ? null : (
            <p className={`${styles.cardLine} ${styles.num}`}>{text.range}</p>
          )}
        </>
      )}
      <p className={styles.cardLine}>{text.detail}</p>
    </section>
  );
}
