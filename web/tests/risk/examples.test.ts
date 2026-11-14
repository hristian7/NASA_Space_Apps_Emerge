import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { RiskCountry, RiskRegion } from '../../src/types/risk';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/risk/example/${name}`, import.meta.url), 'utf8'));
it('covers every Bulgarian province and California with grid-centred, ordered examples', () => {
 const regions = read('regions.json') as RiskRegion[];
 expect(regions.filter(r=>r.country==='BGR').map(r=>r.region_id)).toEqual(Array.from({length:28},(_,i)=>`BG-${String(i+1).padStart(2,'0')}`));
 expect(regions.find(r=>r.region_id==='US-CA')).toBeDefined();
 for(const country of ['BGR','USA']) {
  const file=read(`latest/${country}.json`) as RiskCountry;
  for(const byDay of Object.values(file.regions)) for(const spots of Object.values(byDay)) {
   expect(spots.map(s=>s.rank)).toEqual([1,2,3,4,5,6,7,8,9,10]);
   expect(new Set(spots.map(s=>s.spot_id)).size).toBe(10);
   for(const s of spots) {
    expect(s.spot_id).toBe(Math.floor((90-s.lat)/.1)*3600+Math.floor((s.lon+180)/.1));
    expect(s.precision_radius_km).toBeGreaterThan(0);
   }
   expect(spots[9].p).toBeNull();
  }
 }
});
it('never presents fixtures as ready predictions',()=> {
 expect(read('meta.json')).toMatchObject({engine_ready:false,example:true,grid_g:.1});
});
