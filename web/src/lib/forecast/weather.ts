import type { Selection } from "../../types/ui";

/** Must match `past_days` in the request: the API lists past rows first. */
export const PAST_DAYS = 7;
/** Today and the nine days after it, the same span as the timeline. */
export const FORECAST_DAYS = 10;
const RAIN_DAY_MM = 1;
const CACHE_MS = 3600000;

export type ForecastDay = "today" | "tomorrow";

export type DryDays = { days: number; atLeast: boolean };

/** Every value is null when the source gave nothing; 0 is a real measurement. */
export type DayWeather = {
  date: string;
  tMax: number | null;
  rhMin: number | null;
  windMax: number | null;
  gustMax: number | null;
  /** Meteorological direction the wind comes from, in degrees. */
  windFrom: number | null;
  rain: number | null;
  rain7: number | null;
  dryDays: DryDays | null;
  soil: number | null;
};

type Place = { lat: number; lon: number };
type CountryPoint = { lat: number; lon: number };

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const round = (value: number, digits: number): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

function series(block: Record<string, unknown>, name: string): unknown[] {
  const values = block[name];
  return Array.isArray(values) ? values : [];
}

/** Sum of the seven days before `index`; unknown if any of them is missing. */
function pastRain(rain: unknown[], index: number): number | null {
  if (index < PAST_DAYS) return null;
  let total = 0;
  for (let i = index - PAST_DAYS; i < index; i++) {
    const value = finite(rain[i]);
    if (value === null) return null;
    total += value;
  }
  return round(total, 1);
}

function daysSinceRain(rain: unknown[], index: number): DryDays | null {
  const today = finite(rain[index]);
  if (today !== null && today >= RAIN_DAY_MM) return { days: 0, atLeast: false };
  for (let i = index - 1; i >= Math.max(0, index - PAST_DAYS); i--) {
    const value = finite(rain[i]);
    if (value === null) return null;
    if (value >= RAIN_DAY_MM) return { days: index - i, atLeast: false };
  }
  return index >= PAST_DAYS ? { days: PAST_DAYS, atLeast: true } : null;
}

function dailyMean(hourly: Record<string, unknown>, name: string, date: string): number | null {
  const times = series(hourly, "time");
  const values = series(hourly, name);
  const found = times.flatMap((time, i) =>
    typeof time === "string" && time.startsWith(date) && finite(values[i]) !== null ? [values[i] as number] : [],
  );
  if (found.length === 0) return null;
  return round(found.reduce((sum, value) => sum + value, 0) / found.length, 3);
}

/**
 * Today is the first row after the past days; a day offset counts on from
 * there (0 today, 1 tomorrow, up to 9).
 */
export function parseWeather(json: unknown, day: ForecastDay | number, pastDays = PAST_DAYS): DayWeather | null {
  if (json === null || typeof json !== "object") return null;
  const daily = (json as Record<string, unknown>).daily;
  if (daily === null || typeof daily !== "object") return null;
  const block = daily as Record<string, unknown>;
  const offset = typeof day === "number" ? day : day === "tomorrow" ? 1 : 0;
  if (!Number.isInteger(offset) || offset < 0) return null;
  const index = pastDays + offset;
  const date = series(block, "time")[index];
  if (typeof date !== "string") return null;
  const rain = series(block, "precipitation_sum");
  const hourlyRaw = (json as Record<string, unknown>).hourly;
  const hourly = hourlyRaw !== null && typeof hourlyRaw === "object" ? (hourlyRaw as Record<string, unknown>) : {};
  const at = (name: string) => finite(series(block, name)[index]);
  return {
    date,
    tMax: at("temperature_2m_max"),
    rhMin: at("relative_humidity_2m_min"),
    windMax: at("wind_speed_10m_max"),
    gustMax: at("wind_gusts_10m_max"),
    windFrom: at("wind_direction_10m_dominant"),
    rain: at("precipitation_sum"),
    rain7: pastRain(rain, index),
    dryDays: daysSinceRain(rain, index),
    soil: dailyMean(hourly, "soil_moisture_0_to_1cm", date),
  };
}

export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassPoint = (typeof COMPASS)[number];

export function compassPoint(degrees: number): CompassPoint {
  const normal = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normal / 45) % 8];
}

/** Where the wind blows to, for an arrow drawn pointing north at 0 degrees. */
export function blowsToward(from: number): number {
  return (((from + 180) % 360) + 360) % 360;
}

export function roundedPlace(lat: number, lon: number): Place {
  return { lat: round(lat, 2), lon: round(lon, 2) };
}

export function weatherUrl(lat: number, lon: number): string {
  const place = roundedPlace(lat, lon);
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    daily: "temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum",
    hourly: "soil_moisture_0_to_1cm",
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    timezone: "auto",
    wind_speed_unit: "kmh",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

const cache = new Map<string, { at: number; json: unknown }>();

export async function fetchWeather(
  lat: number,
  lon: number,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<unknown> {
  const place = roundedPlace(lat, lon);
  const key = `${place.lat},${place.lon}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.json;
  const response = await fetcher(weatherUrl(lat, lon), { signal });
  if (!response.ok) throw new Error(`Weather service: ${response.status}`);
  const json: unknown = await response.json();
  if (json === null || typeof json !== "object" || !("daily" in json)) throw new Error("Incomplete weather data");
  cache.set(key, { at: now, json });
  return json;
}

/** The point the weather is read at; a polygon's closing corner is not counted twice. */
export function selectionPoint(selection: Selection, countries: Map<string, CountryPoint>): Place | null {
  if (selection.kind === "point") return { lat: selection.lat, lon: selection.lon };
  if (selection.kind === "country") {
    const entry = countries.get(selection.iso3);
    return entry && Number.isFinite(entry.lat) && Number.isFinite(entry.lon) ? { lat: entry.lat, lon: entry.lon } : null;
  }
  const ring = [...selection.ring];
  if (ring.length > 1) {
    const [firstLon, firstLat] = ring[0];
    const [lastLon, lastLat] = ring[ring.length - 1];
    if (firstLon === lastLon && firstLat === lastLat) ring.pop();
  }
  if (ring.length === 0) return null;
  const lon = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
  const lat = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
  return { lat, lon };
}
