/**
 * Layers and their settings in the address bar, so a copied link opens the
 * same map (S10).
 *
 *   lay=h,r        which layers are on, by their short keys, in registry order
 *   hy=2024        the history year
 *   rw=24h         which recent window is shown
 *   dd=5           how many days ahead the fire danger layer is showing
 *
 * `lay=` with no value means every layer is off, which is a different thing
 * from the parameter being absent, where the registry's own defaults apply.
 *
 * Nothing here touches `sel`, the language or the look: the two helpers from
 * `lib/ui/query` keep every other parameter exactly as it was typed.
 */

import { removeQueryParam, setQueryParam } from '../ui/query';
import { LAYERS, type LayerDefinition } from '../../config/layers';
import { clampHistoryYear, historyYearEnd } from './history';
import { clampDangerDay } from './danger';
import { defaultRecentWindow, isRecentWindow, type RecentWindow } from './firms';

export const layersParam = 'lay';
export const historyYearParam = 'hy';
export const recentWindowParam = 'rw';
export const dangerDayParam = 'dd';

export interface LayerState {
  /** Layer ids that are switched on. */
  on: string[];
  historyYear: number;
  recentWindow: RecentWindow;
  dangerDay: number;
}

/** Layers listed in the panel, in the order the registry gives them. */
export function panelLayers(): LayerDefinition[] {
  return LAYERS.filter((entry) => entry.panel !== undefined).sort(
    (a, b) => (a.panel?.order ?? 0) - (b.panel?.order ?? 0),
  );
}

function byUrlKey(key: string): LayerDefinition | undefined {
  return panelLayers().find((entry) => entry.panel?.urlKey === key);
}

export function defaultLayerState(lastMonth: string | null | undefined): LayerState {
  return {
    on: panelLayers()
      .filter((entry) => entry.panel?.defaultOn === true)
      .map((entry) => entry.id),
    historyYear: historyYearEnd(lastMonth),
    recentWindow: defaultRecentWindow,
    dangerDay: 0,
  };
}

function readParam(search: string, key: string): string | null {
  const parts = search.replace(/^\?/, '').split('&');
  for (const part of parts) {
    if (part === key) return '';
    if (part.startsWith(`${key}=`)) return part.slice(key.length + 1);
  }
  return null;
}

/** Reads the whole layer state out of a query string. */
export function layerStateFromSearch(
  search: string,
  lastMonth: string | null | undefined,
): LayerState {
  const fallback = defaultLayerState(lastMonth);
  const raw = readParam(search, layersParam);

  const on =
    raw === null
      ? fallback.on
      : raw
          .split(',')
          .map((key) => byUrlKey(key.trim()))
          .filter((entry): entry is LayerDefinition => entry !== undefined)
          .map((entry) => entry.id);

  const year = readParam(search, historyYearParam);
  const window = readParam(search, recentWindowParam);
  const day = readParam(search, dangerDayParam);

  return {
    on: [...new Set(on)],
    historyYear:
      year === null || year === '' ? fallback.historyYear : clampHistoryYear(Number(year), lastMonth),
    recentWindow: isRecentWindow(window) ? window : fallback.recentWindow,
    dangerDay: day === null || day === '' ? fallback.dangerDay : clampDangerDay(Number(day)),
  };
}

/**
 * Writes the state back into a query string. A setting whose layer is off is
 * left out, so the address stays short and says only what is on screen.
 */
export function layerStateSearch(
  search: string,
  state: LayerState,
  lastMonth: string | null | undefined,
): string {
  const order = panelLayers();
  const keys = order
    .filter((entry) => state.on.includes(entry.id))
    .map((entry) => entry.panel?.urlKey ?? entry.id);

  let next = setQueryParam(search, layersParam, keys.join(','));

  const control = (name: 'history_year' | 'recent_window' | 'danger_day'): boolean =>
    order.some((entry) => state.on.includes(entry.id) && entry.panel?.control === name);

  next = control('history_year')
    ? setQueryParam(next, historyYearParam, String(clampHistoryYear(state.historyYear, lastMonth)))
    : removeQueryParam(next, historyYearParam);

  next = control('recent_window')
    ? setQueryParam(next, recentWindowParam, state.recentWindow)
    : removeQueryParam(next, recentWindowParam);

  next = control('danger_day')
    ? setQueryParam(next, dangerDayParam, String(clampDangerDay(state.dangerDay)))
    : removeQueryParam(next, dangerDayParam);

  return next;
}
