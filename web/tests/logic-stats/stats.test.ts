/**
 * Mechanics and edge handling of the statistics functions.
 *
 * These are our own tests. The authority on the figures themselves is
 * expected.test.ts, which checks the independent expected answers.
 */

import { describe, expect, it } from "vitest";

import type { MonthPoint, Series } from "../../src/types/ui";
import {
  betaQuantile,
  chance,
  extremes,
  incompleteBeta,
  jeffreysRange,
  mean,
  median,
  olsSlope,
  rankWindow,
  trend,
  unusual,
  unusualFromHistory,
  unusualToDate,
  windowYearLabel,
} from "../../src/lib/stats";

function month(y: number, m: number, value: number | null): MonthPoint {
  return { y, m, value, lo: null, hi: null, src: value === null ? null : "measured", flags: [] };
}

function series(months: MonthPoint[], unit: Series["unit"] = "hot"): Series {
  return { unit, months, cellCount: 1, lowConfidence: false };
}

/** A full year of the same value, for the trend tests. */
function wholeYear(y: number, value: number | null): MonthPoint[] {
  return Array.from({ length: 12 }, (_, i) => month(y, i + 1, value));
}

describe("median and mean", () => {
  it("averages the two middle values of an even list", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("takes the middle value of an odd list", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("gives null for an empty list", () => {
    expect(median([])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("does not reorder its input", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toStrictEqual([3, 1, 2]);
  });
});

describe("olsSlope", () => {
  it("fits an exact straight line", () => {
    expect(olsSlope([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(2, 12);
  });

  it("gives null when every x is the same", () => {
    expect(olsSlope([3, 3, 3], [1, 2, 3])).toBeNull();
  });
});

describe("unusualFromHistory", () => {
  it("calls a value above the median above", () => {
    const got = unusualFromHistory(10, [2, 4, 4, 6]);
    expect(got.status).toBe("above");
    expect(got.median).toBe(4);
    expect(got.mean).toBe(4);
    expect(got.ratioMedian).toBeCloseTo(2.5, 12);
    expect(got.higherThan).toBe(4);
    expect(got.years).toBe(4);
  });

  it("calls a value below three quarters of the median below", () => {
    expect(unusualFromHistory(2, [4, 4, 4]).status).toBe("below");
  });

  it("keeps the edges of the band near", () => {
    expect(unusualFromHistory(5, [4, 4, 4]).status).toBe("near");
    expect(unusualFromHistory(3, [4, 4, 4]).status).toBe("near");
  });

  it("treats any fire as above when the median is 0", () => {
    expect(unusualFromHistory(1, [0, 0, 0]).status).toBe("above");
    expect(unusualFromHistory(0, [0, 0, 0]).status).toBe("near");
  });

  it("gives null ratios when the median is 0 but the status is above", () => {
    const got = unusualFromHistory(3, [0, 0, 0, 0]);
    expect(got.ratioMedian).toBeNull();
    expect(got.ratioMean).toBeNull();
  });

  it("counts only strictly lower past years", () => {
    expect(unusualFromHistory(4, [4, 4, 3]).higherThan).toBe(1);
  });

  it("reports no_history under three history years, with empty fields", () => {
    const got = unusualFromHistory(10, [1, 2]);
    expect(got).toStrictEqual({
      status: "no_history",
      value: 10,
      median: null,
      mean: null,
      ratioMedian: null,
      ratioMean: null,
      higherThan: 0,
      years: 2,
    });
  });

  it("reports no_history for a null current value", () => {
    const got = unusualFromHistory(null, [1, 2, 3, 4]);
    expect(got.status).toBe("no_history");
    expect(got.value).toBeNull();
    expect(got.years).toBe(4);
    expect(got.median).toBeNull();
  });
});

describe("unusual over a series", () => {
  const s = series([
    month(2021, 8, 10),
    month(2022, 8, 20),
    month(2023, 8, null),
    month(2024, 8, 30),
    month(2025, 8, 100),
    month(2025, 7, 999),
  ]);

  it("uses the same month of earlier years only, and skips null months", () => {
    const got = unusual(s, 2025, 8);
    expect(got.years).toBe(3);
    expect(got.median).toBe(20);
    expect(got.value).toBe(100);
    expect(got.status).toBe("above");
  });

  it("gives no_history for a month the series does not hold", () => {
    expect(unusual(s, 2026, 8).status).toBe("no_history");
  });
});

describe("unusualToDate", () => {
  it("is too_early under eight days, whatever the numbers say", () => {
    const got = unusualToDate(100, [1, 2, 3, 4], 7);
    expect(got.status).toBe("too_early");
    expect(got.value).toBe(100);
    expect(got.years).toBe(4);
    expect(got.median).toBeNull();
    expect(got.higherThan).toBe(0);
  });

  it("compares from the eighth day on", () => {
    expect(unusualToDate(100, [1, 2, 3, 4], 8).status).toBe("above");
  });
});

describe("the incomplete beta function", () => {
  it("is 0 at 0 and 1 at 1", () => {
    expect(incompleteBeta(2, 3, 0)).toBe(0);
    expect(incompleteBeta(2, 3, 1)).toBe(1);
  });

  it("matches the closed form of Beta(1, 1), the uniform distribution", () => {
    for (const x of [0.1, 0.25, 0.5, 0.8]) {
      expect(incompleteBeta(1, 1, x)).toBeCloseTo(x, 10);
    }
  });

  it("matches the closed form of Beta(2, 1) and Beta(1, 2)", () => {
    expect(incompleteBeta(2, 1, 0.3)).toBeCloseTo(0.09, 10);
    expect(incompleteBeta(1, 2, 0.3)).toBeCloseTo(0.51, 10);
  });

  it("matches the arcsine law of Beta(0.5, 0.5)", () => {
    const x = 0.25;
    const want = (2 / Math.PI) * Math.asin(Math.sqrt(x));
    expect(incompleteBeta(0.5, 0.5, x)).toBeCloseTo(want, 10);
  });
});

describe("betaQuantile", () => {
  it("inverts the distribution function to better than 1e-6", () => {
    for (const [a, b] of [
      [0.5, 0.5],
      [1.5, 10.5],
      [10.5, 1.5],
      [25.5, 25.5],
    ]) {
      for (const p of [0.05, 0.5, 0.95]) {
        const x = betaQuantile(a, b, p);
        expect(incompleteBeta(a, b, x)).toBeCloseTo(p, 9);
      }
    }
  });

  it("matches the median of the uniform distribution", () => {
    expect(betaQuantile(1, 1, 0.5)).toBeCloseTo(0.5, 9);
  });

  it("rises with p", () => {
    expect(betaQuantile(3.5, 7.5, 0.05)).toBeLessThan(betaQuantile(3.5, 7.5, 0.95));
  });
});

describe("the Jeffreys range", () => {
  it("starts at 0 when no year had fire", () => {
    const range = jeffreysRange(0, 10);
    expect(range.lo).toBe(0);
    expect(range.hi as number).toBeGreaterThan(0);
    expect(range.hi as number).toBeLessThan(1);
  });

  it("ends at 1 when every year had fire", () => {
    const range = jeffreysRange(10, 10);
    expect(range.hi).toBe(1);
    expect(range.lo as number).toBeLessThan(1);
  });

  it("is null at both ends with no past year", () => {
    expect(jeffreysRange(0, 0)).toStrictEqual({ lo: null, hi: null });
  });

  it("holds the share inside the range", () => {
    const range = jeffreysRange(5, 10);
    expect(range.lo as number).toBeLessThan(0.5);
    expect(range.hi as number).toBeGreaterThan(0.5);
  });

  it("narrows as the years pile up", () => {
    const few = jeffreysRange(5, 10);
    const many = jeffreysRange(50, 100);
    const widthFew = (few.hi as number) - (few.lo as number);
    const widthMany = (many.hi as number) - (many.lo as number);
    expect(widthMany).toBeLessThan(widthFew);
  });
});

describe("chance", () => {
  const s = series([
    month(2019, 7, 0),
    month(2020, 7, 0.4),
    month(2021, 7, 0.5),
    month(2022, 7, 12),
    month(2023, 7, null),
    month(2024, 7, 3),
    month(2025, 7, 50),
  ]);

  it("counts a year as fire at half a hotspot or more", () => {
    const got = chance(s, 7, 2025);
    expect(got.years).toBe(5);
    expect(got.fireYears).toBe(3);
    expect(got.p).toBeCloseTo(0.6, 12);
  });

  it("gives null figures with no past year", () => {
    expect(chance(s, 7, 2019)).toStrictEqual({ p: null, lo: null, hi: null, fireYears: 0, years: 0 });
  });
});

describe("rankWindow", () => {
  const current = { year: 2026, hot: 50, frp: 100, estimated: false };

  it("ranks 1 when nothing was higher", () => {
    const got = rankWindow(8, "2026-11-14", current, [
      { year: 2024, hot: 10, frp: 20, estimated: false },
      { year: 2025, hot: 49, frp: 20, estimated: false },
    ]);
    expect(got.rank).toBe(1);
    expect(got.of).toBe(3);
    expect(got.days).toBe(8);
    expect(got.end).toBe("2026-11-14");
  });

  it("lets ties share the better rank", () => {
    const got = rankWindow(8, "2026-11-14", current, [
      { year: 2023, hot: 80, frp: 1, estimated: false },
      { year: 2024, hot: 50, frp: 1, estimated: false },
      { year: 2025, hot: 50, frp: 1, estimated: false },
    ]);
    expect(got.rank).toBe(2);
    expect(got.of).toBe(4);
  });

  it("leaves a year with no measurement out of the ranking but keeps its row", () => {
    const got = rankWindow(8, "2026-11-14", current, [
      { year: 2024, hot: null, frp: null, estimated: false },
      { year: 2025, hot: 90, frp: 1, estimated: false },
    ]);
    expect(got.rank).toBe(2);
    expect(got.of).toBe(2);
    expect(got.past).toHaveLength(2);
    expect(got.past[0].hot).toBeNull();
  });

  it("gives a null rank with no past year", () => {
    const got = rankWindow(8, "2026-11-14", current, []);
    expect(got.rank).toBeNull();
    expect(got.of).toBe(1);
  });

  it("marks years before 2012 estimated", () => {
    const got = rankWindow(8, "2026-11-14", current, [
      { year: 2011, hot: 1, frp: 1, estimated: false },
      { year: 2012, hot: 1, frp: 1, estimated: true },
    ]);
    expect(got.past[0].estimated).toBe(true);
    expect(got.past[1].estimated).toBe(false);
    expect(got.current.estimated).toBe(false);
  });

  it("labels a window by the year of its last day", () => {
    expect(windowYearLabel("2026-01-03")).toBe(2026);
  });
});

describe("trend", () => {
  it("needs five complete years", () => {
    const four = series([...wholeYear(2001, 1), ...wholeYear(2002, 2), ...wholeYear(2003, 3), ...wholeYear(2004, 4)]);
    const got = trend(four);
    expect(got.years).toBe(4);
    expect(got.slopePerYear).toBeNull();
    expect(got.perDecadeShare).toBeNull();
  });

  it("fits the slope of the yearly totals", () => {
    const months: MonthPoint[] = [];
    for (let y = 2001; y <= 2005; y++) months.push(...wholeYear(y, y - 2000));
    const got = trend(series(months));
    expect(got.years).toBe(5);
    // Each year totals 12 x (y - 2000), so the yearly totals rise by 12.
    expect(got.slopePerYear).toBeCloseTo(12, 9);
    expect(got.perDecadeShare).toBeCloseTo((10 * 12) / 36, 9);
  });

  it("drops a year with a month that has no measurement", () => {
    const months: MonthPoint[] = [];
    for (let y = 2001; y <= 2005; y++) months.push(...wholeYear(y, 5));
    months.push(...wholeYear(2006, 5).slice(0, 11), month(2006, 12, null));
    const got = trend(series(months));
    expect(got.years).toBe(5);
  });

  it("gives a null share when the mean year is 0", () => {
    const months: MonthPoint[] = [];
    for (let y = 2001; y <= 2006; y++) months.push(...wholeYear(y, 0));
    const got = trend(series(months));
    expect(got.slopePerYear).toBeCloseTo(0, 12);
    expect(got.perDecadeShare).toBeNull();
  });
});

describe("extremes", () => {
  it("takes the worst month over every month with a value", () => {
    const months = [...wholeYear(2001, 1), month(2002, 3, 99), month(2002, 4, null)];
    const got = extremes(series(months));
    expect(got.worstMonth).toStrictEqual({ y: 2002, m: 3, value: 99 });
  });

  it("gives a tie to the earlier month", () => {
    const got = extremes(series([month(2001, 5, 7), month(2001, 6, 7), month(2002, 1, 7)]));
    expect(got.worstMonth).toStrictEqual({ y: 2001, m: 5, value: 7 });
  });

  it("takes the worst year over complete years only", () => {
    const months = [...wholeYear(2001, 2), ...wholeYear(2002, 1), month(2003, 1, 500)];
    const got = extremes(series(months));
    expect(got.worstYear).toStrictEqual({ y: 2001, value: 24 });
  });

  it("gives a tie to the earlier year", () => {
    const got = extremes(series([...wholeYear(2001, 3), ...wholeYear(2002, 3)]));
    expect(got.worstYear?.y).toBe(2001);
  });

  it("is null on a series with no measurement at all", () => {
    const got = extremes(series([month(2001, 1, null)]));
    expect(got.worstMonth).toBeNull();
    expect(got.worstYear).toBeNull();
  });
});
