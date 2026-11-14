/**
 * The 0.25 degree grid rule, checked against the independent expected answers.
 *
 * tests/expected/cell_id.json was written by a separate agent, before this
 * code existed, with exact arithmetic and no dataframe library. Nothing here
 * is adjusted to match it: a difference is a failure of our code.
 *
 * This file sits under web/tests/ rather than beside cell.ts because the
 * vitest config only collects tests/**\/*.test.ts, and another stream owns
 * that config.
 */

import { describe, expect, it } from "vitest";

import expected from "../../tests/expected/cell_id.json";
import { cellCenter, cellId } from "../src/lib/data/cell";

interface Case {
  name: string;
  lat: number;
  lon: number;
  row: number;
  col: number;
  cell_id: number;
  center_lat: number;
  center_lon: number;
}

const cases = expected.cases as Case[];

describe("the expected answers themselves", () => {
  it("has every case we need", () => {
    expect(cases.length).toBeGreaterThanOrEqual(34);
    expect(expected.rule).toContain("row * 1440 + col");
  });
});

describe("cellId", () => {
  it.each(cases)("$name", (c) => {
    expect(cellId(c.lat, c.lon)).toBe(c.cell_id);
    expect(c.row * 1440 + c.col).toBe(c.cell_id);
  });
});

describe("cellCenter", () => {
  it.each(cases)("$name", (c) => {
    const centre = cellCenter(c.cell_id);
    expect(centre.lat).toBeCloseTo(c.center_lat, 9);
    expect(centre.lon).toBeCloseTo(c.center_lon, 9);
  });
});
