"use client";

import { useTranslations } from "next-intl";
import type { Series } from "@/types/ui";
import { sourceLabel } from "./lib/sentences";
import {
  formatCount,
  monthYearShort,
  type ReportLocale,
} from "./lib/format";
import styles from "./styles";

export interface DataTableProps {
  series: Series;
  locale: ReportLocale;
  newestFirst?: boolean;
  /** The accessible name, so this can stand in for the calendar. */
  label?: string;
}

/** The calendar's months as rows: the text alternative to the grid. */
export default function DataTable({
  series,
  locale,
  newestFirst = true,
  label,
}: DataTableProps) {
  const t = useTranslations("report");
  const unit = t(`unit.${series.unit}.short`);

  const rows = series.months
    .slice()
    .sort((a, b) =>
      newestFirst ? b.y - a.y || b.m - a.m : a.y - b.y || a.m - b.m,
    );

  return (
    <section className={styles.section} aria-labelledby="report-data-table">
      <h2 className={styles.heading} id="report-data-table">
        {label ?? t("table.heading")}
      </h2>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption>{t("table.caption", { unit })}</caption>
          <thead>
            <tr>
              <th scope="col">{t("table.month")}</th>
              <th scope="col">{unit}</th>
              <th scope="col">{t("table.low")}</th>
              <th scope="col">{t("table.high")}</th>
              <th scope="col">{t("table.source")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.y}-${row.m}`}>
                <th scope="row">{monthYearShort(row.y, row.m, locale)}</th>
                <td>
                  {row.value === null
                    ? t("table.noData")
                    : formatCount(row.value, locale)}
                </td>
                <td>
                  {row.lo === null
                    ? t("table.noData")
                    : formatCount(row.lo, locale)}
                </td>
                <td>
                  {row.hi === null
                    ? t("table.noData")
                    : formatCount(row.hi, locale)}
                </td>
                <td className={styles.flagEstimated}>
                  {sourceLabel(row.src, t)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.sub}>{t("table.zeroNote")}</p>
    </section>
  );
}
