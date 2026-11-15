import type { RiskIndex, RiskSpot } from '../../types/risk';
import { distanceKm, nearestSpot, regionAt } from './geo';
import { loadRiskCountry } from './loaders';
import { loadSpotScore } from './spot-scores';

/**
 * The score for a place: the exact 0.25 degree square's published score.
 * A square that is also one of the ranked spots brings its fuel type and
 * reasons; any other square has only its level and chance (`ranked` false).
 */
export type PointSpot = Omit<RiskSpot, 'fire_type' | 'inputs'> & {
 fire_type: RiskSpot['fire_type'] | null;
 inputs?: RiskSpot['inputs'];
 ranked?: boolean;
};

export async function pointScore(index: RiskIndex, lat: number, lon: number, day: string, example: boolean, fetcher = fetch): Promise<PointSpot | null> {
 if(!index.meta || !Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const reach=index.meta.grid_g*112;
 const countries=[...new Set(index.regions.filter(({bbox:[w,s,e,n]})=>distanceKm(lat,lon,Math.max(s,Math.min(n,lat)),Math.max(w,Math.min(e,lon)))<=reach).map(r=>r.country))];
 const files=await Promise.all(countries.map(country=>loadRiskCountry(country,example,fetcher)));
 const forest=files.flatMap(({file})=>Object.values(file.regions).flatMap(days=>days[day]??[]));
 const all=files.flatMap(({file})=>Object.values(file.all_vegetation??{}).flatMap(days=>days[day]??[]));
 // Example data has no per-square scores, so it keeps the ranked-spot match.
 if(example){const spot=nearestSpot(forest,lat,lon)??nearestSpot(all,lat,lon);return spot?{...spot,ranked:true}:null;}
 for(const country of countries){
  const square=await loadSpotScore(country,day,lat,lon,fetcher).catch(()=>null);
  if(!square||square.status==='missing country'||square.status==='missing day')continue;
  if(square.status!=='ready')return null;
  const listed=[...forest,...all].find(spot=>spot.spot_id===square.spot_id&&spot.p!==null);
  if(listed)return {...listed,usual:listed.usual ?? square.usual,ranked:true};
  return {type:'fire_risk',spot_id:square.spot_id,lat:square.lat,lon:square.lon,precision_radius_km:index.meta.grid_g*111*0.62,
   region_id:regionAt(index.regions,lat,lon)?.region_id??'',day,rank:0,p:square.p,level:square.level,usual:square.usual,context:square.context,inputs:{fwi:square.fwi,ffmc:null,dmc:null,dc:null,t_max_c:null,rh_min:null,wind_max_kmh:null,wind_dir_deg:null,rain_3d_mm:null,ndvi_diff:null,forest:null,farm:null,grass_shrub:null,hist_p:null,fire_near_3d:null},fire_type:null,why:[],ranked:false};
 }
 return null;
}

/** Tomorrow's score for a place, for the report card. */
export async function loadRiskHere(index: RiskIndex, lat: number, lon: number, example: boolean, fetcher = fetch): Promise<PointSpot | null> {
 if(!index.meta)return null;
 return pointScore(index,lat,lon,index.meta.days.tomorrow,example,fetcher);
}
