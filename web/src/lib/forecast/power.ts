import { roundedPlace } from './weather';

export const POWER_PARAMETERS = ['T2M_MAX', 'RH2M', 'WS10M', 'WD10M', 'PRECTOTCORR', 'GWETTOP'] as const;
export type PowerParameter = typeof POWER_PARAMETERS[number];
export const POWER_UNITS: Record<PowerParameter, string> = {
  T2M_MAX: '°C', RH2M: '%', WS10M: 'km/h', WD10M: '°', PRECTOTCORR: 'mm', GWETTOP: '0 to 1',
};
export type PowerDay = { date: string; value: number | null };
export type PowerData = { series: Record<PowerParameter, PowerDay[]>; lastDate: string | null; units: typeof POWER_UNITS };
const CACHE_MS = 3600000;
const cache = new Map<string, { at: number; data: PowerData }>();
const dateString = (date: Date) => date.toISOString().slice(0, 10);

/** The inclusive UTC window contains today and the preceding 29 days. */
export function powerUrl(lat: number, lon: number, now = Date.now()): string {
  const place = roundedPlace(lat, lon);
  const end = new Date(now);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - 29));
  const params = new URLSearchParams({ parameters: POWER_PARAMETERS.join(','), community: 'AG', longitude: String(place.lon), latitude: String(place.lat), start: dateString(start).replaceAll('-', ''), end: dateString(end).replaceAll('-', ''), format: 'JSON' });
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${params}`;
}

export function parsePower(json: unknown): PowerData {
  if (!json || typeof json !== 'object' || !('properties' in json)) throw new Error('Incomplete POWER data');
  const properties = (json as { properties?: { parameter?: unknown } }).properties;
  const raw = properties?.parameter;
  if (!raw || typeof raw !== 'object') throw new Error('Incomplete POWER data');
  const block = raw as Record<string, unknown>;
  const dates = new Set<string>();
  for (const name of POWER_PARAMETERS) {
    const values = block[name];
    if (values && typeof values === 'object') for (const date of Object.keys(values)) if (/^\d{8}$/.test(date)) dates.add(date);
  }
  const sorted = [...dates].sort();
  let lastDate: string | null = null;
  const series = {} as Record<PowerParameter, PowerDay[]>;
  for (const name of POWER_PARAMETERS) {
    const values = (block[name] && typeof block[name] === 'object' ? block[name] : {}) as Record<string, unknown>;
    series[name] = sorted.map(key => {
      const rawValue = values[key];
      const value = typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue !== -999 ? (name === 'WS10M' ? rawValue * 3.6 : rawValue) : null;
      const date = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
      if (value !== null && (lastDate === null || date > lastDate)) lastDate = date;
      return { date, value };
    });
  }
  return { series, lastDate, units: POWER_UNITS };
}

export async function fetchPower(lat: number, lon: number, signal?: AbortSignal, fetcher: typeof fetch = fetch, now = Date.now()): Promise<PowerData> {
  const place = roundedPlace(lat, lon);
  const key = `${place.lat},${place.lon}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS && now >= hit.at) return hit.data;
  const response = await fetcher(powerUrl(lat, lon, now), { signal });
  if (!response.ok) throw new Error(`POWER service: ${response.status}`);
  const data = parsePower(await response.json());
  cache.set(key, { at: now, data });
  return data;
}
