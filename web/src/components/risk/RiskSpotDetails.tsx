'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { PointSpot } from '@/lib/risk/here';
import RiskContext, { LevelInfo, RiskContextChips } from './RiskContext';
import { historyHref } from '@/lib/risk/geo';
export default function RiskSpotDetails({spot, crew = false, day = 'tomorrow', compact = false}: {spot: PointSpot; crew?: boolean; day?: 'today'|'tomorrow'; /** One line of level, land type and chance, then chips. */ compact?: boolean}) {
 const t=useTranslations('risk');
 const locale=useLocale();
 const why=spot.why.filter(key=>t.has(`why.${key}`)).slice(0,4);
 if (compact) return <>
  <div className="fc-scoreRow risk-hereRow">
   <strong>{spot.p===null ? t('noForecast') : t('level',{level:spot.level})}</strong>
   <span className="risk-muted">{t.has(`fuel.${spot.fire_type}`) ? t(`fuel.${spot.fire_type}`) : t('unknownFuel')}</span>
   {spot.p!==null && <span className="num">{spot.p===0 ? t('zeroEstimate') : t('chance',{n:Math.max(1,Math.round(1/spot.p))})}</span>}
   <LevelInfo fwi={spot.inputs?.fwi}/>
  </div>
  {spot.p===null ? <p className="risk-muted">{t('missingInputs')}</p> : <ul className="fc-chips">
   <RiskContextChips p={spot.p} usual={spot.usual} fwi={spot.inputs?.fwi} day={spot.day} context={spot.context}/>
   {why.map(key=><li key={key} className="fc-chip fc-chipWhy">{t(`why.${key}`)}</li>)}
  </ul>}
  <div className="risk-spot-line risk-muted"><span className="num">{spot.lat.toFixed(2)}, {spot.lon.toFixed(2)}</span><a href={historyHref(spot)}>{t('history')}</a></div>
 </>;
 return <>
  <div className="risk-spot-line">
   <strong>{spot.p===null ? t('noForecast') : t('level',{level:spot.level})}</strong>
   <span>{t.has(`fuel.${spot.fire_type}`) ? t(`fuel.${spot.fire_type}`) : t('unknownFuel')}</span>
  </div>
  {spot.p===null ? <p className="risk-muted">{t('missingInputs')}</p> : <details className="risk-chance">
   <summary>{spot.p===0 ? t('zeroEstimate') : t('chance',{n:Math.max(1,Math.round(1/spot.p))})}</summary>
   <p>{t('probability',{p:new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2}).format(spot.p)})}</p>
  </details>}
  {spot.p!==null && <RiskContext p={spot.p} usual={spot.usual} fwi={spot.inputs?.fwi} day={spot.day} context={spot.context}/>}
  {spot.p!==null && why.length>0 && <ul className="risk-why">{why.map(key=><li key={key}>{t(`why.${key}`)}</li>)}</ul>}
  <div className="risk-spot-line risk-muted"><span className="num">{spot.lat.toFixed(2)}, {spot.lon.toFixed(2)}</span><a href={historyHref(spot)}>{t('history')}</a></div>
  {crew && spot.p!==null && <p className="risk-crew">{t(day==='today'?'crewToday':'crew')}</p>}
 </>;
}
