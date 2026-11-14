/**
 * The independent expected answers.
 *
 * tests/expected/logic/ was written by another agent from the same frozen
 * rules, before this code was checked against it. Nothing here is adjusted to
 * match our output and no expected value is edited: a difference is a failure
 * of our code until the director rules otherwise.
 *
 * Three of those files belong to this stream and are read here as they are:
 *   selection_weights.json  input is the selection; expected carries cells
 *                           (id, weight, subcells), cellCount, totalWeight,
 *                           rawTotalWeightBeforeSmallRule, lowConfidence. One
 *                           case instead probes that the point's own cell is
 *                           always in the set.
 *   series_cases.json       input.selection; expected carries cellCount,
 *                           lowConfidence, seriesLength, firstMonth,
 *                           lastMonth, weights, months (by "YYYY-MM", per
 *                           unit), october_2000, sumOfAllMonths_x625,
 *                           monthsWithZeroValue and noNullMonths.
 *   daily_cases.json        three shapes: a window (selection, days,
 *                           lastDataDay), a month to date (selection,
 *                           lastDataDay) and a pure window mapping (end,
 *                           days, pastYear).
 *
 * The other case files in that folder belong to the statistics stream, and
 * the rank, of and status fields inside these three are theirs too, so they
 * are left to it.
 *
 * If the folder is missing this file fails loudly rather than skipping,
 * because a skipped oracle is a false pass.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Selection, Unit } from '../../src/types/ui';
import { cellId } from '../../src/lib/data/cell';
import { getSeries } from '../../src/lib/data/series';
import { loadMeta as getMeta, loadTiles } from '../../src/lib/data/loaders';
import { getMonthToDate, getWindowTotals, pastWindow } from '../../src/lib/data/daily';
import { selectionCells, tilesForSelection } from '../../src/lib/data/selection';
import { LOGIC_DIR, metaWith, patchedSource, testSource } from './helpers';

const source = testSource();
const PREFIXES = ['selection_', 'series_', 'daily_'];
const UNITS: Unit[] = ['hot', 'cd'];

type Json = Record<string, unknown>;

interface Case {
  name: string;
  input: Json;
  expected: Json;
}

function files(): string[] {
  if (!existsSync(LOGIC_DIR)) return [];
  return readdirSync(LOGIC_DIR)
    .filter((name) => name.endsWith('.json') && PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();
}

function casesOf(file: string): Case[] {
  const raw = JSON.parse(readFileSync(path.join(LOGIC_DIR, file), 'utf-8')) as {
    cases: Case[];
  };
  return raw.cases;
}

/** Equal to six decimals, with null kept apart from 0. */
function same(actual: number | null | undefined, wanted: unknown, label: string): void {
  if (wanted === null) {
    expect(actual, `${label} should be null`).toBeNull();
    return;
  }
  expect(actual, `${label} should be a number`).not.toBeNull();
  expect(actual as number, label).toBeCloseTo(wanted as number, 6);
}

const found = files();

describe('the independent expected answers', () => {
  it('are in the repository', () => {
    expect(
      found.length,
      `expected answers not found: no selection_, series_ or daily_ case files under ${LOGIC_DIR}`,
    ).toBeGreaterThan(0);
  });

  it('cover the three files this stream answers for', () => {
    expect(found).toContain('selection_weights.json');
    expect(found).toContain('series_cases.json');
    expect(found).toContain('daily_cases.json');
  });
});

/* ----------------------------------------------------------- section 1 */

