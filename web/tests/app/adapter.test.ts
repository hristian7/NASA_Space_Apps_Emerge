import { describe, expect, it } from "vitest";
import type { MonthPoint, Selection, Series } from "../../src/types/ui";
import {
  anomalyPoints,
  clipByMonth,
  clipSeries,
  hotspotsLink,
  isLargeArea,
  lastMonthWithData,
  monthRank,
  noFireEver,
  rangeForCsv,
  resolveMonth,
  scopeOf,
  selectionForCsv,
  typicalFireDays,
} from "../../src/components/app/adapter";
import { historyFor, median, unusual } from "../../src/lib/stats";

function month(y: number, m: number, value: number | null): MonthPoint {
  return { y, m, value, lo: value, hi: value, src: "measured", flags: [] };
}

function seriesOf(months: MonthPoint[], extra: Partial<Series> = {}): Series {
  return { unit: "cd", months, cellCount: 1, lowConfidence: false, ...extra };
}

/** Five Augusts, then a sixth that is well above their median. */
const augusts = seriesOf([
  month(2019, 8, 10),
  month(2020, 8, 20),
  month(2021, 8, 30),
  month(2022, 8, 40),
  month(2023, 8, 50),
  month(2024, 8, 200),
]);

describe("clipping to a date range", () => {
  const series = seriesOf([
    month(2000, 11, 1),
    month(2000, 12, 2),
    month(2001, 1, 3),
    month(2001, 2, 4),
  ]);

  it("keeps both ends of the range", () => {
    const clipped = clipSeries(series, { y: 2000, m: 12 }, { y: 2001, m: 1 });
    expect(clipped.months.map((point) => [point.y, point.m])).toEqual([
      [2000, 12],
      [2001, 1],
    ]);
  });

  it("carries the series' own fields through", () => {
    const low = seriesOf(series.months, { lowConfidence: true, cellCount: 1, unit: "hot" });
    const clipped = clipSeries(low, { y: 2001, m: 1 }, null);
    expect(clipped.lowConfidence).toBe(true);
    expect(clipped.unit).toBe("hot");
  });

  it("returns the same series when neither end is set", () => {
    expect(clipSeries(series, null, null)).toBe(series);
  });

  it("clips anything else keyed by month the same way", () => {
    const rows = [
      { y: 2000, m: 11, ratio: null },
      { y: 2001, m: 1, ratio: 2 },
    ];
    expect(clipByMonth(rows, { y: 2001, m: 1 }, null)).toEqual([rows[1]]);
  });

  it("orders months so a range test is one comparison", () => {
    expect(monthRank({ y: 2001, m: 1 })).toBeGreaterThan(monthRank({ y: 2000, m: 12 }));
  });
});

describe("the anomaly ramp", () => {
  it("takes every ratio from the stats module, month by month", () => {
    const points = anomalyPoints(augusts);
    for (const point of points) {
      expect(point.ratio).toBe(unusual(augusts, point.y, point.m).ratioMedian);
    }
  });

  it("has no ratio before there is enough history", () => {
    const points = anomalyPoints(augusts);
    expect(points[0].ratio).toBeNull();
    expect(points[1].ratio).toBeNull();
    expect(points[2].ratio).toBeNull();
    // Four past Augusts by 2023: the median of 10, 20, 30, 40 is 25.
    expect(points[4].ratio).toBeCloseTo(50 / 25, 10);
  });

  it("holds one point per month of the series", () => {
    expect(anomalyPoints(augusts)).toHaveLength(augusts.months.length);
  });
});

describe("the typical month a large area shows instead of a chance", () => {
  it("is there even while the month itself is still being measured", () => {
    const unfinished = seriesOf([...augusts.months, month(2025, 8, null)]);
    expect(typicalFireDays(unfinished, { y: 2025, m: 8 })).toBe(
      median(historyFor(unfinished, 2025, 8)),
    );
    expect(typicalFireDays(unfinished, { y: 2025, m: 8 })).not.toBeNull();
  });

  it("is the stats module's own median of the same month in past years", () => {
    const value = typicalFireDays(augusts, { y: 2024, m: 8 });
    expect(value).toBe(median(historyFor(augusts, 2024, 8)));
    expect(value).toBe(unusual(augusts, 2024, 8).median);
    expect(value).toBe(30);
  });
});

describe("which months the cards and the pickers use", () => {
  it("falls back to the last month that has a measurement", () => {
    const series = seriesOf([month(2025, 11, 5), month(2025, 12, null)]);
    expect(lastMonthWithData(series)).toEqual({ y: 2025, m: 11 });
    expect(resolveMonth(series, null)).toEqual({ y: 2025, m: 11 });
  });

  it("keeps a month the series holds", () => {
    expect(resolveMonth(augusts, { y: 2021, m: 8 })).toEqual({ y: 2021, m: 8 });
  });

  it("drops a month outside the series", () => {
    expect(resolveMonth(augusts, { y: 1999, m: 4 })).toEqual({ y: 2024, m: 8 });
  });
});

describe("a record with no fire in it", () => {
  it("is a record where every measured month is 0", () => {
    expect(noFireEver(seriesOf([month(2001, 1, 0), month(2001, 2, null)]))).toBe(true);
    expect(noFireEver(seriesOf([month(2001, 1, 0), month(2001, 2, 1)]))).toBe(false);
  });

  it("is not claimed when nothing was measured at all", () => {
    expect(noFireEver(seriesOf([month(2001, 1, null)]))).toBe(false);
  });
});

