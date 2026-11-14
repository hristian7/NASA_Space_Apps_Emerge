/**
 * The data layers drawn over the map by deck.gl.
 *
 * The overlay runs beside the map rather than inside its draw loop, which is
 * the arrangement the risk spike tested and the one that does not depend on
 * the base map's own layer order.
 *
 * Colours arrive already converted to plain `rgb(...)`, because the look is
 * written in a colour format the map rejects; this file only turns them into
 * the four numbers deck.gl wants.
 */

import type { GlobeFile } from '../../types/data';
import { cellPolygon, historyClass } from './history';
import { recentRadiusPx, type RecentPayload } from './recent';

export interface HistoryCell {
  polygon: [number, number][];
  fireDays: number;
  hotspots: number;
  lat: number;
  lon: number;
  klass: number;
}

export interface RecentPoint {
  position: [number, number];
  frp: number;
  sat: number;
  conf: number;
  /** `YYYY-MM-DD HH:MM` in UTC. */
  when: string;
}

/** `rgb(r,g,b)` to the four channels deck.gl takes. */
export function rgbaFrom(color: string, alpha: number): [number, number, number, number] {
  const found = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  if (found === null) return [255, 255, 255, alpha];
  return [Number(found[1]), Number(found[2]), Number(found[3]), alpha];
}

/**
 * Cells worth drawing for one year, already classed.
 *
 * This is the only place that reads the globe file's own shape. Everything
 * downstream takes `HistoryCell[]`, which is a centre, a fire-days value and a
 * class, so a different file layout is one edit here and nowhere else.
 */
export function historyCells(file: GlobeFile | null): HistoryCell[] {
  if (file === null) return [];
  const { cols, cell_deg: cellDeg } = file;
  const cells: HistoryCell[] = [];
  for (let index = 0; index < file.n; index += 1) {
    const fireDays = cols.cd[index] ?? 0;
    const klass = historyClass(fireDays);
    if (klass < 0) continue;
    const lat = cols.lat[index];
    const lon = cols.lon[index];
    cells.push({
      polygon: cellPolygon(lat, lon, cellDeg),
      fireDays,
      hotspots: cols.hot[index] ?? 0,
      lat,
      lon,
      klass,
    });
  }
  return cells;
}

/** Detections unpacked from the compact reply. */
export function recentPoints(payload: RecentPayload | null): RecentPoint[] {
  if (payload === null) return [];
  const { cols, dates } = payload;
  const points: RecentPoint[] = [];
  for (let index = 0; index < cols.lat.length; index += 1) {
    const minute = cols.minute[index];
    const hour = String(Math.floor(minute / 60)).padStart(2, '0');
    const rest = String(minute % 60).padStart(2, '0');
    points.push({
      position: [cols.lon[index], cols.lat[index]],
      frp: cols.frp[index],
      sat: cols.sat[index],
      conf: cols.conf[index],
      when: `${dates[cols.date[index]] ?? ''} ${hour}:${rest}`,
    });
  }
  return points;
}

export { recentRadiusPx };
