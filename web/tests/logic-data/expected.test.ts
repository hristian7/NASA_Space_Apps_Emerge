/**
 * The independent expected answers.
 *
 * Every case file under tests/expected/logic/ whose name starts with
 * selection_, series_ or daily_ is loaded and run through this stream's
 * functions. The files were written by another agent from the same frozen
 * rules, and nothing here is adjusted to match our output: a difference is a
 * failure of our code.
 *
 * The folder may not exist yet when this stream commits. Then this file fails
 * loudly with "expected answers not found" rather than skipping, because a
 * skipped oracle is a false pass.
 *
 * The shape this reader accepts, so a case file can be read without the two
 * streams agreeing on a layout beforehand:
 *   - a file is either a list of cases, or an object with `cases`, or one case
 *   - a case carries `selection` (the shape in web/src/types/ui.ts), and
 *     optionally `unit` ("hot" or "cd") and `days`
 *   - the expected values sit on the case itself or under `expected`:
 *       selection_*: `cells` (a list of {id, weight} or an object of id to
 *                    weight), `lowConfidence`, `tiles`, `cellCount`
 *       series_*:    `months` (a list of {y, m, value, lo, hi, src, flags}),
 *                    `cellCount`, `lowConfidence`, `unit`
 *       daily_*:     `end`, `day`, `year`, `month`, `years` or `past` and
 *                    `current` (each {year, hot, frp, estimated})
 * A case carrying none of those keys fails with the keys it does carry, so
 * the director can wire the real layout after the merge.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Selection, Unit } from '../../src/types/ui';
import { getSeries } from '../../src/lib/data/series';
import { getMonthToDate, getWindowTotals } from '../../src/lib/data/daily';
import { selectionCells, tilesForSelection } from '../../src/lib/data/selection';
import { REPO_ROOT, testSource } from './helpers';

const source = testSource();
const LOGIC_DIR = path.join(REPO_ROOT, 'tests/expected/logic');
const PREFIXES = ['selection_', 'series_', 'daily_'];

type Json = Record<string, unknown>;

function files(): string[] {
  if (!existsSync(LOGIC_DIR)) return [];
  return readdirSync(LOGIC_DIR)
    .filter((name) => name.endsWith('.json') && PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();
}

function casesOf(file: string): Json[] {
  const raw = JSON.parse(readFileSync(path.join(LOGIC_DIR, file), 'utf-8')) as unknown;
  if (Array.isArray(raw)) return raw as Json[];
  const asObject = raw as Json;
  for (const key of ['cases', 'selections', 'series', 'daily', 'windows']) {
    const list = asObject[key];
    if (Array.isArray(list)) return list as Json[];
  }
  return [asObject];
}

function field(c: Json, name: string): unknown {
  if (name in c) return c[name];
  const nested = c.expected as Json | undefined;
  if (nested && typeof nested === 'object' && name in nested) return nested[name];
  const input = c.input as Json | undefined;
  if (input && typeof input === 'object' && name in input) return input[name];
  return undefined;
}

function selectionOf(c: Json): Selection {
  const given = (field(c, 'selection') ?? field(c, 'sel')) as Selection | undefined;
  if (!given || typeof given !== 'object' || !('kind' in given)) {
    throw new Error(
      `case "${String(c.name ?? c.id ?? 'unnamed')}" carries no selection; keys: ${Object.keys(c).join(', ')}`,
    );
  }
  return given;
}

/** Equal to six decimals, with null kept apart from 0. */
function same(actual: number | null | undefined, wanted: unknown, label: string): void {
  if (wanted === null) {
    expect(actual, `${label} should be null`).toBeNull();
    return;
  }
  if (typeof wanted !== 'number') return;
  expect(actual, `${label} should be a number`).not.toBeNull();
  expect(actual as number, label).toBeCloseTo(wanted, 6);
}

function weightsOf(wanted: unknown): { id: number; weight: number }[] | null {
  if (Array.isArray(wanted)) {
    return (wanted as Json[]).map((entry) => ({
      id: Number(entry.id ?? entry.cell ?? entry.cell_id),
      weight: Number(entry.weight ?? entry.w),
    }));
  }
  if (wanted && typeof wanted === 'object') {
    return Object.entries(wanted as Record<string, number>).map(([id, weight]) => ({
      id: Number(id),
      weight: Number(weight),
    }));
  }
  return null;
}

const found = files();

describe('the independent expected answers', () => {
  it('are in the repository', () => {
    expect(
      found.length,
      `expected answers not found: no selection_, series_ or daily_ case files under ${LOGIC_DIR}`,
    ).toBeGreaterThan(0);
  });
});

