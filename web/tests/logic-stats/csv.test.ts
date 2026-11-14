/**
 * The CSV downloads: the text rules of docs/number-logic.md section 8.
 *
 * Our own tests. The authority on the exact text is expected.test.ts.
 */

import { describe, expect, it } from "vitest";

import type { MonthPoint, Series } from "../../src/types/ui";
import {
  csvField,
  decimalNumber,
  headerLines,
  monthlyCsv,
  summaryCsv,
  summaryRows,
  wholeNumber,
  LEGEND_LINE,
  type CsvHeader,
} from "../../src/lib/csv";

const header: CsvHeader = {
  title: "Emerge: monthly fire history",
  selection: "Point 42.70 N, 23.32 E, within 50 km",
  dateRange: "Nov 2000 to Oct 2026",
  dataDate: "2026-11-14",
  sources: ["NASA FIRMS", "Emerge harmonization v1"],
};

function month(y: number, m: number, value: number | null, extra: Partial<MonthPoint> = {}): MonthPoint {
  return { y, m, value, lo: null, hi: null, src: null, flags: [], ...extra };
}

function series(months: MonthPoint[]): Series {
  return { unit: "hot", months, cellCount: 4, lowConfidence: false };
}

describe("csv fields", () => {
  it("quotes a field with a comma", () => {
    expect(csvField("a,b")).toBe('"a,b"');
  });

  it("quotes a field with a quote and doubles the quote", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("leaves a plain field alone", () => {
    expect(csvField("measured")).toBe("measured");
  });
});

describe("numbers in a csv", () => {
  it("writes an empty field for null", () => {
    expect(wholeNumber(null)).toBe("");
    expect(decimalNumber(null)).toBe("");
  });

  it("writes zero as 0", () => {
    expect(wholeNumber(0)).toBe("0");
    expect(wholeNumber(-0)).toBe("0");
    expect(wholeNumber(0.4)).toBe("0");
  });

  it("rounds half up", () => {
    expect(wholeNumber(0.5)).toBe("1");
    expect(wholeNumber(1.5)).toBe("2");
    expect(wholeNumber(2.5)).toBe("3");
    expect(wholeNumber(12.49)).toBe("12");
  });

  it("cuts trailing zeros off a decimal", () => {
    expect(decimalNumber(2.5)).toBe("2.5");
    expect(decimalNumber(1 / 3)).toBe("0.333333");
    expect(decimalNumber(7)).toBe("7");
  });
});

describe("the comment block", () => {
  it("holds the six lines the rules ask for, in order", () => {
    const lines = headerLines(header).split("\n").filter(Boolean);
    expect(lines).toStrictEqual([
      "# Emerge: monthly fire history",
      "# Selection: Point 42.70 N, 23.32 E, within 50 km",
      "# Dates: Nov 2000 to Oct 2026",
      "# Data date: 2026-11-14",
      "# Sources: NASA FIRMS; Emerge harmonization v1",
      `# ${LEGEND_LINE}`,
    ]);
  });

  it("adds a notice line before the legend", () => {
    const lines = headerLines({ ...header, notices: ["Cut at 100000 rows"] })
      .split("\n")
      .filter(Boolean);
    expect(lines[5]).toBe("# Cut at 100000 rows");
    expect(lines[6]).toBe(`# ${LEGEND_LINE}`);
  });

  it("uses exact lines when they are given", () => {
    expect(headerLines({ ...header, lines: ["one", "# two"] })).toBe("# one\n# two\n");
  });
});

describe("monthlyCsv", () => {
  const csv = monthlyCsv(
    series([
      month(2024, 7, 12.6, { lo: 10.2, hi: 15.8, src: "measured", flags: [] }),
      month(2024, 8, 0, { lo: 0, hi: 0, src: "measured", flags: ["partial_month", "low_confidence"] }),
      month(2024, 9, null),
    ]),
    header,
  );
  const lines = csv.split("\n");

  it("ends every line with a newline and nothing else", () => {
    expect(csv.endsWith("\n")).toBe(true);
    expect(csv.includes("\r")).toBe(false);
    expect(lines[lines.length - 1]).toBe("");
  });

  it("writes the column line after the comments", () => {
    expect(lines[6]).toBe("year,month,unit,value,low,high,source,flags");
  });

  it("rounds the values and names the unit", () => {
    expect(lines[7]).toBe("2024,7,hot,13,10,16,measured,");
  });

  it("writes zero as 0 and joins flags with a bar", () => {
    expect(lines[8]).toBe("2024,8,hot,0,0,0,measured,partial_month|low_confidence");
  });

  it("leaves a month with no measurement empty", () => {
    expect(lines[9]).toBe("2024,9,hot,,,,,");
  });

  it("holds one row per month of the series", () => {
    expect(lines.filter(Boolean)).toHaveLength(6 + 1 + 3);
  });
});

describe("summaryCsv", () => {
  const figures = {
    extremes: {
      worstMonth: { y: 2024, m: 8, value: 1234.6 },
      worstYear: { y: 2024, value: 5678.2 },
    },
    trend: { slopePerYear: 12.5, perDecadeShare: 0.3456789, years: 20 },
    unusual: {
      status: "above" as const,
      value: 100,
      median: 40,
      mean: 44,
      ratioMedian: 2.5,
      ratioMean: 2.272727,
      higherThan: 23,
      years: 25,
    },
    chance: { p: 0.6, lo: 0.3614, hi: 0.8043, fireYears: 15, years: 25 },
  };
  const csv = summaryCsv(figures, { ...header, title: "Emerge: summary" });
  const lines = csv.split("\n").filter(Boolean);

  it("writes key and value, one row per figure", () => {
    expect(lines[6]).toBe("key,value");
    expect(lines.slice(7)).toStrictEqual([
      "worst_month,2024-08",
      "worst_month_value,1235",
      "worst_year,2024",
      "worst_year_value,5678",
      "trend_per_decade_share,0.345679",
      "unusual_status,above",
      "unusual_ratio_median,2.5",
      "unusual_ratio_mean,2.272727",
      "chance_of_fire,0.6",
      "chance_of_fire_low,0.3614",
      "chance_of_fire_high,0.8043",
    ]);
  });

  it("leaves a figure that does not exist empty", () => {
    const rows = summaryRows({
      extremes: { worstMonth: null, worstYear: null },
      trend: { slopePerYear: null, perDecadeShare: null, years: 0 },
      unusual: {
        status: "no_history",
        value: null,
        median: null,
        mean: null,
        ratioMedian: null,
        ratioMean: null,
        higherThan: 0,
        years: 0,
      },
      chance: { p: null, lo: null, hi: null, fireYears: 0, years: 0 },
    });
    expect(rows.find(([key]) => key === "worst_month")?.[1]).toBe("");
    expect(rows.find(([key]) => key === "chance_of_fire")?.[1]).toBe("");
    expect(rows.find(([key]) => key === "unusual_status")?.[1]).toBe("no_history");
  });

  it("quotes a comment-free field that holds a comma", () => {
    const rows = summaryRows(figures);
    expect(rows).toHaveLength(11);
  });
});
