'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { RiskSpot } from '@/types/risk';
import { historyHref } from '@/lib/risk/geo';
export default function RiskSpotDetails({spot, crew = false, day = 'tomorrow'}: {spot: RiskSpot; crew?: boolean; day?: 'today'|'tomorrow'}) {
 const t=useTranslations('risk');
 const locale=useLocale();
 const why=spot.why.filter(key=>t.has(`why.${key}`)).slice(0,4);
 return <>
  <div className="risk-spot-line">
   <strong>{spot.p===null ? t('noForecast') : t('level',{level:spot.level})}</strong>
   <span>{t.has(`fuel.${spot.fire_type}`) ? t(`fuel.${spot.fire_type}`) : t('unknownFuel')}</span>
  </div>
  {spot.p===null ? <p className="risk-muted">{t('missingInputs')}</p> : <details className="risk-chance">
   <summary>{spot.p===0 ? t('zeroEstimate') : t('chance',{n:Math.max(1,Math.round(1/spot.p))})}</summary>
   <p>{t('probability',{p:new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2}).format(spot.p)})}</p>
  </details>}
  {spot.p!==null && why.length>0 && <ul className="risk-why">{why.map(key=><li key={key}>{t(`why.${key}`)}</li>)}</ul>}
  <div className="risk-spot-line risk-muted"><span className="num">{spot.lat.toFixed(2)}, {spot.lon.toFixed(2)}</span><a href={historyHref(spot)}>{t('history')}</a></div>
  {crew && spot.p!==null && <p className="risk-crew">{t(day==='today'?'crewToday':'crew')}</p>}
 </>;
}