for (const file of found) {
  describe(file, () => {
    const cases = casesOf(file);

    it('holds at least one case', () => {
      expect(cases.length).toBeGreaterThan(0);
    });

    cases.forEach((c, at) => {
      const name = String(c.name ?? c.id ?? `case ${at + 1}`);

      it(name, async () => {
        const selection = selectionOf(c);
        let checked = 0;

        if (file.startsWith('selection_')) {
          const wantedCells = weightsOf(field(c, 'cells') ?? field(c, 'weights'));
          const result = selectionCells(selection);
          if (wantedCells) {
            checked += 1;
            expect(result.cells.map((cell) => cell.id)).toEqual(
              wantedCells.map((cell) => cell.id).sort((a, b) => a - b),
            );
            for (const wanted of wantedCells) {
              const mine = result.cells.find((cell) => cell.id === wanted.id);
              same(mine?.weight ?? null, wanted.weight, `weight of cell ${wanted.id}`);
            }
          }
          const wantedLow = field(c, 'lowConfidence') ?? field(c, 'low_confidence');
          if (typeof wantedLow === 'boolean') {
            checked += 1;
            expect(result.lowConfidence, 'lowConfidence').toBe(wantedLow);
          }
          const wantedCount = field(c, 'cellCount') ?? field(c, 'cell_count');
          if (typeof wantedCount === 'number') {
            checked += 1;
            expect(result.cells.length, 'cellCount').toBe(wantedCount);
          }
          const wantedTiles = field(c, 'tiles');
          if (Array.isArray(wantedTiles)) {
            checked += 1;
            expect(tilesForSelection(selection).sort()).toEqual([...(wantedTiles as string[])].sort());
          }
        }

        if (file.startsWith('series_')) {
          const unit = ((field(c, 'unit') as Unit | undefined) ?? 'cd') as Unit;
          const series = await getSeries(selection, unit, source);
          const wantedMonths = field(c, 'months');
          if (Array.isArray(wantedMonths)) {
            checked += 1;
            for (const [position, wanted] of (wantedMonths as Json[]).entries()) {
              const y = wanted.y as number | undefined;
              const m = wanted.m as number | undefined;
              const mine =
                y !== undefined && m !== undefined
                  ? series.months.find((point) => point.y === y && point.m === m)
                  : series.months[position];
              const label = `${unit} ${y ?? '?'}-${m ?? position}`;
              expect(mine, `${label} should be in the series`).toBeDefined();
              if (!mine) continue;
              if ('value' in wanted) same(mine.value, wanted.value, `${label} value`);
              if ('lo' in wanted) same(mine.lo, wanted.lo, `${label} lo`);
              if ('hi' in wanted) same(mine.hi, wanted.hi, `${label} hi`);
              if ('src' in wanted) expect(mine.src, `${label} src`).toBe(wanted.src);
              if ('flags' in wanted) {
                expect([...mine.flags].sort(), `${label} flags`).toEqual(
                  [...(wanted.flags as string[])].sort(),
                );
              }
            }
          }
          const wantedLength = field(c, 'monthCount') ?? field(c, 'length');
          if (typeof wantedLength === 'number') {
            checked += 1;
            expect(series.months.length, 'number of months').toBe(wantedLength);
          }
          const wantedCount = field(c, 'cellCount') ?? field(c, 'cell_count');
          if (typeof wantedCount === 'number') {
            checked += 1;
            expect(series.cellCount, 'cellCount').toBe(wantedCount);
          }
          const wantedLow = field(c, 'lowConfidence') ?? field(c, 'low_confidence');
          if (typeof wantedLow === 'boolean') {
            checked += 1;
            expect(series.lowConfidence, 'lowConfidence').toBe(wantedLow);
          }
          const wantedTotal = field(c, 'total');
          if (typeof wantedTotal === 'number') {
            checked += 1;
            const total = series.months.reduce((sum, point) => sum + (point.value ?? 0), 0);
            same(total, wantedTotal, 'total of the series');
          }
        }

        if (file.startsWith('daily_')) {
          const days = field(c, 'days');
          const wantedYears = field(c, 'years') ?? field(c, 'window');
          if (Array.isArray(wantedYears)) {
            const totals = await getWindowTotals(
              selection,
              typeof days === 'number' ? days : undefined,
              source,
            );
            checked += 1;
            const wantedEnd = field(c, 'end');
            if (typeof wantedEnd === 'string') expect(totals.end, 'end of the window').toBe(wantedEnd);
            for (const wanted of wantedYears as Json[]) {
              const year = Number(wanted.year ?? wanted.y);
              const mine = totals.years.find((entry) => entry.year === year);
              expect(mine, `year ${year} should be in the window`).toBeDefined();
              if (!mine) continue;
              if ('hot' in wanted) same(mine.hot, wanted.hot, `hot of ${year}`);
              if ('frp' in wanted) same(mine.frp, wanted.frp, `frp of ${year}`);
              if ('estimated' in wanted) {
                expect(mine.estimated, `estimated of ${year}`).toBe(wanted.estimated);
              }
            }
          }

          const wantedPast = field(c, 'past');
          const wantedCurrent = field(c, 'current');
          const wantedDay = field(c, 'day');
          if (Array.isArray(wantedPast) || wantedCurrent || typeof wantedDay === 'number') {
            const monthToDate = await getMonthToDate(selection, source);
            checked += 1;
            if (typeof wantedDay === 'number') expect(monthToDate.day, 'D').toBe(wantedDay);
            const wantedMonth = field(c, 'month');
            if (typeof wantedMonth === 'number') expect(monthToDate.month, 'month').toBe(wantedMonth);
            const wantedYear = field(c, 'year');
            if (typeof wantedYear === 'number') expect(monthToDate.year, 'year').toBe(wantedYear);
            if (wantedCurrent && typeof wantedCurrent === 'object') {
              const wanted = wantedCurrent as Json;
              if ('hot' in wanted) same(monthToDate.current.hot, wanted.hot, 'current hot');
              if ('frp' in wanted) same(monthToDate.current.frp, wanted.frp, 'current frp');
            }
            for (const wanted of (wantedPast ?? []) as Json[]) {
              const year = Number(wanted.year ?? wanted.y);
              const mine = monthToDate.past.find((entry) => entry.year === year);
              expect(mine, `past year ${year} should be there`).toBeDefined();
              if (!mine) continue;
              if ('hot' in wanted) same(mine.hot, wanted.hot, `month to date hot of ${year}`);
              if ('frp' in wanted) same(mine.frp, wanted.frp, `month to date frp of ${year}`);
            }
          }
        }

        expect(
          checked,
          `nothing in "${name}" of ${file} could be read as an expected value; keys: ${Object.keys(c).join(', ')}`,
        ).toBeGreaterThan(0);
      });
    });
  });
}
