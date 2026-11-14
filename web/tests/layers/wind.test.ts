import { describe, expect, it, vi } from 'vitest';
import { fetchWind, windGrid, windArrowRotation, windVector, createWindField } from '../../src/lib/layers/wind';

describe('wind grid and cache', () => {
  it('creates at most 25 points inside the view', () => {
    const points = windGrid({ west: 20, east: 30, south: 40, north: 50 });
    expect(points).toHaveLength(25);
    expect(points.every(p => p.lon >= 20 && p.lon <= 30 && p.lat >= 40 && p.lat <= 50)).toBe(true);
  });
  it('uses one request and caches a matching view for an hour', async () => {
    const bounds = { west: 21, east: 29, south: 41, north: 49 };
    const response = windGrid(bounds).map(() => ({ current: { wind_speed_10m: 12, wind_direction_10m: 90, time: '2026-11-14T12:00' } }));
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', request);
    try {
      const first = await fetchWind(bounds, 10000);
      expect(first).toHaveLength(25);
      expect(await fetchWind(bounds, 20000)).toEqual(first);
      expect(request).toHaveBeenCalledTimes(1);
      await fetchWind(bounds, 3610001);
      expect(request).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
});

// Cardinal expectations supplied in the brief, independently of the implementation.
describe('meteorological FROM direction becomes travel TO direction', () => {
  it.each([
    [270, 0, 12, 0],
    [0, 90, 0, -12],
    [90, 180, -12, 0],
    [180, 270, 0, 12],
  ])('from %s degrees', (from, rotation, east, north) => {
    expect(windArrowRotation(from)).toBe(rotation);
    expect(windVector(12, from).east).toBeCloseTo(east, 10);
    expect(windVector(12, from).north).toBeCloseTo(north, 10);
  });
  it('normalizes equivalent angles and leaves calm wind still', () => {
    expect(windArrowRotation(-90)).toBe(0);
    expect(windArrowRotation(630)).toBe(0);
    expect(Math.hypot(...Object.values(windVector(0, 270)))).toBe(0);
  });
});


describe('bilinear velocity field', () => {
  const bounds = { west: 0, east: 10, south: 0, north: 10 };
  const points = windGrid(bounds).map(p => ({ ...p, speed: p.lon + 2 * p.lat, direction: 270, time: '2026-11-14T12:00' }));
  it('reproduces an independently specified linear eastward field between samples', () => {
    const field = createWindField(points, bounds);
    expect(field(2, 4)?.east).toBeCloseTo(10, 10);
    expect(field(2.5, 4.5)?.east).toBeCloseTo(11.5, 10);
    expect(field(2, 4)?.north).toBeCloseTo(0, 10);
    for (const point of points) expect(field(point.lon, point.lat)?.east).toBeCloseTo(point.speed, 10);
  });
  it('uses the outer row only in its half-cell and rejects locations beyond coverage', () => {
    const field = createWindField(points, bounds);
    expect(field(0, 0)?.east).toBeCloseTo(3, 10);
    expect(field(10, 10)?.east).toBeCloseTo(27, 10);
    expect(field(-0.01, 5)).toBeNull();
    expect(field(5, 10.01)).toBeNull();
  });
  it('averages vector components across north, not angles into a reversed wind', () => {
    const field = createWindField(points.map(p => ({ ...p, speed: 20, direction: p.lon <= 1 ? 350 : 10 })), bounds);
    expect(field(2, 2)?.east).toBeCloseTo(0, 10);
    expect(field(2, 2)?.north).toBeCloseTo(-20 * Math.cos(Math.PI / 18), 10);
  });
  it('cancels opposing velocities and preserves calm', () => {
    const field = createWindField(points.map(p => ({ ...p, speed: 12, direction: p.lon <= 1 ? 90 : 270 })), bounds);
    expect(field(2, 2)?.east).toBeCloseTo(0, 10);
    expect(field(2, 2)?.north).toBeCloseTo(0, 10);
    expect(createWindField(points.map(p => ({ ...p, speed: 0 })), bounds)(5, 5)?.east).toBe(0);
  });
  it('does not invent data across missing corners', () => {
    const field = createWindField(points.filter(p => p.lon !== 3 || p.lat !== 3), bounds);
    expect(field(2, 2)).toBeNull();
    expect(field(1, 1)?.east).toBeCloseTo(3, 10);
    expect(field(8, 8)?.east).toBeCloseTo(24, 10);
  });
  it('keeps a usable grid at street-level zoom', () => {
    const area = { west: 20, east: 20.0001, south: 40, north: 40.0001 };
    const grid = windGrid(area).map(p => ({ ...p, speed: 12, direction: 270, time: '2026-11-14T12:00' }));
    expect(new Set(grid.map(p => p.lon)).size).toBe(5);
    expect(new Set(grid.map(p => p.lat)).size).toBe(5);
    expect(createWindField(grid, area)(20.00005, 40.00005)?.east).toBeCloseTo(12, 10);
  });
  it('interpolates continuously across the date line', () => {
    const area = { west: 170, east: 190, south: -10, north: 10 };
    const grid = windGrid(area).map(p => ({ ...p, speed: 18, direction: 270, time: '2026-11-14T12:00' }));
    expect(grid[4].lon).toBe(188);
    const field = createWindField(grid, area);
    expect(field(-179, 0)?.east).toBeCloseTo(18, 10);
    expect(field(181, 0)).toEqual(field(-179, 0));
    expect(field(-160, 0)).toBeNull();
  });
  it('wraps only API longitudes and explicitly requests km/h', async () => {
    const area = { west: 170, east: 190, south: -10, north: 10 };
    const response = windGrid(area).map(() => ({ current: { wind_speed_10m: 12, wind_direction_10m: 270, time: '2026-11-14T12:00' } }));
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', request);
    try {
      const data = await fetchWind(area, 10000);
      const url = new URL(request.mock.calls[0][0]);
      expect(url.searchParams.get('wind_speed_unit')).toBe('kmh');
      expect(url.searchParams.get('longitude')?.split(',').map(Number).every(n => n >= -180 && n <= 180)).toBe(true);
      expect(data[4].lon).toBe(188);
    } finally { vi.unstubAllGlobals(); }
  });
});
