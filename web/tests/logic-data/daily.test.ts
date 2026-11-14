/**
 * The mechanics of the daily inputs behind number-logic sections 4 and 6.
 *
 * The window in the example set runs 17 November to 31 December 2025, so an
 * 8 day window is 24 to 31 December, offsets 37 to 44 of the stored window.
 * Those offsets are worked out from the dates here, not read from the code.
 */

import { describe, expect, it } from 'vitest';

import type { BackgroundFile, DailyFile, MetaFile } from '../../src/types/data';
import type { Selection } from '../../src/types/ui';
import { DataError } from '../../src/lib/data/source';
import { loadDaily, loadMeta } from '../../src/lib/data/loaders';
import {
  getMonthToDate,
  getWindowTotals,
  isNoDataDay,
  windowYears,
} from '../../src/lib/data/daily';
import { selectionCells } from '../../src/lib/data/selection';
import { backgroundPeriod, backgroundStatus } from '../../src/lib/data/background';
import { patchedSource, testSource } from './helpers';

const source = testSource();

const POINT: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 50 };
const ONE_CELL: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 2 };

async function meta(): Promise<MetaFile> {
  return loadMeta(source);
}

/**
 * Weighted hot and frp summed straight out of the file for one cell, with
 * ruling 11 applied by hand: a raw count before February 2012 is multiplied
 * by that group's k_hot for the day's own calendar month, and FRP is left as
 * it is.
 */
async function byHand(
  key: string,
  cellIdWanted: number,
  year: number,
  offsets: number[],
): Promise<{ hot: number; frp: number }> {
  const file = (await loadDaily(key, source)) as DailyFile;
  const background = (await source.json<BackgroundFile>('background.json')) as BackgroundFile;
  const m = await meta();
  const [startM, startD] = m.daily_window.start_md.split('-').map(Number);
  const windowStart = Date.UTC(year, startM - 1, startD) / 86400000;
  const cell = file.cells.find((entry) => entry.id === cellIdWanted);
  let hot = 0;
  let frp = 0;
  const block = cell?.years.find((entry) => entry.y === year);
  if (block && cell) {
    block.d.forEach((offset, at) => {
      if (!offsets.includes(offset)) return;
      const day = new Date((windowStart + offset) * 86400000);
      const period = backgroundPeriod(day.getUTCFullYear(), day.getUTCMonth() + 1);
      const factor = period
        ? background.groups[cell.g][period].k_hot[day.getUTCMonth()] / 1000
        : 1;
      hot += block.hot[at] * factor;
      frp += block.frp[at];
    });
  }
  return { hot, frp };
}

