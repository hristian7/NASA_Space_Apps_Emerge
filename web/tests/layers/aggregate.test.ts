import { describe, expect, it } from "vitest";
import { aggregateCells, mergeFactor, type HistoryCell } from "../../src/lib/layers/overlay";
import { cellPolygon, historyClass } from "../../src/lib/layers/history";

function cell(lat: number, lon: number, fireDays: number, hotspots = 1): HistoryCell {
  return {
    polygon: cellPolygon(lat, lon, 0.25),
    fireDays,
    hotspots,
    lat,
    lon,
    klass: historyClass(fireDays),
  };
}

describe("how many cells are merged at a zoom", () => {
  it("merges more the further out the camera is", () => {
    expect(mergeFactor(0)).toBeGreaterThan(mergeFactor(2));
    expect(mergeFactor(2)).toBeGreaterThan(mergeFactor(3.5));
    expect(mergeFactor(3.5)).toBeGreaterThan(mergeFactor(6));
  });

  it("draws every cell once the camera is close", () => {
    expect(mergeFactor(4.5)).toBe(1);
    expect(mergeFactor(9)).toBe(1);
  });

  it("answers for a zoom it cannot read", () => {
    expect(mergeFactor(Number.NaN)).toBe(1);
  });
});

describe("merging cells into bigger squares", () => {
  it("hands the cells back untouched at full detail", () => {
    const cells = [cell(42.125, 23.125, 4), cell(42.375, 23.375, 30)];
    expect(aggregateCells(cells, 1, 0.25)).toBe(cells);
  });

  it("puts cells of one block together and keeps the highest value", () => {
    const merged = aggregateCells(
      [cell(42.125, 23.125, 4), cell(42.375, 23.375, 300), cell(42.125, 23.375, 30)],
      4,
      0.25,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].fireDays).toBe(300);
    expect(merged[0].klass).toBe(historyClass(300));
  });

  it("adds up the hotspots inside a block", () => {
    const merged = aggregateCells([cell(42.1, 23.1, 4, 7), cell(42.3, 23.3, 9, 11)], 4, 0.25);
    expect(merged[0].hotspots).toBe(18);
  });

  it("keeps cells that fall in different blocks apart", () => {
    const merged = aggregateCells([cell(42.125, 23.125, 4), cell(50.125, -3.125, 9)], 4, 0.25);
    expect(merged).toHaveLength(2);
  });

  it("draws a merged square the size of the block it covers", () => {
    const merged = aggregateCells([cell(42.125, 23.125, 4)], 4, 0.25);
    const lons = merged[0].polygon.map((point) => point[0]);
    expect(Math.max(...lons) - Math.min(...lons)).toBeCloseTo(1, 6);
  });

  it("cuts a world-sized layer down by about the square of the factor", () => {
    const cells: HistoryCell[] = [];
    for (let lat = 0; lat < 20; lat += 0.25) {
      for (let lon = 0; lon < 20; lon += 0.25) cells.push(cell(lat + 0.125, lon + 0.125, 3));
    }
    expect(cells).toHaveLength(6400);
    expect(aggregateCells(cells, 4, 0.25)).toHaveLength(400);
    expect(aggregateCells(cells, 8, 0.25)).toHaveLength(100);
  });
});