describe('selection_weights.json', () => {
  const cases = casesOf('selection_weights.json');

  it('holds cases', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(c.name, () => {
      if ('probes' in c.input) {
        const probes = c.input.probes as [number, number][];
        const radii = c.input.radiiKm as number[];
        let count = 0;
        for (const [lat, lon] of probes) {
          for (const radiusKm of radii) {
            const selection: Selection = { kind: 'point', lat, lon, radiusKm };
            const result = selectionCells(selection);
            const own = cellId(lat, lon);
            expect(
              result.cells.some((cell) => cell.id === own),
              `the cell holding ${lat}, ${lon} should be in the set at ${radiusKm} km`,
            ).toBe(c.expected.ownCellAlwaysInSet);
            count += 1;
          }
        }
        expect(count, 'number of probes').toBe(c.expected.probeCount);
        return;
      }

      const selection = c.input as unknown as Selection;
      const result = selectionCells(selection);
      const wantedCells = c.expected.cells as { id: number; weight: number; subcells: number }[];

      expect(result.cells.map((cell) => cell.id), 'cell ids in order').toEqual(
        wantedCells.map((cell) => cell.id),
      );
      for (const wanted of wantedCells) {
        const mine = result.cells.find((cell) => cell.id === wanted.id);
        same(mine?.weight, wanted.weight, `weight of cell ${wanted.id}`);
        expect(
          Math.round((mine?.weight ?? 0) * 625),
          `sub-cells inside cell ${wanted.id}`,
        ).toBe(wanted.subcells);
      }
      expect(result.cells.length, 'cellCount').toBe(c.expected.cellCount);
      same(result.totalWeight, c.expected.totalWeight, 'totalWeight');
      same(
        result.rawTotalWeight,
        c.expected.rawTotalWeightBeforeSmallRule,
        'total weight before the small-selection rule',
      );
      expect(result.lowConfidence, 'lowConfidence').toBe(c.expected.lowConfidence);
    });
  }
});

/* ----------------------------------------------------------- section 2 */

interface ExpectedMonth {
  y: number;
  m: number;
  value: number;
  lo: number;
  hi: number;
  src: string | null;
  flags: string[];
  value_x62500?: number;
  lo_x62500?: number;
  hi_x62500?: number;
}

