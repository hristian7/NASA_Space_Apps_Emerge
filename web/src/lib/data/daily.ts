/**
 * The daily inputs behind docs/number-logic.md sections 4 and 6, as plain
 * numbers. The ranking and the status words belong to another module.
 *
 * Rulings applied (number-logic section 9):
 *  - A past year's window is the `days` consecutive days ending on the same
 *    month and day as the current window's end, so every window has exactly
 *    `days` days. An end on 29 Feb maps to 28 Feb in a year without one.
 *  - A window that crosses 1 Jan is labelled by the year of its last day.
 *
 * The daily files carry hot and frp only, never cd, so both answers here are
 * in those two units.
 */

import type { DailyCell, DailyFile, DailyYear, MetaFile } from '../../types/data';
import type { Selection, WindowYear } from '../../types/ui';

import { DataError, DataSource } from './source';
import { loadDailyTiles, loadMeta } from './loaders';
import { selectionCells, tilesForSelection, type WeightedCell } from './selection';

/** One year's window of days, as calendar dates. */
export interface WindowDates {
  /** The year that labels the window: the year of its last day. */
  label: number;
  /** First day, as YYYY-MM-DD. */
  start: string;
  /** Last day, as YYYY-MM-DD. */
  end: string;
  /** Every day of the window, ascending, exactly `days` of them. */
  days: string[];
  /** True for a year before 2012, where the numbers are converted. */
  estimated: boolean;
}

/** Everything section 6 needs before the ranking. */
export interface WindowTotals {
  /** Length of the window in days. */
  days: number;
  /** First day of the current window, as YYYY-MM-DD. */
  start: string;
  /** Last day of the window, as YYYY-MM-DD. */
  end: string;
  /** The year that labels the current window: the year of its last day. */
  currentYear: number;
  /** Every year the daily window is held for, ascending, current one included. */
  years: WindowYear[];
}

/** Everything section 4 needs before the comparison. */
export interface MonthToDate {
  /** D: the day of the month of the last data day. */
  day: number;
  /** The month being compared. */
  year: number;
  month: number;
  /** Days 1 to D of the current month. */
  current: WindowYear;
  /** The same days 1 to D of that month in each past year, ascending. */
  past: WindowYear[];
}

const MS_PER_DAY = 86400000;

interface YMD {
  y: number;
  m: number;
  d: number;
}

