import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { useSearchParams } from 'next/navigation';
import { bilinear, fetchTemperature, temperatureColor, temperatureCacheMs, reusableView, type TemperatureField } from '@/lib/layers/temperature';
import type { Bounds } from '@/lib/layers/wind';

export type TemperatureStatus = { state: 'off' | 'loading' | 'ready' | 'empty' | 'failed'; date: string };
const initial: TemperatureStatus = { state: 'off', date: '' };
let current = initial;
const listeners = new Set<() => void>();
function publish(value: TemperatureStatus) { current = value; listeners.forEach(fn => fn()); }
export function useTemperatureStatus() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => current, () => initial);
}
const prefix = 'emerge-temperature-';
const latitude = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
const fields = new Map<string, { field: TemperatureField; values: number[] }>();
let sequence = 0;
let protocol: Promise<void> | null = null;

/** Canvas-generated image tiles use the raster renderer's globe pole geometry. */
function registerProtocol() {
  protocol ??= import('maplibre-gl').then(({ addProtocol }) => {
    addProtocol('emerge-temperature', async (request, abort) => {
      const [key, z, x, y] = request.url.replace('emerge-temperature://', '').split('/');
      const entry = fields.get(key);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Temperature canvas unavailable');
      if (entry) {
        const { field, values } = entry, b = field.bounds, count = 2 ** Number(z);
        const pixels = context.createImageData(canvas.width, canvas.height);
        const centre = (b.west + b.east) / 2;
        for (let py = 0; py < canvas.height; py++) {
          const lat = latitude(Math.PI * (1 - 2 * (Number(y) + (py + .5) / canvas.height) / count));
          if (lat < b.south || lat > b.north) continue;
          for (let px = 0; px < canvas.width; px++) {
            let lon = (Number(x) + (px + .5) / canvas.width) / count * 360 - 180;
            lon += Math.round((centre - lon) / 360) * 360;
            if (lon < b.west || lon > b.east) continue;
            const value = bilinear(values, field.columns, field.rows, (lon - b.west) / (b.east - b.west), (lat - b.south) / (b.north - b.south));
            pixels.data.set(temperatureColor(value ?? NaN), (py * canvas.width + px) * 4);
          }
        }
        context.putImageData(pixels, 0, 0);
      }
      if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Temperature image unavailable'))));
      return { data: await blob.arrayBuffer() };
    });
  });
  return protocol;
}

/** Static canvas images, no animation, below labels and selection outlines. */
function paint(map: MapLibreMap, field: TemperatureField, values: number[], ids: string[]) {
  const id = `${prefix}${++sequence}`;
  fields.set(id, { field, values });
  ids.push(id);
  const before = map.getStyle().layers.find(layer => layer.type === 'symbol' || layer.id === 'emerge-countries-hit')?.id;
  map.addSource(id, { type: 'raster', tiles: [`emerge-temperature://${id}/{z}/{x}/{y}`], tileSize: 256, maxzoom: 8, attribution: 'Weather data by Open-Meteo.com' });
  map.addLayer({ id, source: id, type: 'raster', paint: { 'raster-opacity': 0.64, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, before);
}

/** Layer state already lives in the URL, including Next's reactive replaceState updates. */
export function useTemperatureLayer(map: React.RefObject<MapLibreMap | null>, ready: boolean) {
  const search = useSearchParams();
  const on = search.get('v') === 'f' && (search.get('lay') ?? '').split(',').includes('t');
  const offset = Number(search.get('dd') ?? 0);
  const day = Number.isInteger(offset) && offset >= 0 && offset <= 1 ? offset : -1;
  const selected = useRef(day); selected.current = day;
  const redraw = useRef<(() => void) | null>(null);
  useEffect(() => { redraw.current?.(); }, [day]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !on) { publish(initial); return; }
    let alive = true, generation = 0;
    let previous: Bounds | null = null, at = 0, field: TemperatureField | null = null;
    let ids: string[] = [];
    const clear = () => {
      for (const id of ids) { if (instance.getLayer(id)) instance.removeLayer(id); if (instance.getSource(id)) instance.removeSource(id); fields.delete(id); }
      ids = [];
    };
    const render = () => {
      if (!alive || !instance.getStyle()) return;
      clear();
      const day = selected.current;
      const date = day < 0 ? '' : field?.dates[day] ?? '';
      if (day < 0 || (field && !field.values[day])) { publish({ state: 'empty', date }); return; }
      if (!field) return;
      try {
        paint(instance, field, field.values[day]!, ids);
        publish({ state: 'ready', date });
      } catch { clear(); publish({ state: 'failed', date }); }
    };
    redraw.current = render;
    const update = async () => {
      if (!alive) return;
      const b = instance.getBounds();
      const view = { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() };
      const now = Date.now();
      if (previous && reusableView(previous, view) && now - at < temperatureCacheMs && field?.dates[0] === new Date(now).toISOString().slice(0, 10)) return;
      previous = view; at = now;
      const request = ++generation;
      publish({ state: 'loading', date: '' });
      try {
        const [next] = await Promise.all([fetchTemperature(view, now), registerProtocol()]);
        if (!alive || request !== generation) return;
        field = next; previous = next.view; at = next.at; render();
      } catch {
        if (!alive || request !== generation) return;
        clear(); field = null; previous = null; publish({ state: 'failed', date: '' });
      }
    };
    const style = () => { ids.forEach(id => fields.delete(id)); ids = []; render(); };
    const error = (event: unknown) => {
      const id = (event as { sourceId?: string }).sourceId;
      if (!alive || !id || !ids.includes(id)) return;
      clear(); field = null; previous = null; publish({ state: 'failed', date: '' });
    };
    instance.on('moveend', update); instance.on('style.load', style); instance.on('error', error);
    const timer = window.setInterval(update, temperatureCacheMs);
    void update();
    return () => {
      alive = false; redraw.current = null; window.clearInterval(timer);
      instance.off('moveend', update); instance.off('style.load', style); instance.off('error', error);
      clear(); publish(initial);
    };
  }, [map, ready, on]);
}
