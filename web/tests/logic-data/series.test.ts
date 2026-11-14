/**
 * The mechanics of number-logic section 2, and the control total.
 *
 * The control total is the only place here that compares a figure with
 * something this stream did not write: tests/expected/bakeoff/truth_samples.json
 * was computed from the raw NASA files by another agent, with no dataframe
 * library. A difference is a failure of our code.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Selection } from '../../src/types/ui';
import type { BackgroundFile, MetaFile, TileFile } from '../../src/types/data';
import { cellId, monthIndex } from '../../src/lib/data/cell';
import { globeCells, loadCountryIndex, loadGlobeYear, loadMeta } from '../../src/lib/data/loaders';
import { getPerSatellite, getReported, getSeries, isNoDataMonth } from '../../src/lib/data/series';
import { backgroundStatus } from '../../src/lib/data/background';
import { selectionCells } from '../../src/lib/data/selection';
import { REPO_ROOT, patchedSource, testSource } from './helpers';

const source = testSource();

async function meta(): Promise<MetaFile> {
  return loadMeta(source);
}

const BULGARIA: Selection = { kind: 'country', iso3: 'BGR' };
const BULGARIA_POINT: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 50 };

describe('the shape of a series', () => {
  it('runs from November 2000 to meta last data month, with no gap', async () => {
    const m = await meta();
    const series = await getSeries(BULGARIA, 'cd', source);
    const [lastY, lastM] = m.last_month.split('-').map(Number);
    const expectedLength = monthIndex(lastY, lastM) - monthIndex(2000, 11) + 1;
    expect(series.months).toHaveLength(expectedLength);
    expect(series.months[0]).toMatchObject({ y: 2000, m: 11 });
    expect(series.months[series.months.length - 1]).toMatchObject({ y: lastY, m: lastM });
    series.months.forEach((point, at) => {
      expect(monthIndex(point.y, point.m)).toBe(monthIndex(2000, 11) + at);
    });
  });

  it('starts at November 2000: no earlier month is in it', async () => {
    const series = await getSeries(BULGARIA_POINT, 'hot', source);
    expect(series.months[0]).toMatchObject({ y: 2000, m: 11 });
    expect(series.months.some((point) => monthIndex(point.y, point.m) < monthIndex(2000, 11))).toBe(
      false,
    );
  });

  it('counts a country as one cell and never low confidence', async () => {
    const series = await getSeries(BULGARIA, 'hot', source);
    expect(series.cellCount).toBe(1);
    expect(series.lowConfidence).toBe(false);
    expect(series.unit).toBe('hot');
  });

  it('counts the weighted cells of a point selection', async () => {
    const series = await getSeries(BULGARIA_POINT, 'hot', source);
    expect(series.cellCount).toBeGreaterThan(1);
    expect(series.lowConfidence).toBe(false);
  });

  it('marks a selection smaller than a cell as low confidence in every month', async () => {
    const tiny: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 2 };
    const series = await getSeries(tiny, 'cd', source);
    expect(series.lowConfidence).toBe(true);
    expect(series.cellCount).toBe(1);
    for (const point of series.months) {
      expect(point.flags).toContain('low_confidence');
    }
  });
});

describe('null against zero', () => {
  it('leaves no month null in the example set, because no month is inside a global no-data period', async () => {
    const m = await meta();
    const series = await getSeries(BULGARIA, 'cd', source);
    for (const point of series.months) {
      expect(isNoDataMonth(m, point.y, point.m)).toBe(false);
      expect(point.value).not.toBeNull();
    }
  });

  it('reads the global no-data periods as the only source of null', async () => {
    const m = await meta();
    expect(isNoDataMonth(m, 2000, 10)).toBe(true);
    expect(isNoDataMonth(m, 2000, 11)).toBe(false);
    expect(isNoDataMonth(m, 2026, 1)).toBe(true);
    expect(isNoDataMonth(m, 2015, 6)).toBe(false);
  });

  it('does not let a missing satellite null a harmonized month', async () => {
    const m = await meta();
    const noaa21 = m.no_data.find((period) => period.sat === 'noaa21');
    expect(noaa21?.scope).toBe('satellite');
    expect(isNoDataMonth(m, 2024, 7)).toBe(false);
  });

  it('gives a covered month with no fire 0, not null', async () => {
    const empty: Selection = { kind: 'point', lat: 43.0, lon: 31.0, radiusKm: 30 };
    const series = await getSeries(empty, 'cd', source);
    const measured = series.months.filter(
      (point) => monthIndex(point.y, point.m) >= monthIndex(2012, 2),
    );
    expect(measured.length).toBeGreaterThan(0);
    for (const point of measured) {
      expect(point.value).toBe(0);
      expect(point.lo).toBe(0);
      expect(point.hi).toBe(0);
    }
  });

  it('turns a month inside a global no-data period into null', async () => {
    const m = await meta();
    const shortened: MetaFile = {
      ...m,
      no_data: [
        ...m.no_data,
        {
          scope: 'global',
          sat: null,
          from: '2015-01-01',
          to: '2015-12-31',
          days: null,
          reason: 'a made-up gap, to check the null rule',
        },
      ],
    };
    const patched = patchedSource({ 'meta.json': shortened });
    const series = await getSeries(BULGARIA, 'cd', patched);
    const inGap = series.months.filter((point) => point.y === 2015);
    expect(inGap).toHaveLength(12);
    for (const point of inGap) {
      expect(point.value).toBeNull();
      expect(point.lo).toBeNull();
      expect(point.hi).toBeNull();
    }
    const outside = series.months.find((point) => point.y === 2016 && point.m === 1);
    expect(outside?.value).not.toBeNull();
  });
});

describe('the src label and the flags of a month', () => {
  it('follows the date rule, not a cell label', async () => {
    const series = await getSeries(BULGARIA_POINT, 'hot', source);
    const at = (y: number, m: number) =>
      series.months.find((point) => point.y === y && point.m === m);
    expect(at(2000, 11)?.src).toBe('estimated_terra');
    expect(at(2002, 6)?.src).toBe('estimated_terra');
    expect(at(2002, 7)?.src).toBe('estimated_modis');
    expect(at(2012, 1)?.src).toBe('estimated_modis');
    expect(at(2012, 2)?.src).toBe('measured');
    expect(at(2025, 12)?.src).toBe('measured');
  });

  it('unions the flags of the cells that list the month', async () => {
    const series = await getSeries(BULGARIA_POINT, 'hot', source);
    const flagged = series.months.filter((point) => point.flags.includes('example'));
    expect(flagged.length).toBeGreaterThan(0);
    for (const point of series.months) {
      expect(new Set(point.flags).size).toBe(point.flags.length);
    }
  });
});

describe('a weighted sum', () => {
  it('is the sum of weight times cell value, unrounded', async () => {
    const half: Selection = { kind: 'point', lat: 44.0, lon: 22.3, radiusKm: 20 };
    const series = await getSeries(half, 'cd', source);
    const withValue = series.months.filter((point) => (point.value ?? 0) > 0);
    expect(withValue.length).toBeGreaterThan(0);
    expect(withValue.some((point) => !Number.isInteger(point.value as number))).toBe(true);
    for (const point of series.months) {
      expect(point.lo as number).toBeLessThanOrEqual(point.value as number);
      expect(point.hi as number).toBeGreaterThanOrEqual(point.value as number);
    }
  });
});

describe('the control total', () => {
  const samples = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'tests/expected/bakeoff/truth_samples.json'), 'utf-8'),
  ) as {
    samples: { country: string; year: number; month: number; total_cd: number; total_hot: number }[];
  };

  const iso3: Record<string, string> = { Bulgaria: 'BGR', United_States: 'USA' };

  for (const sample of samples.samples) {
    it(`matches the independent total for ${sample.country} ${sample.year}-${sample.month}`, async () => {
      const code = iso3[sample.country];
      expect(code).toBeDefined();
      const selection: Selection = { kind: 'country', iso3: code };
      const cd = await getSeries(selection, 'cd', source);
      const hot = await getSeries(selection, 'hot', source);
      const find = (series: Awaited<ReturnType<typeof getSeries>>) =>
        series.months.find((point) => point.y === sample.year && point.m === sample.month);
      expect(find(cd)?.value).toBe(sample.total_cd);
      expect(find(hot)?.value).toBe(sample.total_hot);
    });
  }
});

describe('the other two country answers', () => {
  it('gives the raw per-satellite series for a country and null for anything else', async () => {
    const perSatellite = await getPerSatellite(BULGARIA, source);
    expect(perSatellite).not.toBeNull();
    expect(perSatellite?.length).toBe(302);
    expect(perSatellite?.[0]).toMatchObject({ y: 2000, m: 11 });
    for (const month of perSatellite ?? []) expect(month.noaa21).toBeNull();
    expect(await getPerSatellite(BULGARIA_POINT, source)).toBeNull();
  });

  it('gives a country its own reported file', async () => {
    const reported = await getReported(BULGARIA, source);
    expect(reported?.iso3).toBe('BGR');
    expect(reported?.scope).toBe('national');
  });

  it('gives a point the reported file of the country whose data circle holds it', async () => {
    const reported = await getReported(BULGARIA_POINT, source);
    expect(reported?.iso3).toBe('BGR');
  });

  it('gives null when no country data circle holds the point', async () => {
    const pacific: Selection = { kind: 'point', lat: -20, lon: -150, radiusKm: 30 };
    expect(await getReported(pacific, source)).toBeNull();
  });
});

describe('the background before February 2012 (ruling 10)', () => {
  const ONE_CELL: Selection = { kind: 'point', lat: 42.7, lon: 23.32, radiusKm: 2 };

  it('gives an unlisted month before Feb 2012 the group background, read from the file', async () => {
    const background = (await source.json<BackgroundFile>('background.json')) as BackgroundFile;
    const tile = (await source.json<TileFile>('tiles/40_20.json.gz')) as TileFile;
    const { cells } = selectionCells(ONE_CELL);
    expect(cells).toHaveLength(1);
    const cell = tile.cells.find((entry) => entry.id === cells[0].id);
    expect(cell, 'the one cell should be in the tile').toBeDefined();
    const group = background.groups[(cell as TileFile['cells'][number]).g];
    expect(group, 'the cell group should be in background.json').toBeDefined();

    for (const unit of ['hot', 'cd'] as const) {
      const series = await getSeries(ONE_CELL, unit, source);
      expect(backgroundStatus().loaded).toBe(true);
      expect(backgroundStatus().cellsWithoutGroup).toBe(0);
      const listed = new Set((cell as TileFile['cells'][number]).mi);

      for (const [key, period] of [
        ['2000-12', 'estimated_terra'],
        ['2005-04', 'estimated_modis'],
      ] as const) {
        const [y, m] = key.split('-').map(Number);
        expect(listed.has(monthIndex(y, m)), `${key} should not be listed by the cell`).toBe(false);
        const point = series.months.find((entry) => entry.y === y && entry.m === m);
        const values = group[period];
        expect(point?.value).toBeCloseTo(values[unit][m - 1] / 100, 10);
        expect(point?.lo).toBe(0);
        expect(point?.hi).toBeCloseTo(
          values[unit === 'hot' ? 'hot_hi' : 'cd_hi'][m - 1] / 100,
          10,
        );
      }
    }
  });

  it('gives an unlisted month from Feb 2012 a plain 0', async () => {
    const tile = (await source.json<TileFile>('tiles/40_20.json.gz')) as TileFile;
    const { cells } = selectionCells(ONE_CELL);
    const cell = tile.cells.find((entry) => entry.id === cells[0].id) as TileFile['cells'][number];
    const series = await getSeries(ONE_CELL, 'hot', source);
    const measured = series.months.filter(
      (point) =>
        monthIndex(point.y, point.m) >= monthIndex(2012, 2) &&
        !cell.mi.includes(monthIndex(point.y, point.m)),
    );
    expect(measured.length).toBeGreaterThan(0);
    for (const point of measured) {
      expect(point.value).toBe(0);
      expect(point.lo).toBe(0);
      expect(point.hi).toBe(0);
    }
  });

  it('weighs the background like any other cell value', async () => {
    const background = (await source.json<BackgroundFile>('background.json')) as BackgroundFile;
    const circle: Selection = { kind: 'point', lat: 42.7, lon: 23.32, radiusKm: 50 };
    const series = await getSeries(circle, 'hot', source);
    const month = series.months.find((point) => point.y === 2000 && point.m === 11);
    const perCell = background.groups.BGR_40.estimated_terra.hot[10] / 100;
    expect(month?.value).toBeGreaterThan(perCell);
    expect(Number.isInteger(month?.value)).toBe(false);
  });

  it('treats a missing background file as 0 and says it was not loaded', async () => {
    const patched = patchedSource({ 'background.json': null });
    const series = await getSeries(ONE_CELL, 'cd', patched);
    expect(backgroundStatus().loaded).toBe(false);
    expect(series.months.find((point) => point.y === 2000 && point.m === 12)?.value).toBe(0);
  });

  it('counts a cell with no group and leaves its background at 0', async () => {
    const tile = JSON.parse(
      JSON.stringify(await source.json<TileFile>('tiles/40_20.json.gz')),
    ) as { cells: { g?: string }[] };
    for (const cell of tile.cells) delete cell.g;
    const patched = patchedSource({ 'tiles/40_20.json.gz': tile });
    const series = await getSeries(ONE_CELL, 'cd', patched);
    expect(backgroundStatus().loaded).toBe(true);
    expect(backgroundStatus().cellsWithoutGroup).toBe(1);
    expect(series.months.find((point) => point.y === 2000 && point.m === 12)?.value).toBe(0);
  });

  it('names a group that background.json does not hold', async () => {
    const tile = JSON.parse(
      JSON.stringify(await source.json<TileFile>('tiles/40_20.json.gz')),
    ) as { cells: { g: string }[] };
    for (const cell of tile.cells) cell.g = 'NOT_A_GROUP';
    const patched = patchedSource({ 'tiles/40_20.json.gz': tile });
    await getSeries(ONE_CELL, 'cd', patched);
    expect(backgroundStatus().groupsNotFound).toEqual(['NOT_A_GROUP']);
  });
});

describe('the country index and the globe year', () => {
  it('lists one entry per country file, with a box that may cross the 180 degree line', async () => {
    const index = await loadCountryIndex(source);
    const meta_ = await meta();
    expect(index?.schema).toBe('emerge-country-index-1');
    expect(index?.countries.map((entry) => entry.iso3)).toEqual(meta_.countries);
    const usa = index?.countries.find((entry) => entry.iso3 === 'USA');
    expect(usa?.bbox[0]).toBeGreaterThan(usa?.bbox[2] as number);
    for (const entry of index?.countries ?? []) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.bbox[1]).toBeLessThan(entry.bbox[3]);
    }
  });

  it('reads a globe year from the gzipped slim file and works the point out from the id', async () => {
    const meta_ = await meta();
    const year = meta_.globe_years[0];
    const file = await loadGlobeYear(year, source);
    expect(file?.schema).toBe('emerge-globe-1');
    expect(file?.point_from_id).toBe(true);
    expect(file?.cols.id).toHaveLength(file?.n as number);
    const cells = globeCells(file as NonNullable<typeof file>);
    expect(cells).toHaveLength(file?.n as number);
    for (const cell of cells.slice(0, 20)) {
      expect(cellId(cell.lat, cell.lon)).toBe(cell.id);
      expect(cell.precisionRadiusKm).toBeGreaterThan(0);
      expect(cell.hot).toBeGreaterThanOrEqual(0);
    }
  });

  it('answers null for a globe year with no file', async () => {
    expect(await loadGlobeYear(1999, source)).toBeNull();
  });
});
