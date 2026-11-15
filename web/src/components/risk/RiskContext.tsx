'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usualWord, weatherWord } from '@/lib/risk/context';

/** Context for the same square and day as the displayed chance. */
export default function RiskContext({p, usual, fwi, day, context}: {p: number | null; usual?: number | null; fwi?: number | null; day: string; context?: [number | null, number | null]}) {
 const t = useTranslations('risk');
 const locale = useLocale();
 const month = new Intl.DateTimeFormat(locale, {month:'long', timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
 const comparisons = ['usualLower', 'usualSame', 'usualHigher'] as const;
 const weathers = ['weatherLow', 'weatherModerate', 'weatherStrong', 'weatherVeryStrong'] as const;
 const comparison = context?.[0] != null ? comparisons[context[0]] : p !== null && usual != null ? usualWord(p, usual) : null;
 const weather = context?.[1] != null ? weathers[context[1]] : weatherWord(fwi);
 return <>
  {comparison && <p className="risk-muted">{t(comparison,{month})}</p>}
  <p className="risk-muted" title={fwi == null ? undefined : t('weatherIndex',{value:new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(fwi)})}>{t(weather)}</p>
  <details className="risk-muted"><summary>{t('levelMeaningTitle')}</summary><p>{t('levelMeaning')}</p></details>
 </>;
}