function parseDate(iso: string): YMD {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(date: YMD): string {
  return `${date.y}-${pad2(date.m)}-${pad2(date.d)}`;
}

function dayNumber(date: YMD): number {
  return Date.UTC(date.y, date.m - 1, date.d) / MS_PER_DAY;
}

function fromDayNumber(n: number): YMD {
  const at = new Date(n * MS_PER_DAY);
  return { y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate() };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The same month and day in another year, with 29 Feb falling back to 28 Feb. */
function sameDayInYear(month: number, day: number, year: number): YMD {
  const limit = daysInMonth(year, month);
  return { y: year, m: month, d: day > limit ? limit : day };
}

/** True when a day has no measurement at all, per meta's global no-data periods. */
export function isNoDataDay(meta: MetaFile, iso: string): boolean {
  for (const period of meta.no_data) {
    if (period.scope !== 'global') continue;
    // A scatter of single days (a day count with a wide range) does not say
    // which days, so no single day can be marked from it. The satellite-scope
    // periods are the raw columns, not the harmonized value.
    if (period.days !== null) continue;
    const from = period.from ?? '0000-01-01';
    const to = period.to ?? '9999-12-31';
    if (from <= iso && iso <= to) return true;
  }
  return false;
}

interface WindowFiles {
  meta: MetaFile;
  files: DailyFile[];
  cells: WeightedCell[];
  /** The weighted cells that appear in a daily file. */
  found: { weight: number; cell: DailyCell }[];
  /**
   * False for a country selection. The daily window is stored per cell and a
   * country file holds no days, so there is nothing to sum and the answer is
   * no years at all rather than a row of zeros.
   */
  hasCells: boolean;
}

async function dailyInputs(selection: Selection, src?: DataSource): Promise<WindowFiles> {
  const meta = await loadMeta(src);
  if (selection.kind === 'country') {
    return { meta, files: [], cells: [], found: [], hasCells: false };
  }
  const wanted = tilesForSelection(selection);
  const keys = meta.daily.length > 0 ? wanted.filter((key) => meta.daily.includes(key)) : wanted;
  const files = await loadDailyTiles(keys, src);
  const { cells } = selectionCells(selection);
  const byId = new Map<number, DailyCell>();
  for (const file of files) {
    for (const cell of file.cells) byId.set(cell.id, cell);
  }
  const found: { weight: number; cell: DailyCell }[] = [];
  for (const weighted of cells) {
    const cell = byId.get(weighted.id);
    if (cell) found.push({ weight: weighted.weight, cell });
  }
  return { meta, files, cells, found, hasCells: true };
}

/**
 * The year block that holds a date, as the daily files key them: the year the
 * file's own window starts in. A window that wraps is labelled by its last
 * day, so the label year is one ahead of the block year.
 */
function blockYear(meta: MetaFile, labelYear: number): number {
  return meta.daily_window.wraps_year ? labelYear - 1 : labelYear;
}

/** Day 0 of a year block: start_md of that block's year. */
function blockStart(meta: MetaFile, block: number): YMD {
  const [m, d] = meta.daily_window.start_md.split('-').map(Number);
  return { y: block, m, d };
}

/** The label years the daily window is held for, ascending. */
export function windowYears(meta: MetaFile): number[] {
  const shift = meta.daily_window.wraps_year ? 1 : 0;
  return meta.daily_window.years.map((block) => block + shift).sort((a, b) => a - b);
}

function yearBlock(cell: DailyCell, block: number): DailyYear | null {
  for (const entry of cell.years) {
    if (entry.y === block) return entry;
  }
  return null;
}

/**
 * Weighted hot and frp over a run of days, or null when any of those days has
 * no measurement: a day outside the stored window, or a day inside a global
 * no-data period, or a label year the window is not held for.
 */
function sumDays(
  input: WindowFiles,
  labelYear: number,
  dates: YMD[],
): { hot: number; frp: number } | null {
  const { meta } = input;
  if (!input.hasCells) return null;
  if (!windowYears(meta).includes(labelYear)) return null;
  const block = blockYear(meta, labelYear);
  const zero = dayNumber(blockStart(meta, block));
  const offsets: number[] = [];
  for (const date of dates) {
    if (isNoDataDay(meta, toIso(date))) return null;
    const offset = dayNumber(date) - zero;
    if (offset < 0 || offset >= meta.daily_window.days) return null;
    offsets.push(offset);
  }

  let hot = 0;
  let frp = 0;
  for (const { weight, cell } of input.found) {
    const entry = yearBlock(cell, block);
    if (!entry) continue;
    const at = new Map<number, number>();
    entry.d.forEach((offset, position) => at.set(offset, position));
    for (const offset of offsets) {
      const position = at.get(offset);
      if (position === undefined) continue;
      hot += weight * entry.hot[position];
      frp += weight * entry.frp[position];
    }
  }
  return { hot, frp };
}

function windowDates(end: YMD, days: number): YMD[] {
  const last = dayNumber(end);
  const dates: YMD[] = [];
  for (let k = days - 1; k >= 0; k -= 1) dates.push(fromDayNumber(last - k));
  return dates;
}

/**
 * The window of one year, from the current window's end date (section 9,
 * ruling 5): the `days` consecutive days ending on the same month and day,
 * with 29 February falling back to 28 February in a year without one. The
 * label is the year of the last day, so a window crossing 1 January is
 * labelled by the later year (ruling 6).
 */
export function pastWindow(currentEnd: string, days: number, labelYear: number): WindowDates {
  const end = parseDate(currentEnd);
  const yearEnd = sameDayInYear(end.m, end.d, labelYear);
  const dates = windowDates(yearEnd, days);
  return {
    label: labelYear,
    start: toIso(dates[0]),
    end: toIso(dates[dates.length - 1]),
    days: dates.map(toIso),
    estimated: labelYear < 2012,
  };
}

function asWindowYear(
  labelYear: number,
  totals: { hot: number; frp: number } | null,
): WindowYear {
  return {
    year: labelYear,
    hot: totals ? totals.hot : null,
    frp: totals ? totals.frp : null,
    estimated: labelYear < 2012,
  };
}

/**
 * Section 6's input: the window ends on the last data day and covers `days`
 * calendar days; every past year gets the same `days` days ending on the same
 * month and day. A year with any no-data day in its window answers null, so
 * the ranking can leave it out.
 */
export async function getWindowTotals(
  selection: Selection,
  days?: number,
  src?: DataSource,
): Promise<WindowTotals> {
  const input = await dailyInputs(selection, src);
  const meta = input.meta;
  const length = days ?? meta.daily_window.min_compare_days;
  if (!Number.isInteger(length) || length < 1) {
    throw new DataError('parse', 'meta.json', `a window of ${String(days)} days is not a window`);
  }
  if (length > meta.daily_window.days) {
    throw new DataError(
      'parse',
      'meta.json',
      `the daily files hold ${meta.daily_window.days} days, so a ${length} day window cannot be summed`,
    );
  }

  const end = parseDate(meta.last_data_day);
  const currentYear = end.y;
  const current = pastWindow(meta.last_data_day, length, currentYear);
  const years: WindowYear[] = [];
  if (input.hasCells) {
    for (const labelYear of windowYears(meta)) {
      const dates = pastWindow(meta.last_data_day, length, labelYear).days.map(parseDate);
      years.push(asWindowYear(labelYear, sumDays(input, labelYear, dates)));
    }
  }

  return { days: length, start: current.start, end: meta.last_data_day, currentYear, years };
}

/**
 * Section 4's input: D is the day of the month of the last data day, the
 * current value sums days 1 to D of that month, and every past year gets the
 * same days 1 to D of the same month. A past year's month shorter than D
 * (29 February) stops at its own last day.
 */
export async function getMonthToDate(
  selection: Selection,
  src?: DataSource,
): Promise<MonthToDate> {
  const input = await dailyInputs(selection, src);
  const meta = input.meta;
  const end = parseDate(meta.last_data_day);

  const forYear = (labelYear: number): WindowYear => {
    const limit = Math.min(end.d, daysInMonth(labelYear, end.m));
    const dates: YMD[] = [];
    for (let d = 1; d <= limit; d += 1) dates.push({ y: labelYear, m: end.m, d });
    return asWindowYear(labelYear, sumDays(input, labelYear, dates));
  };

  const past: WindowYear[] = [];
  if (input.hasCells) {
    for (const labelYear of windowYears(meta)) {
      if (labelYear === end.y) continue;
      past.push(forYear(labelYear));
    }
  }

  return { day: end.d, year: end.y, month: end.m, current: forYear(end.y), past };
}
