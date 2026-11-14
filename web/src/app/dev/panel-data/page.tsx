'use client';

import { useEffect, useState } from 'react';
import { Sparkline } from '@/components/forecast/Sparkline';
import { fetchPower, POWER_PARAMETERS, type PowerData, type PowerParameter } from '@/lib/forecast/power';
import './panel-data.css';

const labels: Record<PowerParameter, string> = {
 T2M_MAX: 'Maximum temperature', RH2M: 'Relative humidity', WS10M: 'Wind speed', WD10M: 'Wind direction', PRECTOTCORR: 'Precipitation', GWETTOP: 'Topsoil wetness',
};
const places = [
 { name: 'Rila, Bulgaria', lat: 42.15, lon: 23.45 },
 { name: 'California, USA', lat: 34.625, lon: -118.125 },
];
function Place({ place }: { place: typeof places[number] }) {
 const [weather, setWeather] = useState<PowerData | null>(null);
 const [weatherStatus, setWeatherStatus] = useState('Loading NASA POWER data');
 useEffect(() => {
  let active = true;
  const controller = new AbortController();
  fetchPower(place.lat, place.lon, controller.signal).then(data => { if (active) { setWeather(data); setWeatherStatus(''); } }).catch(() => { if (active) setWeatherStatus('POWER data unavailable'); });
  return () => { active = false; controller.abort(); };
 }, [place]);
 return <section className="panel-place">
  <h2>{place.name}</h2>
  <p>NASA POWER daily estimates. Latest available: {weather?.lastDate ?? 'unknown'} [V]</p>
  {weatherStatus && <p role="status">{weatherStatus}</p>}
  {weather && <div className="panel-trends">{POWER_PARAMETERS.map(name => <Sparkline key={name} label={labels[name]} values={weather.series[name]} unit={weather.units[name]} />)}</div>}
  <h3>Published fire forecast</h3>
 </section>;
}
export default function PanelDataPage() {
 return <main className="panel-data"><h1>Point panel data</h1><p>NASA POWER estimates from observation-informed models [V]. Fire forecast is a research estimate [U].</p>{places.map(place => <Place key={place.name} place={place} />)}</main>;
}
