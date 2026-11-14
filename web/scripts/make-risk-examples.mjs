/** Hand-made UI values [U], not observations, boundaries or predictions. */
import { mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../public/data/risk/example/', import.meta.url);
const days = ['2026-11-14', '2026-11-15'];
// ISO province order, with illustrative inland anchors in Rila and Strandzha.
const provinces = [
 ['Blagoevgrad','Благоевград',41.95,23.45], ['Burgas','Бургас',42.05,27.55],
 ['Varna','Варна',43.25,27.65], ['Veliko Tarnovo','Велико Търново',43.05,25.65],
 ['Vidin','Видин',43.85,22.65], ['Vratsa','Враца',43.35,23.65],
 ['Gabrovo','Габрово',42.85,25.25], ['Dobrich','Добрич',43.55,27.85],
 ['Kardzhali','Кърджали',41.65,25.35], ['Kyustendil','Кюстендил',42.15,23.05],
 ['Lovech','Ловеч',43.05,24.65], ['Montana','Монтана',43.45,23.25],
 ['Pazardzhik','Пазарджик',42.05,24.15], ['Pernik','Перник',42.65,22.95],
 ['Pleven','Плевен',43.45,24.65], ['Plovdiv','Пловдив',42.15,24.75],
 ['Razgrad','Разград',43.55,26.55], ['Ruse','Русе',43.65,25.95],
 ['Silistra','Силистра',43.95,27.05], ['Sliven','Сливен',42.65,26.35],
 ['Smolyan','Смолян',41.65,24.65], ['Sofia City','София-град',42.65,23.35],
 ['Sofia Province','Софийска област',42.25,23.55], ['Stara Zagora','Стара Загора',42.45,25.65],
 ['Targovishte','Търговище',43.25,26.55], ['Haskovo','Хасково',41.85,25.55],
 ['Shumen','Шумен',43.25,26.95], ['Yambol','Ямбол',42.35,26.55],
];
const regions = provinces.map(([name_en,name_local,lat,lon],i) => ({
 region_id: `BG-${String(i+1).padStart(2,'0')}`, name_en, name_local, country:'BGR',
 bbox: [lon-.19,lat-.19,lon+.39,lat+.29].map(n=>+n.toFixed(2)), spots: 10,
}));
regions.push({region_id:'US-CA',name_en:'California',name_local:'California',country:'USA',bbox:[-124.48,32.53,-114.13,42.01],spots:10});
function spot(region, day, rank, lat, lon) {
 const row=Math.floor((90-lat)/.1), col=Math.floor((lon+180)/.1);
 const p=rank === 10 ? null : +(.14-(rank-1)*.013-(day===days[0] ? .015 : 0)).toFixed(3);
 return {type:'fire_risk',spot_id:row*3600+col,lat,lon,
 precision_radius_km:+(Math.hypot(11.12,11.12*Math.cos(lat*Math.PI/180))/2).toFixed(2),
 region_id:region.region_id,day,rank,p,level:rank<3?4:rank<6?3:rank<9?2:1,
 fire_type:rank===7?'farmland':rank===8?'grass_shrub':'forest',
 inputs:{fwi:rank===10?null: +(23.8-rank*.9).toFixed(1),ffmc:86.2-rank*.5,dmc:32.5,dc:412,
 t_max_c:21-rank*.3,rh_min:28+rank,wind_max_kmh:38-rank,wind_dir_deg:290,rain_3d_mm:0,
 ndvi_diff:-.08,forest:rank===7?.12:rank===8?.12:.72,farm:rank===7?.7:.05,grass_shrub:rank===8?.72:.2,hist_p:.024,fire_near_3d:false},
 why:rank===10?[]:['strong_wind','very_dry',rank===7?'mostly_farmland':rank===8?'mostly_grass':'mostly_forest','dry_plants']};
}
await mkdir(new URL('latest/',root),{recursive:true});
async function save(name,value){await writeFile(new URL(name,root),JSON.stringify(value,null,2)+'\n');}
await save('meta.json',{engine_ready:false,example:true,model_version:'hand-made-example',made_at:'2026-11-14T21:00:00Z',grid_g:.1,days:{today:days[0],tomorrow:days[1]},fire_weather_run:'2026-11-12',sources:[{name:'Hand-made examples [U], not measured data',url:'/risk?risk=example',date:days[0]}]});
await save('regions.json',regions);
for(const country of ['BGR','USA']) {
 const file={country,days,regions:{}};
 for(const region of regions.filter(r=>r.country===country)) {
  const i=regions.indexOf(region);
  const lat=country==='BGR'?provinces[i][2]:38.55;
  const lon=country==='BGR'?provinces[i][3]:-120.65;
  file.regions[region.region_id]=Object.fromEntries(days.map(day=>[day,Array.from({length:10},(_,j)=>spot(region,day,j+1,+(lat+Math.floor(j/5)*.1).toFixed(2),+(lon+(j%5-1)*.1).toFixed(2)))]));
 }
 await save(`latest/${country}.json`,file);
}
console.log('Wrote hand-made examples: 28 Bulgarian provinces and California; 10 spots per region per day [U].');
