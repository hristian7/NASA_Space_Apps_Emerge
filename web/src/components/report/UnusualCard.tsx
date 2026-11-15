"use client";

import { useTranslations } from "next-intl";
import type { Unusual } from "@/types/ui";
import { unusualFigure, unusualText } from "./lib/sentences";
import { monthYearLong, type ReportLocale } from "./lib/format";
import TermTip from "./TermTip";
import styles from "./styles";
import Roll from "@/components/ui/roll";

export interface UnusualCardProps {
  unusual: Unusual;
  /** The month the figure belongs to. */
  year: number;
  month: number;
  locale: ReportLocale;
  /** True for the month that has not finished yet (M5's month to date). */
  monthToDate?: boolean;
}

export default function UnusualCard({
  unusual,
  year,
  month,
  locale,
  monthToDate = false,
}: UnusualCardProps) {
  const t = useTranslations("report");
  const text = unusualText(unusual, month, { t, locale });
  const figure = unusualFigure(unusual, locale);
  const showsRatio =
    unusual.ratioMedian !== null &&
    unusual.value !== 0 &&
    unusual.status !== "no_history" &&
    unusual.status !== "too_early";

  return (
    <section className={styles.card} aria-labelledby="report-unusual">
      <h2 className={styles.heading} id="report-unusual">
        {t("unusual.heading")}
      </h2>
      <p className={styles.sub}>
        {monthYearLong(year, month, locale)}
        {monthToDate ? ` · ${t("unusual.monthToDate")}` : ""}
      </p>
      {figure === "" ? null : (
        <p
          className={`${styles.cardFigure} ${unusual.status === "above" ? styles.cardFigureUp : ""}`}
        >
          <Roll value={showsRatio ? t("unusual.timesShort", { ratio: figure }) : figure} />
        </p>
      )}
      <p className={styles.cardLine}>{text.headline}</p>
      <ul className={styles.cardList}>
        {text.clauses.map((clause) => (
          <li key={clause}>{clause}</li>
        ))}
      </ul>
      <p className={styles.sub}>
        <TermTip term="anomaly" />
      </p>
    </section>
  );
}
