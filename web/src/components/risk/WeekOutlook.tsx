'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { loadRiskWeek, regionSpots } from '@/lib/risk/loaders';
import { historyHref } from '@/lib/risk/geo';
import { loadScorecard, type RiskScorecard } from '@/app/proof/risk-data';
import type { CountryResult, RiskRegion } from '@/types/risk';

type WeekFile = CountryResult['file'] & { run_date?: string };
export default function WeekOutlook({region, example, staleDate}: {region: RiskRegion; example: boolean; staleDate?: string}) {
 const t=useTranslations('risk'); const locale=useLocale();
 const [card,setCard]=useState<RiskScorecard|null>(null);
 useEffect(()=>{let live=true;loadScorecard(false).then(value=>{if(live)setCard(value);},()=>{if(live)setCard(null);});return ()=>{live=false;};},[]);
 const [data,setData]=useState<CountryResult|null>(null); const [failed,setFailed]=useState(false); const [day,setDay]=useState('');
 useEffect(()=>{let live=true;setData(null);setFailed(false);setDay('');
  loadRiskWeek(region.country,example).then(value=>{if(live){setData(value);setDay(value.file.days[0]??'');}},()=>{if(live)setFailed(true);});
  return ()=>{live=false;};
 },[region.country,example]);
 const file=data?.file as WeekFile|undefined; const spots=regionSpots(file??null,region.region_id,day);
 const lead=file?.run_date && day ? (Date.parse(`${day}T00:00:00Z`)-Date.parse(`${file.run_date}T00:00:00Z`))/86400000 : NaN;
 const scores=card?.week?.leads[String(lead)]?.scopes.world?.selections.forest_wildland?.pooled.methods;
 const fwi=scores?.fwi?.capture_rate; const history=scores?.history?.capture_rate;
 const format=(n:number)=>new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(n);
 return <section className="risk-sheet" aria-label={t('weekTitle')}>
  <h2>{locale==='bg'?region.name_local:region.name_en}</h2>
  <div className="risk-meta"><p>{typeof fwi==='number'&&typeof history==='number'?t('weekScored',{lead, fwi:format(fwi), history:format(history)}):t('weekNotice')}</p>{file?.run_date&&<p>{t('weatherRun',{date:file.run_date})}</p>}</div>
  {staleDate&&<p role="status">{t('stale',{date:staleDate})}</p>}
  {failed?<p role="alert">{t('failed')}</p>:!data?<p role="status">{t('loading')}</p>:data.status==='missing'?<p role="status">{t('missingCountry')}</p>:<>
   <div className="risk-days" role="group" aria-label={t('day')}>{file?.days.map(value=><button key={value} aria-pressed={day===value} onClick={()=>setDay(value)}>{value}</button>)}</div>
   {spots.length===0?<p role="status">{t('empty')}</p>:<ol className="risk-list" aria-label={t('weekTitle')}>{spots.map(spot=><li key={spot.spot_id}><span className="risk-rank">{spot.rank}</span><div className="risk-spot">
    <div className="risk-spot-line"><strong>{t('weekFwi',{value:spot.inputs.fwi??'-'})}</strong><span>{t(`fuel.${spot.fire_type}`)}</span></div>
    <div className="risk-spot-line risk-muted"><span>{spot.lat.toFixed(2)}, {spot.lon.toFixed(2)} [U]</span><a href={historyHref(spot)}>{t('history')}</a></div>
   </div></li>)}</ol>}
  </>}
 </section>;
}
