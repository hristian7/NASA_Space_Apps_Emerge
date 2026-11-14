import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { clipSeries, historyYears } from "../../src/components/app/adapter";
import { unusual, unusualFromHistory } from "../../src/lib/stats/unusual";
import { formatComparisonYears, unusualText } from "../../src/components/report/lib/sentences";
import type { Series } from "../../src/types/ui";
import { translateFor } from "../report/translate";
import app from "../../messages/app.en.json";
import appBg from "../../messages/app.bg.json";

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

  it.each([
    [full, 2003, "2000 to 2001", 2],
    [full, 2005, "2000 to 2001, 2003 to 2004", 4],
    [clipSeries(full, { y: 2001, m: 8 }, { y: 2005, m: 8 }), 2005, "2001, 2003 to 2004", 3],
  ])("lists the actual years for %s in %i", (input, year, list, count) => {
    const years = historyYears(input, year, 8);
    const t = createTranslator({ locale: "en", messages: app });
    const shown = t("comparedWith", { month: "August", list: formatComparisonYears(years, "en"), years: years.length });
    expect(shown).toBe(`Compared with August in ${list}: ${count} years.`);
    expect(years.length).toBe(unusual(input, year, 8).years);
    expect(shown).not.toContain("2002");
  });

  it("lists gaps in Bulgarian and uses the singular for one year", () => {
    const t = createTranslator({ locale: "bg", messages: appBg });
    expect(t("comparedWith", { month: "август", list: formatComparisonYears([2000, 2001, 2003], "bg"), years: 3 }))
      .toBe("Сравнено с август през 2000 до 2001, 2003: 3 години.");
    expect(t("comparedWith", { month: "август", list: formatComparisonYears([2003], "bg"), years: 1 }))
      .toBe("Сравнено с август през 2003: 1 година.");
  });
});

describe("sentences immediately around the normal median", () => {
  it.each([
    [125.01, "Higher than usual for this month."],
    [74.99, "Lower than usual for this month."],
  ])("uses the correct directional headline for %s against a median of 100", (value, headline) => {
    const result = unusualFromHistory(value, [100, 100, 100]);
    expect(unusualText(result, 8, english).headline).toBe(headline);
  });

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
