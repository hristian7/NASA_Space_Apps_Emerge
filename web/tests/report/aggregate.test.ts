import { describe, expect, it } from "vitest";
import type { MonthPoint } from "../../src/types/ui";
import {
  monthIndex,
  monthKey,
  yearTotalsFromMonths,
  yearsOf,
} from "../../src/components/report/lib/aggregate";

function month(
  y: number,
  m: number,
  value: number | null,
  src: MonthPoint["src"] = "measured",
): MonthPoint {
  return {
    y,
    m,
    value,
    lo: value === null ? null : Math.round(value * 0.7),
    hi: value === null ? null : Math.round(value * 1.3),
    src,
    flags: [],
  };
}

describe("yearTotalsFromMonths", () => {
  it("adds the months of a complete year", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      month(2015, i + 1, 10),
    );
    expect(yearTotalsFromMonths(months)).toEqual([
      { y: 2015, value: 120, lo: 84, hi: 156, estimated: false, complete: true },
    ]);
  });

  it("counts a zero month and marks the year complete", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      month(2015, i + 1, i === 0 ? 0 : 10),
    );
    const [total] = yearTotalsFromMonths(months);
    expect(total.value).toBe(110);
    expect(total.complete).toBe(true);
  });

  it("marks a year with a missing month incomplete but keeps the total", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      month(2015, i + 1, i === 0 ? null : 10),
    );
    const [total] = yearTotalsFromMonths(months);
    expect(total.value).toBe(110);
    expect(total.complete).toBe(false);
  });

  it("marks a year with fewer than twelve months incomplete", () => {
    const [total] = yearTotalsFromMonths([
      month(2000, 11, 238),
      month(2000, 12, 3),
    ]);
    expect(total.complete).toBe(false);
    expect(total.value).toBe(241);
  });

  it("gives null, not zero, when no month was measured", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      month(2015, i + 1, null),
    );
    const [total] = yearTotalsFromMonths(months);
    expect(total.value).toBeNull();
    expect(total.lo).toBeNull();
    expect(total.hi).toBeNull();
    expect(total.complete).toBe(false);
  });

  it("gives zero, not null, for a year the satellites saw no fire in", () => {
    const months = Array.from({ length: 12 }, (_, i) => month(2015, i + 1, 0));
    const [total] = yearTotalsFromMonths(months);
    expect(total.value).toBe(0);
    expect(total.complete).toBe(true);
  });

  it("marks a year estimated when any month came from a conversion", () => {
    const months = [
      month(2011, 1, 10, "measured"),
      month(2011, 2, 10, "estimated_modis"),
    ];
    expect(yearTotalsFromMonths(months)[0].estimated).toBe(true);
    expect(
      yearTotalsFromMonths([month(2013, 1, 10, "measured")])[0].estimated,
    ).toBe(false);
  });

  it("falls back to the value when a month carries no range", () => {
    const bare: MonthPoint = {
      y: 2015,
      m: 1,
      value: 40,
      lo: null,
      hi: null,
      src: "measured",
      flags: [],
    };
    const [total] = yearTotalsFromMonths([bare]);
    expect(total.lo).toBe(40);
    expect(total.hi).toBe(40);
  });

  it("keeps the years in the order they arrive", () => {
    const totals = yearTotalsFromMonths([
      month(2000, 11, 1),
      month(2001, 1, 1),
      month(2000, 12, 1),
    ]);
    expect(totals.map((total) => total.y)).toEqual([2000, 2001]);
  });
});

describe("yearsOf", () => {
  it("lists every year once, in order", () => {
    expect(
      yearsOf([month(2000, 11, 1), month(2000, 12, 1), month(2001, 1, 1)]),
    ).toEqual([2000, 2001]);
  });
});

describe("monthIndex", () => {
  it("finds a month that is present and nothing for one that is not", () => {
    const index = monthIndex([month(2000, 11, 238)]);
    expect(index.get(monthKey(2000, 11))?.value).toBe(238);
    expect(index.get(monthKey(2000, 10))).toBeUndefined();
  });
});
