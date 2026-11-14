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
  dangerDate: string | null;
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
  const started = useRef(false);
  // Nothing is fetched before the address bar and the last data year are both
  // known, or the first paint would ask for a year nobody chose.
  const [hydrated, setHydrated] = useState(false);

  // The last data year decides where the year control stops, so the state is
  // read from the address bar only once that is known.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
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

  const toggle = useCallback(
    (id: string) => {
      const known = panelLayers().some((entry) => entry.id === id);
      if (!known) return;
      setState((current) => {
        const on = current.on.includes(id)
          ? current.on.filter((entry) => entry !== id)
          : [...current.on, id];
        const next = { ...current, on };
        writeSearch(next, lastMonth);
        return next;
      });
    },
    [lastMonth],
  );

  const setYear = useCallback(
    (year: number) => {
      setState((current) => {
        const next = { ...current, historyYear: clampHistoryYear(year, lastMonth) };
        writeSearch(next, lastMonth);
        return next;
      });
    },
    [lastMonth],
  );

  const setWindow = useCallback(
    (value: RecentWindow) => {
      setState((current) => {
        const next = { ...current, recentWindow: value };
        writeSearch(next, lastMonth);
        return next;
      });
    },
    [lastMonth],
  );

  const setDay = useCallback(
    (day: number) => {
      setState((current) => {
        const next = { ...current, dangerDay: clampDangerDay(day) };
        writeSearch(next, lastMonth);
        return next;
      });
    },
    [lastMonth],
  );

  const historyOn = state.on.includes('harmonized-history');
  const recentOn = state.on.includes('recent-fires');
  const dangerOn = state.on.includes('fire-danger');

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
    dangerDate: dangerOn ? dangerDate(state.dangerDay) : null,
    toggle,
    setYear,
    setWindow,
    setDay,
  };
}
