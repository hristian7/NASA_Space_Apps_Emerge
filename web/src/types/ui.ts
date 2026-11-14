// Shared shapes between the screens (components) and the number logic (lib).
// Frozen: both sides import these and neither side edits this file.
// The rules behind every value are in docs/number-logic.md.

import type { FlagLabel, SrcLabel } from "./data";

/** Harmonized hotspots, or fire cell-days (see docs/data-contract.md, section 3.1). */
export type Unit = "hot" | "cd";

/** What the user picked. Longitude before latitude only inside `ring` (GeoJSON order). */
export type Selection =
  | { kind: "country"; iso3: string }
  | { kind: "point"; lat: number; lon: number; radiusKm: number }
  | { kind: "polygon"; ring: [lon: number, lat: number][] };

/** One month of one series. `value` null means no measurement; 0 means no fire seen. */
export interface MonthPoint {
  y: number;
  m: number;
  value: number | null;
  lo: number | null;
  hi: number | null;
  src: SrcLabel | null;
  flags: FlagLabel[];
}

/** A full monthly series for a selection: every month from Nov 2000 to the last data month. */
export interface Series {
  unit: Unit;
  months: MonthPoint[];
  /** Number of 0.25 degree cells that contribute (1 for a country file). */
  cellCount: number;
  /** True when the selection is smaller than one grid cell. */
  lowConfidence: boolean;
}

/** Raw counts per satellite for one month (country selections only). */
export interface SatelliteMonth {
  y: number;
  m: number;
  terra: number | null;
  aqua: number | null;
  snpp: number | null;
  noaa20: number | null;
  noaa21: number | null;
}

export type UnusualStatus = "above" | "near" | "below" | "no_history" | "too_early";

/** "Is this unusual?" for one month. */
export interface Unusual {
  status: UnusualStatus;
  value: number | null;
  median: number | null;
  mean: number | null;
  ratioMedian: number | null;
  ratioMean: number | null;
  /** Past years with a strictly lower value, out of `years`. */
  higherThan: number;
  years: number;
}

/** "Chance of fire this month": share of past years with fire, with a 90% Jeffreys range. */
export interface Chance {
  p: number | null;
  lo: number | null;
  hi: number | null;
  fireYears: number;
  years: number;
}

/** "This fire vs past fires": one row per year for the same calendar window. */
export interface WindowYear {
  year: number;
  hot: number | null;
  frp: number | null;
  estimated: boolean;
}

export interface WindowComparison {
  days: number;
  /** Last day of the window, as YYYY-MM-DD. */
  end: string;
  current: WindowYear;
  past: WindowYear[];
  /** 1 = highest. Ties share the better rank. Null when there is no past year. */
  rank: number | null;
  of: number;
}

export interface Trend {
  /** Change per year, in the series' unit, from a straight-line fit on complete years. */
  slopePerYear: number | null;
  /** The same change per decade as a share of the mean year. */
  perDecadeShare: number | null;
  years: number;
}

export interface Extremes {
  worstMonth: { y: number; m: number; value: number } | null;
  worstYear: { y: number; value: number } | null;
}
