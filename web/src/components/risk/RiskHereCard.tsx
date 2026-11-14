'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { RiskIndex } from '@/types/risk';
import { exampleMode, loadRiskIndex, showForecast, forecastIsStale } from '@/lib/risk/loaders';
import { loadRiskHere, type PointSpot } from '@/lib/risk/here';
import styles from '@/components/report/styles';
import RiskSpotDetails from './RiskSpotDetails';
import RiskPlaceholder from './RiskPlaceholder';
import { RiskLinks } from './RiskLinks';
import './risk.css';

export interface RiskHereCardProps {
 point: {lat:number;lon:number};
 /** Omit to inherit the URL/environment example switch. */
 example?: boolean;
 country?: string;
}
/** Drop-in report card. It never substitutes a neighbouring spot outside its radius. */
export function RiskHereCard({point,example,country=''}:RiskHereCardProps) {
 const t=useTranslations('risk');
 const [state,setState]=useState<{index:RiskIndex;spot:PointSpot|null;example:boolean;country:string}|null>(null);
 const [stale,setStale]=useState(false);
 useEffect(()=>{const update=()=>setStale(!!state?.index.meta && forecastIsStale(state.index.meta.days.tomorrow)); update(); const timer=setInterval(update,60000); return ()=>clearInterval(timer);},[state]);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let live=true;setState(null);setFailed(false);
  const mode=example??exampleMode(window.location.search);
  (async()=>{
   const index=await loadRiskIndex(mode);
   const spot=showForecast(index.meta,mode)?await loadRiskHere(index,point.lat,point.lon,mode):null;
   const selectedCountry=index.regions.find(r=>r.region_id===spot?.region_id)?.country??country;
   if(live)setState({index,spot,example:mode,country:selectedCountry});
  })().catch(()=>{if(live)setFailed(true);});
  return ()=>{live=false;};
 },[point.lat,point.lon,example,country]);
 return <section className={`${styles.card} risk-here`} aria-label={t(stale?'hereDated':'here')}>
  <h2 className={styles.heading}>{t(stale?'hereDated':'here')}</h2>
  {failed?<p role="alert">{t('failed')}</p>:!state?<p role="status">{t('loading')}</p>:<>
   {state.example&&<p className="risk-example">{t('example')} · {t('exampleNote')}</p>}
   {stale&&showForecast(state.index.meta,state.example)&&<p role="status">{t('stale',{date:state.index.meta?.days.tomorrow??''})}</p>}
   {!showForecast(state.index.meta,state.example)?<RiskPlaceholder/>:state.spot?<>
    <p className="risk-muted">{t('valid',{date:state.index.meta?.days.tomorrow??''})}</p>
    <RiskSpotDetails spot={state.spot}/>
   </>:<><p>{t('noForecast')}</p><p className="risk-muted">{t('coverage')}</p></>}
   <a href={state.example?'/risk?risk=example':'/risk'}>{t('outlook')}</a>
  </>}
  <RiskLinks country={state?.country??country}/>
  <p className="risk-muted">{t('disclaimer')}</p>
 </section>;
}
export default RiskHereCard;
