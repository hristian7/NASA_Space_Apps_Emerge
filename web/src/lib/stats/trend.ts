/**
 * Trend and extremes (docs/number-logic.md section 7).
 *
 * A year counts only when all 12 of its months have a measurement, so a year
 * with a satellite gap never drags the line down.
 */

import type { Extremes, Series, Trend } from "../../types/ui";
import { mean, olsSlope } from "./numbers";

/** Fewer complete years than this gives a null slope (number-logic 7, our choice). */
export const MIN_TREND_YEARS = 5;

/** Months in a complete year. */
const MONTHS_IN_YEAR = 12;

export interface YearTotal {
  y: number;
  total: number;
}

/** Yearly totals for the years where every one of the 12 months has a measurement. */
export function completeYearTotals(series: Series): YearTotal[] {
  const counts = new Map<number, { months: Set<number>; total: number }>();
  for (const point of series.months) {
    if (point.value === null) continue;
    let entry = counts.get(point.y);
    if (!entry) {
      entry = { months: new Set<number>(), total: 0 };
      counts.set(point.y, entry);
    }
    if (entry.months.has(point.m)) continue;
    entry.months.add(point.m);
    entry.total += point.value;
  }
  const totals: YearTotal[] = [];
  for (const [y, entry] of counts) {
    if (entry.months.size === MONTHS_IN_YEAR) totals.push({ y, total: entry.total });
  }
  totals.sort((a, b) => a.y - b.y);
  return totals;
}

/** Section 7: a straight-line fit of yearly total on year, over complete years only. */
export function trend(series: Series): Trend {
  const totals = completeYearTotals(series);
  const years = totals.length;
  if (years < MIN_TREND_YEARS) {
    return { slopePerYear: null, perDecadeShare: null, years };
  }
  const slope = olsSlope(
    totals.map((t) => t.y),
    totals.map((t) => t.total),
  );
  const avg = mean(totals.map((t) => t.total));
  const perDecadeShare = slope === null || avg === null || avg === 0 ? null : (10 * slope) / avg;
  return { slopePerYear: slope, perDecadeShare, years };
}

/** Section 7: the highest month and the highest complete year. Ties go to the earliest. */
export function extremes(series: Series): Extremes {
  let worstMonth: Extremes["worstMonth"] = null;
  for (const point of series.months) {
    if (point.value === null) continue;
    const earlier =
      worstMonth !== null &&
      point.value === worstMonth.value &&
      (point.y < worstMonth.y || (point.y === worstMonth.y && point.m < worstMonth.m));
    if (worstMonth === null || point.value > worstMonth.value || earlier) {
      worstMonth = { y: point.y, m: point.m, value: point.value };
    }
  }

  let worstYear: Extremes["worstYear"] = null;
  for (const entry of completeYearTotals(series)) {
    if (worstYear === null || entry.total > worstYear.value) {
      worstYear = { y: entry.y, value: entry.total };
    }
  }

  return { worstMonth, worstYear };
}
