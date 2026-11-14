// Plain summing of the months already in the props, so a calendar row and a
// trend chart can show a year total. No rule from docs/number-logic.md runs
// here: no median, no fit, no interval. Anything that needs a rule arrives as
// a prop from the number logic instead.

import type { MonthPoint, Series } from "@/types/ui";
import type { YearTotal } from "../types";
import { isEstimated } from "./sentences";

export function yearTotalsFromMonths(months: MonthPoint[]): YearTotal[] {
  const order: number[] = [];
  const byYear = new Map<number, MonthPoint[]>();

  for (const month of months) {
    const held = byYear.get(month.y);
    if (held === undefined) {
      byYear.set(month.y, [month]);
      order.push(month.y);
    } else {
      held.push(month);
    }
  }

  return order.map((year) => {
    const rows = byYear.get(year) ?? [];
    let value = 0;
    let lo = 0;
    let hi = 0;
    let complete = rows.length === 12;
    let estimated = false;

    for (const row of rows) {
      if (row.value === null) {
        complete = false;
        continue;
      }
      value += row.value;
      lo += row.lo ?? row.value;
      hi += row.hi ?? row.value;
      if (isEstimated(row.src)) {
        estimated = true;
      }
    }

    const measured = rows.some((row) => row.value !== null);
    return {
      y: year,
      value: measured ? value : null,
      lo: measured ? lo : null,
      hi: measured ? hi : null,
      estimated,
      complete,
    };
  });
}

export function yearTotalsFromSeries(series: Series): YearTotal[] {
  return yearTotalsFromMonths(series.months);
}

/** Every year present in the series, in order. */
export function yearsOf(months: MonthPoint[]): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  for (const month of months) {
    if (!seen.has(month.y)) {
      seen.add(month.y);
      order.push(month.y);
    }
  }
  return order;
}

/** A lookup from "y-m" to the month, so a grid can fill gaps with no data. */
export function monthIndex(months: MonthPoint[]): Map<string, MonthPoint> {
  const index = new Map<string, MonthPoint>();
  for (const month of months) {
    index.set(`${month.y}-${month.m}`, month);
  }
  return index;
}

export function monthKey(y: number, m: number): string {
  return `${y}-${m}`;
}

/** Cumulative totals require every month from January, including measured zeros. */
export function cumulativeSeason(series: Series, year: number, lastDataDay: string) {
  const [endYear, endMonth, endDay] = lastDataDay.split("-").map(Number);
  const completeMonth = endDay >= new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate() ? endMonth : endMonth - 1;
  const limit = year < endYear ? 12 : year === endYear ? completeMonth : 0;
  const index = monthIndex(series.months);
  const pastYears = yearsOf(series.months).filter((y) => y < year);
  const sums = new Map<number, number | null>();
  for (const y of [year, ...pastYears]) sums.set(y, 0);
  return Array.from({ length: Math.max(0, limit) }, (_, i) => {
    const month = i + 1;
    for (const y of sums.keys()) {
      const previous = sums.get(y) ?? null;
      const value = index.get(monthKey(y, month))?.value ?? null;
      sums.set(y, previous === null || value === null ? null : previous + value);
    }
    const values = pastYears.map((y) => sums.get(y) ?? null).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median = values.length === 0 ? null : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    return { month, current: sums.get(year) ?? null, median };
  });
}
