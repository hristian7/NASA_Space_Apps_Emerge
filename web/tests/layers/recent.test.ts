import { describe, expect, it } from "vitest";
import { compactRecent, parseFirmsCsv, recentRadiusPx, type RecentRow } from "../../src/lib/layers/recent";
import { firmsFiles, isRecentWindow, recentWindows } from "../../src/lib/layers/firms";

const modisHeader =
  "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight";
const viirsHeader =
  "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight";

function modis(rows: string[]): string {
  return [modisHeader, ...rows].join("\n");
}

function viirs(rows: string[]): string {
  return [viirsHeader, ...rows].join("\n");
}

describe("the confidence rule", () => {
  it("keeps MODIS rows at 30 and above and drops the rest", () => {
    const text = modis([
      "42.1,23.2,306,2.1,1.4,2026-11-13,0017,T,29,6.1NRT,288,22.5,N",
      "42.2,23.3,306,2.1,1.4,2026-11-13,0017,T,30,6.1NRT,288,22.5,N",
      "42.3,23.4,306,2.1,1.4,2026-11-13,0017,T,81,6.1NRT,288,22.5,N",
    ]);
    const rows = parseFirmsCsv(text, "modis", 0);
    expect(rows.map((row) => row.lat)).toEqual([42.2, 42.3]);
    expect(rows.map((row) => row.conf)).toEqual([0, 1]);
  });

  it("keeps VIIRS rows marked nominal or high, written as words or as letters", () => {
    const text = viirs([
      "19.1,-155.2,342,0.34,0.56,2026-11-13,0015,N20,low,2.0NRT,315,7.2,D",
      "19.2,-155.2,342,0.34,0.56,2026-11-13,0015,N20,nominal,2.0NRT,315,7.2,D",
      "19.3,-155.2,342,0.34,0.56,2026-11-13,0015,N20,high,2.0NRT,315,7.2,D",
      "19.4,-155.2,342,0.34,0.56,2026-11-13,0015,N20,n,2.0NRT,315,7.2,D",
      "19.5,-155.2,342,0.34,0.56,2026-11-13,0015,N20,h,2.0NRT,315,7.2,D",
    ]);
    const rows = parseFirmsCsv(text, "viirs", 1);
    expect(rows.map((row) => row.lat)).toEqual([19.2, 19.3, 19.4, 19.5]);
    expect(rows.map((row) => row.conf)).toEqual([0, 1, 0, 1]);
  });

  it("drops rows that are unreadable rather than losing the file", () => {
    const text = modis([
      "not-a-number,23.2,306,2.1,1.4,2026-11-13,0017,T,90,6.1NRT,288,22.5,N",
      "42.2,23.3,306,2.1,1.4,13-11-2026,0017,T,90,6.1NRT,288,22.5,N",
      "42.3,23.4,306,2.1,1.4,2026-11-13,9917,T,90,6.1NRT,288,22.5,N",
      "95.0,23.4,306,2.1,1.4,2026-11-13,0017,T,90,6.1NRT,288,22.5,N",
      "42.5,23.6,306,2.1,1.4,2026-11-13,0017,T,90,6.1NRT,288,22.5,N",
    ]);
    const rows = parseFirmsCsv(text, "modis", 0);
    expect(rows).toHaveLength(1);
    expect(rows[0].lat).toBe(42.5);
  });

  it("reads the acquisition time as minutes after midnight", () => {
    const rows = parseFirmsCsv(
      modis(["42.5,23.6,306,2.1,1.4,2026-11-13,1745,T,90,6.1NRT,288,22.5,N"]),
      "modis",
      0,
    );
    expect(rows[0].minute).toBe(17 * 60 + 45);
  });

  it("answers with nothing for an empty or header-only file", () => {
    expect(parseFirmsCsv("", "modis", 0)).toEqual([]);
    expect(parseFirmsCsv(modisHeader, "modis", 0)).toEqual([]);
  });
});

function row(extra: Partial<RecentRow> = {}): RecentRow {
  return { lat: 42, lon: 23, date: "2026-11-13", minute: 60, frp: 5, sat: 0, conf: 0, ...extra };
}

describe("compaction", () => {
  const sources = [{ sat: 0, rows: 3, ok: true }];

  it("packs rows into columns that share one index", () => {
    const payload = compactRecent(
      [
        row({ lat: 1, lon: 2, frp: 10, date: "2026-11-12", minute: 30 }),
        row({ lat: 3, lon: 4, frp: 20, date: "2026-11-13", minute: 90 }),
      ],
      { window: "24h", cap: 100, built: "2026-11-14T10:00:00.000Z", sources },
    );
    expect(payload.cols.lat).toEqual([1, 3]);
    expect(payload.cols.lon).toEqual([2, 4]);
    expect(payload.dates).toEqual(["2026-11-12", "2026-11-13"]);
    expect(payload.cols.date).toEqual([0, 1]);
    expect(payload.cols.minute).toEqual([30, 90]);
    expect(payload.shown).toBe(2);
    expect(payload.total).toBe(2);
    expect(payload.capped).toBe(false);
  });

  it("reports the first and last acquisition it kept", () => {
    const payload = compactRecent(
      [
        row({ date: "2026-11-13", minute: 90 }),
        row({ date: "2026-11-12", minute: 30 }),
        row({ date: "2026-11-13", minute: 15 }),
      ],
      { window: "24h", cap: 100, built: "2026-11-14T10:00:00.000Z", sources },
    );
    expect(payload.dataStart).toBe("2026-11-12 00:30");
    expect(payload.dataTime).toBe("2026-11-13 01:30");
  });

  it("keeps the strongest detections when the cap bites, and says it did", () => {
    const rows = [1, 50, 9, 300, 7].map((frp) => row({ frp }));
    const payload = compactRecent(rows, {
      window: "7d",
      cap: 2,
      built: "2026-11-14T10:00:00.000Z",
      sources,
    });
    expect(payload.total).toBe(5);
    expect(payload.shown).toBe(2);
    expect(payload.capped).toBe(true);
    expect(payload.cols.frp).toEqual([300, 50]);
  });

  it("answers with an empty, readable payload when nothing passed the rule", () => {
    const payload = compactRecent([], {
      window: "24h",
      cap: 10,
      built: "2026-11-14T10:00:00.000Z",
      sources: [{ sat: 0, rows: 0, ok: true }],
    });
    expect(payload.shown).toBe(0);
    expect(payload.dataTime).toBeNull();
    expect(payload.cols.lat).toEqual([]);
  });
});

describe("the files behind the layer", () => {
  it("names three satellites per window and nothing that needs a key", () => {
    for (const window of recentWindows) {
      const files = firmsFiles(window);
      expect(files).toHaveLength(3);
      for (const file of files) {
        expect(file.url.startsWith("https://firms.modaps.eosdis.nasa.gov/")).toBe(true);
        expect(file.url.toLowerCase().includes("map_key")).toBe(false);
        expect(file.url.includes(window === "24h" ? "_24h.csv" : "_7d.csv")).toBe(true);
      }
    }
  });

  it("refuses a window it does not know", () => {
    expect(isRecentWindow("24h")).toBe(true);
    expect(isRecentWindow("7d")).toBe(true);
    expect(isRecentWindow("30d")).toBe(false);
    expect(isRecentWindow(null)).toBe(false);
  });
});

describe("point size", () => {
  it("grows with heat output", () => {
    expect(recentRadiusPx(1)).toBeLessThan(recentRadiusPx(50));
    expect(recentRadiusPx(50)).toBeLessThan(recentRadiusPx(500));
  });
});
