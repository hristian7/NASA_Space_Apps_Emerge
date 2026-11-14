import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadPointScore } from '../../src/lib/risk/point-score';
const fixtureFetch = (async (input: RequestInfo | URL) => {
 try { return new Response(readFileSync(new URL(`../../public${String(input)}`, import.meta.url), 'utf8')); }
 catch { return new Response(null, { status: 404 }); }
}) as typeof fetch;
it('finds a published tomorrow score and rejects a point outside coverage', async () => {
 const score = await loadPointScore({ lat: 43.875, lon: 22.375 }, fixtureFetch);
 expect(score).toMatchObject({ spot: { spot_id: 265769, day: '2026-11-15' }, level: 2, chance: 0.007460641578582908, why: ['history', 'very_dry', 'mostly_grass'] });
 expect(await loadPointScore({ lat: 0, lon: 0 }, fixtureFetch)).toBeNull();
});
