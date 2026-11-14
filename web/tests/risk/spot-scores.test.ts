import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadSpotScore, riskSquare } from '../../src/lib/risk/spot-scores';

const oracle = JSON.parse(readFileSync(new URL('../../../tests/expected/risk/spot_id.json', import.meta.url), 'utf8'));
const rila = oracle.cases.find((c: { name: string; g: number }) => c.name === 'Rila' && c.g === .25);
const day = '2026-11-15';
const withScores = (scores: unknown[]) => (async () => new Response(JSON.stringify({ grid_g: .25, days: { [day]: scores } }))) as typeof fetch;

it('matches the independent Rila oracle and wraps and clamps grid edges', () => {
  expect(riskSquare(rila.lat, rila.lon, rila.g)).toEqual({ spot_id: rila.spot_id, lat: rila.center_lat, lon: rila.center_lon });
  expect(riskSquare(-90, 180, .25)).toEqual({ spot_id: 1035360, lat: -89.875, lon: -179.875 });
});
it('distinguishes scored, null, zero and missing squares', async () => {
  expect(await loadSpotScore('BGR', day, rila.lat, rila.lon, withScores([[rila.spot_id, .1234, 3]]))).toMatchObject({ status: 'ready', p: .1234, level: 3 });
  expect(await loadSpotScore('BGR', day, rila.lat, rila.lon, withScores([[rila.spot_id, 0, 1]]))).toMatchObject({ status: 'ready', p: 0 });
  expect(await loadSpotScore('BGR', day, rila.lat, rila.lon, withScores([[rila.spot_id, null, null]]))).toMatchObject({ status: 'no forecast here', p: null });
  expect(await loadSpotScore('BGR', day, rila.lat, rila.lon, withScores([]))).toEqual({ status: 'not land' });
});
it('distinguishes a missing country and missing day from land coverage', async () => {
  const missing = (async () => new Response(null, { status: 404 })) as typeof fetch;
  expect(await loadSpotScore('BGR', day, rila.lat, rila.lon, missing)).toEqual({ status: 'missing country' });
  expect(await loadSpotScore('BGR', 'other', rila.lat, rila.lon, withScores([]))).toEqual({ status: 'missing day' });
});
