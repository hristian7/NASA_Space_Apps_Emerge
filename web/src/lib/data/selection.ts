/**
 * From a selection to cells: docs/number-logic.md section 1, to the letter.
 *
 * Each 0.25 degree cell is split into 25 x 25 sub-cells of 0.01 degree. A
 * cell's weight is the share of its 625 sub-cell centres that the selection
 * covers, so a circle or a drawn area gets partial cells at its edge instead
 * of a staircase of whole ones.
 *
 * docs/data-contract.md section 11 describes a simpler rule for a point
 * selection (keep a cell when its centre is inside the distance, plus the
 * cell holding the point). That page says which files a selection loads;
 * number-logic section 1 says how the numbers are weighted and is the rule
 * implemented here. The contract's "plus the cell holding the point" survives
 * as the small-selection rule below.
 */

import type { Selection } from '../../types/ui';

import {
  CELL_DEG,
  EARTH_RADIUS_KM,
  GRID_COLS,
  GRID_ROWS,
  TILE_DEG,
  cellCol,
  cellId,
  cellRow,
  wrapLon,
} from './cell';

/** Sub-cells along one side of a cell. */
export const SUB_PER_SIDE = 25;

/** Side of one sub-cell, in degrees. */
export const SUB_DEG = 0.01;

/** Sub-cell centres in one cell: 25 x 25. */
export const SUB_PER_CELL = SUB_PER_SIDE * SUB_PER_SIDE;

/** One cell of a selection and how much of it the selection covers. */
export interface WeightedCell {
  /** Cell id: row * 1440 + col. */
  id: number;
  /** Share of the cell the selection covers, above 0 and up to 1. */
  weight: number;
  /** Cell centre latitude. */
  lat: number;
  /** Cell centre longitude. */
  lon: number;
}

/** The cells a selection reaches, and whether it is smaller than one cell. */
export interface SelectionCells {
  cells: WeightedCell[];
  /** True when the selection is smaller than one grid cell (section 1). */
  lowConfidence: boolean;
  /** Weights added up as returned, so 1 exactly after the small-selection rule. */
  totalWeight: number;
  /** Weights added up before the small-selection rule, which is what that rule tests. */
  rawTotalWeight: number;
}

/** A selection's extent. Longitude is held as ranges, so a wrap is explicit. */
export interface SelectionBounds {
  latMin: number;
  latMax: number;
  /** Every range is inside [-180, 180) with its first value the lower one. */
  lonRanges: [number, number][];
  /** True when the selection spans every longitude (a pole, or a huge circle). */
  allLon: boolean;
}

const DEG = Math.PI / 180;

/** Great-circle distance in km, haversine, mean Earth radius 6371.0088 km. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * DEG;
  const dLon = (bLon - aLon) * DEG;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * s2 * s2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The 625 sub-cell centres of one cell, in the order of the rule:
 * lat = 90 - row * 0.25 - (i + 0.5) * 0.01, lon = -180 + col * 0.25 + (j + 0.5) * 0.01.
 */
export function subCellCenters(id: number): { lat: number; lon: number }[] {
  const row = Math.floor(id / GRID_COLS);
  const col = id - row * GRID_COLS;
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < SUB_PER_SIDE; i += 1) {
    const lat = 90 - row * CELL_DEG - (i + 0.5) * SUB_DEG;
    for (let j = 0; j < SUB_PER_SIDE; j += 1) {
      out.push({ lat, lon: -180 + col * CELL_DEG + (j + 0.5) * SUB_DEG });
    }
  }
  return out;
}

/**
 * Even-odd rule on plain longitude and latitude. A ring crossing the 180
 * degree line is not supported (section 1).
 */
export function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let a = 0, b = n - 1; a < n; b = a, a += 1) {
    const [lonA, latA] = ring[a];
    const [lonB, latB] = ring[b];
    const crosses = latA > lat !== latB > lat;
    if (!crosses) continue;
    const x = lonA + ((lat - latA) / (latB - latA)) * (lonB - lonA);
    if (lon < x) inside = !inside;
  }
  return inside;
}

