/**
 * The raw hotspots download: input checking, the row filter and the CSV
 * writer, on small rows made up here. Nothing in this file touches the
 * network; the one network check is run by hand and reported.
 */

import { describe, expect, it } from "vitest";

import {
  bboxAround,
  bboxesOverlap,
  confidenceKept,
  cutNotice,
  distanceKm,
  hotspotHeader,
  hotspotsCsv,
  isDay,
  isModis,
  keepRow,
  overlappingRanges,
  parseHotspotQuery,
  toDetection,
  yearsOf,
  yearUrl,
  type Detection,
  type FilterOptions,
  type HotspotRequest,
} from "../../src/lib/hotspots";

function query(text: string): URLSearchParams {
  return new URLSearchParams(text);
}

const bulgaria: HotspotRequest = {
  area: { kind: "bbox", box: { west: 22.3, south: 41.2, east: 28.65, north: 44.25 } },
  from: "2024-08-01",
  to: "2024-08-31",
  clean: true,
};

function detection(extra: Partial<Detection> = {}): Detection {
  return {
    date: "2024-08-15",
    time: "09:42",
    lat: 42.7,
    lon: 23.32,
    satellite: "Suomi-NPP",
    sensor: "VIIRS_SNPP",
    confidence: "n",
    frp: 12.8,
    daynight: "D",
    scan: 0.43,
    track: 0.46,
    type: 0,
    ...extra,
  };
}

const options: FilterOptions = {
  area: bulgaria.area,
  from: bulgaria.from,
  to: bulgaria.to,
  clean: true,
};

describe("distance and boxes", () => {
  it("measures a known distance", () => {
    // Sofia to Plovdiv is about 130 km.
    const km = distanceKm(42.6977, 23.3219, 42.1354, 24.7453);
    expect(km).toBeGreaterThan(125);
    expect(km).toBeLessThan(135);
  });

  it("is zero at the same point", () => {
    expect(distanceKm(10, 20, 10, 20)).toBeCloseTo(0, 12);
  });

  it("holds a circle inside its box", () => {
    const box = bboxAround(42.7, 23.3, 50);
    expect(box.north).toBeGreaterThan(42.7);
    expect(box.south).toBeLessThan(42.7);
    expect(distanceKm(42.7, 23.3, box.north, 23.3)).toBeGreaterThanOrEqual(50);
    expect(distanceKm(42.7, 23.3, 42.7, box.east)).toBeGreaterThanOrEqual(50);
  });

  it("wraps every longitude at a pole", () => {
    const box = bboxAround(90, 0, 100);
    expect(box.west).toBe(-180);
    expect(box.east).toBe(180);
  });

  it("sees boxes that touch as overlapping, and separate boxes as not", () => {
    const a = { west: 0, south: 0, east: 10, north: 10 };
    expect(bboxesOverlap(a, { west: 10, south: 10, east: 20, north: 20 })).toBe(true);
    expect(bboxesOverlap(a, { west: 10.1, south: 0, east: 20, north: 10 })).toBe(false);
    expect(bboxesOverlap(a, { west: -5, south: -5, east: 5, north: 5 })).toBe(true);
  });
});

describe("dates and years", () => {
  it("accepts a real day and refuses the rest", () => {
    expect(isDay("2024-08-01")).toBe(true);
    expect(isDay("2024-02-30")).toBe(false);
    expect(isDay("2024-13-01")).toBe(false);
    expect(isDay("1 Aug 2024")).toBe(false);
    expect(isDay("2024-8-1")).toBe(false);
  });

  it("lists every year a range touches", () => {
    expect(yearsOf("2023-12-20", "2024-01-05")).toStrictEqual([2023, 2024]);
    expect(yearsOf("2024-08-01", "2024-08-31")).toStrictEqual([2024]);
  });

  it("names one file per year", () => {
    expect(yearUrl(2024)).toContain("year=2024/detections.parquet");
  });
});

