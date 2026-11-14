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
import type { MetaFile } from '../../src/types/data';
import { monthIndex } from '../../src/lib/data/cell';
import { loadMeta } from '../../src/lib/data/loaders';
import { getPerSatellite, getReported, getSeries, isNoDataMonth } from '../../src/lib/data/series';
import { backgroundStatus } from '../../src/lib/data/background';
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

describe('the background before February 2012', () => {
  const group = 'g1';
  const twelve = (value: number) => Array.from({ length: 12 }, () => value);
  const background = {
    schema: 'emerge-background-1',
    example: true,
    built: '2026-11-14',
    groups: {
      [group]: {
        estimated_terra: { hot: twelve(40), hot_hi: twelve(120), cd: twelve(25), cd_hi: twelve(75) },
        estimated_modis: { hot: twelve(60), hot_hi: twelve(180), cd: twelve(37), cd_hi: twelve(111) },
      },
    },
  };

  async function groupedTile() {
    const tile = await source.json<{ cells: { id: number; mi: number[] }[] }>(
      'tiles/40_20.json.gz',
    );
    const copy = JSON.parse(JSON.stringify(tile)) as { cells: ({ g?: string } & { id: number })[] };
    for (const cell of copy.cells) cell.g = group;
    return copy;
  }

  it('gives an unlisted month before Feb 2012 the group background, and 0 from Feb 2012', async () => {
    const tile = await groupedTile();
    const patched = patchedSource({ 'background.json': background, 'tiles/40_20.json.gz': tile });
    const one: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 2 };
    const series = await getSeries(one, 'cd', patched);
    expect(backgroundStatus().loaded).toBe(true);
    expect(backgroundStatus().cellsWithoutGroup).toBe(0);

    const at = (y: number, m: number) =>
      series.months.find((point) => point.y === y && point.m === m);
    expect(at(2000, 12)?.value).toBeCloseTo(0.25, 10);
    expect(at(2000, 12)?.lo).toBe(0);
    expect(at(2000, 12)?.hi).toBeCloseTo(0.75, 10);
    expect(at(2003, 4)?.value).toBeCloseTo(0.37, 10);
    expect(at(2003, 4)?.hi).toBeCloseTo(1.11, 10);

    const measuredEmpty = series.months.filter(
      (point) => monthIndex(point.y, point.m) >= monthIndex(2012, 2) && point.value === 0,
    );
    expect(measuredEmpty.length).toBeGreaterThan(0);
  });

  it('weighs the background like any other cell value', async () => {
    const tile = await groupedTile();
    const patched = patchedSource({ 'background.json': background, 'tiles/40_20.json.gz': tile });
    const circle: Selection = { kind: 'point', lat: 44.0, lon: 22.3, radiusKm: 20 };
    const series = await getSeries(circle, 'hot', patched);
    const month = series.months.find((point) => point.y === 2005 && point.m === 3);
    expect(month?.value).toBeGreaterThan(0);
  });

  it('treats a missing background file as 0 and says it was not loaded', async () => {
    const tile = await groupedTile();
    const patched = patchedSource({ 'tiles/40_20.json.gz': tile });
    const one: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 2 };
    const series = await getSeries(one, 'cd', patched);
    expect(backgroundStatus().loaded).toBe(false);
    const unlisted = series.months.find((point) => point.y === 2000 && point.m === 12);
    expect(unlisted?.value).toBe(0);
  });

  it('counts cells with no group and leaves their background at 0', async () => {
    const patched = patchedSource({ 'background.json': background });
    const one: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 2 };
    const series = await getSeries(one, 'cd', patched);
    expect(backgroundStatus().loaded).toBe(true);
    expect(backgroundStatus().cellsWithoutGroup).toBe(1);
    expect(series.months.find((point) => point.y === 2000 && point.m === 12)?.value).toBe(0);
  });
});
