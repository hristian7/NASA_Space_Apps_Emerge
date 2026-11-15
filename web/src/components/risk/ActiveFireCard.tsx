'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { fetchActiveFire, type ActiveFire } from '@/lib/risk/active-fire';
import { blowsToward, compassPoint, type DayWeather } from '@/lib/forecast/weather';

export type ActiveFireCheck = { status: 'loading' } | { status: 'ready'; fire: ActiveFire } | { status: 'failed' };

/** The model's grid, used before the risk index has loaded. */
const defaultGrid = 0.25;
/** A slow check gives way to the score rather than holding the card. */
const giveUpMs = 12000;

/** Recent detections in and around a point's square, from the map's own recent-fires source. */
export function useActiveFire(place: { lat: number; lon: number; radiusKm: number } | null, grid: number = defaultGrid): ActiveFireCheck | null {
 const key = place === null ? null : `${place.lat.toFixed(3)},${place.lon.toFixed(3)},${place.radiusKm},${grid}`;
 const [check, setCheck] = useState<{ key: string; value: ActiveFireCheck } | null>(null);
 useEffect(() => {
  if (key === null || place === null) return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), giveUpMs);
  fetchActiveFire(place, grid, controller.signal).then(
   fire => setCheck({ key, value: { status: 'ready', fire } }),
   () => setCheck({ key, value: { status: 'failed' } }),
  ).finally(() => window.clearTimeout(timer));
  return () => { window.clearTimeout(timer); controller.abort(); };
  // `key` carries the place and the grid.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [key]);
 if (key === null) return null;
 return check?.key === key ? check.value : { status: 'loading' };
}

type Weather = Pick<DayWeather, 'windFrom' | 'windMax' | 'gustMax' | 'rhMin' | 'dryDays'>;

/** Shown instead of a level where the area is already burning: the model scores new fires only. */
export default function ActiveFireCard({ fire, radiusKm, weather }: { fire: ActiveFire; radiusKm: number; weather: Weather | null }) {
 const t = useTranslations('risk');
 const f = useTranslations('forecast');
 const locale = useLocale();
 const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
 const newest = fire.newest === null ? null : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(new Date(fire.newest));
 const toward = weather?.windFrom == null ? null : blowsToward(weather.windFrom);
 return <div className="fire-card" data-testid="active-fire">
  <p className="fire-title">
   <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5c.6 2.6 3.9 4.4 3.9 8.4a3.9 3.9 0 0 1-7.8 0c0-1.9 1-3.2 2-4.2.1 1.4.8 2.3 1.6 2.6-.4-2.3-.3-4.6.3-6.8z" fill="currentColor"/></svg>
   {t('fireTitle')}
  </p>
  <p className="fire-counts">
   {t('fireCounts', { n24: fire.count24, n72: fire.count72 })}, {radiusKm > 0 ? t('fireWithin', { km: number(radiusKm) }) : t('fireSquares')}.
  </p>
  {newest && <p className="fc-muted">{t('fireNewest', { time: newest })}</p>}
  <p className="fire-note">{t('fireNote')}</p>
  {weather && <div className="fire-wind">
   {toward === null || weather.windFrom == null ? <p className="fc-muted">{t('downwindCalm')}</p> : <>
    <svg className="fire-arrow" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${toward}deg)` }}>
     <path d="M12 2.5 18 11h-4v10.5h-4V11H6z" fill="currentColor"/>
    </svg>
    <p>
     {t('downwind', { from: f(`dir${compassPoint(weather.windFrom)}`), speed: weather.windMax === null ? '-' : number(weather.windMax), to: f(`dir${compassPoint(toward)}`) })}
     {weather.gustMax !== null && <> {t('downwindGusts', { gust: number(weather.gustMax) })}</>}
    </p>
   </>}
   <p className="fire-guide">{t('downwindNote')}</p>
  </div>}
  {weather && ((weather.rhMin !== null && weather.rhMin < 30) || (weather.dryDays !== null && weather.dryDays.days > 0)) && <ul className="fc-chips">
   {weather.rhMin !== null && weather.rhMin < 30 && <li className="fc-chip fc-chipWhy">{t('dryAir', { rh: number(weather.rhMin) })}</li>}
   {weather.dryDays !== null && weather.dryDays.days > 0 && <li className="fc-chip fc-chipWhy">{t('noRain', { n: weather.dryDays.days })}</li>}
  </ul>}
 </div>;
}
