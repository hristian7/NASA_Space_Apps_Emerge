import { useEffect } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { fetchWind, windArrowRotation, windGrid, type Bounds } from '@/lib/layers/wind';

import { createWindFlow } from './wind-flow';

/** Keeps wind markers in a separate integration so raster rendering stays generic. */
export function useWindLayer(map: React.RefObject<MapLibreMap | null>, ready: boolean, on: boolean) {
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !on) return;
    let alive = true, generation = 0;
    let markers: Marker[] = [];
    let previous = '';
    let flow: ReturnType<typeof createWindFlow> = null;
    let render = () => {};
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clear = () => {
      markers.forEach(marker => marker.remove()); markers = [];
      flow?.destroy(); flow = null;
    };
    const motionChange = () => render();
    const invalidate = () => { generation++; };
    const status = (state: string, time = '') => window.dispatchEvent(new CustomEvent('emerge-wind', { detail: { state, time } }));
    const update = async () => {
      const b = instance.getBounds();
      const bounds = { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() };
      const key = `${Math.floor(Date.now() / 3600000)}:${JSON.stringify(windGrid(bounds))}`;
      if (previous === key) return;
      flow?.clear();
      const id = ++generation;
      status('loading');
      try {
        const [points, maplibre] = await Promise.all([fetchWind(bounds), import('maplibre-gl')]);
        if (!alive || id !== generation) return;
        previous = key;
        render = () => {
          clear();
          if (!reduced.matches) {
            flow = createWindFlow(instance);
            if (flow) { flow.setData(points, bounds); return; }
          }
          markers = points.map(point => {
            const el = document.createElement('div');
            el.textContent = '➤';
            el.dataset.windArrow = '';
            el.dataset.direction = String(point.direction);
            el.title = `${point.speed} km/h`;
            el.style.cssText = 'color:#fff;text-shadow:0 0 3px #000;font-size:20px';
            return new maplibre.Marker({ element: el, rotation: windArrowRotation(point.direction), rotationAlignment: 'map' }).setLngLat([point.lon, point.lat]).addTo(instance);
          });
        };
        render();
        status('ready', points[0].time);
      } catch {
        if (!alive || id !== generation) return;
        clear(); render = () => {}; previous = ''; status('failed');
      }
    };
    const refresh = () => { if (!document.hidden && !instance.isMoving()) void update(); };
    const timer = window.setInterval(refresh, 60000);
    instance.on('movestart', invalidate);
    instance.on('moveend', update);
    reduced.addEventListener('change', motionChange);
    document.addEventListener('visibilitychange', refresh);
    void update();
    return () => {
      alive = false; window.clearInterval(timer);
      instance.off('movestart', invalidate); instance.off('moveend', update);
      reduced.removeEventListener('change', motionChange);
      document.removeEventListener('visibilitychange', refresh);
      clear();
    };
  }, [map, ready, on]);
}
