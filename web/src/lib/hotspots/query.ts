/**
 * What the hotspots download accepts, and how it is checked.
 *
 * Bad input is answered with 400 and a plain message, so the caller is told
 * which value is wrong rather than being handed an empty file.
 */

import { bboxAround, type Bbox } from "./geo";

/** Longest range one request may ask for (specification M11). */
export const MAX_DAYS = 366;

/** Largest search distance around a point, in km (specification M11). */
export const MAX_RADIUS_KM = 200;

/** Rows are cut off here, and the CSV says so (specification M11). */
export const MAX_ROWS = 100000;

/** First day of the record. */
export const FIRST_DAY = "2000-11-01";

export interface PointArea {
  kind: "point";
  lat: number;
  lon: number;
  radiusKm: number;
}

export interface BboxArea {
  kind: "bbox";
  box: Bbox;
}

export type Area = PointArea | BboxArea;

export interface HotspotRequest {
  area: Area;
  /** First day, as YYYY-MM-DD. */
  from: string;
  /** Last day, as YYYY-MM-DD. */
  to: string;
  /** False only for verification: it switches the cleaning rules off. */
  clean: boolean;
}

export type ParseResult =
  | { ok: true; request: HotspotRequest }
  | { ok: false; message: string };

function bad(message: string): ParseResult {
  return { ok: false, message };
}

/** A finite number from a query value, or null when it is missing or not a number. */
function numberParam(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True when the text is a real calendar day in the form YYYY-MM-DD. */
export function isDay(text: string): boolean {
  if (!DAY.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole days from one day to another, both as YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** Every calendar year the range touches, in order. */
export function yearsOf(from: string, to: string): number[] {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  const years: number[] = [];
  for (let y = first; y <= last; y++) years.push(y);
  return years;
}

/** The box to read blocks for: the box itself, or the one around the circle. */
export function readBox(area: Area): Bbox {
  if (area.kind === "bbox") return area.box;
  return bboxAround(area.lat, area.lon, area.radiusKm);
}

/** The request in words, for the CSV comment line. */
export function describeArea(area: Area): string {
  if (area.kind === "point") {
    return `point ${area.lat} ${area.lon}, within ${area.radiusKm} km`;
  }
  const { west, south, east, north } = area.box;
  return `box west ${west}, south ${south}, east ${east}, north ${north}`;
}

/** Read and check a request. Either a point with a distance, or a box. */
export function parseHotspotQuery(params: URLSearchParams): ParseResult {
  const bboxRaw = params.get("bbox");
  const latRaw = params.get("lat");
  const lonRaw = params.get("lon");

  if (bboxRaw !== null && (latRaw !== null || lonRaw !== null)) {
    return bad("Give either bbox, or lat and lon with radius_km, not both.");
  }

  let area: Area;
  if (bboxRaw !== null) {
    const parts = bboxRaw.split(",").map((p) => p.trim());
    if (parts.length !== 4) {
      return bad("bbox needs four numbers: west,south,east,north.");
    }
    const [west, south, east, north] = parts.map((p) => Number(p));
    if (![west, south, east, north].every((n) => Number.isFinite(n))) {
      return bad("bbox needs four numbers: west,south,east,north.");
    }
    if (west < -180 || west > 180 || east < -180 || east > 180) {
      return bad("bbox longitudes must be between -180 and 180.");
    }
    if (south < -90 || south > 90 || north < -90 || north > 90) {
      return bad("bbox latitudes must be between -90 and 90.");
    }
    if (west >= east) {
      return bad("bbox west must be smaller than east; a box crossing the 180 degree line is not supported.");
    }
    if (south >= north) return bad("bbox south must be smaller than north.");
    area = { kind: "bbox", box: { west, south, east, north } };
  } else {
    const lat = numberParam(latRaw);
    const lon = numberParam(lonRaw);
    if (lat === null || lon === null) {
      return bad("Give lat and lon in decimal degrees, or a bbox.");
    }
    if (lat < -90 || lat > 90) return bad("lat must be between -90 and 90.");
    if (lon < -180 || lon > 180) return bad("lon must be between -180 and 180.");
    const radiusRaw = params.get("radius_km");
    const radiusKm = numberParam(radiusRaw);
    if (radiusKm === null) return bad("Give radius_km in km, between 0 and 200.");
    if (radiusKm < 0 || radiusKm > MAX_RADIUS_KM) {
      return bad(`radius_km must be between 0 and ${MAX_RADIUS_KM}.`);
    }
    area = { kind: "point", lat, lon, radiusKm };
  }

  const from = (params.get("from") ?? "").trim();
  const to = (params.get("to") ?? "").trim();
  if (!isDay(from) || !isDay(to)) {
    return bad("Give from and to as dates in the form YYYY-MM-DD.");
  }
  if (from < FIRST_DAY) return bad(`The record starts on ${FIRST_DAY}, so from cannot be earlier.`);
  if (to < from) return bad("to cannot be earlier than from.");
  const span = daysBetween(from, to) + 1;
  if (span > MAX_DAYS) {
    return bad(`One request covers at most ${MAX_DAYS} days; this one covers ${span}.`);
  }

  return { ok: true, request: { area, from, to, clean: true } };
}
