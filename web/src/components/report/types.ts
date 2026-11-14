// Shapes the report panel needs that web/src/types/ui.ts does not carry.
// That file is frozen, so these live here. Presentational only: nothing in
// this folder applies a rule from docs/number-logic.md.

/**
 * What the unit toggle reports. "cd" and "hot" match Unit in types/ui.ts;
 * "sat" draws the raw per-satellite table; "anomaly" recolours the calendar
 * from ratios the caller computed.
 */
export type UnitMode = "cd" | "hot" | "sat" | "anomaly";

/** One month's ratio to its own median, computed by the number logic. */
export interface AnomalyPoint {
  y: number;
  m: number;
  /** value / median for this calendar month. null when there is no median. */
  ratio: number | null;
}

/** One year of a series, summed for display. */
export interface YearTotal {
  y: number;
  value: number | null;
  lo: number | null;
  hi: number | null;
  /** True when any month of the year came from a conversion rather than VIIRS. */
  estimated: boolean;
  /** False when a month of the year has no measurement at all. */
  complete: boolean;
}

/** Whether the selection is a whole country or a smaller area. */
export type Scope = "country" | "area";

/** A month the user can select. */
export interface MonthKey {
  y: number;
  m: number;
}

/**
 * The subset of next-intl's `t` the pure helpers use. Injecting it keeps the
 * sentence builders testable without a React tree.
 */
export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;
