/**
 * Place search for the top bar: a typed latitude and longitude, a country from
 * the data set, or a named place from the Photon geocoder (OpenStreetMap data,
 * free, no key). Photon is asked only after a pause in typing and only for
 * three or more characters, which is the service's fair-use expectation.
 */

import { latRange, lonRange } from "./latlon";

export type PlaceHit =
  | { kind: "coords"; lat: number; lon: number }
  | { kind: "country"; iso3: string; name: string }
  | { kind: "place"; name: string; detail: string; lat: number; lon: number; countryIso2: string | null; isCountry: boolean };

const photonUrl = "https://photon.komoot.io/api/";

/** "42.7, 23.3", "42.7 23.3" or "42.7;23.3", latitude first. Null if it is not a pair in range. */
export function parseCoordsQuery(query: string): { lat: number; lon: number } | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(query);
  if (match === null) return null;
  // A comma decimal is allowed only when the separator is not also a comma.
  const lat = Number(match[1].replace(",", "."));
  const lon = Number(match[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < latRange[0] || lat > latRange[1] || lon < lonRange[0] || lon > lonRange[1]) return null;
  return { lat, lon };
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
};

/** Turns a Photon response into hits, dropping anything without a name or a point. */
export function parsePhoton(json: unknown): PlaceHit[] {
  const features = (json as { features?: PhotonFeature[] } | null)?.features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const hits: PlaceHit[] = [];
  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    const props = feature.properties ?? {};
    if (!Array.isArray(coords) || typeof props.name !== "string") continue;
    const [lon, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const detail = [props.city !== props.name ? props.city : undefined, props.state, props.country]
      .filter((part): part is string => typeof part === "string" && part !== "" && part !== props.name)
      .join(", ");
    const key = `${props.name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      kind: "place",
      name: props.name,
      detail,
      lat,
      lon,
      countryIso2: typeof props.countrycode === "string" ? props.countrycode.toUpperCase() : null,
      isCountry: props.osm_value === "country" || props.type === "country",
    });
  }
  return hits;
}

export async function searchPlaces(query: string, locale: string, signal: AbortSignal): Promise<PlaceHit[]> {
  // Photon speaks a few languages; any other gets the local names.
  const lang = ["en", "de", "fr"].includes(locale) ? `&lang=${locale}` : "";
  const response = await fetch(`${photonUrl}?q=${encodeURIComponent(query)}&limit=6${lang}`, { signal });
  if (!response.ok) throw new Error(`Place search: ${response.status}`);
  return parsePhoton(await response.json());
}