describe('series_cases.json', () => {
  const cases = casesOf('series_cases.json');

  it('holds cases', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(c.name, async () => {
      const selection = c.input.selection as Selection;
      const expected = c.expected;

      for (const unit of UNITS) {
        const series = await getSeries(selection, unit, source);

        expect(series.cellCount, `${unit} cellCount`).toBe(expected.cellCount);
        expect(series.lowConfidence, `${unit} lowConfidence`).toBe(expected.lowConfidence);
        if (typeof expected.seriesLength === 'number') {
          expect(series.months.length, `${unit} seriesLength`).toBe(expected.seriesLength);
        }

        const first = series.months[0];
        const last = series.months[series.months.length - 1];
        const asKey = (point: { y: number; m: number }) =>
          `${point.y}-${String(point.m).padStart(2, '0')}`;
        if (expected.firstMonth) expect(asKey(first), `${unit} firstMonth`).toBe(expected.firstMonth);
        if (expected.lastMonth) expect(asKey(last), `${unit} lastMonth`).toBe(expected.lastMonth);

        if (expected.cellsWithTileData !== undefined || expected.groups !== undefined) {
          const meta = await getMeta(source);
          const keys = tilesForSelection(selection).filter((key) => meta.tiles.includes(key));
          const tiles = await loadTiles(keys, source);
          const inTiles = new Map<number, string>();
          for (const tile of tiles) {
            for (const cell of tile.cells) inTiles.set(cell.id, cell.g);
          }
          const mine = selectionCells(selection).cells.filter((cell) => inTiles.has(cell.id));
          if (expected.cellsWithTileData !== undefined) {
            expect(mine.length, 'cells that a tile file holds').toBe(expected.cellsWithTileData);
          }
          if (expected.groups !== undefined) {
            const groups = [...new Set(mine.map((cell) => inTiles.get(cell.id) as string))].sort();
            expect(groups, 'the groups those cells belong to').toEqual(expected.groups);
          }
        }

        if (expected.weights) {
          const wanted = expected.weights as { id: number; subcells: number }[];
          const cells = selectionCells(selection).cells;
          expect(cells.map((cell) => cell.id), 'cell ids').toEqual(wanted.map((cell) => cell.id));
          for (const entry of wanted) {
            const mine = cells.find((cell) => cell.id === entry.id);
            expect(Math.round((mine?.weight ?? 0) * 625), `sub-cells of ${entry.id}`).toBe(
              entry.subcells,
            );
          }
        }

        if (expected.october_2000) {
          const october = expected.october_2000 as { inSeries: boolean };
          expect(
            series.months.some((point) => point.y === 2000 && point.m === 10),
            'October 2000 in the series',
          ).toBe(october.inSeries);
        }

        if (expected.noNullMonths === true) {
          expect(
            series.months.filter((point) => point.value === null).length,
            `${unit} months with a null value`,
          ).toBe(0);
        }

        const months = expected.months as Record<string, Record<string, ExpectedMonth>>;
        let asserted = 0;
        for (const [key, perUnit] of Object.entries(months)) {
          const wanted = perUnit[unit];
          if (!wanted) continue;
          asserted += 1;
          const mine = series.months.find(
            (point) => point.y === wanted.y && point.m === wanted.m,
          );
          expect(mine, `${key} should be in the ${unit} series`).toBeDefined();
          if (!mine) continue;
          same(mine.value, wanted.value, `${key} ${unit} value`);
          same(mine.lo, wanted.lo, `${key} ${unit} lo`);
          same(mine.hi, wanted.hi, `${key} ${unit} hi`);
          expect(mine.src, `${key} ${unit} src`).toBe(wanted.src);
          expect(mine.flags, `${key} ${unit} flags`).toEqual(wanted.flags);
          if (wanted.value_x62500 !== undefined) {
            expect(
              Math.round((mine.value as number) * 62500),
              `${key} ${unit} value x62500`,
            ).toBe(wanted.value_x62500);
            expect(Math.round((mine.lo as number) * 62500), `${key} ${unit} lo x62500`).toBe(
              wanted.lo_x62500,
            );
            expect(Math.round((mine.hi as number) * 62500), `${key} ${unit} hi x62500`).toBe(
              wanted.hi_x62500,
            );
          }
        }

        expect(asserted, `months checked in ${unit}`).toBeGreaterThan(0);

        if (expected.sumOfAllMonths_x62500) {
          const wanted = (expected.sumOfAllMonths_x62500 as Record<string, number>)[unit];
          const total = series.months.reduce((sum, point) => sum + (point.value ?? 0), 0);
          expect(Math.round(total * 62500), `${unit} sum of every month x62500`).toBe(wanted);
        }

        if (expected.monthsWithZeroValue) {
          const wanted = (expected.monthsWithZeroValue as Record<string, number>)[unit];
          const zeros = series.months.filter((point) => point.value === 0).length;
          expect(zeros, `${unit} months with value 0`).toBe(wanted);
        }
      }
    });
  }
});

/* --------------------------------------------------- sections 4 and 6 */

interface ExpectedWindowYear {
  year: number;
  hot: number;
  frp: number;
  hot_x625000: number;
  frp_x625: number;
  rawHot_x625: number;
  sensor: string;
  estimated: boolean;
  windowStart: string;
  windowEnd: string;
}

