'use client';
import { useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usualWord, weatherWord } from '@/lib/risk/context';

type ContextProps = {p: number | null; usual?: number | null; fwi?: number | null; day: string; context?: [number | null, number | null]};

const comparisons = ['usualLower', 'usualSame', 'usualHigher'] as const;
const weathers = ['weatherLow', 'weatherModerate', 'weatherStrong', 'weatherVeryStrong'] as const;
const shortWeather = {weatherNone: 'weatherShortNone', weatherLow: 'weatherShortLow', weatherModerate: 'weatherShortModerate', weatherStrong: 'weatherShortStrong', weatherVeryStrong: 'weatherShortVeryStrong'} as const;

/** The same square and day as the displayed chance, read as words. */
export function useRiskContext({p, usual, fwi, day, context}: ContextProps) {
 const t = useTranslations('risk');
 const locale = useLocale();
 const month = new Intl.DateTimeFormat(locale, {month:'long', timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
 const comparison = context?.[0] != null ? comparisons[context[0]] : p !== null && usual != null ? usualWord(p, usual) : null;
 const weather = context?.[1] != null ? weathers[context[1]] : weatherWord(fwi);
 const level = weather === 'weatherNone' ? 0 : weathers.indexOf(weather) + 1;
 return {
  month,
  comparison,
  direction: comparison === 'usualLower' ? 'down' as const : comparison === 'usualHigher' ? 'up' as const : comparison === 'usualSame' ? 'same' as const : null,
  usualText: comparison ? t(comparison, {month}) : null,
  usualShort: comparison ? t(`${comparison}Short`, {month}) : null,
  weatherText: t(weather),
  weatherShort: t(shortWeather[weather]),
  weatherLevel: level,
  fwiText: fwi == null ? null : t('weatherIndex', {value: new Intl.NumberFormat(locale, {maximumFractionDigits:1}).format(fwi)}),
 };
}

export function UsualArrow({direction}: {direction: 'up' | 'down' | 'same' | null}) {
 if (direction === null) return null;
 return <svg className="usual-arrow" data-dir={direction} viewBox="0 0 12 12" aria-hidden="true">
  {direction === 'same'
   ? <path d="M2 4.5h8M2 7.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
   : <path d={direction === 'up' ? 'M6 10V2.5M2.8 5.6 6 2.4l3.2 3.2' : 'M6 2v7.5M2.8 6.4 6 9.6l3.2-3.2'} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>}
 </svg>;
}

/** Chips for a score: versus usual with an arrow, then the fire weather. */
export function RiskContextChips(props: ContextProps) {
 const c = useRiskContext(props);
 return <>
  {c.usualText && <li className="fc-chip"><UsualArrow direction={c.direction}/>{c.usualText}</li>}
  <li className="fc-chip"><span className="weather-dot" data-level={c.weatherLevel} aria-hidden="true"/>{c.weatherText}</li>
 </>;
}

/** Context for the same square and day as the displayed chance. */
export default function RiskContext(props: ContextProps) {
 const t = useTranslations('risk');
 const c = useRiskContext(props);
 return <>
  {c.usualText && <p className="risk-muted">{c.usualText}</p>}
  <p className="risk-muted">{c.weatherText}</p>
  <details className="risk-muted"><summary>{t('levelMeaningTitle')}</summary><p>{t('levelMeaning')}</p>{c.fwiText && <p>{c.fwiText}</p>}</details>
 </>;
}

/** The level meaning (and the fire-weather index) behind a small info button. */
export function LevelInfo({fwi}: {fwi?: number | null}) {
 const t = useTranslations('risk');
 const locale = useLocale();
 const [open, setOpen] = useState(false);
 const id = useId();
 return <>
  <button type="button" className="fc-info" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
   <svg viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="10" cy="6.4" r="1" fill="currentColor"/>
   </svg>
   <span className="fc-infoText">{t('levelMeaningTitle')}</span>
  </button>
  <div id={id} className="fc-infoBody" hidden={!open}>
   <p>{t('levelMeaning')}</p>
   {fwi != null && <p>{t('weatherIndex', {value: new Intl.NumberFormat(locale, {maximumFractionDigits:1}).format(fwi)})}</p>}
  </div>
 </>;
}
