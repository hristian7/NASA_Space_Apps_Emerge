"use client";

/**
 * Holds what the layer panel and the map need: which layers are on, their
 * settings, and the data behind the two layers that load numbers.
 *
 * The address bar is the source of truth on arrival and is rewritten on every
 * change, so a copied link opens the same layers (S10). The selection
 * parameter is never touched here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GlobeFile } from '../../types/data';
import { getMeta, loadGlobeYear } from '../data/api';
import { LAYERS } from '../../config/layers';
import { clampDangerDay, dangerDate } from './danger';
import { clampHistoryYear } from './history';
import type { RecentWindow } from './firms';
import { historyCells, recentPoints, type HistoryCell, type RecentPoint } from './overlay';
import type { RecentPayload } from './recent';
import {
  defaultLayerState,
  layerStateFromSearch,
  layerStateSearch,
  panelLayers,
  type LayerState,
} from './url-state';

export type LoadStatus = 'off' | 'loading' | 'ready' | 'empty' | 'failed';

export interface LayersValue {
  state: LayerState;
  lastMonth: string | null;
  historyStatus: LoadStatus;
  historyCells: HistoryCell[];
  recentStatus: LoadStatus;
  recent: RecentPayload | null;
  recentPoints: RecentPoint[];
  rasterDates: Record<string, string>;
  toggle: (id: string) => void;
  setYear: (year: number) => void;
  setWindow: (window: RecentWindow) => void;
  setDay: (day: number) => void;
}

function writeSearch(state: LayerState, lastMonth: string | null): void {
  const search = layerStateSearch(window.location.search, state, lastMonth);
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${search}${window.location.hash}`,
  );
}

export function useLayers(): LayersValue {
  const [lastMonth, setLastMonth] = useState<string | null>(null);
  const [state, setState] = useState<LayerState>(() => defaultLayerState(null));
  const [history, setHistory] = useState<GlobeFile | null>(null);
  const [historyStatus, setHistoryStatus] = useState<LoadStatus>('off');
  const [recent, setRecent] = useState<RecentPayload | null>(null);
  const [recentStatus, setRecentStatus] = useState<LoadStatus>('off');
  // Nothing is fetched before the address bar and the last data year are both
  // known, or the first paint would ask for a year nobody chose.
  const [hydrated, setHydrated] = useState(false);

  // The last data year decides where the year control stops, so the state is
  // read from the address bar only once that is known.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let month: string | null = null;
      try {
        const meta = await getMeta();
        month = meta?.last_month ?? null;
      } catch {
        month = null;
      }
      if (cancelled) return;
      setLastMonth(month);
      setState(layerStateFromSearch(window.location.search, month));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The address bar is written after the change is rendered, never inside a
  // state update: the router listens to address-bar writes, and a write during
  // render makes React update the router while another component renders.
  const userChanged = useRef(false);
  useEffect(() => {
    if (!userChanged.current) return;
    userChanged.current = false;
    writeSearch(state, lastMonth);
  }, [state, lastMonth]);

  const toggle = useCallback(
    (id: string) => {
      const known = panelLayers().some((entry) => entry.id === id);
      if (!known) return;
      setState((current) => {
        const on = current.on.includes(id)
          ? current.on.filter((entry) => entry !== id)
          : [...current.on, id];
        const next = { ...current, on };
        userChanged.current = true;
        return next;
      });
    },
    [lastMonth],
  );

  const setYear = useCallback(
    (year: number) => {
      setState((current) => {
        const next = { ...current, historyYear: clampHistoryYear(year, lastMonth) };
        userChanged.current = true;
        return next;
      });
    },
    [lastMonth],
  );

  const setWindow = useCallback(
    (value: RecentWindow) => {
      setState((current) => {
        const next = { ...current, recentWindow: value };
        userChanged.current = true;
        return next;
      });
    },
    [lastMonth],
  );

  const setDay = useCallback(
    (day: number) => {
      setState((current) => {
        const next = { ...current, dangerDay: clampDangerDay(day) };
        userChanged.current = true;
        return next;
      });
    },
    [lastMonth],
  );

  const historyOn = state.on.includes('harmonized-history');
  const recentOn = state.on.includes('recent-fires');


  useEffect(() => {
    if (!historyOn) {
      setHistory(null);
      setHistoryStatus('off');
      return;
    }
    if (!hydrated) {
      setHistoryStatus('loading');
      return;
    }
    let cancelled = false;
    setHistoryStatus('loading');
    (async () => {
      try {
        const file = await loadGlobeYear(state.historyYear);
        if (cancelled) return;
        setHistory(file);
        setHistoryStatus(file === null ? 'empty' : 'ready');
      } catch {
        if (cancelled) return;
        setHistory(null);
        setHistoryStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [historyOn, hydrated, state.historyYear]);

  useEffect(() => {
    if (!recentOn) {
      setRecent(null);
      setRecentStatus('off');
      return;
    }
    if (!hydrated) {
      setRecentStatus('loading');
      return;
    }
    let cancelled = false;
    setRecentStatus('loading');
    (async () => {
      try {
        const response = await fetch(`/api/recent?window=${state.recentWindow}`);
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as RecentPayload;
        if (cancelled) return;
        setRecent(payload);
        setRecentStatus(payload.shown === 0 ? 'empty' : 'ready');
      } catch {
        if (cancelled) return;
        setRecent(null);
        setRecentStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recentOn, hydrated, state.recentWindow]);

  const cells = useMemo(() => (historyOn ? historyCells(history) : []), [historyOn, history]);
  const points = useMemo(() => (recentOn ? recentPoints(recent) : []), [recentOn, recent]);

  return {
    state,
    lastMonth,
    historyStatus,
    historyCells: cells,
    recentStatus,
    recent,
    recentPoints: points,
    rasterDates: { ...(state.on.includes('wind') ? { wind: 'on' } : {}), ...Object.fromEntries(LAYERS.filter((entry) => entry.kind === 'raster_tiles' && state.on.includes(entry.id) && entry.source.kind === 'tile_template').map((entry) => [entry.id, entry.source.kind === 'tile_template' ? entry.source.date ?? dangerDate(state.dangerDay) : ''])) },
    toggle,
    setYear,
    setWindow,
    setDay,
  };
}
