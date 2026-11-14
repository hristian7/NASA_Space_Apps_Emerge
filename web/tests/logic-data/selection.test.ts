/**
 * The mechanics of number-logic section 1: sub-cell centres, distances, the
 * small-selection rule, and which tiles a selection needs when it crosses the
 * 180 degree line or reaches a pole.
 *
 * The values here are read off the rule itself, not off the code: every
 * figure asserted below is either exact (a count, a cell id, a tile key) or
 * an inequality. The independent expected answers live in expected.test.ts.
 */

import { describe, expect, it } from 'vitest';

import type { Selection } from '../../src/types/ui';
import { cellId } from '../../src/lib/data/cell';
import {
  SUB_PER_CELL,
  cellWeight,
  haversineKm,
  pointInRing,
  ringCenter,
  selectionCells,
  subCellCenters,
  tilesForSelection,
} from '../../src/lib/data/selection';

describe('sub-cell centres', () => {
  it('are 625 per cell and follow the rule for the first and last one', () => {
    const id = cellId(44.2, 22.3);
    const centers = subCellCenters(id);
    expect(centers).toHaveLength(SUB_PER_CELL);
    const row = Math.floor(id / 1440);
    const col = id - row * 1440;
    expect(centers[0].lat).toBeCloseTo(90 - row * 0.25 - 0.005, 12);
    expect(centers[0].lon).toBeCloseTo(-180 + col * 0.25 + 0.005, 12);
    const last = centers[SUB_PER_CELL - 1];
    expect(last.lat).toBeCloseTo(90 - row * 0.25 - 24.5 * 0.01, 12);
    expect(last.lon).toBeCloseTo(-180 + col * 0.25 + 24.5 * 0.01, 12);
  });

  it('all sit inside their own cell', () => {
    const id = cellId(-33.4, 151.2);
    for (const center of subCellCenters(id)) {
      expect(cellId(center.lat, center.lon)).toBe(id);
    }
  });
});

describe('great-circle distance', () => {
  it('is zero at the same point and symmetric', () => {
    expect(haversineKm(42, 23, 42, 23)).toBe(0);
    const there = haversineKm(42, 23, 48.8, 2.3);
    const back = haversineKm(48.8, 2.3, 42, 23);
    expect(there).toBeCloseTo(back, 9);
  });

  it('gives a quarter of the globe from the equator to a pole', () => {
    const quarter = (2 * Math.PI * 6371.0088) / 4;
    expect(haversineKm(0, 0, 90, 0)).toBeCloseTo(quarter, 6);
  });

  it('crosses the 180 degree line by the short way', () => {
    expect(haversineKm(0, 179.5, 0, -179.5)).toBeLessThan(120);
  });
});

describe('the even-odd rule', () => {
  const square: [number, number][] = [
    [22, 44],
    [23, 44],
    [23, 45],
    [22, 45],
  ];

  it('holds a point inside and refuses one outside', () => {
    expect(pointInRing(22.5, 44.5, square)).toBe(true);
    expect(pointInRing(21.5, 44.5, square)).toBe(false);
    expect(pointInRing(22.5, 43.5, square)).toBe(false);
  });

  it('leaves a hole when a ring doubles back', () => {
    const ring: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 3],
      [3, 3],
      [3, 1],
      [0, 1],
    ];
    expect(pointInRing(2, 2, ring)).toBe(false);
    expect(pointInRing(3.5, 2, ring)).toBe(true);
  });

  it("averages a closed ring's vertices once", () => {
    const closed: [number, number][] = [...square, [22, 44]];
    expect(ringCenter(closed)).toEqual(ringCenter(square));
    expect(ringCenter(square)).toEqual({ lat: 44.5, lon: 22.5 });
  });
});

