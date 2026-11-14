/** Clockwise CSS rotation for a right-facing glyph, from meteorological FROM degrees. */
export function windArrowRotation(direction: number): number {
  return ((direction + 90) % 360 + 360) % 360;
}

/** East/north components in km/h, pointing where the wind blows TO. */
export function windVector(speed: number, direction: number): { east: number; north: number } {
  const radians = direction * Math.PI / 180;
  return { east: -speed * Math.sin(radians), north: -speed * Math.cos(radians) };
}

/** A coarse, bounded grid for one Open-Meteo request. */
export type Bounds = { west: number; south: number; east: number; north: number };
export type WindPoint = { lat: number; lon: number; speed: number; direction: number; time: string };

export function windGrid(bounds: Bounds): { lat: number; lon: number }[] {
  const west = bounds.west, east = Math.min(bounds.east, west + 360);
  const south = Math.max(-90, bounds.south), north = Math.min(90, bounds.north);
  const points = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    points.push({ lat: +(south + (north - south) * (y + 0.5) / 5).toFixed(6), lon: +(west + (east - west) * (x + 0.5) / 5).toFixed(6) });
  }
  return points;
}

let cached: { key: string; at: number; points: WindPoint[] } | null = null;
export async function fetchWind(bounds: Bounds, now = Date.now()): Promise<WindPoint[]> {
  const grid = windGrid(bounds);
  const key = JSON.stringify(grid);
  if (cached && cached.key === key && Math.floor(now / 3600000) === Math.floor(cached.at / 3600000)) return cached.points;
  const params = new URLSearchParams({ latitude: grid.map(p => p.lat).join(','), longitude: grid.map(p => ((p.lon + 180) % 360 + 360) % 360 - 180).join(','), current: 'wind_speed_10m,wind_direction_10m', timezone: 'UTC', wind_speed_unit: 'kmh' });
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

export type WindVector = { east: number; north: number };

/**
 * Bilinear interpolation of velocity, never compass angles. Missing corners
 * remain missing; the outer half-cell uses the nearest measured row/column.
 * Longitudes stay continuous across the date line until the API request.
 */
export function createWindField(points: WindPoint[], bounds: Bounds) {
  const grid = windGrid(bounds);
  const cells = grid.map(p => {
    const point = points.find(q => q.lat === p.lat && q.lon === p.lon);
    return point ? windVector(point.speed, point.direction) : null;
  });
  const west = grid[0].lon, south = grid[0].lat;
  const dx = (grid[4].lon - west) / 4, dy = (grid[20].lat - south) / 4;
  return (longitude: number, lat: number): WindVector | null => {
    const lon = longitude + 360 * Math.round(((bounds.west + bounds.east) / 2 - longitude) / 360);
    if (lon < bounds.west || lon > bounds.east || lat < bounds.south || lat > bounds.north || dx <= 0 || dy <= 0) return null;
    const x = Math.max(0, Math.min(4, (lon - west) / dx));
    const y = Math.max(0, Math.min(4, (lat - south) / dy));
    const ix = Math.min(3, Math.floor(x)), iy = Math.min(3, Math.floor(y));
    const tx = x - ix, ty = y - iy;
    const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
    const indices = [iy * 5 + ix, iy * 5 + ix + 1, (iy + 1) * 5 + ix, (iy + 1) * 5 + ix + 1];
    let east = 0, north = 0;
    for (let i = 0; i < 4; i++) {
      if (weights[i] === 0) continue;
      const cell = cells[indices[i]];
      if (!cell) return null;
      east += cell.east * weights[i]; north += cell.north * weights[i];
    }
    return { east, north };
  };
}
