import { describe, expect, it } from "vitest";
import type { Chance, Unusual, WindowComparison } from "../../src/types/ui";
import {
  chanceText,
  isEstimated,
  sourceLabel,
  unusualFigure,
  unusualText,
  windowRankText,
} from "../../src/components/report/lib/sentences";
import { translateFor } from "./translate";

const en = { t: translateFor("en"), locale: "en" as const };
const bg = { t: translateFor("bg"), locale: "bg" as const };

function unusual(overrides: Partial<Unusual> = {}): Unusual {
  return {
    status: "above",
    value: 1860,
    median: 886,
    mean: 1033,
    ratioMedian: 2.1,
    ratioMean: 1.8,
    higherThan: 23,
    years: 25,
    ...overrides,
  };
}

describe("unusualText", () => {
  it("builds the three clauses M5 asks for, in order", () => {
    const text = unusualText(unusual(), 11, en);
    expect(text.clauses).toEqual([
      "2.1 times the usual November (median)",
      "1.8 times the average",
      "higher than 23 of 25 years",
    ]);
    expect(text.headline).toBe("Higher than usual for this month.");
  });

  it("builds the same clauses in Bulgarian, with Bulgarian numbers", () => {
    const text = unusualText(unusual(), 11, bg);
    expect(text.clauses[0]).toBe("2,1 пъти обичайния ноември (медиана)");
    expect(text.clauses[1]).toBe("1,8 пъти средното");
    expect(text.clauses[2]).toBe("по-високо от 23 от 25 години");
  });

  it("says so plainly when there is no history", () => {
    const text = unusualText(
      unusual({
        status: "no_history",
        median: null,
        mean: null,
        ratioMedian: null,
        ratioMean: null,
        years: 2,
      }),
      3,
      en,
    );
    expect(text.clauses).toHaveLength(1);
    expect(text.clauses[0]).toContain("three past March");
    expect(text.headline).toBe("Not enough past years to compare.");
  });

  it("says so plainly when the month is too early", () => {
    const text = unusualText(unusual({ status: "too_early" }), 11, en);
    expect(text.clauses).toHaveLength(1);
    expect(text.clauses[0]).toContain("eight days");
  });

  it("says no fire was seen when the value is zero, not that it is below", () => {
    const text = unusualText(unusual({ status: "below", value: 0 }), 2, en);
    expect(text.clauses[0]).toBe("No fire was seen this February.");
    expect(text.clauses.some((clause) => clause.includes("average"))).toBe(
      false,
    );
  });

  it("calls a first fire a first fire when the usual level is zero", () => {
    const text = unusualText(
      unusual({ value: 44, median: 0, ratioMedian: null, ratioMean: 24.4 }),
      2,
      en,
    );
    expect(text.clauses[0]).toBe("The first February with fire here in 25 years.");
  });

  it("drops the average clause when there is no average", () => {
    const text = unusualText(unusual({ ratioMean: null }), 11, en);
    expect(text.clauses).toEqual([
      "2.1 times the usual November (median)",
      "higher than 23 of 25 years",
    ]);
  });

  it("names every status in both languages", () => {
    for (const status of [
      "above",
      "near",
      "below",
      "no_history",
      "too_early",
    ] as const) {
      for (const context of [en, bg]) {
        const text = unusualText(unusual({ status }), 8, context);
        expect(text.headline.length).toBeGreaterThan(5);
        expect(text.clauses.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("unusualFigure", () => {
  it("shows the ratio when there is one", () => {
    expect(unusualFigure(unusual(), "en")).toBe("2.1");
  });

  it("shows the value itself when there is no ratio", () => {
    expect(unusualFigure(unusual({ ratioMedian: null }), "en")).toBe("1,860");
  });

  it("shows zero for a month with no fire", () => {
    expect(unusualFigure(unusual({ value: 0 }), "en")).toBe("0");
  });
});

describe("chanceText", () => {
  const chance: Chance = {
    p: 0.72,
    lo: 0.54,
    hi: 0.86,
    fireYears: 18,
    years: 25,
  };

  it("gives the share, the range and the count", () => {
    const text = chanceText(chance, 8, en);
    expect(text.figure).toBe("72%");
    expect(text.range).toBe("Range 54% to 86%");
    expect(text.detail).toBe("August had fire in 18 of 25 past years.");
  });

  it("gives the Bulgarian wording", () => {
    const text = chanceText(chance, 8, bg);
    expect(text.detail).toBe("август е имал пожар в 18 от 25 минали години.");
  });

  it("says so when no past year has a measurement", () => {
    const text = chanceText(
      { p: null, lo: null, hi: null, fireYears: 0, years: 0 },
      2,
      en,
    );
    expect(text.figure).toBe("");
    expect(text.range).toBe("");
    expect(text.detail).toBe("No past February here has a measurement.");
  });

  it("leaves the range out when only one end is known", () => {
    const text = chanceText({ ...chance, hi: null }, 8, en);
    expect(text.range).toBe("");
    expect(text.figure).toBe("72%");
  });
});

describe("windowRankText", () => {
  function comparison(
    overrides: Partial<WindowComparison> = {},
  ): WindowComparison {
    return {
      days: 8,
      end: "2026-11-14",
      current: { year: 2026, hot: 412, frp: 3180, estimated: false },
      past: [],
      rank: 2,
      of: 11,
      ...overrides,
    };
  }

  it("puts the rank in words", () => {
    expect(windowRankText(comparison(), en)).toBe(
      "Number 2 of 11 years, over the same 8 days.",
    );
  });

  it("names the top rank without a number first", () => {
    expect(windowRankText(comparison({ rank: 1 }), en)).toBe(
      "The highest of the 11 years with a measurement.",
    );
  });

  it("says so when no past year can be ranked", () => {
    expect(windowRankText(comparison({ rank: null, of: 1 }), en)).toContain(
      "No past year",
    );
    expect(windowRankText(comparison({ rank: null, of: 1 }), bg)).toContain(
      "Няма минала година",
    );
  });
});

describe("source labels", () => {
  it("reads estimated from the src label, not from the date", () => {
    expect(isEstimated("estimated_terra")).toBe(true);
    expect(isEstimated("estimated_modis")).toBe(true);
    expect(isEstimated("measured")).toBe(false);
    expect(isEstimated("measured_calibrated")).toBe(false);
    expect(isEstimated(null)).toBe(false);
  });

  it("names every label in both languages", () => {
    for (const context of [en, bg]) {
      expect(sourceLabel("estimated_modis", context.t)).toBe(
        context.t("source.estimated"),
      );
      expect(sourceLabel("measured_calibrated", context.t)).toBe(
        context.t("source.measured"),
      );
      expect(sourceLabel("provisional", context.t)).toBe(
        context.t("source.provisional"),
      );
      expect(sourceLabel(null, context.t)).toBe(context.t("source.none"));
    }
  });
});
