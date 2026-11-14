// Links from a report to the official services Emerge builds on.
// URL formats were checked by loading them in a browser on 14 Nov 2026:
// - FIRMS map: `#d:7days;@<lon>,<lat>,<zoom>z` opens centred on the place.
// - GWIS and EFFIS statistics: `/estimates/<ISO3>/...` opens on that country.
// - The GWIS fire-danger viewer reads no map position from its URL, so it
//   always opens on the world view.

import type { Selection } from "@/types/ui";

export type OutsideLinkId = "firms" | "gwisStats" | "effisStats" | "gwisDanger";

export interface OutsideLink {
  id: OutsideLinkId;
  url: string;
  /** "place" opens on the selection itself; "country" on its whole country; "world" on the world. */
  scope: "place" | "country" | "world";
}

/** A west/south/east/north box in degrees. */
export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface OutsideLinkInput {
  selection: Selection;
  /** ISO 3166 alpha-3 code of the country the selection is in, when known. */
  countryIso3: string | null;
  /** The selected country's box; only used for country selections. */
  countryBox: Box | null;
  /** The year the statistics pages open on. */
  year: number;
}

export const FIRMS_MAP = "https://firms.modaps.eosdis.nasa.gov/map/";
export const GWIS_STATS = "https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates";
export const EFFIS_STATS = "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates";
export const GWIS_DANGER = "https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/";

/** EFFIS's average starts in 2006. */
export const EFFIS_FIRST_YEAR = 2006;

/** Countries the EFFIS statistics portal lists (read from its zone list, 14 Nov 2026). */
export const EFFIS_COUNTRIES: ReadonlySet<string> = new Set([
  "ALB", "AUT", "BEL", "BIH", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN",
  "FRA", "DEU", "GRC", "GLP", "GUY", "HUN", "ISL", "IRL", "ITA", "LVA", "LTU",
  "LUX", "MLT", "MTQ", "MYT", "MDA", "MNE", "NLD", "MKD", "NOR", "POL", "PRT",
  "REU", "ROU", "MAF", "SRB", "SVK", "SVN", "ESP", "SWE", "TUR", "UKR",
]);

const KM_PER_DEG_LAT = 111.32;
const MIN_ZOOM = 2;
const MAX_ZOOM = 12;

/** Map zoom that fits `spanDeg` degrees of longitude with room around it. */
export function zoomForSpan(spanDeg: number): number {
  if (!(spanDeg > 0)) return MAX_ZOOM;
  const zoom = Math.floor(Math.log2(562 / spanDeg));
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Centre and longitude span of a selection, or null when it cannot be placed. */
export function selectionView(
  selection: Selection,
  countryBox: Box | null,
): { lat: number; lon: number; spanDeg: number } | null {
  if (selection.kind === "point") {
    const cosLat = Math.max(Math.cos((selection.lat * Math.PI) / 180), 0.01);
    const spanDeg = (2 * selection.radiusKm) / (KM_PER_DEG_LAT * cosLat);
    return { lat: selection.lat, lon: selection.lon, spanDeg };
  }

  let box: Box | null = null;
  if (selection.kind === "polygon") {
    if (selection.ring.length === 0) return null;
    const lons = selection.ring.map(([lon]) => lon);
    const lats = selection.ring.map(([, lat]) => lat);
    box = {
      west: Math.min(...lons),
      east: Math.max(...lons),
      south: Math.min(...lats),
      north: Math.max(...lats),
    };
  } else {
    box = countryBox;
  }
  if (box === null) return null;

  // A box wider than half the globe most likely crosses the 180° line; show it whole.
  const width = box.east - box.west;
  if (width > 180) {
    return { lat: (box.south + box.north) / 2, lon: 180, spanDeg: 360 - width };
  }
  return {
    lat: (box.south + box.north) / 2,
    lon: (box.west + box.east) / 2,
    spanDeg: Math.max(width, box.north - box.south),
  };
}

/** The FIRMS map link for a place, last 7 days. */
export function firmsUrl(lat: number, lon: number, zoom: number): string {
  return `${FIRMS_MAP}#d:7days;@${lon.toFixed(2)},${lat.toFixed(2)},${zoom.toFixed(1)}z`;
}

/** Every link that applies to this selection, in display order. */
export function outsideLinks(input: OutsideLinkInput): OutsideLink[] {
  const links: OutsideLink[] = [];

  const view = selectionView(input.selection, input.countryBox);
  if (view !== null) {
    links.push({
      id: "firms",
      url: firmsUrl(view.lat, view.lon, zoomForSpan(view.spanDeg)),
      scope: "place",
    });
  }

  const iso3 = input.countryIso3?.toUpperCase() ?? null;
  const scope = input.selection.kind === "country" ? "place" : "country";
  if (iso3 !== null && /^[A-Z]{3}$/.test(iso3)) {
    links.push({
      id: "gwisStats",
      url: `${GWIS_STATS}/${iso3}/${input.year}`,
      scope,
    });
    if (EFFIS_COUNTRIES.has(iso3)) {
      links.push({
        id: "effisStats",
        url: `${EFFIS_STATS}/${iso3}/${input.year}/${EFFIS_FIRST_YEAR}/${input.year - 1}`,
        scope,
      });
    }
  }

  links.push({ id: "gwisDanger", url: GWIS_DANGER, scope: "world" });
  return links;
}
