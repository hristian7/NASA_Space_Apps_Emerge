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

export function cornerCount(selection: Selection): number {
  return selection.kind === "polygon" ? openRing(selection.ring).length : 0;
}
