/**
 * Geometry for the raw hotspots download: great-circle distance and boxes.
 *
 * The same Earth radius as the rest of the contract, so a point kept here and
 * a cell weighted there use one definition of distance.
 */

/** Mean Earth radius in km (docs/data-contract.md). */
export const EARTH_RADIUS_KM = 6371.0088;

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const RAD = Math.PI / 180;

/** Great-circle distance in km between two points, by the haversine formula. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * The smallest box that holds every point within `radiusKm` of a point. Used
 * only to pick which blocks of the file to read; rows are then filtered by the
 * exact distance.
 */
export function bboxAround(lat: number, lon: number, radiusKm: number): Bbox {
  const r = radiusKm / EARTH_RADIUS_KM;
  // A hair of slack, so a point exactly at the distance is never pruned away.
  const slack = 1e-7;
  const dLat = r / RAD + slack;
  const cos = Math.cos(lat * RAD);
  // The widest the circle reaches east or west, exactly; at a pole it wraps.
  const sin = Math.sin(r);
  const dLon = Math.abs(cos) <= sin ? 180 : Math.min(180, Math.asin(sin / cos) / RAD + slack);
  return {
    west: Math.max(-180, lon - dLon),
    south: Math.max(-90, lat - dLat),
    east: Math.min(180, lon + dLon),
    north: Math.min(90, lat + dLat),
  };
}

/** True when two boxes share any point. Boxes touching at an edge count as overlapping. */
export function bboxesOverlap(a: Bbox, b: Bbox): boolean {
  return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

/** True when a point is inside a box or on its edge. */
export function inBbox(box: Bbox, lat: number, lon: number): boolean {
  return lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north;
}
