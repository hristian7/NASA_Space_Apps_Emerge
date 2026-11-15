import type { RiskRegion, RiskSpot } from '../../types/risk';
import { encodeSelection } from '../ui/selection-url';
export function distanceKm(lat: number, lon: number, otherLat: number, otherLon: number): number {
 const r = Math.PI / 180;
 const a = Math.sin((otherLat-lat)*r/2)**2 + Math.cos(lat*r)*Math.cos(otherLat*r)*Math.sin((otherLon-lon)*r/2)**2;
 return 12742 * Math.asin(Math.sqrt(Math.min(1,a)));
}
export function nearestSpot(spots: RiskSpot[], lat: number, lon: number): RiskSpot | null {
 return spots.map(spot=>({spot,d:distanceKm(lat,lon,spot.lat,spot.lon)}))
  .filter(({spot,d})=>d<=spot.precision_radius_km).sort((a,b)=>a.d-b.d)[0]?.spot ?? null;
}
/** Boxes are the contract's only region geometry; overlapping boxes use nearest centre. */
export function regionAt(regions: RiskRegion[], lat: number, lon: number): RiskRegion | null {
 return regions.filter(({bbox:[w,s,e,n]})=>lon>=w&&lon<=e&&lat>=s&&lat<=n)
  .sort((a,b)=>distanceKm(lat,lon,(a.bbox[1]+a.bbox[3])/2,(a.bbox[0]+a.bbox[2])/2)-distanceKm(lat,lon,(b.bbox[1]+b.bbox[3])/2,(b.bbox[0]+b.bbox[2])/2))[0] ?? null;
}
export function historyHref(spot: Pick<RiskSpot, 'lat' | 'lon' | 'precision_radius_km'>): string {
 return `/?v=h&sel=${encodeSelection({kind:'point',lat:spot.lat,lon:spot.lon,radiusKm:spot.precision_radius_km})}`;
}
