import { expect, it, vi } from 'vitest';
import { fetchPower, parsePower, powerUrl } from '../../src/lib/forecast/power';

const data = { properties: { parameter: {
 T2M_MAX: { '20261110': 0, '20261111': 12, '20261112': -999 },
 WS10M: { '20261110': 5, '20261111': -999, '20261112': -999 },
 RH2M: { '20261110': 50, '20261111': 60, '20261112': -999 },
} } };
it('preserves zero and gaps, converts wind, and finds the last real date', () => {
 const result = parsePower(data);
 expect(result.series.T2M_MAX.map(day => day.value)).toEqual([0, 12, null]);
 expect(result.series.WS10M.map(day => day.value)).toEqual([18, null, null]);
 expect(result.series.GWETTOP.map(day => day.value)).toEqual([null, null, null]);
 expect(result.lastDate).toBe('2026-11-11');
 expect(result.units.WS10M).toBe('km/h');
});
it('requests one inclusive 30-day window and caches it for an hour', async () => {
 const now = Date.UTC(2026, 10, 14);
 const url = new URL(powerUrl(42.15, 23.45, now));
 expect(url.searchParams.get('start')).toBe('20261016');
 expect(url.searchParams.get('end')).toBe('20261114');
 const fetcher = vi.fn(async () => new Response(JSON.stringify(data))) as unknown as typeof fetch;
 await fetchPower(42.15, 23.45, undefined, fetcher, now);
 await fetchPower(42.15, 23.45, undefined, fetcher, now + 3599999);
 expect(fetcher).toHaveBeenCalledTimes(1);
 await fetchPower(42.15, 23.45, undefined, fetcher, now + 3600000);
 expect(fetcher).toHaveBeenCalledTimes(2);
});
