import { describe, expect, it } from "vitest";
import { cumulativeSeason } from "../../src/components/report/lib/aggregate";
import type { MonthPoint, Series } from "../../src/types/ui";

const point = (y: number, m: number, value: number | null): MonthPoint => ({ y, m, value, lo: value, hi: value, src: null, flags: [] });
const series = (months: MonthPoint[]): Series => ({ unit: "cd", months, cellCount: 1, lowConfidence: false });

describe("cumulative season", () => {
  it("leaves an early year without a historical median", () => {
    const result = cumulativeSeason(series([point(2001, 1, 4)]), 2001, "2026-11-14");
    expect(result[0]).toMatchObject({ current: 4, median: null });
  });
  it("does not bridge gaps in either the selected year or the baseline", () => {
    const result = cumulativeSeason(series([point(2024, 1, 2), point(2024, 2, null), point(2024, 3, 9), point(2025, 1, 4), point(2025, 2, null), point(2025, 3, 5)]), 2025, "2026-11-14");
    expect(result[0]).toMatchObject({ current: 4, median: 2 });
    expect(result[1]).toMatchObject({ current: null, median: null });
    expect(result[2]).toMatchObject({ current: null, median: null });
  });
  it("excludes the current part month and later months", () => {
    const result = cumulativeSeason(series([point(2026, 1, 1), point(2026, 2, 2), point(2026, 3, 100)]), 2026, "2026-03-14");
    expect(result).toHaveLength(2);
    expect(result[1].current).toBe(3);
  });
});
