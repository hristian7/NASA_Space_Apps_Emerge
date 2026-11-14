import type { Selection } from "@/types/ui";
import { latRange, lonRange } from "./latlon";
import { removeQueryParam, setQueryParam } from "./query";

/**
 * The selection lives in the address bar under `sel`, so a copied link opens
 * the same place. The encoding is meant to stay readable in a browser's
 * address bar, which is why it uses plain separators and latitude first,
 * matching the order people type and read:
 *
 *   sel=c:BGR                                   a country, by its three-letter code
 *   sel=p:42.7,23.3,50                          a point: latitude, longitude, search distance in km
 *   sel=a:42.5,23.1;42.9,23.1;42.9,23.9         a drawn area: latitude,longitude corners, ";" between them
 *
 * Inside the app the ring keeps GeoJSON order (longitude first) and is closed,
 * as the frozen `Selection` type documents. The URL form drops the repeated
 * closing corner and puts latitude first for reading.
 *
 * Anything unreadable decodes to `null`, so a hand-edited link never throws.
 */
export const selectionParam = "sel";

/** Search distance limits in kilometres (M3, D-3). */
export const radiusRange = [0, 500] as const;

const decimals = 4;

function round(value: number): number {
  return Number(value.toFixed(decimals));
}

function num(value: number): string {
  return String(round(value));
}

export function clampRadiusKm(value: number): number {
  if (!Number.isFinite(value)) return radiusRange[0];
  return Math.min(radiusRange[1], Math.max(radiusRange[0], Math.round(value)));
}

function inRange(lat: number, lon: number): boolean {
  return (
    lat >= latRange[0] && lat <= latRange[1] && lon >= lonRange[0] && lon <= lonRange[1]
  );
}

/** Drops the repeated closing corner, if there is one. */
export function openRing(ring: [lon: number, lat: number][]): [lon: number, lat: number][] {
  if (ring.length > 1) {
    const [firstLon, firstLat] = ring[0];
    const [lastLon, lastLat] = ring[ring.length - 1];
    if (firstLon === lastLon && firstLat === lastLat) return ring.slice(0, -1);
  }
  return ring;
}

/** Repeats the first corner at the end, as GeoJSON rings do. */
export function closeRing(ring: [lon: number, lat: number][]): [lon: number, lat: number][] {
  const open = openRing(ring);
  return open.length >= 3 ? [...open, open[0]] : open;
}

export function encodeSelection(selection: Selection): string {
  if (selection.kind === "country") return `c:${selection.iso3}`;
  if (selection.kind === "point") {
    return `p:${num(selection.lat)},${num(selection.lon)},${clampRadiusKm(selection.radiusKm)}`;
  }
  const corners = openRing(selection.ring)
    .map(([lon, lat]) => `${num(lat)},${num(lon)}`)
    .join(";");
  return `a:${corners}`;
}

export function decodeSelection(value: string | null | undefined): Selection | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const mark = text.indexOf(":");
  if (mark < 1) return null;
  const kind = text.slice(0, mark);
  const body = text.slice(mark + 1);

  if (kind === "c") {
    const iso3 = body.trim().toUpperCase();
    return /^[A-Z]{3}$/.test(iso3) ? { kind: "country", iso3 } : null;
  }

  if (kind === "p") {
    const parts = body.split(",").map((part) => Number(part.trim()));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    const [lat, lon, radiusKm] = parts;
    if (!inRange(lat, lon)) return null;
    return { kind: "point", lat: round(lat), lon: round(lon), radiusKm: clampRadiusKm(radiusKm) };
  }

  if (kind === "a") {
    const corners: [lon: number, lat: number][] = [];
    for (const pair of body.split(";")) {
      if (pair.trim() === "") continue;
      const parts = pair.split(",").map((part) => Number(part.trim()));
      if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
      const [lat, lon] = parts;
      if (!inRange(lat, lon)) return null;
      corners.push([round(lon), round(lat)]);
    }
    if (corners.length < 3) return null;
    return { kind: "polygon", ring: closeRing(corners) };
  }

  return null;
}

/**
 * Writes `sel` into a query string by hand, because the separators above
 * survive as typed. Other parameters, such as the look, are kept.
 */
export function selectionSearch(search: string, selection: Selection | null): string {
  return selection === null
    ? removeQueryParam(search, selectionParam)
    : setQueryParam(search, selectionParam, encodeSelection(selection));
}

export function selectionFromSearch(search: string): Selection | null {
  return decodeSelection(new URLSearchParams(search).get(selectionParam));
}
