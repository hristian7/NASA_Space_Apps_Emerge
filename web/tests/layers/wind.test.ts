import { describe, expect, it, vi } from 'vitest';
import { fetchWind, windGrid } from '../../src/lib/layers/wind';

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
