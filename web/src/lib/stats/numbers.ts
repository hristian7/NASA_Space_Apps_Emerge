/**
 * Small numeric helpers shared by the statistics functions.
 *
 * Pure functions. Relative imports only: the vitest config carries no path
 * alias, so "@/..." would not resolve in the test runner.
 */

/** Mean of a list. Null for an empty list. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Median of a list. Even counts take the average of the two middle values. Null for an empty list. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Ordinary least squares slope of y on x. Null when fewer than two distinct x values. */
export function olsSlope(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  if (mx === null || my === null) return null;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    sxy += dx * (ys[i] - my);
    sxx += dx * dx;
  }
  if (sxx === 0) return null;
  return sxy / sxx;
}
