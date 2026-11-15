import { describe, expect, it } from "vitest";
import { activeFireReachKm, summarizeActiveFire } from "../../src/lib/risk/active-fire";

const now = new Date("2026-11-15T14:00:00Z");
const grid = 0.25;
// The continuing-fire square from the brief: -16.05, 135.075, in the square from -16.0 to -16.25 latitude.
const place = { lat: -16.05, lon: 135.075, radiusKm: 0 };

/** Detections as the route packs them: one date list, then columns. */
function payload(rows: { lat: number; lon: number; at: string }[]) {
  const dates: string[] = [];
  const cols = { lat: [] as number[], lon: [] as number[], date: [] as number[], minute: [] as number[], frp: [] as number[], sat: [] as number[], conf: [] as number[] };
  for (const row of rows) {
    const day = row.at.slice(0, 10);
    if (!dates.includes(day)) dates.push(day);
    cols.lat.push(row.lat);
    cols.lon.push(row.lon);
    cols.date.push(dates.indexOf(day));
    cols.minute.push(Number(row.at.slice(11, 13)) * 60 + Number(row.at.slice(14, 16)));
    cols.frp.push(10);
    cols.sat.push(1);
    cols.conf.push(0);
  }
  return { dates, cols };
}

describe("summarizeActiveFire", () => {
  it("finds a fire in the place's own square in the last day", () => {
    const result = summarizeActiveFire(payload([{ lat: -16.06, lon: 135.08, at: "2026-11-15T04:00" }]), place, grid, now);
    expect(result).toEqual({ active: true, count24: 1, count72: 1, newest: "2026-11-15T04:00:00.000Z" });
  });

  it("counts a neighbouring square's fire from two days ago in 72 hours only", () => {
    const result = summarizeActiveFire(payload([{ lat: -16.3, lon: 135.08, at: "2026-11-13T12:00" }]), place, grid, now);
    expect(result).toEqual({ active: true, count24: 0, count72: 1, newest: "2026-11-13T12:00:00.000Z" });
  });

  it("ignores a fire two squares away when there is no search distance", () => {
    const result = summarizeActiveFire(payload([{ lat: -16.6, lon: 135.08, at: "2026-11-15T04:00" }]), place, grid, now);
    expect(result).toEqual({ active: false, count24: 0, count72: 0, newest: null });
  });

  it("ignores a fire older than 72 hours", () => {
    const result = summarizeActiveFire(payload([{ lat: -16.06, lon: 135.08, at: "2026-11-12T12:00" }]), place, grid, now);
    expect(result.active).toBe(false);
    expect(result.count72).toBe(0);
  });

  it("counts within the search distance, but only a nearby square makes it burning", () => {
    // Two squares south (-16.5 to -16.75), about 61 km away.
    const far = { lat: -16.6, lon: 135.075, at: "2026-11-15T10:00" };
    const result = summarizeActiveFire(payload([far]), { ...place, radiusKm: 70 }, grid, now);
    expect(result).toEqual({ active: false, count24: 1, count72: 1, newest: "2026-11-15T10:00:00.000Z" });
  });

  it("treats squares across the 180th meridian as neighbours", () => {
    const result = summarizeActiveFire(payload([{ lat: 10.1, lon: -179.9, at: "2026-11-15T10:00" }]), { lat: 10.1, lon: 179.9, radiusKm: 0 }, grid, now);
    expect(result.active).toBe(true);
  });

  it("reaches far enough for the squares around a place", () => {
    expect(activeFireReachKm(0, grid)).toBe(62);
    expect(activeFireReachKm(100, grid)).toBe(100);
    expect(activeFireReachKm(900, grid)).toBe(300);
  });
});
