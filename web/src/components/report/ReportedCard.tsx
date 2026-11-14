"use client";

import { useTranslations } from "next-intl";
import type { ReportedFile } from "@/types/data";
import type { Scope, YearTotal } from "./types";
import { formatCount, type ReportLocale } from "./lib/format";
import styles from "./styles";

export interface ReportedCardProps {
  /** null when no authority publishes figures for this place (M28). */
  reported: ReportedFile | null;
  /** Satellite yearly totals, to sit next to the reported ones. */
  satelliteYears: YearTotal[];
  scope: Scope;
  locale: ReportLocale;
  unitShortKey?: "cd" | "hot";
}

/** M28: official reported fires and burned area next to what satellites saw. */
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

  const satelliteByYear = new Map(
    satelliteYears.map((total) => [total.y, total]),
  );
  const years = reported.years
    .filter((row) => row.fires !== null || row.burned_ha !== null)
    .sort((a, b) => b.y - a.y);

  return (
    <section className={styles.section} aria-labelledby="report-reported">
      <h2 className={styles.heading} id="report-reported">
        {t("reported.heading")}
      </h2>
      {scope === "area" ? (
        <p className={styles.sub}>{t("reported.countryContext")}</p>
      ) : null}
      {years.length === 0 ? (
        <p className={styles.cardLine}>{t("reported.noYears")}</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption>
              {t("reported.caption", { source: reported.source.name })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("table.year")}</th>
                <th scope="col">{t("reported.fires")}</th>
                <th scope="col">{t("reported.burned")}</th>
                <th scope="col">{t(`unit.${unitShortKey}.short`)}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((row) => {
                const satellite = satelliteByYear.get(row.y);
                return (
                  <tr key={row.y}>
                    <th scope="row">{row.y}</th>
                    <td>
                      {row.fires === null
                        ? t("table.noData")
                        : formatCount(row.fires, locale)}
                    </td>
                    <td>
                      {row.burned_ha === null
                        ? t("table.noData")
                        : formatCount(row.burned_ha, locale)}
                    </td>
                    <td>
                      {satellite === undefined || satellite.value === null
                        ? t("table.noData")
                        : formatCount(satellite.value, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {reported.source.note === null ? null : (
        <p className={styles.sub}>{reported.source.note}</p>
      )}
      <p className={styles.sub}>{t("reported.notComparable")}</p>
    </section>
  );
}
