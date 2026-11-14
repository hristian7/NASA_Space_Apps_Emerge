/**
 * background.json: what a cell is worth in a month it does not list, and the
 * factor that turns a raw daily count into a harmonized one.
 *
 * Two rules live here, both from docs/number-logic.md section 9:
 *  - Ruling 10, monthly. Before February 2012 the old sensors often saw
 *    nothing where the newer one would have seen fire, so a month a cell does
 *    not list takes its group's background for that calendar month and
 *    period, with a lower end of 0. From February 2012 an unlisted month is 0.
 *  - Ruling 11, daily. A day before February 2012 holds one older sensor's
 *    raw count, so it is multiplied by that group's k_hot for the day's
 *    calendar month and period. No background is ever added to a daily value
 *    and FRP is never converted.
 *
 * The background arrays are whole hundredths (37 means 0.37) and the factor
 * arrays whole thousandths (2700 means 2.7). A group id is opaque: it is
 * looked up and never taken apart.
 *
 * A missing file is not an error. Every lookup then answers null, the callers
 * fall back to 0 for a background and to the raw value for a factor, and
 * backgroundStatus() says so, so a screen can tell the reader instead of
 * quietly showing numbers that are too low.
 */

import type { BackgroundFile, BackgroundPeriod, BackgroundSeries } from '../../types/data';

import type { DataSource } from './source';
import { dataSource } from './source';

export type { BackgroundFile, BackgroundPeriod, BackgroundSeries };

/** First month index that is measured rather than converted: February 2012. */
export const FIRST_MEASURED_INDEX = (2012 - 2000) * 12 + 1;

/** Reads background.json. null when the file is not there. */
export function loadBackground(src?: DataSource): Promise<BackgroundFile | null> {
  return (src ?? dataSource()).json<BackgroundFile>('background.json');
}

/**
 * The period a month belongs to: Nov 2000 to Jun 2002 is converted from Terra
 * alone, Jul 2002 to Jan 2012 from Terra and Aqua together. A month from
 * February 2012 has no background and needs no factor.
 */
export function backgroundPeriod(y: number, m: number): BackgroundPeriod | null {
  const key = y * 100 + m;
  if (key >= 200011 && key <= 200206) return 'estimated_terra';
  if (key >= 200207 && key <= 201201) return 'estimated_modis';
  return null;
}

function seriesFor(
  file: BackgroundFile | null,
  group: string | null | undefined,
  y: number,
  m: number,
): BackgroundSeries | null {
  if (!file || !group) return null;
  const period = backgroundPeriod(y, m);
  if (!period) return null;
  const forGroup = file.groups[group];
  if (!forGroup) return null;
  return forGroup[period] ?? null;
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
  const series = seriesFor(file, group, y, m);
  if (!series) return null;
  const value = series[unit]?.[m - 1];
  const hi = series[unit === 'hot' ? 'hot_hi' : 'cd_hi']?.[m - 1];
  if (typeof value !== 'number' || typeof hi !== 'number') return null;
  return { value: value / 100, hi: hi / 100 };
}

/**
 * The factor a raw daily count is multiplied by (ruling 11), or null when the
 * day needs none (February 2012 onward) or the factor is not in the file. A
 * caller that gets null for a day before February 2012 is using a raw count
 * and says so through backgroundStatus().
 */
export function conversionFactor(
  file: BackgroundFile | null,
  group: string | null | undefined,
  y: number,
  m: number,
  unit: 'hot' | 'cd',
): number | null {
  const series = seriesFor(file, group, y, m);
  if (!series) return null;
  const thousandths = series[unit === 'hot' ? 'k_hot' : 'k_cd']?.[m - 1];
  if (typeof thousandths !== 'number' || thousandths <= 0) return null;
  return thousandths / 1000;
}

/** What the last series or daily run could and could not find. */
export interface BackgroundStatus {
  /** True when background.json was read. */
  loaded: boolean;
  /** Cells that carry no group id, so their background counted as 0. */
  cellsWithoutGroup: number;
  /** Group ids asked for that the file does not hold. */
  groupsNotFound: string[];
  /**
   * Daily values before February 2012 used raw because no factor was found.
   * Above 0 means the pre-2012 part of the daily window reads too low.
   */
  unscaledDays: number;
}

const EMPTY: BackgroundStatus = {
  loaded: false,
  cellsWithoutGroup: 0,
  groupsNotFound: [],
  unscaledDays: 0,
};

let status: BackgroundStatus = EMPTY;

/**
 * The state of the background after the last run that used it, so a screen
 * can say "background not loaded" instead of quietly showing zeros or
 * unscaled counts. A missing file is never an error.
 */
export function backgroundStatus(): BackgroundStatus {
  return { ...status, groupsNotFound: [...status.groupsNotFound] };
}

export function setBackgroundStatus(next: Partial<BackgroundStatus>): void {
  status = { ...EMPTY, ...next, groupsNotFound: [...(next.groupsNotFound ?? [])] };
}
