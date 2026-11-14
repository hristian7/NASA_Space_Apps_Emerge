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

/**
 * How many cells to a side are merged into one square at this zoom.
 *
 * The world holds about 111,000 cells in a busy year. Drawing all of them
 * costs more per frame than panning can afford, and below about zoom 4 a
 * 0.25 degree cell is smaller than a pixel anyway, so the squares that are
 * merged were never separately visible.
 */
export function mergeFactor(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  if (zoom >= 4.5) return 1;
  if (zoom >= 3) return 2;
  if (zoom >= 1.5) return 4;
  return 8;
}

/**
 * Merges cells into bigger squares, each taking the HIGHEST fire-days value
 * inside it. The colour therefore still means "a cell with this many fire
 * days is in here", never an average nobody measured, and a bad cell cannot
 * be averaged away by its quiet neighbours. The panel says so while it is on.
 */
export function aggregateCells(
  cells: HistoryCell[],
  factor: number,
  cellDeg: number,
): HistoryCell[] {
  if (factor <= 1) return cells;
  const step = cellDeg * factor;
  const blocks = new Map<string, HistoryCell>();
  for (const cell of cells) {
    const row = Math.floor((cell.lat + 90) / step);
    const col = Math.floor((cell.lon + 180) / step);
    const key = `${row}:${col}`;
    const held = blocks.get(key);
    if (held !== undefined) {
      if (cell.fireDays > held.fireDays) {
        held.fireDays = cell.fireDays;
        held.klass = cell.klass;
      }
      held.hotspots += cell.hotspots;
      continue;
    }
    const lat = row * step - 90 + step / 2;
    const lon = col * step - 180 + step / 2;
    blocks.set(key, {
      polygon: cellPolygon(lat, lon, step),
      fireDays: cell.fireDays,
      hotspots: cell.hotspots,
      lat,
      lon,
      klass: cell.klass,
    });
  }
  return [...blocks.values()];
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
