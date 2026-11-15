import type { RiskScoresFile, RiskSquareResult } from '../../types/risk';
import { riskRoot } from './loaders';

/** Compute the containing square, wrapping longitude and clamping the poles. */
export function riskSquare(lat: number, lon: number, grid: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(grid) || grid <= 0) {
    throw new Error('Invalid coordinates or grid size');
  }
  const columns = 360 / grid;
  const rows = 180 / grid;
  if (!Number.isInteger(columns) || !Number.isInteger(rows)) throw new Error('Invalid grid size');
  const latitude = Math.max(-90, Math.min(90, lat));
  const longitude = ((lon + 180) % 360 + 360) % 360 - 180;
  const row = Math.min(rows - 1, Math.floor((90 - latitude) / grid));
  const col = Math.floor((longitude + 180) / grid);
  return { spot_id: row * columns + col, lat: 90 - (row + .5) * grid, lon: -180 + (col + .5) * grid };
}

/** Fetch just one country; unavailable files and days are distinct from ocean. */
export async function loadSpotScore(country: string, day: string, lat: number, lon: number, fetcher = fetch): Promise<RiskSquareResult> {
  if (!/^[A-Z]{3}$/.test(country)) throw new Error('Invalid country code');
  const response = await fetcher(`${riskRoot(false)}/scores/${country}.json`, { cache: 'no-store' });
  // An unread error body keeps the request open.
  if (!response.ok) void response.body?.cancel().catch(() => {});
  if (response.status === 404) return { status: 'missing country' };
  if (!response.ok) throw new Error(`Risk data: ${response.status}`);
  const file = await response.json() as RiskScoresFile;
  const square = riskSquare(lat, lon, file.grid_g);
  const scores = file.days[day];
  if (!scores) return { status: 'missing day' };
  let lo = 0, hi = scores.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (scores[mid][0] < square.spot_id) lo = mid + 1;
    else hi = mid;
  }
  const score = scores[lo];
  if (!score || score[0] !== square.spot_id) return { status: 'not land' };
  if (score[1] === null) return { status: 'no forecast here', ...square, p: null, level: null };
  if (score[2] === null) throw new Error('Score is missing its level');
  return { status: 'ready', ...square, p: score[1], level: score[2], usual: score[3] ?? null, fwi: score[4] ?? null, context: file.context_corrections?.[day]?.[square.spot_id] };
}
