/** Reasons the typed coordinates were refused. The caller turns these into text. */
export type LatLonError = "empty" | "number" | "lat" | "lon";

export type LatLonResult =
  | { ok: true; lat: number; lon: number }
  | { ok: false; error: LatLonError };

/** Latitude and longitude limits (M3). */
export const latRange = [-90, 90] as const;
export const lonRange = [-180, 180] as const;

/**
 * Decimal degrees only. A comma is accepted as a separator between the two
 * fields, so pasting "42.7, 23.3" into the latitude box also works, but a
 * comma is never read as a decimal point: "42,7" is two numbers, not one.
 */
function parseNumber(raw: string): number | null {
  const text = raw.trim().replace(/^\+/, "");
  if (text === "") return null;
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function parseLatLon(latRaw: string, lonRaw: string): LatLonResult {
  // One box may hold both numbers, as happens when a pair is pasted.
  let latText = latRaw.trim();
  let lonText = lonRaw.trim();
  const pasted = latText.split(/[,;\s]+/).filter((part) => part !== "");
  if (lonText === "" && pasted.length === 2) {
    [latText, lonText] = pasted;
  }

  if (latText === "" || lonText === "") return { ok: false, error: "empty" };

  const lat = parseNumber(latText);
  const lon = parseNumber(lonText);
  if (lat === null || lon === null) return { ok: false, error: "number" };

  if (lat < latRange[0] || lat > latRange[1]) return { ok: false, error: "lat" };
  if (lon < lonRange[0] || lon > lonRange[1]) return { ok: false, error: "lon" };

  return { ok: true, lat, lon };
}