describe("the hotspots link", () => {
  const lastDay = "2025-12-31";

  it("caps a point's distance at the 200 km the route allows", () => {
    const link = hotspotsLink({
      selection: { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 500 },
      year: 2024,
      lastDay,
    });
    const params = new URLSearchParams(link?.href.split("?")[1]);
    expect(params.get("radius_km")).toBe("200");
    expect(params.get("lat")).toBe("42.7");
    expect(link?.box).toBe(false);
  });

  it("asks for one calendar year, never more than 366 days", () => {
    const link = hotspotsLink({
      selection: { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 },
      year: 2024,
      lastDay,
    });
    expect(link?.from).toBe("2024-01-01");
    expect(link?.to).toBe("2024-12-31");
  });

  it("never asks for a day outside the record", () => {
    const first = hotspotsLink({
      selection: { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 },
      year: 2000,
      lastDay,
    });
    expect(first?.from).toBe("2000-11-01");
    const current = hotspotsLink({
      selection: { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 },
      year: 2025,
      lastDay: "2025-06-15",
    });
    expect(current?.to).toBe("2025-06-15");
  });

  it("asks for the box around a drawn area, and says so", () => {
    const link = hotspotsLink({
      selection: {
        kind: "polygon",
        ring: [
          [23.1, 42.5],
          [23.9, 42.5],
          [23.9, 42.9],
          [23.1, 42.5],
        ],
      },
      year: 2024,
      lastDay,
    });
    const params = new URLSearchParams(link?.href.split("?")[1]);
    const [west, south, east, north] = (params.get("bbox") ?? "").split(",").map(Number);
    expect(west).toBeLessThan(23.1);
    expect(east).toBeGreaterThan(23.9);
    expect(south).toBeLessThan(42.5);
    expect(north).toBeGreaterThan(42.9);
    expect(link?.box).toBe(true);
  });

  it("asks for the box the country index holds for a country", () => {
    const link = hotspotsLink({
      selection: { kind: "country", iso3: "BGR" },
      year: 2024,
      lastDay,
      countryBox: { west: 22.36, south: 41.24, east: 28.6, north: 44.22 },
    });
    const params = new URLSearchParams(link?.href.split("?")[1]);
    expect(params.get("bbox")).not.toBeNull();
    expect(link?.box).toBe(true);
  });

  it("asks for one side when a country reaches across the 180 degree line", () => {
    const link = hotspotsLink({
      selection: { kind: "country", iso3: "USA" },
      year: 2024,
      lastDay,
      // The United States, whose box wraps: west 179.49, east -66.74.
      countryBox: { west: 179.49, south: 18.74, east: -66.74, north: 70.51 },
      countryLon: -98.5,
    });
    const params = new URLSearchParams(link?.href.split("?")[1]);
    const [west, south, east, north] = (params.get("bbox") ?? "").split(",").map(Number);
    expect(west).toBe(-180);
    expect(east).toBeGreaterThan(west);
    expect(south).toBeLessThan(north);
    expect(link?.partial).toBe(true);
  });

  it("has no address for a country with no centre to work from", () => {
    expect(
      hotspotsLink({ selection: { kind: "country", iso3: "BGR" }, year: 2024, lastDay }),
    ).toBeNull();
  });
});

describe("naming the selection", () => {
  const cases: [Selection, string][] = [
    [{ kind: "country", iso3: "BGR" }, "Country Bulgaria (BGR)"],
    [{ kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 }, "Point 42.700 N, 23.300 E within 50 km"],
    [{ kind: "point", lat: -12.5, lon: -70.25, radiusKm: 0 }, "Point 12.500 S, 70.250 W, nearest grid square"],
  ];

  it.each(cases)("writes %o in English for the CSV", (selection, expected) => {
    expect(
      selectionForCsv(selection, selection.kind === "country" ? "Bulgaria" : null),
    ).toBe(expected);
  });

  it("writes a drawn area with its corners and its box", () => {
    const text = selectionForCsv({
      kind: "polygon",
      ring: [
        [23.1, 42.5],
        [23.9, 42.5],
        [23.9, 42.9],
        [23.1, 42.5],
      ],
    });
    expect(text).toContain("3 corners");
    expect(text).toContain("west 23.100");
    expect(text).toContain("north 42.900");
  });

  it("writes the date range in English", () => {
    expect(rangeForCsv({ y: 2000, m: 11 }, { y: 2025, m: 12 })).toBe("Nov 2000 to Dec 2025");
  });

  it("knows a country from a smaller area", () => {
    expect(scopeOf({ kind: "country", iso3: "BGR" })).toBe("country");
    expect(scopeOf({ kind: "point", lat: 0, lon: 0, radiusKm: 1 })).toBe("area");
  });
});

describe("which selections are too wide for a chance of fire", () => {
  it("counts a country and anything over 50 km", () => {
    expect(isLargeArea({ kind: "country", iso3: "BGR" })).toBe(true);
    expect(isLargeArea({ kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 })).toBe(false);
    expect(isLargeArea({ kind: "point", lat: 42.7, lon: 23.3, radiusKm: 120 })).toBe(true);
  });

  it("measures a drawn area by how far it reaches", () => {
    const small: Selection = {
      kind: "polygon",
      ring: [
        [23.1, 42.5],
        [23.3, 42.5],
        [23.3, 42.7],
        [23.1, 42.5],
      ],
    };
    const wide: Selection = {
      kind: "polygon",
      ring: [
        [20, 40],
        [26, 40],
        [26, 44],
        [20, 40],
      ],
    };
    expect(isLargeArea(small)).toBe(false);
    expect(isLargeArea(wide)).toBe(true);
  });
});