describe('weights', () => {
  it('give a cell well inside a circle the whole weight and one outside none', () => {
    const point: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 50 };
    expect(cellWeight(point, cellId(44.125, 22.375))).toBe(1);
    expect(cellWeight(point, cellId(44.125, 30))).toBe(0);
  });

  it('give an edge cell a share strictly between none and all', () => {
    const point: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 30 };
    const { cells } = selectionCells(point);
    const partial = cells.filter((cell) => cell.weight > 0 && cell.weight < 1);
    expect(partial.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.weight).toBeGreaterThan(0);
      expect(cell.weight).toBeLessThanOrEqual(1);
      expect(Number.isInteger(cell.weight * SUB_PER_CELL)).toBe(true);
    }
  });

  it('counts a sub-cell centre exactly at the distance as inside', () => {
    const id = cellId(10, 10);
    const centers = subCellCenters(id);
    const target = centers[312];
    const exact = haversineKm(10.005, 10.005, target.lat, target.lon);
    const atDistance: Selection = { kind: 'point', lat: 10.005, lon: 10.005, radiusKm: exact };
    const justUnder: Selection = {
      kind: 'point',
      lat: 10.005,
      lon: 10.005,
      radiusKm: exact * (1 - 1e-12),
    };
    expect(cellWeight(atDistance, id) * SUB_PER_CELL).toBeGreaterThan(
      cellWeight(justUnder, id) * SUB_PER_CELL - 1,
    );
    expect(cellWeight(atDistance, id)).toBeGreaterThanOrEqual(cellWeight(justUnder, id));
  });

  it('are ordered by cell id', () => {
    const point: Selection = { kind: 'point', lat: 44.125, lon: 22.375, radiusKm: 60 };
    const ids = selectionCells(point).cells.map((cell) => cell.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe('the small-selection rule', () => {
  it('uses the cell holding the point, with weight 1, and says so', () => {
    const tiny: Selection = { kind: 'point', lat: 42.6977, lon: 23.3219, radiusKm: 2 };
    const result = selectionCells(tiny);
    expect(result.lowConfidence).toBe(true);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].id).toBe(cellId(42.6977, 23.3219));
    expect(result.cells[0].weight).toBe(1);
  });

  it("uses the cell holding a small ring's vertex average", () => {
    const ring: [number, number][] = [
      [23.32, 42.69],
      [23.33, 42.69],
      [23.33, 42.7],
      [23.32, 42.7],
    ];
    const result = selectionCells({ kind: 'polygon', ring });
    expect(result.lowConfidence).toBe(true);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].id).toBe(cellId(42.695, 23.325));
  });

  it('does not fire once the weights reach 1 in total', () => {
    const big: Selection = { kind: 'point', lat: 42.6977, lon: 23.3219, radiusKm: 40 };
    const result = selectionCells(big);
    expect(result.lowConfidence).toBe(false);
    const total = result.cells.reduce((sum, cell) => sum + cell.weight, 0);
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it("keeps the point's own cell in a normal selection too", () => {
    const point: Selection = { kind: 'point', lat: 44.3, lon: 22.4, radiusKm: 50 };
    const ids = selectionCells(point).cells.map((cell) => cell.id);
    expect(ids).toContain(cellId(44.3, 22.4));
  });
});

describe('the tiles a selection needs', () => {
  it('is one tile for a small circle inside a square', () => {
    expect(tilesForSelection({ kind: 'point', lat: 42, lon: 23, radiusKm: 20 })).toEqual(['40_20']);
  });

  it('is both squares for a circle over a tile edge', () => {
    const keys = tilesForSelection({ kind: 'point', lat: 42, lon: 24.9, radiusKm: 40 });
    expect(keys).toContain('40_20');
    expect(keys).toContain('40_25');
  });

  it('reaches both sides of the 180 degree line', () => {
    const keys = tilesForSelection({ kind: 'point', lat: -17, lon: 179.5, radiusKm: 120 });
    expect(keys).toContain('-20_175');
    expect(keys).toContain('-20_-180');
    for (const key of keys) {
      const lon0 = Number(key.slice(key.indexOf('_') + 1));
      expect(lon0 === 175 || lon0 === -180).toBe(true);
    }
  });

  it('gives every longitude when the circle reaches the north pole', () => {
    const keys = tilesForSelection({ kind: 'point', lat: 89, lon: 10, radiusKm: 300 });
    expect(keys.filter((key) => key.startsWith('85_'))).toHaveLength(72);
    expect(keys).toContain('85_-180');
    expect(keys).toContain('85_175');
    expect(keys.some((key) => key.startsWith('90_'))).toBe(false);
  });

  it('gives every longitude when the circle reaches the south pole', () => {
    const keys = tilesForSelection({ kind: 'point', lat: -89.5, lon: -70, radiusKm: 200 });
    expect(keys.filter((key) => key.startsWith('-90_'))).toHaveLength(72);
    expect(keys.every((key) => key.startsWith('-90_'))).toBe(true);
  });

  it('is empty for a country, which has no cells', () => {
    expect(tilesForSelection({ kind: 'country', iso3: 'BGR' })).toEqual([]);
  });

  it("covers a drawn area's bounding box", () => {
    const ring: [number, number][] = [
      [22, 42],
      [26, 42],
      [26, 44],
      [22, 44],
    ];
    const keys = tilesForSelection({ kind: 'polygon', ring });
    expect(keys.sort()).toEqual(['40_20', '40_25']);
  });
});
