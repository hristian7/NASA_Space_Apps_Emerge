/**
 * Which detections a request keeps, and what one output row holds.
 *
 * Cleaning (specification section 4.1): vegetation fires only (type 0), MODIS
 * confidence 30 or more, VIIRS confidence n or h.
 *
 * The trap: the catalogue leaves `type` empty for recent near-real-time rows.
 * The mask that should sort those out (0.01 degree cells where past detections
 * were mostly type 2) does not exist yet, so such a row is kept and marked
 * provisional, and the CSV header says so.
 */

import { distanceKm, inBbox } from "./geo";
import type { Area } from "./query";

/** Lowest MODIS confidence that is kept, in percent. */
export const MIN_MODIS_CONFIDENCE = 30;

/** VIIRS confidence classes that are kept. */
export const VIIRS_CONFIDENCE = ["n", "h"];

/** The type of a vegetation fire. */
export const VEGETATION_TYPE = 0;

/** One detection as it comes out of the file, already normalized. */
export interface Detection {
  /** YYYY-MM-DD, UTC. */
  date: string;
  /** HH:MM, UTC. */
  time: string;
  lat: number;
  lon: number;
  satellite: string;
  sensor: string;
  confidence: string;
  frp: number | null;
  daynight: string;
  scan: number | null;
  track: number | null;
  /** Null for a near-real-time row, which the catalogue leaves empty. */
  type: number | null;
}

/** One row of the download. */
export interface HotspotRow extends Detection {
  /** True when the row had no type, so the cleaning could not be applied in full. */
  provisional: boolean;
}

/** True when a sensor name means MODIS rather than VIIRS. */
export function isModis(sensor: string): boolean {
  return sensor.toUpperCase().startsWith("MODIS");
}

/** Does the row pass the confidence rule for its sensor? */
export function confidenceKept(sensor: string, confidence: string): boolean {
  const value = (confidence ?? "").trim();
  if (isModis(sensor)) {
    const pct = Number(value);
    return Number.isFinite(pct) && pct >= MIN_MODIS_CONFIDENCE;
  }
  return VIIRS_CONFIDENCE.includes(value.toLowerCase());
}

/** Is the row inside the area? Exact: distance for a point, the box for a box. */
export function inArea(area: Area, lat: number, lon: number): boolean {
  if (area.kind === "bbox") return inBbox(area.box, lat, lon);
  return distanceKm(area.lat, area.lon, lat, lon) <= area.radiusKm;
}

export interface FilterOptions {
  area: Area;
  from: string;
  to: string;
  /** False keeps every row whatever its type and confidence (verification only). */
  clean: boolean;
}

/**
 * The row to write, or null when the request leaves it out. Dates are compared
 * as text, which works because both sides are YYYY-MM-DD.
 */
export function keepRow(row: Detection, options: FilterOptions): HotspotRow | null {
  if (row.date < options.from || row.date > options.to) return null;
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) return null;
  if (!inArea(options.area, row.lat, row.lon)) return null;

  const provisional = row.type === null || row.type === undefined;
  if (options.clean) {
    if (!provisional && row.type !== VEGETATION_TYPE) return null;
    if (!confidenceKept(row.sensor, row.confidence)) return null;
  }
  return { ...row, provisional };
}
