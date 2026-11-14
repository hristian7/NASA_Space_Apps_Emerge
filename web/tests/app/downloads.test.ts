import { describe, expect, it } from "vitest";
import type { MetaFile } from "../../src/types/data";
import type { Series } from "../../src/types/ui";
import { csvFilename, csvHeader, monthlyFile, summaryFile } from "../../src/components/app/downloads";
import { chance, extremes, trend, unusual } from "../../src/lib/stats";
import { LEGEND_LINE } from "../../src/lib/csv";

const meta = {
  last_data_day: "2025-12-31",
  sources: [
    { id: "a", name: "First source", used_for: "", url: null, licence: null, fetched: null },
    { id: "b", name: "Second source", used_for: "", url: null, licence: null, fetched: null },
  ],
} as unknown as MetaFile;

const series: Series = {
  unit: "cd",
  months: [
    { y: 2024, m: 7, value: 12, lo: 10, hi: 14, src: "measured", flags: [] },
    { y: 2024, m: 8, value: null, lo: null, hi: null, src: null, flags: ["example", "low_confidence"] },
    { y: 2024, m: 9, value: 0, lo: 0, hi: 0, src: "measured", flags: [] },
  ],
  cellCount: 1,
  lowConfidence: false,
};

const header = csvHeader({
  selection: { kind: "country", iso3: "BGR" },
  meta,
  from: { y: 2024, m: 7 },
  to: { y: 2024, m: 9 },
  title: "Emerge: monthly fire numbers",
});

describe("the monthly CSV", () => {
  const text = monthlyFile(series, header);
  const lines = text.split("\n");

  it("opens with the comment lines the rules ask for", () => {
    expect(lines[0]).toBe("# Emerge: monthly fire numbers");
    expect(lines[1]).toBe("# Selection: Country Bulgaria (BGR)");
    expect(lines[2]).toBe("# Dates: Jul 2024 to Sep 2024");
    expect(lines[3]).toBe("# Data date: 2025-12-31");
    expect(lines[4]).toBe("# Sources: First source; Second source");
    expect(lines[5]).toBe(`# ${LEGEND_LINE}`);
  });

  it("names its columns in the frozen order", () => {
    expect(lines[6]).toBe("year,month,unit,value,low,high,source,flags");
  });

  it("writes an empty field for no measurement and 0 for no fire", () => {
    expect(lines[7]).toBe("2024,7,cd,12,10,14,measured,");
    expect(lines[8]).toBe("2024,8,cd,,,,,example|low_confidence");
    expect(lines[9]).toBe("2024,9,cd,0,0,0,measured,");
  });
});

describe("the summary CSV", () => {
  const text = summaryFile(
    {
      extremes: extremes(series),
      trend: trend(series),
      unusual: unusual(series, 2024, 9),
      chance: chance(series, 9, 2024),
    },
    csvHeader({
      selection: { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 },
      meta,
      from: { y: 2024, m: 7 },
      to: { y: 2024, m: 9 },
      title: "Emerge: summary of the fire record",
      notices: ["Selected month: 2024-09"],
    }),
  );
  const lines = text.split("\n");

  it("carries the extra notice before the legend line", () => {
    expect(lines[5]).toBe("# Selected month: 2024-09");
    expect(lines[6]).toBe(`# ${LEGEND_LINE}`);
    expect(lines[7]).toBe("key,value");
  });

  it("holds the figures the logic worked out", () => {
    expect(text).toContain("worst_month,2024-07");
    expect(text).toContain("worst_month_value,12");
    expect(text).toContain("unusual_status,no_history");
  });
});

describe("file names", () => {
  it("keep to letters, numbers and dashes", () => {
    expect(csvFilename(["emerge", "monthly", "cd", "42.700, 23.300"])).toBe(
      "emerge-monthly-cd-42-700-23-300.csv",
    );
    expect(csvFilename([])).toBe("emerge.csv");
  });
});
