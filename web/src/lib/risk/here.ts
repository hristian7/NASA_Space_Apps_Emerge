import type { RiskIndex, RiskSpot } from '../../types/risk';
import { distanceKm, nearestSpot } from './geo';
import { loadRiskCountry } from './loaders';
/** Load only countries whose boxes could intersect the grid's precision radius. */
export async function loadRiskHere(index: RiskIndex, lat: number, lon: number, example: boolean, fetcher = fetch): Promise<RiskSpot | null> {
 if(!index.meta || !Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const candidates=index.regions.filter(({bbox:[w,s,e,n]})=>distanceKm(lat,lon,Math.max(s,Math.min(n,lat)),Math.max(w,Math.min(e,lon)))<=index.meta!.grid_g*112);
 const countries=[...new Set(candidates.map(r=>r.country))];
 const files=await Promise.all(countries.map(country=>loadRiskCountry(country,example,fetcher)));
 const day=index.meta.days.tomorrow;
 const spots=files.flatMap(({file})=>Object.values(file.regions).flatMap(days=>days[day]??[]));
 const all=files.flatMap(({file})=>Object.values(file.all_vegetation??{}).flatMap(days=>days[day]??[]));
 return nearestSpot(spots,lat,lon) ?? nearestSpot(all,lat,lon);
}
