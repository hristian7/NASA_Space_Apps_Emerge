'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { CountryResult, RiskIndex } from '@/types/risk';
import { loadRiskCountry, loadRiskIndex, regionSpots, showForecast } from '@/lib/risk/loaders';
import RiskMap from './RiskMap';
import WeekOutlook from './WeekOutlook';
import RiskSpotDetails from './RiskSpotDetails';
import RiskPlaceholder from './RiskPlaceholder';
import { RiskLinks } from './RiskLinks';
import { formatIsoDateTime } from '@/components/report/lib/format';
import './risk.css';

export default function RiskScreen({example=false}:{example?:boolean}) {
 const t=useTranslations('risk'); const locale=useLocale();
 const [index,setIndex]=useState<RiskIndex|null>(null); const [failed,setFailed]=useState(false);
 const [regionId,setRegionId]=useState(''); const [day,setDay]=useState<'today'|'tomorrow'|'week'>('tomorrow');
 const [countryData,setCountryData]=useState<CountryResult|null>(null); const [countryFailed,setCountryFailed]=useState(false);
 useEffect(()=>{let live=true;loadRiskIndex(example).then(data=>{if(live){setIndex(data);setRegionId(data.regions[0]?.region_id??'');}},()=>{if(live)setFailed(true);});
 return ()=>{live=false;};},[example]);
 const region=index?.regions.find(r=>r.region_id===regionId);
 const country=region?.country??'BGR';
 useEffect(()=>{let live=true;setCountryData(null);setCountryFailed(false);
 if(region)loadRiskCountry(country,example).then(data=>{if(live)setCountryData(data);},()=>{if(live)setCountryFailed(true);});
 return ()=>{live=false;};},[country,example,!!region]);
 const date=day==='week'?'':index?.meta?.days[day]??'';
 const spots=useMemo(()=>regionSpots(countryData?.file.country===country?countryData.file:null,regionId,date),[countryData,country,regionId,date]);
 const selectRegion=useCallback((id:string)=>setRegionId(id),[]);
 const selectSpot=useCallback((id:number)=>{const node=document.getElementById(`risk-spot-${id}`);node?.scrollIntoView({block:'nearest'});node?.focus({preventScroll:true});},[]);
 const countries=[...new Set(index?.regions.map(r=>r.country)??[])];
 return <main className="risk-page">
  <header className="risk-header"><h1>{t('title')}</h1><nav className="risk-nav"><a href={example?'/proof?risk=example#next-day-risk':'/proof#next-day-risk'}>{t('proof')}</a></nav></header>
  {example&&<p className="risk-example" role="status">{t('example')} · {t('exampleNote')}</p>}
  {failed?<p className="risk-placeholder" role="alert">{t('failed')}</p>:!index?<p className="risk-placeholder" role="status">{t('loading')}</p>:!showForecast(index.meta,example)?<RiskPlaceholder/>:<>
   <div className="risk-controls">
    <div className="risk-days" role="group" aria-label={t('day')}>{(['today','tomorrow'] as const).map(value=><button key={value} aria-pressed={day===value} onClick={()=>setDay(value)}>{t(value)}</button>)}<button aria-pressed={day==='week'} onClick={()=>setDay('week')}>{t('weekTitle')}</button></div>
    <label>{t('country')}<select aria-label={t('country')} value={country} onChange={e=>setRegionId(index.regions.find(r=>r.country===e.target.value)?.region_id??'')}>{countries.map(code=><option key={code} value={code}>{t.has(`countries.${code}`)?t(`countries.${code}`):code}</option>)}</select></label>
    <label>{t('region')}<select aria-label={t('region')} value={regionId} onChange={e=>setRegionId(e.target.value)}>{index.regions.filter(r=>r.country===country).map(r=><option key={r.region_id} value={r.region_id}>{locale==='bg'?r.name_local:r.name_en}</option>)}</select></label>
   </div>
   {region?(day==='week'?<WeekOutlook region={region} example={example}/>:<div className="risk-workspace">
    <RiskMap regions={index.regions} region={region} spots={spots} onRegion={selectRegion} onSpot={selectSpot}/>
    <section className="risk-sheet" aria-label={t('title')}>
     <h2>{locale==='bg'?region.name_local:region.name_en}</h2>
     <div className="risk-meta"><p>{t('valid',{date})}</p><p>{t('made',{date:formatIsoDateTime(index.meta?.made_at??'',locale==='bg'?'bg':'en')})}</p><p>{t('weatherRun',{date:index.meta?.fire_weather_run??''})}</p><p>{t('estimates')}</p></div>
     {countryFailed?<p role="alert">{t('failed')}</p>:!countryData?<p role="status">{t('loading')}</p>:countryData.status==='missing'?<p role="status">{t('missingCountry')}</p>:spots.length===0?<p role="status">{t('empty')}</p>:<ol className="risk-list" aria-label={t('title')}>{spots.map(spot=><li key={spot.spot_id} id={`risk-spot-${spot.spot_id}`} tabIndex={-1}><span className="risk-rank">{spot.rank}</span><div className="risk-spot"><RiskSpotDetails spot={spot} crew={spot.rank===1} day={day}/></div></li>)}</ol>}
    </section>
   </div>):<p className="risk-placeholder">{t('noRegion')}</p>}
  </>}
  <footer className="risk-footer"><RiskLinks country={country}/><p>{t('disclaimer')}</p>{showForecast(index?.meta??null,example)&&<><p>{t('mapApproximate')}</p><div className="risk-links" aria-label={t('sources')}>{index?.meta?.sources.map(source=><a key={source.url} href={source.url}>{source.name} · {source.date}</a>)}</div></>}</footer>
 </main>;
}
