"use client";

import { useTranslations } from "next-intl";
import type { MonthKey } from "@/components/report/types";
import { monthYearShort, type ReportLocale } from "@/components/report/lib/format";
import { encodeMonth } from "@/lib/ui/view-url";
import { monthRank } from "./adapter";
import styles from "./app-styles";

export interface DateRangeProps {
  /** Every month the record holds, in order. */
  months: MonthKey[];
  from: MonthKey;
  to: MonthKey;
  locale: ReportLocale;
  onChange: (from: MonthKey, to: MonthKey) => void;
  onReset: () => void;
}

/**
 * Two month pickers over the whole record. Picking a first month after the
 * last one moves the other end with it, so the range is never empty.
 */
export default function DateRange({
  months,
  from,
  to,
  locale,
  onChange,
  onReset,
}: DateRangeProps) {
  const t = useTranslations("app");

  function read(value: string): MonthKey | null {
    const found = months.find((month) => encodeMonth(month) === value);
    return found ?? null;
  }

  return (
    <section className={styles.range} aria-labelledby="report-range">
      <h2 className="rp-heading" id="report-range">
        {t("rangeHeading")}
      </h2>
      <div className={styles.rangeRow}>
        <label className={styles.rangeField}>
          <span className={styles.rangeLabel}>{t("rangeFrom")}</span>
          <select
            className={styles.select}
            name="range-from"
            value={encodeMonth(from)}
            onChange={(event) => {
              const next = read(event.target.value);
              if (next === null) return;
              onChange(next, monthRank(next) > monthRank(to) ? next : to);
            }}
          >
            {months.map((month) => (
              <option key={encodeMonth(month)} value={encodeMonth(month)}>
                {monthYearShort(month.y, month.m, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.rangeField}>
          <span className={styles.rangeLabel}>{t("rangeTo")}</span>
          <select
            className={styles.select}
            name="range-to"
            value={encodeMonth(to)}
            onChange={(event) => {
              const next = read(event.target.value);
              if (next === null) return;
              onChange(monthRank(next) < monthRank(from) ? next : from, next);
            }}
          >
            {months.map((month) => (
              <option key={encodeMonth(month)} value={encodeMonth(month)}>
                {monthYearShort(month.y, month.m, locale)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="rp-btn" onClick={onReset}>
          {t("rangeReset")}
        </button>
      </div>
      <p className="rp-sub">{t("rangeNote")}</p>
    </section>
  );
}
