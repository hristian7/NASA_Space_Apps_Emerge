'use client';
import { useTranslations } from 'next-intl';
export default function RiskPlaceholder() {
 const t=useTranslations('risk');
 return <section className="risk-placeholder">
  <h2>{t('placeholder')}</h2>
  <ul><li>{t('plannedSpots')}</li><li>{t('plannedWhy')}</li><li>{t('plannedProof')}</li></ul>
 </section>;
}
