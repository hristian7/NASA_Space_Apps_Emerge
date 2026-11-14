"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCountryName } from "@/components/app/country-name";
import { getSeries } from "@/lib/data/api";
import type { Selection } from "@/types/ui";
import MapView from "@/components/map/map-view";
import { defaultBasemapId } from "@/config/basemaps";
import { historyYears } from "@/lib/layers/history";
import { LAYERS } from "@/config/layers";
import { useLayers } from "@/lib/layers/use-layers";
import { removeQueryParam, setQueryParam } from "@/lib/ui/query";
import { closeRing, selectionSearch, selectionFromSearch } from "@/lib/ui/selection-url";
import LayerPanel from "./layer-panel";
import MapTools from "./map-tools";
import ReportPanel from "./report-panel";
import TimeSlider from "./time-slider";
import TopBar from "./top-bar";
import { type AppView, viewParam } from "./view-tabs";

const sheetHeights = ["peek", "half", "full"] as const;
const defaultRadiusKm = 50;
/** A tapped detection is looked at with a 10 km search distance (M27). */
const recentRadiusKm = 10;

function replaceSearch(search: string) {
  window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
}

export default function AppShell() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
  const [drawing, setDrawing] = useState(false);
  const [radiusTool, setRadiusTool] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [view, setView] = useState<AppView>("history");
  // The country a clicked point lies in, for its outline and the
  // "whole country" button. Unknown for a point read from a link.
  const [pointCountry, setPointCountry] = useState<string | null>(null);

  // The address bar is the source of truth on arrival, so a copied link opens
  // the same place and view. Read here rather than through the router's hooks,
  // which would turn this page into a client-only render.
  useEffect(() => {
    const search = window.location.search;
    if (/(?:^|[?&])v=f(?:&|$)/.test(search)) setView("forecast");
    const restored = selectionFromSearch(search);
    if (restored === null) return;
    setSelection(restored);
    if (restored.kind === "point") setRadiusKm(restored.radiusKm);
  }, []);

  const apply = useCallback((next: Selection | null) => {
    setSelection(next);
    if (next?.kind !== "point") setPointCountry(null);
    replaceSearch(selectionSearch(window.location.search, next));
    if (next !== null && window.innerWidth < 768) {
      document.documentElement.setAttribute("data-sheet", "half");
    }
  }, []);

  const changeView = useCallback((next: AppView) => {
    setView(next);
    const search = window.location.search;
    replaceSearch(next === "forecast" ? setQueryParam(search, viewParam, "f") : removeQueryParam(search, viewParam));
  }, []);

  const pickPoint = useCallback(
    (lat: number, lon: number) => {
      apply({ kind: "point", lat, lon, radiusKm });
    },
    [apply, radiusKm],
  );

  const layers = useLayers();

  // Monthly fire days for the strip behind the timeline: the chosen place's
  // series (the report reads the same cached files), or the world's.
  const shellText = useTranslations("shell");
  const countryName = useCountryName(selection?.kind === "country" ? selection.iso3 : null);
  const [activity, setActivity] = useState<{ first: string; values: (number | null)[] } | null>(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      if (selection === null) {
        const response = await fetch("/geo/world-months.json");
        if (!response.ok) throw new Error(String(response.status));
        const world = (await response.json()) as { first: string; months: number[] };
        return { first: world.first, values: world.months };
      }
      const series = await getSeries(selection, "cd");
      const start = series.months[0];
      if (start === undefined) return null;
      return {
        first: `${start.y}-${String(start.m).padStart(2, "0")}`,
        values: series.months.map((month) => month.value),
      };
    };
    load().then(
      (next) => {
        if (live) setActivity(next);
      },
      () => {
        if (live) setActivity(null);
      },
    );
    return () => {
      live = false;
    };
  }, [selection]);
  const activityPlace =
    selection === null
      ? null
      : selection.kind === "country"
        ? countryName
        : selection.kind === "point"
          ? shellText("activityPoint")
          : shellText("activityArea");

  // The forecast opens with the official fire danger on, unless the reader
  // already chose forecast layers.
  const { state: layerState, toggle, ready: layersReady } = layers;
  useEffect(() => {
    // Waits for the address bar to be read, or this would overwrite its layers.
    if (view !== "forecast" || !layersReady) return;
    const forecastIds = ["fire-danger", "nasa-fwi", "wind", "air-temperature", "rain", "soil-moisture", "greenness", "land-type"];
    if (!layerState.on.some((id) => forecastIds.includes(id))) toggle("fire-danger");
    // Only on entering the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, layersReady]);

  const pickRecent = useCallback(
    (lat: number, lon: number) => {
      setRadiusKm(recentRadiusKm);
      apply({ kind: "point", lat, lon, radiusKm: recentRadiusKm });
    },
    [apply],
  );

  const changeRadius = useCallback((km: number) => {
    setRadiusKm(km);
    setSelection((current) => {
      if (current === null || current.kind !== "point") return current;
      const next: Selection = { ...current, radiusKm: km };
      replaceSearch(selectionSearch(window.location.search, next));
      return next;
    });
  }, []);

  const cycleSheet = useCallback(() => {
    const root = document.documentElement;
    const now = root.getAttribute("data-sheet") ?? "half";
    const index = sheetHeights.indexOf(now as (typeof sheetHeights)[number]);
    root.setAttribute("data-sheet", sheetHeights[(index + 1) % sheetHeights.length]);
  }, []);

  // Each view draws only its own layers; the choices of the other are kept.
  const history = view === "history";
  const rasterDates = history ? {} : layers.rasterDates;

  return (
    <div className="shell" data-view={view} data-has-report={selection !== null}>
      <MapView
        selection={selection}
        basemapId={defaultBasemapId}
        projection="globe"
        drawing={drawing}
        historyCells={history ? layers.historyCells : []}
        recentPoints={layers.recentPoints}
        rasterDates={rasterDates}
        outlineIso3={selection?.kind === "country" ? selection.iso3 : selection?.kind === "point" ? pointCountry : null}
        onPickPoint={pickPoint}
        onPointCountry={setPointCountry}
        onPickRecent={pickRecent}
        onDrawArea={(ring) => apply({ kind: "polygon", ring: closeRing(ring) })}
        onDrawingEnd={() => setDrawing(false)}
      />

      <TopBar
        view={view}
        onView={changeView}
        onCountry={(iso3) => apply({ kind: "country", iso3 })}
        onPoint={(lat, lon) => {
          setPointCountry(null);
          pickPoint(lat, lon);
        }}
      />

      <MapTools
        drawing={drawing}
        radiusOn={radiusTool}
        radiusKm={radiusKm}
        layersOpen={layersOpen}
        onDraw={() => {
          setRadiusTool(false);
          setLayersOpen(false);
          setDrawing((value) => !value);
        }}
        onRadius={() => {
          setDrawing(false);
          setLayersOpen(false);
          setRadiusTool((value) => !value);
        }}
        onRadiusKm={changeRadius}
        onLayers={() => {
          setDrawing(false);
          setRadiusTool(false);
          setLayersOpen((value) => {
            if (!value && window.innerWidth < 768) document.documentElement.setAttribute("data-sheet", "peek");
            return !value;
          });
        }}
      />

      <LayerPanel
        state={layers.state}
        lastMonth={layers.lastMonth}
        historyStatus={layers.historyStatus}
        historyCellCount={layers.historyCells.length}
        recentStatus={layers.recentStatus}
        recent={layers.recent}
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        view={view}
        onToggle={layers.toggle}
        onWindow={layers.setWindow}
      />

      <TimeSlider
        view={view}
        activity={activity === null ? null : { ...activity, place: activityPlace }}
        fixedLayers={
          history
            ? []
            : LAYERS.filter(
                (entry) =>
                  entry.kind === "raster_tiles" &&
                  entry.source.kind === "tile_template" &&
                  entry.source.date !== undefined &&
                  layers.state.on.includes(entry.id),
              ).map((entry) => ({
                nameKey: entry.nameKey,
                date: entry.source.kind === "tile_template" ? (entry.source.date ?? "") : "",
              }))
        }
        years={historyYears(layers.lastMonth)}
        year={layers.state.historyYear}
        onYear={layers.setYear}
        day={layers.state.dangerDay}
        onDay={layers.setDay}
      />

      {selection !== null ? (
        <ReportPanel
          selection={selection}
          view={view}
          day={layers.state.dangerDay === 0 ? "today" : "tomorrow"}
          onPickPoint={pickPoint}
          pointCountry={selection.kind === "point" ? pointCountry : null}
          onWholeCountry={(iso3) => apply({ kind: "country", iso3 })}
          onClose={() => apply(null)}
          onCycleHeight={cycleSheet}
        />
      ) : null}
    </div>
  );
}
