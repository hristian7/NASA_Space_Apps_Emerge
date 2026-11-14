import type { Selection } from "@/types/ui";
import { closeRing, openRing } from "./selection-url";

const earthRadiusKm = 6371.0088;
const toRad = Math.PI / 180;
const toDeg = 180 / Math.PI;

/**
 * A ring of points all at the same geodesic distance from the centre, so the
 * circle follows the sphere instead of being a flat disc on the screen.
 * Longitude is wrapped into -180..180 and latitude is clamped at the poles.
 */
export function circleRing(
  lat: number,
  lon: number,
  radiusKm: number,
  steps = 128,
): [lon: number, lat: number][] {
  const ring: [lon: number, lat: number][] = [];
  const angular = radiusKm / earthRadiusKm;
  const lat1 = lat * toRad;
  const lon1 = lon * toRad;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAng = Math.sin(angular);
  const cosAng = Math.cos(angular);

  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * 2 * Math.PI;
    const sinLat2 = sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(bearing);
    const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat2)));
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * sinAng * cosLat1,
        cosAng - sinLat1 * Math.sin(lat2),
      );
    let lonDeg = lon2 * toDeg;
    while (lonDeg > 180) lonDeg -= 360;
    while (lonDeg < -180) lonDeg += 360;
    ring.push([lonDeg, lat2 * toDeg]);
  }
  return ring;
}

export type FeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { shape: "point" | "circle" | "area" };
    geometry:
      | { type: "Point"; coordinates: [number, number] }
      | { type: "Polygon"; coordinates: [lon: number, lat: number][][] };
  }[];
};

export const emptyFeatures: FeatureCollection = { type: "FeatureCollection", features: [] };

/** What the map draws for the current selection. A country draws nothing yet. */
export function selectionFeatures(selection: Selection | null): FeatureCollection {
  if (selection === null) return emptyFeatures;

  if (selection.kind === "point") {
    const features: FeatureCollection["features"] = [
      {
        type: "Feature",
        properties: { shape: "point" },
        geometry: { type: "Point", coordinates: [selection.lon, selection.lat] },
      },
    ];
    if (selection.radiusKm > 0) {
      features.unshift({
        type: "Feature",
        properties: { shape: "circle" },
        geometry: {
          type: "Polygon",
          coordinates: [circleRing(selection.lat, selection.lon, selection.radiusKm)],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }

  if (selection.kind === "polygon") {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { shape: "area" },
          geometry: { type: "Polygon", coordinates: [closeRing(selection.ring)] },
        },
      ],
    };
  }

  return emptyFeatures;
}

/** Centre of a selection, for moving the camera. Null when there is nothing to centre on. */
export function selectionCentre(selection: Selection | null): [lon: number, lat: number] | null {
  if (selection === null) return null;
  if (selection.kind === "point") return [selection.lon, selection.lat];
  if (selection.kind === "polygon") {
    const ring = openRing(selection.ring);
    if (ring.length === 0) return null;
    const lon = ring.reduce((sum, [value]) => sum + value, 0) / ring.length;
    const lat = ring.reduce((sum, [, value]) => sum + value, 0) / ring.length;
    return [lon, lat];
  }
  return null;
}

/**
 * A zoom level at which the search circle fills about two fifths of the
 * smaller side of the map, so the chosen area is visible rather than a dot.
 */
export function zoomForRadius(lat: number, radiusKm: number, smallestSidePx: number): number {
  if (radiusKm <= 0) return 6;
  // 512 pixel tiles, so half the figure quoted for 256 pixel tiles.
  const metresPerPixelAtZoomZero = 78271.516 * Math.cos((lat * Math.PI) / 180);
  const wanted = (2 * radiusKm * 1000) / (0.4 * Math.max(240, smallestSidePx));
  const zoom = Math.log2(metresPerPixelAtZoomZero / wanted);
  return Math.min(8, Math.max(1.2, zoom));
}

/**
 * A country's box, as MapLibre wants it: south west, then north east.
 * A box whose west edge is east of its east edge crosses the 180 degree line,
 * as the United States does, so the east edge is carried past 180 instead of
 * wrapping the camera the long way around the world.
 */
export function countryBounds(
  bbox: [west: number, south: number, east: number, north: number],
): [[number, number], [number, number]] {
  const [west, south, east, north] = bbox;
  const eastward = east < west ? east + 360 : east;
  return [
    [west, Math.min(south, north)],
    [eastward, Math.max(south, north)],
  ];
}

/** Corner box of a ring, as MapLibre wants it: south west, then north east. */
export function ringBounds(
  ring: [lon: number, lat: number][],
): [[number, number], [number, number]] {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

export function cornerCount(selection: Selection): number {
  return selection.kind === "polygon" ? openRing(selection.ring).length : 0;
}
