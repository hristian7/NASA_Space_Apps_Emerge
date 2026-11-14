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
import { globeCells } from '../data/api';
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
 * class, so a different file layout is one edit here and nowhere else. The
 * file itself carries no point: the data layer works the centre out from the
 * cell id, and this layer asks it rather than repeating the grid rule.
 */
export function historyCells(file: GlobeFile | null): HistoryCell[] {
  if (file === null) return [];
  const cells: HistoryCell[] = [];
  for (const cell of globeCells(file)) {
    const klass = historyClass(cell.cd);
    if (klass < 0) continue;
    cells.push({
      polygon: cellPolygon(cell.lat, cell.lon, file.cell_deg),
      fireDays: cell.cd,
      hotspots: cell.hot,
      lat: cell.lat,
      lon: cell.lon,
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