describe("parseHotspotQuery", () => {
  it("reads a point with a distance", () => {
    const got = parseHotspotQuery(query("lat=42.7&lon=23.32&radius_km=50&from=2024-08-01&to=2024-08-31"));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.request.area).toStrictEqual({ kind: "point", lat: 42.7, lon: 23.32, radiusKm: 50 });
    expect(got.request.clean).toBe(true);
  });

  it("reads a box", () => {
    const got = parseHotspotQuery(query("bbox=22.3,41.2,28.65,44.25&from=2024-08-01&to=2024-08-31"));
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.request.area).toStrictEqual({
      kind: "bbox",
      box: { west: 22.3, south: 41.2, east: 28.65, north: 44.25 },
    });
  });

  it("takes a distance of 0", () => {
    const got = parseHotspotQuery(query("lat=0&lon=0&radius_km=0&from=2024-08-01&to=2024-08-01"));
    expect(got.ok).toBe(true);
  });

  it("refuses a missing area", () => {
    const got = parseHotspotQuery(query("from=2024-08-01&to=2024-08-31"));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.message).toContain("lat and lon");
  });

  it("refuses a box together with a point", () => {
    const got = parseHotspotQuery(query("bbox=0,0,1,1&lat=1&lon=1&from=2024-08-01&to=2024-08-02"));
    expect(got.ok).toBe(false);
  });

  it.each([
    ["lat=91&lon=0&radius_km=10", "lat must be"],
    ["lat=0&lon=181&radius_km=10", "lon must be"],
    ["lat=0&lon=0&radius_km=201", "radius_km must be"],
    ["lat=0&lon=0&radius_km=-1", "radius_km must be"],
    ["lat=0&lon=0", "radius_km"],
    ["bbox=0,0,1", "four numbers"],
    ["bbox=1,0,0,1", "west must be smaller"],
    ["bbox=0,1,1,0", "south must be smaller"],
    ["bbox=0,0,181,1", "longitudes must be"],
  ])("refuses %s", (area, message) => {
    const got = parseHotspotQuery(query(`${area}&from=2024-08-01&to=2024-08-31`));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.message).toContain(message);
  });

  it("refuses a bad or missing date", () => {
    expect(parseHotspotQuery(query("lat=0&lon=0&radius_km=1&from=2024-08-01")).ok).toBe(false);
    expect(parseHotspotQuery(query("lat=0&lon=0&radius_km=1&from=x&to=2024-08-01")).ok).toBe(false);
  });

  it("refuses a range that runs backwards", () => {
    const got = parseHotspotQuery(query("lat=0&lon=0&radius_km=1&from=2024-08-31&to=2024-08-01"));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.message).toContain("to cannot be earlier");
  });

  it("refuses a range before the record starts", () => {
    const got = parseHotspotQuery(query("lat=0&lon=0&radius_km=1&from=2000-10-31&to=2000-11-05"));
    expect(got.ok).toBe(false);
  });

  it("takes 366 days and refuses 367", () => {
    expect(parseHotspotQuery(query("lat=0&lon=0&radius_km=1&from=2024-01-01&to=2024-12-31")).ok).toBe(true);
    const got = parseHotspotQuery(query("lat=0&lon=0&radius_km=1&from=2024-01-01&to=2025-01-01"));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.message).toContain("367");
  });
});

describe("the cleaning rules", () => {
  it("tells MODIS from VIIRS by the sensor name", () => {
    expect(isModis("MODIS")).toBe(true);
    expect(isModis("VIIRS_SNPP")).toBe(false);
  });

  it("keeps MODIS at 30 and above", () => {
    expect(confidenceKept("MODIS", "30")).toBe(true);
    expect(confidenceKept("MODIS", "29")).toBe(false);
    expect(confidenceKept("MODIS", "100")).toBe(true);
    expect(confidenceKept("MODIS", "")).toBe(false);
  });

  it("keeps VIIRS n and h only", () => {
    expect(confidenceKept("VIIRS_SNPP", "n")).toBe(true);
    expect(confidenceKept("VIIRS_NOAA20", "h")).toBe(true);
    expect(confidenceKept("VIIRS_SNPP", "l")).toBe(false);
  });
});

