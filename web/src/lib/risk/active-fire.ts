import type { RecentPayload } from '../layers/recent';
import { distanceKm } from './geo';
import { riskSquare } from './spot-scores';

/**
 * Our model scores new fires only: a square with a detection in it or in one
 * of its eight neighbours over the last days counts as already burning, and
 * gets a near-zero chance. These are the detections that make a place
 * "already burning" for the card.
 */
export interface ActiveFire {
  /** A detection in the place's square or one of the 8 around it, last 72 hours. */
  active: boolean;
  /** Detections within 50 km of the place, for "fire around here". */
  around24: number;
  around7d: number;
  /** Detections counted within the search distance (or the 3 by 3 squares when it is 0). */
  count24: number;
  count72: number;
  /** Newest counted detection, as an ISO instant. */
  newest: string | null;
}

const hour = 3600 * 1000;

/** Grid row and column of a place, so neighbours can be found. */
function cell(lat: number, lon: number, grid: number) {
  const columns = 360 / grid;
  const id = riskSquare(lat, lon, grid).spot_id;
  return { row: Math.floor(id / columns), col: id % columns, columns };
}

/**
 * The model's own rule for a continuing fire: the same grid square or one of
 * the 8 around it (columns wrap at the 180th meridian).
 */
export function isNeighbourSquare(a: { lat: number; lon: number }, b: { lat: number; lon: number }, grid: number): boolean {
  const one = cell(a.lat, a.lon, grid);
  const two = cell(b.lat, b.lon, grid);
  const gap = Math.abs(one.col - two.col);
  return Math.abs(one.row - two.row) <= 1 && Math.min(gap, one.columns - gap) <= 1;
}

/** Radius of "fire around here". */
export const aroundKm = 50;

export type FireVerdict = 'none' | 'some' | 'many';

/** Detections within 50 km in 7 days: none at 0, some from 1 to 19, many from 20. */
export function fireVerdict(count7d: number): FireVerdict {
  if (count7d <= 0) return 'none';
  return count7d < 20 ? 'some' : 'many';
}

export function summarizeActiveFire(
  payload: Pick<RecentPayload, 'dates' | 'cols'>,
  place: { lat: number; lon: number; radiusKm: number },
  grid: number,
  now: Date,
): ActiveFire {
  let active = false;
  let around24 = 0;
  let around7d = 0;
  let count24 = 0;
  let count72 = 0;
  let newest = -Infinity;
  const { lat, lon, date, minute } = payload.cols;
  for (let i = 0; i < lat.length; i += 1) {
    const day = payload.dates[date[i]];
    if (day === undefined) continue;
    const at = Date.parse(`${day}T00:00:00Z`) + minute[i] * 60 * 1000;
    const age = now.getTime() - at;
    if (!Number.isFinite(age) || age > 7 * 24 * hour || age < -hour) continue;
    const away = distanceKm(place.lat, place.lon, lat[i], lon[i]);
    if (away <= aroundKm) {
      around7d += 1;
      if (age <= 24 * hour) around24 += 1;
    }
    if (age > 72 * hour) continue;
    const neighbour = isNeighbourSquare(place, { lat: lat[i], lon: lon[i] }, grid);
    if (neighbour) active = true;
    const counted = place.radiusKm > 0 ? away <= place.radiusKm : neighbour;
    if (!counted) continue;
    count72 += 1;
    if (age <= 24 * hour) count24 += 1;
    if (at > newest) newest = at;
  }
  return { active, around24, around7d, count24, count72, newest: Number.isFinite(newest) ? new Date(newest).toISOString() : null };
}

/** Wide enough for the 3 by 3 squares around any place, and for its search distance. */
export function activeFireReachKm(radiusKm: number, grid: number): number {
  return Math.min(300, Math.ceil(Math.max(radiusKm, aroundKm, grid * 111 * 2.2)));
}

export async function fetchActiveFire(
  place: { lat: number; lon: number; radiusKm: number },
  grid: number,
  signal?: AbortSignal,
  now: Date = new Date(),
): Promise<ActiveFire> {
  const km = activeFireReachKm(place.radiusKm, grid);
  const response = await fetch(`/api/recent?window=7d&cap=60000&near=${place.lat.toFixed(3)},${place.lon.toFixed(3)},${km}`, { signal });
  if (!response.ok) throw new Error(String(response.status));
  const payload = (await response.json()) as RecentPayload;
  return summarizeActiveFire(payload, place, grid, now);
}
