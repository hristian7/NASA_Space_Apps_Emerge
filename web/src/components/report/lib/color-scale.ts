// The calendar's colour scales. Pure functions over the values already in the
// props: no statistic from docs/number-logic.md is produced here.

/** What a cell is, before any colour is chosen. M19 keeps these three apart. */
export type CellKind = "nodata" | "zero" | "value";

/** Four sequential steps, --ramp-0 to --ramp-3. */
export const RAMP_STEPS = 4;

/** Six diverging steps: three below the median, three above. */
export const ANOMALY_STEPS = 6;

export function cellKind(value: number | null): CellKind {
  if (value === null || !Number.isFinite(value)) {
    return "nodata";
  }
  return value === 0 ? "zero" : "value";
}

/**
 * Three break points that split the positive values into four groups of
 * roughly equal size. Zero and null take no part: they have their own look,
 * so letting them into the scale would waste a whole step on them.
 */
export function rampThresholds(values: (number | null)[]): number[] {
  const positive = values
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (positive.length === 0) {
    return [1, 2, 3];
  }

  const breaks: number[] = [];
  for (let step = 1; step < RAMP_STEPS; step += 1) {
    breaks.push(quantileSorted(positive, step / RAMP_STEPS));
  }

  // Equal counts can repeat a break when many values are identical. Nudging
  // each repeat up keeps the scale strictly rising, so a step never swallows
  // the one below it.
  for (let i = 1; i < breaks.length; i += 1) {
    if (breaks[i] <= breaks[i - 1]) {
      breaks[i] = breaks[i - 1] + 1;
    }
  }
  return breaks;
}

/** The share-th value of an already sorted list, interpolating between two. */
export function quantileSorted(sorted: number[], share: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, share));
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) {
    return sorted[low];
  }
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

/**
 * Which ramp step a positive value falls in, 0 to 3. A value equal to a break
 * belongs to the step above it.
 */
export function rampStep(value: number, thresholds: number[]): number {
  let step = 0;
  while (step < thresholds.length && value >= thresholds[step]) {
    step += 1;
  }
  return Math.min(step, RAMP_STEPS - 1);
}

/** The CSS variable for a cell, or null when the caller must draw a pattern. */
export function rampToken(kind: CellKind, step: number): string | null {
  if (kind === "nodata") {
    return null;
  }
  if (kind === "zero") {
    return "var(--empty)";
  }
  return `var(--ramp-${Math.min(RAMP_STEPS - 1, Math.max(0, step))})`;
}

/**
 * Where a ratio sits on the diverging scale, 0 to 5. The scale is symmetric in
 * the ratio's own terms: 0.5 and 2 are the same distance from 1, so a halving
 * and a doubling read as equally unusual.
 */
export const ANOMALY_BREAKS = [0.5, 0.8, 1, 1.25, 2] as const;

export function anomalyStep(ratio: number): number {
  let step = 0;
  while (step < ANOMALY_BREAKS.length && ratio >= ANOMALY_BREAKS[step]) {
    step += 1;
  }
  return Math.min(step, ANOMALY_STEPS - 1);
}

/** The CSS variable for an anomaly step, or null when there is no ratio. */
export function anomalyToken(ratio: number | null): string | null {
  if (ratio === null || !Number.isFinite(ratio)) {
    return null;
  }
  return `var(--anom-${anomalyStep(ratio)})`;
}
