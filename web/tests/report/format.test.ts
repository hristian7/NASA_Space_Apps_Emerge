import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatIsoDate,
  formatPercent,
  formatRange,
  formatRatio,
  formatSigned,
  monthInitial,
  monthLong,
  monthShort,
  monthYearLong,
  monthYearShort,
} from "../../src/components/report/lib/format";

describe("formatCount", () => {
  it("groups thousands the way each language does", () => {
    expect(formatCount(1234567, "en")).toBe("1,234,567");
    // Bulgarian groups with a space, not a comma.
    expect(formatCount(1234567, "bg").replace(/ /g, " ")).toBe(
      "1 234 567",
    );
  });

  it("rounds to whole numbers", () => {
    expect(formatCount(1234.6, "en")).toBe("1,235");
  });

  it("gives an empty string for no measurement", () => {
    expect(formatCount(null, "en")).toBe("");
    expect(formatCount(undefined, "bg")).toBe("");
    expect(formatCount(Number.NaN, "en")).toBe("");
  });

  it("keeps zero as zero, never as empty (M19)", () => {
    expect(formatCount(0, "en")).toBe("0");
    expect(formatCount(0, "bg")).toBe("0");
  });
});

describe("formatRatio", () => {
  it("keeps one decimal place in both languages", () => {
    expect(formatRatio(2.14, "en")).toBe("2.1");
    expect(formatRatio(2.14, "bg")).toBe("2,1");
    expect(formatRatio(2, "en")).toBe("2.0");
  });

  it("gives an empty string when there is no ratio", () => {
    expect(formatRatio(null, "en")).toBe("");
  });
});

describe("formatPercent", () => {
  it("writes a share of one as a whole percentage", () => {
    expect(formatPercent(0.72, "en")).toBe("72%");
    expect(formatPercent(1, "en")).toBe("100%");
    // Where the per-cent sign sits is the language's own business; the figure
    // and the sign must both be there.
    const bulgarian = formatPercent(0.72, "bg");
    expect(bulgarian).toContain("72");
    expect(bulgarian).toContain("%");
  });

  it("gives an empty string for a missing share", () => {
    expect(formatPercent(null, "bg")).toBe("");
  });
});

describe("formatSigned", () => {
  it("always shows the sign of a change", () => {
    expect(formatSigned(41.6, "en")).toBe("+41.6");
    expect(formatSigned(-41.6, "en")).toBe("-41.6");
    expect(formatSigned(0, "en")).toBe("0.0");
  });

  it("drops the decimal for a large change", () => {
    expect(formatSigned(412.4, "en")).toBe("+412");
  });
});

describe("month names", () => {
  it("names every month in both languages", () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(monthLong(m, "en").length).toBeGreaterThan(2);
      expect(monthLong(m, "bg").length).toBeGreaterThan(2);
      expect(monthShort(m, "en").length).toBeGreaterThan(1);
      expect(monthShort(m, "bg").length).toBeGreaterThan(1);
      expect(monthInitial(m, "en")).toHaveLength(1);
      expect(monthInitial(m, "bg")).toHaveLength(1);
    }
  });

  it("writes a month and year", () => {
    expect(monthYearLong(2024, 8, "en")).toBe("August 2024");
    expect(monthYearLong(2024, 8, "bg")).toBe("август 2024");
    expect(monthYearShort(2024, 11, "en")).toBe("Nov 2024");
    expect(monthYearShort(2024, 11, "bg")).toBe("ное 2024");
  });

  it("says only the year for a month outside 1 to 12", () => {
    expect(monthYearLong(2024, 13, "en")).toBe("2024");
  });
});

describe("formatIsoDate", () => {
  it("writes the date the way each language does", () => {
    expect(formatIsoDate("2026-11-14", "en")).toContain("2026");
    expect(formatIsoDate("2026-11-14", "en")).toContain("14");
    expect(formatIsoDate("2026-11-14", "bg")).toContain("2026");
  });

  it("hands back anything that is not an ISO date", () => {
    expect(formatIsoDate("later", "en")).toBe("later");
  });
});

describe("formatRange", () => {
  it("joins the two ends", () => {
    expect(formatRange(159, 295, "en", "to")).toBe("159 to 295");
  });

  it("gives an empty string when either end is missing", () => {
    expect(formatRange(null, 295, "en", "to")).toBe("");
    expect(formatRange(159, null, "en", "to")).toBe("");
  });
});
