import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { clipSeries, historyYears } from "../../src/components/app/adapter";
import { unusual, unusualFromHistory } from "../../src/lib/stats/unusual";
import { unusualText } from "../../src/components/report/lib/sentences";
import type { Series } from "../../src/types/ui";
import { translateFor } from "../report/translate";
import app from "../../messages/app.en.json";

function series(years: Array<[number, number | null]>): Series {
  return {
    unit: "hot", cellCount: 1, lowConfidence: false,
    months: years.map(([y, value]) => ({ y, m: 8, value, lo: null, hi: null, src: null, flags: [] })),
  };
}

const full = series([[2000, 10], [2001, 20], [2002, null], [2003, 30], [2004, 40], [2005, 50], [2006, 60]]);
const english = { t: translateFor("en"), locale: "en" as const };

describe("comparison years follow the numbers used", () => {
  it("uses only earlier measured years for an early year", () => {
    expect(historyYears(full, 2003, 8)).toEqual([2000, 2001]);
    expect(unusual(full, 2003, 8).years).toBe(2);
    expect(unusual(full, 2003, 8).status).toBe("no_history");
  });

  it("omits the missing year and includes the measured years", () => {
    expect(historyYears(full, 2005, 8)).toEqual([2000, 2001, 2003, 2004]);
    expect(unusual(full, 2005, 8).years).toBe(4);
    expect(unusual(full, 2005, 8).median).toBe(25);
  });

  it("recalculates both the years and the median after the range changes", () => {
    const clipped = clipSeries(full, { y: 2001, m: 8 }, { y: 2005, m: 8 });
    expect(historyYears(clipped, 2005, 8)).toEqual([2001, 2003, 2004]);
    expect(unusual(clipped, 2005, 8).years).toBe(3);
    expect(unusual(clipped, 2005, 8).median).toBe(30);
  });

  // Strict expected failure: the shipped notice prints endpoints, not the years between them.
  it.fails("lists each actual year when there is a gap", () => {
    const years = historyYears(full, 2005, 8);
    const t = createTranslator({ locale: "en", messages: app });
    const shown = t("comparedWith", { month: "August", first: years[0], last: years.at(-1)!, years: years.length });
    expect(shown).toContain("2001");
    expect(shown).toContain("2003");
    expect(shown).not.toContain("2002");
  });
});

describe("sentences immediately around the normal median", () => {
  it.each([
    [100.1, "About the usual level for this month.", 3],
    [100, "About the usual level for this month.", 0],
    [99.9, "About the usual level for this month.", 0],
  ])("describes %s against a median of 100", (value, headline, higher) => {
    const result = unusualFromHistory(value, [100, 100, 100]);
    const text = unusualText(result, 8, english);
    expect(result.median).toBe(100);
    expect(result.higherThan).toBe(higher);
    expect(text.headline).toBe(headline);
    expect(text.clauses).toContain(`higher than ${higher} of 3 years`);
  });
});
