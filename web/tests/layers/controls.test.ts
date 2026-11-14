import { describe, expect, it } from "vitest";
import {
  clampHistoryYear,
  historyClass,
  historyBreaks,
  historyRampTokens,
  historyYearEnd,
  historyYearStart,
  historyYears,
  cellPolygon,
} from "../../src/lib/layers/history";
import {
  clampDangerDay,
  dangerClasses,
  dangerDate,
  dangerDayMax,
  dangerDays,
} from "../../src/lib/layers/danger";

describe("the year control", () => {
  it("runs from 2001 to the last year the data reaches", () => {
    const years = historyYears("2025-12");
    expect(years[0]).toBe(historyYearStart);
    expect(years[years.length - 1]).toBe(2025);
    expect(years).toHaveLength(2025 - 2001 + 1);
  });

  it("holds a year inside those bounds, however it arrives", () => {
    expect(clampHistoryYear(1998, "2025-12")).toBe(2001);
    expect(clampHistoryYear(2030, "2025-12")).toBe(2025);
    expect(clampHistoryYear(2024, "2025-12")).toBe(2024);
    expect(clampHistoryYear(Number.NaN, "2025-12")).toBe(2025);
  });

  it("falls back to the first year when the data set says nothing useful", () => {
    expect(historyYearEnd(null)).toBe(historyYearStart);
    expect(historyYearEnd("not-a-month")).toBe(historyYearStart);
    expect(historyYears(null)).toEqual([historyYearStart]);
  });
});

describe("the history ramp", () => {
  it("has one colour per class break", () => {
    expect(historyRampTokens).toHaveLength(historyBreaks.length);
  });

  it("puts a value in the class whose break it reaches", () => {
    expect(historyClass(0)).toBe(-1);
    expect(historyClass(0.5)).toBe(-1);
    expect(historyClass(1)).toBe(0);
    expect(historyClass(4)).toBe(0);
    expect(historyClass(5)).toBe(1);
    expect(historyClass(24)).toBe(1);
    expect(historyClass(25)).toBe(2);
    expect(historyClass(99)).toBe(2);
    expect(historyClass(100)).toBe(3);
    expect(historyClass(5000)).toBe(3);
    expect(historyClass(Number.NaN)).toBe(-1);
  });

  it("keeps a top class a real yearly value can sit below", () => {
    // A cell-year reaches the thousands in the real record, so the breaks have
    // to leave room above the last one as well as below the first.
    const top = historyBreaks[historyBreaks.length - 1];
    expect(top).toBeGreaterThan(50);
    expect(historyClass(top - 1)).toBe(historyBreaks.length - 2);
  });

  it("draws a cell as a square around its centre", () => {
    const ring = cellPolygon(42.125, 23.375, 0.25);
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual([23.25, 42]);
    expect(ring[2]).toEqual([23.5, 42.25]);
  });
});

describe("the fire danger day control", () => {
  it("runs from today to nine days ahead", () => {
    expect(dangerDays()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(dangerDayMax).toBe(9);
  });

  it("holds a day inside those bounds", () => {
    expect(clampDangerDay(-3)).toBe(0);
    expect(clampDangerDay(40)).toBe(9);
    expect(clampDangerDay(5)).toBe(5);
    expect(clampDangerDay(Number.NaN)).toBe(0);
  });

  it("turns a day into the date the service is asked for", () => {
    const today = new Date(Date.UTC(2026, 10, 14));
    expect(dangerDate(0, today)).toBe("2026-11-14");
    expect(dangerDate(5, today)).toBe("2026-11-19");
    expect(dangerDate(9, today)).toBe("2026-11-23");
  });

  it("steps over a month end and a year end", () => {
    expect(dangerDate(3, new Date(Date.UTC(2026, 10, 29)))).toBe("2026-12-02");
    expect(dangerDate(2, new Date(Date.UTC(2026, 11, 31)))).toBe("2027-01-02");
  });

  it("carries the service's own six classes, each with a colour the map accepts", () => {
    expect(dangerClasses).toHaveLength(6);
    for (const entry of dangerClasses) {
      expect(/^rgb\(\d+,\d+,\d+\)$/.test(entry.color), entry.color).toBe(true);
      expect(entry.range.length).toBeGreaterThan(0);
    }
  });
});
