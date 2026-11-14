/**
 * "Chance of fire this month" (docs/number-logic.md section 5).
 *
 * The share of past years whose month `m` held fire, with the 90% Jeffreys
 * range: the 5% and 95% points of Beta(fireYears + 0.5, years - fireYears + 0.5).
 */

import type { Chance, Series } from "../../types/ui";
import { betaQuantile } from "./beta";

/** A year counts as a fire year at this value or above (number-logic 5, our choice). */
export const FIRE_THRESHOLD = 0.5;

/** Lower point of the range. */
export const RANGE_LO = 0.05;

/** Upper point of the range. */
export const RANGE_HI = 0.95;

/** Counts of past years and fire years for month `m` before year `y`. */
export function fireYearCounts(series: Series, m: number, y: number): { years: number; fireYears: number } {
  let years = 0;
  let fireYears = 0;
  for (const point of series.months) {
    if (point.m !== m || point.y >= y) continue;
    if (point.value === null) continue;
    years += 1;
    if (point.value >= FIRE_THRESHOLD) fireYears += 1;
  }
  return { years, fireYears };
}

/** The Jeffreys range for `fireYears` out of `years`. Null ends when there is no year at all. */
export function jeffreysRange(fireYears: number, years: number): { lo: number | null; hi: number | null } {
  if (years <= 0) return { lo: null, hi: null };
  const a = fireYears + 0.5;
  const b = years - fireYears + 0.5;
  const lo = fireYears === 0 ? 0 : betaQuantile(a, b, RANGE_LO);
  const hi = fireYears === years ? 1 : betaQuantile(a, b, RANGE_HI);
  return { lo, hi };
}

/** Section 5, for month `m` of year `y` of a monthly series. */
export function chance(series: Series, m: number, y: number): Chance {
  const { years, fireYears } = fireYearCounts(series, m, y);
  const { lo, hi } = jeffreysRange(fireYears, years);
  return {
    p: years === 0 ? null : fireYears / years,
    lo,
    hi,
    fireYears,
    years,
  };
}
