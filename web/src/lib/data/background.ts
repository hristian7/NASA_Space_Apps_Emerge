/**
 * The background value a cell carries in a month it does not list, before
 * February 2012 (docs/number-logic.md section 9, ruling 10).
 *
 * Before the measured record starts, an unlisted cell-month is not a measured
 * zero: the converted series gives the cell's group a small value for that
 * calendar month and period. From February 2012 an unlisted month is 0,
 * because the reference sensor looked and saw nothing.
 *
 * The file is `background.json` at the data root, written by the pipeline:
 *
 *   {schema, example, built,
 *    groups: { "<group id>": { "estimated_terra": {hot, hot_hi, cd, cd_hi},
 *                              "estimated_modis": {...} } } }
 *
 * Each of those four is 12 numbers, one per calendar month, in whole
 * hundredths: 37 means 0.37. The lower end of the range is always 0.
 *
 * This type is declared here rather than in web/src/types/data.ts because
 * another stream owns that file; the two are reconciled when the contract
 * page carries the new file.
 */

import type { DataSource } from './source';
import { dataSource } from './source';

/** The two periods a background value exists for. */
export type BackgroundPeriod = 'estimated_terra' | 'estimated_modis';

/** Twelve monthly values per unit, in whole hundredths. */
export interface BackgroundValues {
  hot: number[];
  hot_hi: number[];
  cd: number[];
  cd_hi: number[];
}

export interface BackgroundFile {
  schema: string;
  example: boolean;
  built: string;
  groups: Record<string, Record<BackgroundPeriod, BackgroundValues>>;
}

/** First month index that is measured rather than converted: February 2012. */
export const FIRST_MEASURED_INDEX = (2012 - 2000) * 12 + 1;

/** Reads background.json. null when the file is not there. */
export function loadBackground(src?: DataSource): Promise<BackgroundFile | null> {
  return (src ?? dataSource()).json<BackgroundFile>('background.json');
}

/**
 * The period a month belongs to: Nov 2000 to Jun 2002 is converted from Terra
 * alone, Jul 2002 to Jan 2012 from Terra and Aqua together. A month from
 * Feb 2012 has no background period at all.
 */
export function backgroundPeriod(y: number, m: number): BackgroundPeriod | null {
  const key = y * 100 + m;
  if (key >= 200011 && key <= 200206) return 'estimated_terra';
  if (key >= 200207 && key <= 201201) return 'estimated_modis';
  return null;
}

/**
 * The background a cell takes in a month it does not list, as the value and
 * the upper end of its range. The lower end is always 0. null when there is
 * no background for that month, group or file.
 */
export function backgroundValue(
  file: BackgroundFile | null,
  group: string | null | undefined,
  y: number,
  m: number,
  unit: 'hot' | 'cd',
): { value: number; hi: number } | null {
  if (!file || !group) return null;
  const period = backgroundPeriod(y, m);
  if (!period) return null;
  const groupValues = file.groups[group];
  if (!groupValues) return null;
  const values = groupValues[period];
  if (!values) return null;
  const value = values[unit]?.[m - 1];
  const hi = values[unit === 'hot' ? 'hot_hi' : 'cd_hi']?.[m - 1];
  if (typeof value !== 'number' || typeof hi !== 'number') return null;
  return { value: value / 100, hi: hi / 100 };
}

/** What the last series run could and could not find. */
export interface BackgroundStatus {
  /** True when background.json was read. */
  loaded: boolean;
  /** Cells that carry no group id, so their background counted as 0. */
  cellsWithoutGroup: number;
  /** Group ids asked for that the file does not hold. */
  groupsNotFound: string[];
}

let status: BackgroundStatus = { loaded: false, cellsWithoutGroup: 0, groupsNotFound: [] };

/**
 * The state of the background after the last series run, so a screen can say
 * "background not loaded" instead of quietly showing zeros. A missing file is
 * never an error.
 */
export function backgroundStatus(): BackgroundStatus {
  return { ...status, groupsNotFound: [...status.groupsNotFound] };
}

export function setBackgroundStatus(next: BackgroundStatus): void {
  status = next;
}
