import { useEffect } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { fetchWind, type Bounds } from '@/lib/layers/wind';

/** Keeps wind markers in a separate integration so raster rendering stays generic. */
export function useWindLayer(map: React.RefObject<MapLibreMap | null>, ready: boolean, on: boolean) {
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !on) return;
    let alive = true, generation = 0;
    let markers: Marker[] = [];
    let previous: Bounds | null = null;
    const status = (state: string, time = '') => window.dispatchEvent(new CustomEvent('emerge-wind', { detail: { state, time } }));
    const update = async () => {
      const b = instance.getBounds();
      const bounds = { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() };
      if (previous && Math.abs((bounds.west + bounds.east - previous.west - previous.east) / 2) <= (previous.east - previous.west) / 2 && Math.abs((bounds.south + bounds.north - previous.south - previous.north) / 2) <= (previous.north - previous.south) / 2) return;
      previous = bounds;
      const id = ++generation;
      status('loading');
      try {
        const [points, maplibre] = await Promise.all([fetchWind(bounds), import('maplibre-gl')]);
        if (!alive || id !== generation) return;
        markers.forEach(marker => marker.remove());
        markers = points.map(point => {
          const el = document.createElement('div');
          el.textContent = '➤';
          el.title = `${point.speed} km/h`;
          el.style.cssText = `color:#fff;text-shadow:0 0 3px #000;font-size:20px;transform:rotate(${point.direction + 90}deg)`;
          return new maplibre.Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(instance);
        });
        status('ready', points[0].time);
      } catch {
        if (!alive || id !== generation) return;
        markers.forEach(marker => marker.remove()); markers = []; previous = null; status('failed');
      }
    };
    instance.on('moveend', update); void update();
    return () => { alive = false; instance.off('moveend', update); markers.forEach(marker => marker.remove()); };
  }, [map, ready, on]);
}
