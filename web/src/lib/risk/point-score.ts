import { loadRiskHere } from './here';
import { loadRiskIndex, showForecast } from './loaders';
import type { RiskSpot } from '../../types/risk';

export type PointScore = { spot: RiskSpot; level: RiskSpot['level']; chance: number | null; why: string[] };

/** Published tomorrow forecast, restricted to the nearest spot's precision radius. */
export async function loadPointScore(point: { lat: number; lon: number }, fetcher: typeof fetch = fetch): Promise<PointScore | null> {
  const index = await loadRiskIndex(false, fetcher);
  if (!showForecast(index.meta, false)) return null;
  const spot = await loadRiskHere(index, point.lat, point.lon, false, fetcher);
  return spot ? { spot, level: spot.level, chance: spot.p, why: spot.why } : null;
}
