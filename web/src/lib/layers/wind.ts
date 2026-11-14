/** A coarse, bounded grid for one Open-Meteo request. */
export type Bounds = { west: number; south: number; east: number; north: number };
export type WindPoint = { lat: number; lon: number; speed: number; direction: number; time: string };

export function windGrid(bounds: Bounds): { lat: number; lon: number }[] {
  const west = Math.max(-180, bounds.west), east = Math.min(180, bounds.east);
  const south = Math.max(-90, bounds.south), north = Math.min(90, bounds.north);
  const points = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    points.push({ lat: +(south + (north - south) * (y + 0.5) / 5).toFixed(3), lon: +(west + (east - west) * (x + 0.5) / 5).toFixed(3) });
  }
  return points;
}

let cached: { key: string; at: number; points: WindPoint[] } | null = null;
export async function fetchWind(bounds: Bounds, now = Date.now()): Promise<WindPoint[]> {
  const grid = windGrid(bounds);
  const key = JSON.stringify(grid);
  if (cached && cached.key === key && now - cached.at < 3600000) return cached.points;
  const params = new URLSearchParams({ latitude: grid.map(p => p.lat).join(','), longitude: grid.map(p => p.lon).join(','), current: 'wind_speed_10m,wind_direction_10m', timezone: 'UTC' });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Wind service: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length !== grid.length) throw new Error('Incomplete wind data');
  const points = grid.flatMap((p, i) => {
    const current = data[i]?.current;
    return Number.isFinite(current?.wind_speed_10m) && Number.isFinite(current?.wind_direction_10m) && typeof current?.time === 'string'
      ? [{ ...p, speed: current.wind_speed_10m as number, direction: current.wind_direction_10m as number, time: current.time as string }] : [];
  });
  if (!points.length) throw new Error('No wind data');
  cached = { key, at: now, points };
  return points;
}