describe("keepRow", () => {
  it("keeps a clean row inside the box and the range", () => {
    const row = keepRow(detection(), options);
    expect(row).not.toBeNull();
    expect(row?.provisional).toBe(false);
  });

  it("drops a row outside the range", () => {
    expect(keepRow(detection({ date: "2024-07-31" }), options)).toBeNull();
    expect(keepRow(detection({ date: "2024-09-01" }), options)).toBeNull();
  });

  it("drops a row outside the box", () => {
    expect(keepRow(detection({ lat: 50 }), options)).toBeNull();
    expect(keepRow(detection({ lon: 10 }), options)).toBeNull();
  });

  it("keeps a row on the edge of the box", () => {
    expect(keepRow(detection({ lat: 41.2, lon: 22.3 }), options)).not.toBeNull();
  });

  it("measures a circle by the great-circle distance, edge included", () => {
    const circle: FilterOptions = {
      area: { kind: "point", lat: 42.7, lon: 23.32, radiusKm: 50 },
      from: "2024-08-01",
      to: "2024-08-31",
      clean: true,
    };
    expect(keepRow(detection({ lat: 42.7, lon: 23.32 }), circle)).not.toBeNull();
    expect(keepRow(detection({ lat: 43.14, lon: 23.32 }), circle)).not.toBeNull();
    expect(keepRow(detection({ lat: 43.25, lon: 23.32 }), circle)).toBeNull();
  });

  it("drops anything that is not a vegetation fire", () => {
    expect(keepRow(detection({ type: 1 }), options)).toBeNull();
    expect(keepRow(detection({ type: 2 }), options)).toBeNull();
    expect(keepRow(detection({ type: 3 }), options)).toBeNull();
  });

  it("drops a low confidence row", () => {
    expect(keepRow(detection({ confidence: "l" }), options)).toBeNull();
    expect(keepRow(detection({ sensor: "MODIS", satellite: "Terra", confidence: "20" }), options)).toBeNull();
  });

  it("keeps a row with no type and marks it provisional", () => {
    const row = keepRow(detection({ type: null }), options);
    expect(row?.provisional).toBe(true);
  });

  it("still checks the confidence of a row with no type", () => {
    expect(keepRow(detection({ type: null, confidence: "l" }), options)).toBeNull();
  });

  it("keeps everything in the area when cleaning is off", () => {
    const raw = { ...options, clean: false };
    expect(keepRow(detection({ type: 2, confidence: "l" }), raw)).not.toBeNull();
    expect(keepRow(detection({ type: 2, lat: 50 }), raw)).toBeNull();
  });

  it("drops a row with no position", () => {
    expect(keepRow(detection({ lat: Number.NaN }), options)).toBeNull();
  });
});

describe("toDetection", () => {
  it("reads the file's own shape", () => {
    const got = toDetection({
      acq_date: new Date("2024-10-27T00:00:00.000Z"),
      acq_datetime: new Date("2024-10-27T10:04:00.000Z"),
      sensor: "VIIRS_SNPP",
      satellite: "Suomi-NPP",
      confidence: "n",
      frp: 12.82,
      daynight: "D",
      scan: 0.56,
      track: 0.43,
      type: 0,
      geometry: { type: "Point", coordinates: [37.13169, 38.28743] },
    });
    expect(got).toStrictEqual({
      date: "2024-10-27",
      time: "10:04",
      lat: 38.28743,
      lon: 37.13169,
      satellite: "Suomi-NPP",
      sensor: "VIIRS_SNPP",
      confidence: "n",
      frp: 12.82,
      daynight: "D",
      scan: 0.56,
      track: 0.43,
      type: 0,
    });
  });

  it("carries an empty type through as null", () => {
    const got = toDetection({
      acq_date: new Date("2026-11-01T00:00:00.000Z"),
      acq_datetime: new Date("2026-11-01T01:02:00.000Z"),
      type: null,
      geometry: { type: "Point", coordinates: [23, 42] },
    });
    expect(got?.type).toBeNull();
  });

  it("gives null without a position", () => {
    expect(toDetection({ acq_date: new Date(), geometry: null })).toBeNull();
  });
});

