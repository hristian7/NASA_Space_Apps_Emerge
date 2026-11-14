import { expect, it } from 'vitest';
import { nearestSpot, distanceKm, regionAt, historyHref } from '../../src/lib/risk/geo';
import type { RiskSpot, RiskRegion } from '../../src/types/risk';
const spot={lat:42.15,lon:23.45,precision_radius_km:6.9,spot_id:1722834,p:null} as RiskSpot;
it('selects a spot only inside its own precision radius, preserving null',()=>{
 expect(nearestSpot([spot],42.15,23.45)).toBe(spot);
 expect(nearestSpot([spot],0,0)).toBeNull();
 expect(distanceKm(0,0,0,1)).toBeCloseTo(111.195,2);
 expect(nearestSpot([{...spot,lat:42.16,spot_id:2},spot],42.15,23.45)?.spot_id).toBe(1722834);
});
it('uses an eligible spot even when a nearer spot has a smaller non-covering radius',()=>{
 const small={...spot,lat:42.16,precision_radius_km:.01};
 expect(nearestSpot([small,spot],42.17,23.45)).toBe(spot);
});
it('links to the established point report URL',()=>{
 expect(historyHref(spot)).toBe('/?sel=p:42.15,23.45,7');
});
it('returns a containing box, never a faraway region',()=>{
 const region={region_id:'BG-10',bbox:[23,42,24,43]} as RiskRegion;
 expect(regionAt([region],42.15,23.45)).toBe(region);
 expect(regionAt([region],0,0)).toBeNull();
});
