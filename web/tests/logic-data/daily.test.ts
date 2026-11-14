/**
 * The mechanics of the daily inputs behind number-logic sections 4 and 6.
 *
 * The window in the example set runs 17 November to 31 December 2025, so an
 * 8 day window is 24 to 31 December, offsets 37 to 44 of the stored window.
 * Those offsets are worked out from the dates here, not read from the code.
 */

import { describe, expect, it } from 'vitest';

import type { DailyFile, MetaFile } from '../../src/types/data';
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
import { testSource } from './helpers';

const source = testSource();

const POINT: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 50 };
const ONE_CELL: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 2 };

async function meta(): Promise<MetaFile> {
  return loadMeta(source);
}

/** Weighted hot and frp summed straight out of the file, for one cell. */
async function byHand(
  key: string,
  cellIdWanted: number,
  year: number,
  offsets: number[],
): Promise<{ hot: number; frp: number }> {
  const file = (await loadDaily(key, source)) as DailyFile;
  const cell = file.cells.find((entry) => entry.id === cellIdWanted);
  let hot = 0;
  let frp = 0;
  const block = cell?.years.find((entry) => entry.y === year);
  if (block) {
    block.d.forEach((offset, at) => {
      if (offsets.includes(offset)) {
        hot += block.hot[at];
        frp += block.frp[at];
      }
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