/** The ring without a repeated closing vertex, so a vertex is counted once. */
function openRing(ring: [number, number][]): [number, number][] {
  if (ring.length > 1) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** Mean of a ring's vertices, used by the small-selection rule. */
export function ringCenter(ring: [number, number][]): { lat: number; lon: number } {
  const open = openRing(ring);
  let lat = 0;
  let lon = 0;
  for (const [vLon, vLat] of open) {
    lat += vLat;
    lon += vLon;
  }
  return { lat: lat / open.length, lon: lon / open.length };
}

function clampLat(lat: number): number {
  if (lat > 90) return 90;
  if (lat < -90) return -90;
  return lat;
}

/**
 * The extent of a selection.
 *
 * For a circle the latitude reach is the radius as an angle; the longitude
 * reach is asin(sin(r) / cos(lat)), the widest meridian the circle touches.
 * When that has no solution the circle swallows a pole and every longitude is
 * inside, which is also true once the radius reaches a quarter of the globe.
 */
export function selectionBounds(selection: Selection): SelectionBounds | null {
  if (selection.kind === 'country') return null;

  if (selection.kind === 'point') {
    const r = selection.radiusKm / EARTH_RADIUS_KM;
    const dLat = r / DEG;
    const latMin = clampLat(selection.lat - dLat);
    const latMax = clampLat(selection.lat + dLat);
    const cosLat = Math.cos(selection.lat * DEG);
    const reachesPole = latMax >= 90 || latMin <= -90;
    const ratio = Math.sin(r) / cosLat;
    if (reachesPole || r >= Math.PI / 2 || !(ratio < 1) || cosLat <= 0) {
      return { latMin, latMax, lonRanges: [[-180, 180]], allLon: true };
    }
    const dLon = Math.asin(ratio) / DEG;
    return { latMin, latMax, ...lonRangesAround(selection.lon, dLon) };
  }

  const ring = openRing(selection.ring);
  let latMin = 90;
  let latMax = -90;
  let lonMin = 180;
  let lonMax = -180;
  for (const [lon, lat] of ring) {
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
    if (lon < lonMin) lonMin = lon;
    if (lon > lonMax) lonMax = lon;
  }
  const spansAll = lonMax - lonMin >= 360;
  return {
    latMin: clampLat(latMin),
    latMax: clampLat(latMax),
    lonRanges: spansAll ? [[-180, 180]] : [[wrapLon(lonMin), wrapLon(lonMin) + (lonMax - lonMin)]],
    allLon: spansAll,
  };
}

/** Longitude ranges around a centre, split when they cross the 180 line. */
function lonRangesAround(
  lon: number,
  dLon: number,
): { lonRanges: [number, number][]; allLon: boolean } {
  if (dLon >= 180) return { lonRanges: [[-180, 180]], allLon: true };
  const center = wrapLon(lon);
  const lo = center - dLon;
  const hi = center + dLon;
  if (lo < -180) return { lonRanges: [[-180, hi], [lo + 360, 180]], allLon: false };
  if (hi >= 180) return { lonRanges: [[lo, 180], [-180, hi - 360]], allLon: false };
  return { lonRanges: [[lo, hi]], allLon: false };
}

function tileLat0(lat: number): number {
  let lat0 = Math.floor(lat / TILE_DEG) * TILE_DEG;
  if (lat0 > 90 - TILE_DEG) lat0 = 90 - TILE_DEG;
  if (lat0 < -90) lat0 = -90;
  return lat0;
}

/**
 * Every tile key a selection's bounding box touches, sorted. A country needs
 * no tile, so it gives an empty list.
 *
 * A circle that crosses the 180 degree line gives tiles on both sides; one
 * that reaches a pole gives every longitude, because at a pole every meridian
 * is within reach.
 */
export function tilesForSelection(selection: Selection): string[] {
  const bounds = selectionBounds(selection);
  if (!bounds) return [];
  const keys: string[] = [];
  const lat0First = tileLat0(bounds.latMax);
  const lat0Last = tileLat0(bounds.latMin);
  const lon0s: number[] = [];
  if (bounds.allLon) {
    for (let lon0 = -180; lon0 < 180; lon0 += TILE_DEG) lon0s.push(lon0);
  } else {
    for (const [lo, hi] of bounds.lonRanges) {
      const firstLon0 = Math.floor(wrapLon(lo) / TILE_DEG) * TILE_DEG;
      const lastRaw = hi >= 180 ? 175 : Math.floor(wrapLon(hi) / TILE_DEG) * TILE_DEG;
      for (let lon0 = firstLon0; lon0 <= lastRaw; lon0 += TILE_DEG) {
        if (!lon0s.includes(lon0)) lon0s.push(lon0);
      }
    }
  }
  for (let lat0 = lat0Last; lat0 <= lat0First; lat0 += TILE_DEG) {
    for (const lon0 of lon0s) keys.push(`${lat0}_${lon0}`);
  }
  return keys.sort();
}

/** The cell that holds a point, or a polygon's vertex average. */
export function containingCellId(selection: Selection): number | null {
  if (selection.kind === 'point') return cellId(selection.lat, selection.lon);
  if (selection.kind === 'polygon') {
    const center = ringCenter(selection.ring);
    return cellId(center.lat, center.lon);
  }
  return null;
}

function cellCenterOf(id: number): { lat: number; lon: number } {
  const row = Math.floor(id / GRID_COLS);
  const col = id - row * GRID_COLS;
  return {
    lat: 90 - CELL_DEG * row - CELL_DEG / 2,
    lon: -180 + CELL_DEG * col + CELL_DEG / 2,
  };
}

/** Candidate cell ids inside a selection's bounding box. */
function candidateCells(bounds: SelectionBounds): number[] {
  const rowFirst = cellRow(bounds.latMax);
  const rowLast = cellRow(bounds.latMin);
  const cols: number[] = [];
  if (bounds.allLon) {
    for (let col = 0; col < GRID_COLS; col += 1) cols.push(col);
  } else {
    const seen = new Set<number>();
    for (const [lo, hi] of bounds.lonRanges) {
      const first = cellCol(lo);
      const last = hi >= 180 ? GRID_COLS - 1 : cellCol(hi);
      for (let col = first; col <= last; col += 1) {
        if (!seen.has(col)) {
          seen.add(col);
          cols.push(col);
        }
      }
    }
  }
  const ids: number[] = [];
  for (let row = rowFirst; row <= rowLast && row < GRID_ROWS; row += 1) {
    for (const col of cols) ids.push(row * GRID_COLS + col);
  }
  return ids;
}

/**
 * The weighted cells of a selection (section 1).
 *
 * Cells with weight 0 are left out. When every weight together adds up to
 * less than 1 the selection is smaller than one cell: the single cell holding
 * the point (or the ring's vertex average) is used with weight 1 and the
 * result is marked lowConfidence.
 *
 * A country selection has no cells: its own file is used as it is.
 */
export function selectionCells(selection: Selection): SelectionCells {
  const empty = { cells: [], lowConfidence: false, totalWeight: 0, rawTotalWeight: 0 };
  if (selection.kind === 'country') return empty;
  const bounds = selectionBounds(selection);
  if (!bounds) return empty;

  const cells: WeightedCell[] = [];
  let total = 0;
  for (const id of candidateCells(bounds)) {
    const weight = cellWeight(selection, id);
    if (weight <= 0) continue;
    total += weight;
    const { lat, lon } = cellCenterOf(id);
    cells.push({ id, weight, lat, lon });
  }

  if (total < 1) {
    const only = containingCellId(selection);
    if (only === null) {
      return { cells: [], lowConfidence: true, totalWeight: 0, rawTotalWeight: total };
    }
    const { lat, lon } = cellCenterOf(only);
    return {
      cells: [{ id: only, weight: 1, lat, lon }],
      lowConfidence: true,
      totalWeight: 1,
      rawTotalWeight: total,
    };
  }

  cells.sort((a, b) => a.id - b.id);
  return { cells, lowConfidence: false, totalWeight: total, rawTotalWeight: total };
}

/**
 * Share of a cell's 625 sub-cell centres the selection covers. A centre
 * exactly at the distance counts as inside.
 */
export function cellWeight(selection: Selection, id: number): number {
  if (selection.kind === 'country') return 0;
  const centers = subCellCenters(id);
  let inside = 0;
  if (selection.kind === 'point') {
    for (const c of centers) {
      if (haversineKm(selection.lat, selection.lon, c.lat, c.lon) <= selection.radiusKm) inside += 1;
    }
  } else {
    for (const c of centers) {
      if (pointInRing(c.lon, c.lat, selection.ring)) inside += 1;
    }
  }
  return inside / SUB_PER_CELL;
}
