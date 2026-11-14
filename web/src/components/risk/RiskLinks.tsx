'use client';
import { useTranslations } from 'next-intl';
export function RiskLinks({ country = 'BGR' }: { country?: string }) {
 const t=useTranslations('risk');
 return <div className="risk-links">
  <a href="https://forest-fire.emergency.copernicus.eu/apps/effis_current_situation/">EFFIS</a>
  <a href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS</a>
  {country==='BGR' ? <a href="https://www.mvr.bg/gdpbzn">{t('fireService')}</a> : <span>{t('officialServices')}</span>}
  <a href="tel:112">{t('emergency')}</a>
 </div>;
}
