"use client";

import { useTranslations } from "next-intl";
import type { SatelliteMonth } from "@/types/ui";
import {
  formatCount,
  monthYearShort,
  type ReportLocale,
} from "./lib/format";
import styles from "./styles";

const SATELLITES = ["terra", "aqua", "snpp", "noaa20", "noaa21"] as const;

export interface SatelliteTableProps {
  months: SatelliteMonth[];
  locale: ReportLocale;
  /** Newest first when true. */
  newestFirst?: boolean;
}

/** Raw counts, as each satellite measured them: no conversion applied. */
export default function SatelliteTable({
  months,
  locale,
  newestFirst = true,
}: SatelliteTableProps) {
  const t = useTranslations("report");

  const rows = months
    .slice()
    .sort((a, b) =>
      newestFirst ? b.y - a.y || b.m - a.m : a.y - b.y || a.m - b.m,
    );

  if (rows.length === 0) {
    return (
      <section className={styles.section} aria-labelledby="report-satellites">
        <h2 className={styles.heading} id="report-satellites">
          {t("satellites.heading")}
        </h2>
        <p className={styles.cardLine}>{t("satellites.countryOnly")}</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="report-satellites">
      <h2 className={styles.heading} id="report-satellites">
        {t("satellites.heading")}
      </h2>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption>{t("satellites.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("table.month")}</th>
              {SATELLITES.map((satellite) => (
                <th key={satellite} scope="col">
                  {t(`satellites.${satellite}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.y}-${row.m}`}>
                <th scope="row">{monthYearShort(row.y, row.m, locale)}</th>
                {SATELLITES.map((satellite) => (
                  <td key={satellite}>
                    {row[satellite] === null
                      ? t("table.noData")
                      : formatCount(row[satellite], locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.sub}>{t("satellites.note")}</p>
    </section>
  );
}
