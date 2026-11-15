import type { Bounds } from './wind';

export const temperatureCacheMs = 60 * 60 * 1000;
const limit = 85.051129;
const size = 8;
const wrap = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function normalized(bounds: Bounds): Bounds {
  let width = bounds.east - bounds.west;
  if (width < 0) width += 360;
  width = clamp(width, 0.001, 360);
  const west = width === 360 ? -180 : wrap(bounds.west);
  return { west, east: west + width, south: clamp(bounds.south, -limit, limit), north: clamp(bounds.north, -limit, limit) };
}

/** Extra half-view margin keeps the field continuous while small pans reuse it. */
export function temperatureGrid(view: Bounds) {
  const b = normalized(view), width = b.east - b.west, height = b.north - b.south;
  const bounds = normalized({ west: b.west - width / 2, east: b.east + width / 2, south: b.south - height / 2, north: b.north + height / 2 });
  const points = Array.from({ length: size * size }, (_, i) => ({
    lat: bounds.south + (bounds.north - bounds.south) * Math.floor(i / size) / (size - 1),
    lon: wrap(bounds.west + (bounds.east - bounds.west) * (i % size) / (size - 1)),
  }));
  return { bounds, points, columns: size, rows: size };
}

/** A zoom out also invalidates the field when it would expose an unsampled edge. */
export function reusableView(previous: Bounds, next: Bounds): boolean {
  const a = normalized(previous), b = normalized(next);
  const width = a.east - a.west, height = a.north - a.south;
  const dx = Math.abs(wrap((b.west + b.east - a.west - a.east) / 2));
  const dy = Math.abs((b.south + b.north - a.south - a.north) / 2);
  return (width === 360 || (dx <= width / 2 && dx + (b.east - b.west) / 2 <= width)) &&
    dy <= height / 2 && dy + (b.north - b.south) / 2 <= height;
}

/** Row-major corners, south to north, x/y normalized to the grid extent. */
export function bilinear(values: readonly (number | null)[], columns: number, rows: number, x: number, y: number): number | null {
  const gx = clamp(x, 0, 1) * (columns - 1), gy = clamp(y, 0, 1) * (rows - 1);
  const ix = Math.min(columns - 2, Math.floor(gx)), iy = Math.min(rows - 2, Math.floor(gy));
  const a = values[iy * columns + ix], b = values[iy * columns + ix + 1];
  const c = values[(iy + 1) * columns + ix], d = values[(iy + 1) * columns + ix + 1];
  if (a == null || b == null || c == null || d == null || ![a, b, c, d].every(Number.isFinite)) return null;
  const fx = gx - ix, fy = gy - iy;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

// Cold blue to warm ochre/red, interpolated in perceptual OKLab space.
// Stops and range are presentation choices [U], not weather thresholds.
export const temperatureStops = [
  { value: -40, rgb: [49, 54, 149] },
  { value: -20, rgb: [69, 117, 180] },
  { value: 0, rgb: [171, 217, 233] },
  { value: 15, rgb: [255, 255, 191] },
  { value: 30, rgb: [253, 174, 97] },
  { value: 50, rgb: [165, 0, 38] },
];
const linear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
function lab(rgb: number[]) {
  const [r, g, b] = rgb.map(v => linear(v / 255));
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  return [.2104542553*l + .793617785*m - .0040720468*s, 1.9779984951*l - 2.428592205*m + .4505937099*s, .0259040371*l + .7827717662*m - .808675766*s];
}
const labs = temperatureStops.map(stop => lab(stop.rgb));
const srgb = (v: number) => Math.round(clamp(v <= .0031308 ? 12.92*v : 1.055 * v ** (1/2.4) - .055, 0, 1) * 255);
export function temperatureColor(value: number): [number, number, number, number] {
  if (!Number.isFinite(value)) return [0, 0, 0, 0];
  const t = clamp(value, -40, 50);
  const i = Math.min(temperatureStops.length - 2, Math.max(0, temperatureStops.findIndex((stop, j) => j > 0 && t <= stop.value) - 1));
  const f = (t - temperatureStops[i].value) / (temperatureStops[i + 1].value - temperatureStops[i].value);
  const [L, a, b] = labs[i].map((v, j) => v + (labs[i + 1][j] - v) * f);
  const l = (L + .3963377774*a + .2158037573*b) ** 3;
  const m = (L - .1055613458*a - .0638541728*b) ** 3;
  const s = (L - .0894841775*a - 1.291485548*b) ** 3;
  return [srgb(4.0767416621*l - 3.3077115913*m + .2309699292*s), srgb(-1.2684380046*l + 2.6097574011*m - .3413193965*s), srgb(-.0041960863*l - .7034186147*m + 1.707614701*s), 255];
}
export const temperatureGradient = `linear-gradient(to right, ${Array.from({ length: 91 }, (_, i) => `rgb(${temperatureColor(i - 40).slice(0, 3).join(',')})`).join(',')})`;

export type TemperatureField = ReturnType<typeof temperatureGrid> & { view: Bounds; at: number; dates: string[]; values: (number[] | null)[] };
let cached: { view: Bounds; at: number; field: TemperatureField } | null = null;
let pending: { key: string; result: Promise<TemperatureField> } | null = null;
export function clearTemperatureCache() { cached = null; pending = null; }

export async function fetchTemperature(view: Bounds, now = Date.now()): Promise<TemperatureField> {
  const today = new Date(now).toISOString().slice(0, 10);
  if (cached && now - cached.at < temperatureCacheMs && cached.field.dates[0] === today && reusableView(cached.view, view)) return cached.field;
  const grid = temperatureGrid(view), key = today + JSON.stringify(grid.bounds);
  if (pending?.key === key) return pending.result;
  const result = (async () => {
    const params = new URLSearchParams({ latitude: grid.points.map(p => p.lat.toFixed(5)).join(','), longitude: grid.points.map(p => p.lon.toFixed(5)).join(','), daily: 'temperature_2m_max', forecast_days: '10', temperature_unit: 'celsius', timezone: 'UTC', cell_selection: 'nearest' });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Temperature service: ${response.status}`);
    const data = await response.json();
    const dates = Array.from({ length: 10 }, (_, i) => new Date(now + i * 86400000).toISOString().slice(0, 10));
    if (!Array.isArray(data) || data.length !== grid.points.length || !data.every(p => p?.daily_units?.temperature_2m_max === '°C' && dates.every((date, i) => p?.daily?.time?.[i] === date))) throw new Error('Incomplete temperature data');
    const values = dates.map((_, day) => {
      const samples: unknown[] = data.map(p => p.daily.temperature_2m_max?.[day]);
      return samples.every((v): v is number => typeof v === 'number' && Number.isFinite(v)) ? samples : null;
    });
    const field = { ...grid, view, at: now, dates, values };
    cached = { view, at: now, field };
    return field;
  })();
  pending = { key, result };
  try { return await result; } finally { if (pending?.result === result) pending = null; }
}
