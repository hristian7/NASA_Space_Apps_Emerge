import { afterEach, describe, expect, it, vi } from 'vitest';
import { bilinear, temperatureColor, temperatureGrid, reusableView, fetchTemperature, clearTemperatureCache } from '../../src/lib/layers/temperature';

const view = { west: 0, east: 20, south: 30, north: 50 };
const now = Date.parse('2026-11-15T06:00:00Z');
const dates = ['2026-11-15', '2026-11-16'];
const payload = () => Array.from({ length: 64 }, () => ({ daily_units: { temperature_2m_max: '°C' }, daily: { time: dates, temperature_2m_max: [10, 20] } }));
afterEach(() => { vi.unstubAllGlobals(); clearTemperatureCache(); });

describe('temperature field', () => {
  it('covers the view plus a half-view pan with at most eight by eight samples', () => {
    const grid = temperatureGrid(view);
    expect(grid.points).toHaveLength(64);
    expect(grid.bounds).toEqual({ west: -10, east: 30, south: 20, north: 60 });
    expect(grid.points[0]).toEqual({ lat: 20, lon: -10 });
    expect(grid.points[63]).toEqual({ lat: 60, lon: 30 });
  });
  it('wraps antimeridian samples without reversing the grid', () => {
    const grid = temperatureGrid({ west: 170, east: -170, south: -10, north: 10 });
    expect(grid.bounds.west).toBe(160);
    expect(grid.bounds.east).toBe(200);
    expect(grid.points.every(p => p.lon >= -180 && p.lon <= 180)).toBe(true);
    expect(grid.points[7].lon).toBe(-160);
  });
  it('clamps the globe to one world and the map latitude limit', () => {
    const grid = temperatureGrid({ west: -240, east: 240, south: -90, north: 90 });
    expect(grid.bounds).toEqual({ west: -180, east: 180, south: -85.051129, north: 85.051129 });
  });
  it('uses analytic bilinear corner and midpoint answers', () => {
    // f(x,y) = 10x + 20y on the unit square, known before implementation.
    expect(bilinear([0, 10, 20, 30], 2, 2, 0, 0)).toBe(0);
    expect(bilinear([0, 10, 20, 30], 2, 2, 1, 1)).toBe(30);
    expect(bilinear([0, 10, 20, 30], 2, 2, 0.5, 0.5)).toBe(15);
    expect(bilinear([0, 10, 20, 30], 2, 2, 0.25, 0.75)).toBe(17.5);
  });
  it('does not turn missing measurements into zero', () => {
    expect(bilinear([0, null, 20, 30], 2, 2, 0.5, 0.5)).toBeNull();
    expect(temperatureColor(Number.NaN)).toEqual([0, 0, 0, 0]);
  });
  it('clamps the perceptual ramp and preserves a distinct freezing colour', () => {
    expect(temperatureColor(-100)).toEqual(temperatureColor(-40));
    expect(temperatureColor(100)).toEqual(temperatureColor(50));
    expect(temperatureColor(0)).not.toEqual(temperatureColor(-40));
    expect(temperatureColor(0)).not.toEqual(temperatureColor(50));
    expect(temperatureColor(0)[3]).toBe(255);
    for (let t = -40; t < 50; t++) {
      const a = temperatureColor(t), b = temperatureColor(t + 0.1);
      expect(Math.max(...a.map((v, i) => Math.abs(v - b[i])))).toBeLessThan(5);
    }
  });
  it('reuses small pans but refetches beyond half a view or on zoom out', () => {
    expect(reusableView(view, { ...view, west: 10, east: 30 })).toBe(true);
    expect(reusableView(view, { ...view, west: 10.1, east: 30.1 })).toBe(false);
    expect(reusableView(view, { west: -30, east: 50, south: 0, north: 80 })).toBe(false);
  });
  it('requests both daily maxima in Celsius in one request and caches for an hour', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    vi.stubGlobal('fetch', fetcher);
    const result = await fetchTemperature(view, now);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('daily')).toBe('temperature_2m_max');
    expect(url.searchParams.get('forecast_days')).toBe('2');
    expect(url.searchParams.get('temperature_unit')).toBe('celsius');
    expect(url.searchParams.get('timezone')).toBe('UTC');
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(64);
    expect(result.dates).toEqual(dates);
    expect(result.values[1]).toEqual(Array(64).fill(20));
    expect(await fetchTemperature({ ...view, west: 1, east: 21 }, now + 3599999)).toBe(result);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await fetchTemperature(view, now + 3600000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('deduplicates concurrent requests for the same view', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    vi.stubGlobal('fetch', fetcher);
    await Promise.all([fetchTemperature(view, now), fetchTemperature(view, now)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves a missing day as no data while keeping the other day usable', async () => {
    const data = payload(); data[0].daily.temperature_2m_max[0] = NaN;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    const result = await fetchTemperature(view, now);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toEqual(Array(64).fill(20));
  });
  it('rejects partial, wrong-date and wrong-unit responses', async () => {
    for (const data of [payload().slice(1), payload().map(p => ({ ...p, daily: { ...p.daily, time: ['2020-01-01', '2020-01-02'] } })), payload().map(p => ({ ...p, daily_units: { temperature_2m_max: '°F' } }))]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
      await expect(fetchTemperature(view, now)).rejects.toThrow();
      clearTemperatureCache();
    }
  });
  it('allows a retry after a service failure', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => payload() });
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchTemperature(view, now)).rejects.toThrow();
    expect((await fetchTemperature(view, now)).values[0]).toHaveLength(64);
  });
});