describe('daily_cases.json', () => {
  const cases = casesOf('daily_cases.json');

  it('holds cases', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(c.name, async () => {
      const expected = c.expected;

      if ('pastYear' in c.input) {
        const window = pastWindow(
          c.input.end as string,
          c.input.days as number,
          c.input.pastYear as number,
        );
        expect(window.label, 'label').toBe(expected.label);
        expect(window.start, 'start').toBe(expected.start);
        expect(window.end, 'end').toBe(expected.end);
        expect(window.days, 'the days of the window').toEqual(expected.days);
        expect(window.days.length, 'number of days').toBe(c.input.days);
        expect(window.estimated, 'estimated').toBe(expected.estimated);
        return;
      }

      const selection = c.input.selection as Selection;
      const lastDataDay = c.input.lastDataDay as string;
      const patched = patchedSource({ 'meta.json': await metaWith({ last_data_day: lastDataDay }) });

      if ('days' in c.input) {
        const totals = await getWindowTotals(selection, c.input.days as number, patched);
        expect(totals.end, 'end of the window').toBe(expected.end);
        expect(totals.start, 'start of the window').toBe(expected.start);
        expect(totals.days, 'length of the window').toBe(c.input.days);

        if (expected.weights) {
          const wanted = expected.weights as { id: number; subcells: number }[];
          const cells = selectionCells(selection).cells;
          expect(cells.map((cell) => cell.id), 'cell ids').toEqual(wanted.map((cell) => cell.id));
          for (const entry of wanted) {
            const mine = cells.find((cell) => cell.id === entry.id);
            expect(Math.round((mine?.weight ?? 0) * 625), `sub-cells of ${entry.id}`).toBe(
              entry.subcells,
            );
          }
        }

        const rows = [expected.current as unknown as ExpectedWindowYear, ...((expected.past ?? []) as ExpectedWindowYear[])];
        for (const wanted of rows) {
          const mine = totals.years.find((entry) => entry.year === wanted.year);
          expect(mine, `year ${wanted.year} should be in the window`).toBeDefined();
          if (!mine) continue;
          same(mine.hot, wanted.hot, `hot of ${wanted.year}`);
          same(mine.frp, wanted.frp, `frp of ${wanted.year}`);
          expect(Math.round((mine.hot as number) * 625000), `hot of ${wanted.year} x625000`).toBe(
            wanted.hot_x625000,
          );
          expect(Math.round((mine.frp as number) * 625), `frp of ${wanted.year} x625`).toBe(
            wanted.frp_x625,
          );
          expect(mine.estimated, `estimated of ${wanted.year}`).toBe(wanted.estimated);
          const window = pastWindow(lastDataDay, c.input.days as number, wanted.year);
          expect(window.start, `window start of ${wanted.year}`).toBe(wanted.windowStart);
          expect(window.end, `window end of ${wanted.year}`).toBe(wanted.windowEnd);
        }
        if (expected.focus) {
          const focus = expected.focus as ExpectedWindowYear;
          const mine = totals.years.find((entry) => entry.year === expected.focusYear);
          expect(mine, `the focus year ${String(expected.focusYear)} should be there`).toBeDefined();
          same(mine?.hot, focus.hot, `hot of the focus year`);
          same(mine?.frp, focus.frp, `frp of the focus year`);
        }
        expect(
          totals.years.length,
          'one row per year of the stored window',
        ).toBe(rows.length);
        return;
      }

      const monthToDate = await getMonthToDate(selection, patched);
      expect(monthToDate.month, 'month').toBe(expected.month);
      expect(monthToDate.year, 'year').toBe(expected.year);
      expect(monthToDate.day, 'day of the month').toBe(expected.dayOfMonth);
      same(monthToDate.current.hot, expected.current, 'the current month to date');
      expect(
        Math.round((monthToDate.current.hot as number) * 625000),
        'the current month to date x625000',
      ).toBe(expected.current_x625000);

      const pastYears = expected.pastYears as Record<string, number>;
      const pastX625 = expected.pastYears_x625000 as Record<string, number>;
      expect(monthToDate.past.length, 'one row per past year').toBe(Object.keys(pastYears).length);
      for (const [year, wanted] of Object.entries(pastYears)) {
        const mine = monthToDate.past.find((entry) => entry.year === Number(year));
        expect(mine, `past year ${year} should be there`).toBeDefined();
        if (!mine) continue;
        same(mine.hot, wanted, `month to date of ${year}`);
        expect(Math.round((mine.hot as number) * 625000), `month to date of ${year} x625000`).toBe(
          pastX625[year],
        );
      }
    });
  }
});