describe("overlappingRanges", () => {
  function group(rows: number, box: [number, number, number, number] | null) {
    const meta = box
      ? { path_in_schema: ["geometry"], geospatial_statistics: { bbox: { xmin: box[0], ymin: box[1], xmax: box[2], ymax: box[3] } } }
      : { path_in_schema: ["geometry"] };
    return { num_rows: rows, columns: [{ meta_data: meta }] };
  }

  const metadata = {
    row_groups: [
      group(100, [-170, -80, -160, -70]),
      group(100, [22, 41, 29, 45]),
      group(100, [23, 42, 24, 43]),
      group(100, [100, 10, 110, 20]),
    ],
  } as never;

  const box = { west: 22.3, south: 41.2, east: 28.65, north: 44.25 };

  it("keeps only the blocks that overlap, joined into one range", () => {
    expect(overlappingRanges(metadata, box)).toStrictEqual([{ start: 100, end: 300 }]);
  });

  it("reads a block that states no area", () => {
    const withUnknown = { row_groups: [group(50, null), group(50, [100, 10, 110, 20])] } as never;
    expect(overlappingRanges(withUnknown, box)).toStrictEqual([{ start: 0, end: 50 }]);
  });
});

describe("the hotspots csv", () => {
  it("names the columns in order", () => {
    const csv = hotspotsCsv(bulgaria, []);
    const lines = csv.split("\n").filter(Boolean);
    const columns = lines.find((line) => !line.startsWith("#"));
    expect(columns).toBe(
      "date,time,latitude,longitude,satellite,sensor,confidence,frp,daynight,scan,track,provisional",
    );
  });

  it("says what was asked for, where the data comes from and how it was cleaned", () => {
    const header = hotspotHeader(bulgaria);
    expect(header.split("\n").filter(Boolean).every((line) => line.startsWith("#"))).toBe(true);
    expect(header).toContain("Emerge: individual fire detections");
    expect(header).toContain("box west 22.3, south 41.2, east 28.65, north 44.25");
    expect(header).toContain("from 2024-08-01 to 2024-08-31");
    expect(header).toContain("NASA FIRMS");
    expect(header).toContain("CC0");
    expect(header).toContain("type 0");
    expect(header).toContain("VIIRS confidence n or h");
    expect(header).toContain("provisional =");
  });

  it("says when the cleaning was off", () => {
    expect(hotspotHeader({ ...bulgaria, clean: false })).toContain("Cleaning: switched off");
  });

  it("writes one line per row", () => {
    const rows = [
      { ...detection(), provisional: false },
      { ...detection({ date: "2024-08-16", type: null, frp: null, scan: null, track: null }), provisional: true },
    ];
    const lines = hotspotsCsv(bulgaria, rows).split("\n").filter(Boolean);
    const data = lines.filter((line) => !line.startsWith("#")).slice(1);
    expect(data).toStrictEqual([
      "2024-08-15,09:42,42.7,23.32,Suomi-NPP,VIIRS_SNPP,n,12.8,D,0.43,0.46,false",
      "2024-08-16,09:42,42.7,23.32,Suomi-NPP,VIIRS_SNPP,n,,D,,,true",
    ]);
  });

  it("ends every line with a newline and nothing else", () => {
    const csv = hotspotsCsv(bulgaria, [{ ...detection(), provisional: false }]);
    expect(csv.endsWith("\n")).toBe(true);
    expect(csv.includes("\r")).toBe(false);
  });

  it("adds the notice after the last row when the answer was cut", () => {
    const csv = hotspotsCsv(bulgaria, [{ ...detection(), provisional: false }], true);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines[lines.length - 1]).toBe(cutNotice().trim());
    expect(lines[lines.length - 1]).toContain("100000");
  });
});