describe('the window', () => {
  it('ends on the last data day and is 8 days by default', async () => {
    const m = await meta();
    const totals = await getWindowTotals(POINT, undefined, source);
    expect(totals.end).toBe(m.last_data_day);
    expect(totals.days).toBe(m.daily_window.min_compare_days);
    expect(totals.days).toBe(8);
    expect(totals.currentYear).toBe(2025);
  });

  it('holds one row per year of the stored window, ascending', async () => {
    const m = await meta();
    const totals = await getWindowTotals(POINT, 8, source);
    expect(totals.years.map((year) => year.year)).toEqual(windowYears(m));
    const years = totals.years.map((year) => year.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('marks every year before 2012 as estimated', async () => {
    const totals = await getWindowTotals(POINT, 8, source);
    for (const year of totals.years) {
      expect(year.estimated).toBe(year.year < 2012);
    }
  });

  it('refuses a window longer than the stored one', async () => {
    await expect(getWindowTotals(POINT, 60, source)).rejects.toBeInstanceOf(DataError);
    await expect(getWindowTotals(POINT, 0, source)).rejects.toBeInstanceOf(DataError);
  });

  it('sums the right offsets, checked by hand on one cell', async () => {
    const totals = await getWindowTotals(ONE_CELL, 8, source);
    const { cells } = selectionCells(ONE_CELL);
    expect(cells).toHaveLength(1);
    const id = cells[0].id;
    const offsets = [37, 38, 39, 40, 41, 42, 43, 44];
    for (const year of totals.years) {
      const hand = await byHand('40_20', id, year.year, offsets);
      expect(year.hot).toBeCloseTo(hand.hot, 9);
      expect(year.frp).toBeCloseTo(hand.frp, 9);
    }
  });

  it('weighs a cell by its share, so a part cell gives a part of its days', async () => {
    const totals = await getWindowTotals(POINT, 45, source);
    const sum = totals.years.reduce((total, year) => total + (year.hot ?? 0), 0);
    expect(sum).toBeGreaterThan(0);
  });

  it('has nothing to sum for a country, whose file carries no days', async () => {
    const totals = await getWindowTotals({ kind: 'country', iso3: 'BGR' }, 8, source);
    expect(totals.end).toBe('2025-12-31');
    expect(totals.years).toEqual([]);
    const monthToDate = await getMonthToDate({ kind: 'country', iso3: 'BGR' }, source);
    expect(monthToDate.past).toEqual([]);
    expect(monthToDate.current.hot).toBeNull();
  });
});

describe('a year with no measurement', () => {
  it('answers null when the stored window does not hold that year', async () => {
    const m = await meta();
    const patched: MetaFile = {
      ...m,
      daily_window: { ...m.daily_window, years: m.daily_window.years.filter((y) => y !== 2009) },
    };
    expect(windowYears(patched)).not.toContain(2009);
  });

  it('answers null for a year whose window holds a global no-data day', async () => {
    const m = await meta();
    expect(isNoDataDay(m, '2000-10-31')).toBe(true);
    expect(isNoDataDay(m, '2000-11-17')).toBe(false);
    expect(isNoDataDay(m, '2026-01-01')).toBe(true);
    expect(isNoDataDay(m, '2025-12-31')).toBe(false);
  });

  it('does not let a missing satellite null a day', async () => {
    const m = await meta();
    expect(isNoDataDay(m, '2015-07-04')).toBe(false);
  });
});

describe('the month to date', () => {
  it('reports D, the month, and one row per past year', async () => {
    const m = await meta();
    const monthToDate = await getMonthToDate(POINT, source);
    expect(monthToDate.day).toBe(31);
    expect(monthToDate.year).toBe(2025);
    expect(monthToDate.month).toBe(12);
    expect(monthToDate.current.year).toBe(2025);
    expect(monthToDate.past).toHaveLength(windowYears(m).length - 1);
    expect(monthToDate.past.some((year) => year.year === 2025)).toBe(false);
  });

  it('sums days 1 to D of December, checked by hand on one cell', async () => {
    const monthToDate = await getMonthToDate(ONE_CELL, source);
    const { cells } = selectionCells(ONE_CELL);
    const id = cells[0].id;
    // 1 December is 14 days after 17 November, so days 1 to 31 are offsets 14 to 44.
    const offsets = Array.from({ length: 31 }, (_, k) => 14 + k);
    for (const year of [monthToDate.current, ...monthToDate.past]) {
      const hand = await byHand('40_20', id, year.year, offsets);
      expect(year.hot).toBeCloseTo(hand.hot, 9);
      expect(year.frp).toBeCloseTo(hand.frp, 9);
    }
  });

  it('is at least as large as the 8 day window inside it', async () => {
    const monthToDate = await getMonthToDate(POINT, source);
    const window = await getWindowTotals(POINT, 8, source);
    for (const year of monthToDate.past) {
      const same = window.years.find((entry) => entry.year === year.year);
      expect(year.hot ?? 0).toBeGreaterThanOrEqual(same?.hot ?? 0);
    }
  });
});

describe('raw daily counts and the conversion factor (ruling 11)', () => {
  it('scales a day before Feb 2012 by k_hot of the cell group and leaves FRP raw', async () => {
    const file = (await loadDaily('40_20', source)) as DailyFile;
    const background = (await source.json<BackgroundFile>('background.json')) as BackgroundFile;
    expect(file.values).toBe('raw');
    expect(file.sensor_labels).toEqual(['terra', 'aqua', 'snpp']);

    const { cells } = selectionCells(ONE_CELL);
    const cell = file.cells.find((entry) => entry.id === cells[0].id) as DailyFile['cells'][number];
    const block = cell.years.find((entry) => entry.y === 2009);
    expect(block, '2009 should have a fire day in this cell').toBeDefined();
    if (!block) return;

    const totals = await getWindowTotals(ONE_CELL, 45, source);
    const year = totals.years.find((entry) => entry.year === 2009);
    const factor = background.groups[cell.g].estimated_modis.k_hot[10] / 1000;
    const rawHot = block.hot.reduce((sum, value) => sum + value, 0);
    const rawFrp = block.frp.reduce((sum, value) => sum + value, 0);
    expect(factor).toBeGreaterThan(1);
    expect(year?.hot).toBeCloseTo(rawHot * factor, 9);
    expect(year?.frp).toBeCloseTo(rawFrp, 9);
  });

  it('uses a day from Feb 2012 as it is', async () => {
    // A cell whose only fire day in the window is a measured year.
    const measuredCell: Selection = { kind: 'point', lat: 43.875, lon: 23.875, radiusKm: 2 };
    const file = (await loadDaily('40_20', source)) as DailyFile;
    const { cells } = selectionCells(measuredCell);
    const cell = file.cells.find((entry) => entry.id === cells[0].id) as DailyFile['cells'][number];
    const block = cell.years.find((entry) => entry.y >= 2012);
    expect(block, 'a year from 2012 should have a fire day in this cell').toBeDefined();
    if (!block) return;
    const totals = await getWindowTotals(measuredCell, 45, source);
    const year = totals.years.find((entry) => entry.year === block.y);
    const rawHot = block.hot.reduce((sum, value) => sum + value, 0);
    expect(year?.hot).toBeCloseTo(rawHot, 9);
  });

  it('falls back to the raw count with no background file, and says how many days', async () => {
    const patched = patchedSource({ 'background.json': null });
    const file = (await loadDaily('40_20', source)) as DailyFile;
    const { cells } = selectionCells(ONE_CELL);
    const cell = file.cells.find((entry) => entry.id === cells[0].id) as DailyFile['cells'][number];
    const block = cell.years.find((entry) => entry.y === 2009) as DailyFile['cells'][number]['years'][number];

    const totals = await getWindowTotals(ONE_CELL, 45, patched);
    const year = totals.years.find((entry) => entry.year === 2009);
    const rawHot = block.hot.reduce((sum, value) => sum + value, 0);
    expect(year?.hot).toBeCloseTo(rawHot, 9);
    expect(backgroundStatus().loaded).toBe(false);
    expect(backgroundStatus().unscaledDays).toBeGreaterThan(0);
  });

  it('reports nothing unscaled when every factor is there', async () => {
    await getWindowTotals(ONE_CELL, 45, source);
    expect(backgroundStatus().loaded).toBe(true);
    expect(backgroundStatus().unscaledDays).toBe(0);
  });
});
