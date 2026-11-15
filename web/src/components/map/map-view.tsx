"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { TerraDraw } from "terra-draw";
import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { basemaps, defaultBasemapId, getBasemap } from "@/config/basemaps";
import { LAYERS, layerUrl } from "@/config/layers";
import {
  countryBounds,
  emptyFeatures,
  ringBounds,
  selectionCentre,
  selectionFeatures,
  zoomForRadius,
} from "@/lib/ui/geo";
import { useCountryBoxes } from "@/lib/ui/use-countries";
import type { CountryIndexEntry } from "@/types/data";
import { historyRampTokens } from "@/lib/layers/history";
import { proxyTileUrl } from "@/lib/layers/tile-proxy";
import type { HistoryCell, RecentPoint } from "@/lib/layers/overlay";
import { useWindLayer } from "./wind-layer";
import { useTemperatureLayer } from "./temperature-field";
import { tokenColor } from "@/lib/ui/token-color";

export type Projection = "globe" | "mercator";

type Props = {
  selection: Selection | null;
  basemapId: string;
  projection: Projection;
  drawing: boolean;
  /** Cells of the chosen history year, already classed. Empty when the layer is off. */
  historyCells: HistoryCell[];
  /** What the history layer shows: "year:2026" or "month:2007-07". */
  historyKey?: string;
  /** Recent detections. Empty when the layer is off. */
  recentPoints: RecentPoint[];
  rasterDates: Record<string, string>;
  /** The country drawn with an outline: the chosen country, or the one a chosen point lies in. */
  outlineIso3: string | null;
  onPickPoint: (lat: number, lon: number) => void;
  /** The country under a clicked point, or null at sea. */
  onPointCountry: (iso3: string | null) => void;
  onPickRecent: (lat: number, lon: number) => void;
  onDrawArea: (ring: [lon: number, lat: number][]) => void;
  onDrawingEnd: () => void;
};

const workerPath = "/vendor/maplibre-worker";
/**
 * Raster tiles allowed in flight at once. With the library default of 16, a
 * data layer's opening tiles wait behind the base map's 36; the tile hosts
 * speak HTTP/2, so one connection carries them all at the same time.
 */
const parallelTileRequests = 96;
const selectionSource = "emerge-selection";
const fillLayer = "emerge-selection-fill";
const lineLayer = "emerge-selection-line";
const pointLayer = "emerge-selection-point";
const countrySource = "emerge-countries";
const countryHitLayer = "emerge-countries-hit";
const countryBorderLayer = "emerge-countries-border";
const countryChosenFill = "emerge-country-chosen-fill";
const countryChosenLine = "emerge-country-chosen-line";
const countriesUrl = "/geo/countries.json";
const historySource = "emerge-history";
const historyHeat = "emerge-history-heat";
const recentSource = "emerge-recent";
const recentLayer = "emerge-recent-dots";

type FirePoints = FeatureCollection<Point, { k: number; d: number }>;
type RecentPoints = FeatureCollection<Point, { frp: number; conf: number }>;
const noPoints = { type: "FeatureCollection", features: [] } as FeatureCollection<Point, never>;

/** One point per cell, built once per loaded year. */
const pointsByCells = new WeakMap<HistoryCell[], FirePoints>();
function firePoints(cells: HistoryCell[]): FirePoints {
  let built = pointsByCells.get(cells);
  if (built === undefined) {
    built = {
      type: "FeatureCollection",
      features: cells.map((cell) => ({
        type: "Feature",
        properties: { k: cell.klass, d: cell.fireDays },
        geometry: { type: "Point", coordinates: [cell.lon, cell.lat] },
      })),
    };
    pointsByCells.set(cells, built);
  }
  return built;
}

function recentFeatures(points: RecentPoint[]): RecentPoints {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: { frp: point.frp, conf: point.conf },
      geometry: { type: "Point", coordinates: point.position },
    })),
  };
}


function rasterStyle(id: string): StyleSpecification | string {
  const basemap = getBasemap(id) ?? getBasemap(defaultBasemapId) ?? basemaps[0];
  if (basemap.style !== undefined) return basemap.style;

  return {
    version: 8,
    sources: {
      // One shipped world image (NASA Blue Marble, stitched from GIBS level 3
      // tiles) under the live tiles, so a part of the globe that has not
      // loaded yet shows the Earth instead of an empty square.
      world: {
        type: "image",
        url: "/geo/world-base.jpg",
        coordinates: [
          [-180, 85.0511],
          [180, 85.0511],
          [180, -85.0511],
          [-180, -85.0511],
        ],
      },
      base: {
        type: "raster",
        tiles: basemap.tiles,
        tileSize: basemap.tileSize,
        minzoom: basemap.minzoom,
        maxzoom: basemap.maxzoom,
        attribution: basemap.attribution,
      },
    },
    layers: [
      { id: "space", type: "background", paint: { "background-color": "rgb(10,10,12)" } },
      {
        id: "world",
        type: "raster",
        source: "world",
        paint: { "raster-saturation": -0.82, "raster-brightness-max": 0.62, "raster-contrast": 0.05, "raster-fade-duration": 0 },
      },
      // Greyed and dimmed so the data layers carry the colour.
      {
        id: "base",
        type: "raster",
        source: "base",
        paint: { "raster-saturation": -0.82, "raster-brightness-max": 0.62, "raster-contrast": 0.05 },
      },
    ],
  } satisfies StyleSpecification;
}

/**
 * Moves the camera so the chosen place is in view: a point with its search
 * circle, a drawn area, or a country's box. The map's own padding, set from
 * the report panel and the phone sheet, is kept by fitBounds and easeTo, so
 * the place lands in the part of the map that is not covered.
 */
function frameSelection(
  instance: MapLibreMap,
  selection: Selection | null,
  countryBoxes: Map<string, CountryIndexEntry>,
): void {
  if (selection === null) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : 650;
  const box = instance.getContainer().getBoundingClientRect();
  const smallest = Math.min(box.width, box.height);
  const inset = Math.round(Math.min(90, smallest / 6));

  if (selection.kind === "country") {
    const entry = countryBoxes.get(selection.iso3);
    if (entry === undefined) return;
    instance.fitBounds(countryBounds(entry.bbox), {
      padding: inset,
      maxZoom: 7,
      duration,
    });
    return;
  }

  if (selection.kind === "polygon") {
    instance.fitBounds(ringBounds(selection.ring), {
      padding: inset,
      maxZoom: 8,
      duration,
    });
    return;
  }

  const centre = selectionCentre(selection);
  if (centre === null) return;
  instance.easeTo({
    center: centre,
    zoom: zoomForRadius(selection.lat, selection.radiusKm, smallest),
    duration,
  });
}

export default function MapView({
  selection,
  basemapId,
  projection,
  drawing,
  historyCells,
  historyKey,
  recentPoints,
  rasterDates,
  outlineIso3,
  onPickPoint,
  onPointCountry,
  onPickRecent,
  onDrawArea,
  onDrawingEnd,
}: Props) {
  const t = useTranslations("map");
  const container = useRef<HTMLDivElement | null>(null);
  const label = useRef(t("label"));
  label.current = t("label");
  const map = useRef<MapLibreMap | null>(null);
  const draw = useRef<TerraDraw | null>(null);
  const cleanUp = useRef<(() => void) | null>(null);
  const countryBoxes = useCountryBoxes();
  const boxes = useRef(countryBoxes);
  boxes.current = countryBoxes;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fireData = useRef<{ history: FirePoints | typeof noPoints; recent: RecentPoints | typeof noPoints }>({
    history: noPoints,
    recent: noPoints,
  });
  const pickRecent = useRef(onPickRecent);
  pickRecent.current = onPickRecent;
  const rasters = useRef(rasterDates);
  rasters.current = rasterDates;
  const paintDangerRef = useRef<(() => void) | null>(null);
  const paintCountriesRef = useRef<(() => void) | null>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const paintFireRef = useRef<(() => void) | null>(null);
  const rasterKey = JSON.stringify(rasterDates);
  useWindLayer(map, ready, Boolean(rasterDates.wind));
  useTemperatureLayer(map, ready);

  // Latest values the map's own listeners need, without rebuilding the map.
  const pick = useRef(onPickPoint);
  const pointCountry = useRef(onPointCountry);
  pointCountry.current = onPointCountry;
  const outline = useRef(outlineIso3);
  outline.current = outlineIso3;
  const area = useRef(onDrawArea);
  const drawEnd = useRef(onDrawingEnd);
  const isDrawing = useRef(drawing);
  // The click that closes a drawn area reaches the map's own click handler as
  // well, and drawing has already been switched off by then, so that one click
  // would replace the fresh area with a point.
  const closingClick = useRef(false);
  const current = useRef(selection);
  pick.current = onPickPoint;
  area.current = onDrawArea;
  drawEnd.current = onDrawingEnd;
  isDrawing.current = drawing;
  current.current = selection;

  useEffect(() => {
    let cancelled = false;
    const node = container.current;
    if (node === null) return;

    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled) return;
        maplibregl.setWorkerUrl(workerPath);
        maplibregl.setMaxParallelImageRequests(parallelTileRequests);

        const instance = new maplibregl.Map({
          container: node,
          style: rasterStyle(basemapId),
          center: [20, 25],
          // A phone shows the whole globe only at a much smaller scale.
          zoom: node.clientWidth < 768 ? 0.6 : 2.1,
          attributionControl: false,
          dragRotate: false,
          maxPitch: 0,
        });
        map.current = instance;

        // Credits are listed once, in the information menu of the top bar.
        // Zoom buttons live in the shell's tool column, which asks by event.
        const zoomBy = (event: Event) => {
          const step = (event as CustomEvent<number>).detail;
          if (step > 0) instance.zoomIn();
          else instance.zoomOut();
        };
        window.addEventListener("emerge-zoom", zoomBy);

        instance.on("error", (event) => {
          // A missing tile must not blank the page; the credit bar and the
          // rest of the shell keep working.
          console.warn("map", event.error?.message ?? event);
        });

        const paintSelection = () => {
          if (instance.getSource(selectionSource) === undefined) {
            instance.addSource(selectionSource, { type: "geojson", data: emptyFeatures });
          }
          const stroke = tokenColor("--outline");
          const accent = tokenColor("--accent");
          if (instance.getLayer(fillLayer) === undefined) {
            instance.addLayer({
              id: fillLayer,
              type: "fill",
              source: selectionSource,
              filter: ["!=", ["geometry-type"], "Point"],
              paint: { "fill-color": accent, "fill-opacity": 0.14 },
            });
          }
          if (instance.getLayer(lineLayer) === undefined) {
            instance.addLayer({
              id: lineLayer,
              type: "line",
              source: selectionSource,
              filter: ["!=", ["geometry-type"], "Point"],
              paint: { "line-color": stroke, "line-width": 1.6 },
            });
          }
          if (instance.getLayer(pointLayer) === undefined) {
            instance.addLayer({
              id: pointLayer,
              type: "circle",
              source: selectionSource,
              filter: ["==", ["geometry-type"], "Point"],
              paint: {
                "circle-radius": 5,
                "circle-color": accent,
                "circle-stroke-width": 2,
                "circle-stroke-color": stroke,
              },
            });
          }
          const source = instance.getSource(selectionSource) as GeoJSONSource | undefined;
          source?.setData(selectionFeatures(current.current));
        };

        const paintCountries = () => {
          if (instance.getSource(countrySource) === undefined) {
            instance.addSource(countrySource, { type: "geojson", data: countriesUrl });
          }
          const stroke = tokenColor("--outline");
          const accent = tokenColor("--accent");
          const chosen = outline.current ?? "";
          const before = instance.getLayer(fillLayer) ? fillLayer : undefined;
          if (instance.getLayer(countryHitLayer) === undefined) {
            // Invisible, but it is what a click is tested against.
            instance.addLayer(
              { id: countryHitLayer, type: "fill", source: countrySource, paint: { "fill-color": "#000", "fill-opacity": 0 } },
              before,
            );
          }
          if (instance.getLayer(countryBorderLayer) === undefined) {
            instance.addLayer(
              {
                id: countryBorderLayer,
                type: "line",
                source: countrySource,
                paint: { "line-color": "rgba(255,255,255,0.16)", "line-width": 0.6 },
              },
              before,
            );
          }
          if (instance.getLayer(countryChosenFill) === undefined) {
            instance.addLayer({
              id: countryChosenFill,
              type: "fill",
              source: countrySource,
              filter: ["==", ["get", "iso3"], chosen],
              paint: { "fill-color": accent, "fill-opacity": 0.07 },
            });
          }
          if (instance.getLayer(countryChosenLine) === undefined) {
            instance.addLayer({
              id: countryChosenLine,
              type: "line",
              source: countrySource,
              filter: ["==", ["get", "iso3"], chosen],
              paint: { "line-color": stroke, "line-width": 1.8 },
            });
          }
        };
        paintCountriesRef.current = paintCountries;

        // A new style wipes every source, so the tiles are put back the same
        // way the selection is.
        // Fire history as a glow weighted by fire days when far away, fading
        // into one soft dot per 0.25 degree cell close up; recent detections
        // as small dots above it. Drawn by the map itself, so they move with
        // it and sit under the country outline.
        const paintFire = () => {
          const ramp = historyRampTokens.map((token) => tokenColor(token));
          const below = instance.getLayer(countryBorderLayer) ? countryBorderLayer : undefined;
          if (instance.getSource(historySource) === undefined) {
            instance.addSource(historySource, { type: "geojson", data: fireData.current.history, buffer: 32 });
          }
          if (instance.getLayer(historyHeat) === undefined) {
            instance.addLayer(
              {
                id: historyHeat,
                type: "heatmap",
                source: historySource,
                paint: {
                  "heatmap-weight": ["interpolate", ["linear"], ["get", "d"], 1, 0.25, 5, 0.45, 25, 0.7, 100, 0.95, 300, 1],
                  // Overlapping glows add up to about 0.28 x (radius / cell spacing) squared;
                  // from zoom 5 on that ratio is fixed, and this keeps a cell's
                  // colour near its own fire-day level.
                  "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.25, 2, 0.45, 3, 0.85, 5, 0.9, 9, 0.9],
                  // Grows with the cells' spacing on screen, so neighbouring
                  // cells blend into one surface at every zoom.
                  "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 2, 3, 5.5, 5, 23, 7, 92, 9, 368, 11, 1472],
                  "heatmap-color": [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0, "rgba(0,0,0,0)",
                    0.06, ramp[0].replace("rgb(", "rgba(").replace(")", ",0.4)"),
                    0.18, ramp[0],
                    0.38, ramp[1],
                    0.62, ramp[2],
                    0.9, ramp[3],
                  ],
                  "heatmap-opacity": 0.86,
                },
              },
              below,
            );
          }
          if (instance.getSource(recentSource) === undefined) {
            instance.addSource(recentSource, { type: "geojson", data: fireData.current.recent });
          }
          if (instance.getLayer(recentLayer) === undefined) {
            instance.addLayer({
              id: recentLayer,
              type: "circle",
              source: recentSource,
              paint: {
                "circle-radius": ["step", ["get", "frp"], 2.8, 20, 4, 100, 5.5],
                "circle-color": ["case", ["==", ["get", "conf"], 1], ramp[3], tokenColor("--accent")],
                "circle-opacity": 0.92,
                "circle-stroke-width": 0.6,
                "circle-stroke-color": "rgba(0,0,0,0.5)",
              },
            });
          }
        };
        paintFireRef.current = paintFire;

        // Each raster layer keeps what it shows until its replacement has
        // loaded, then crossfades; a layer that follows the forecast day also
        // loads the next day out of sight, so playing the days finds it ready.
        type Slot = { source: string; layer: string; url: string };
        const shown = new Map<string, Slot>();
        const waiting = new Map<string, Slot>();
        const ahead = new Map<string, Slot>();
        let serial = 0;
        const removeSlot = (slot: Slot | undefined) => {
          if (slot === undefined) return;
          if (instance.getLayer(slot.layer)) instance.removeLayer(slot.layer);
          if (instance.getSource(slot.source)) instance.removeSource(slot.source);
        };
        const nextDate = (date: string) => {
          const day = new Date(`${date}T00:00:00Z`);
          day.setUTCDate(day.getUTCDate() + 1);
          return day.toISOString().slice(0, 10);
        };
        const addSlot = (definition: (typeof LAYERS)[number], url: string, opacity: number): Slot | null => {
          if (definition.source.kind !== "tile_template") return null;
          serial += 1;
          const source = `emerge-raster-${definition.id}-${serial}`;
          const layer = `${source}-tiles`;
          instance.addSource(source, { type: "raster", tiles: [proxyTileUrl(url)], tileSize: definition.source.tileSize, attribution: definition.credit, ...(definition.source.maxzoom !== undefined ? { maxzoom: definition.source.maxzoom } : {}) });
          const below = instance.getLayer(countryHitLayer) ? countryHitLayer : instance.getLayer(fillLayer) ? fillLayer : undefined;
          // Smooth resampling for every driver layer. Air temperature comes in
          // hard-edged satellite swaths, so it is also fainter and flatter.
          const soft = definition.id === "air-temperature";
          instance.addLayer(
            {
              id: layer,
              type: "raster",
              source,
              paint: {
                "raster-opacity": opacity,
                "raster-opacity-transition": { duration: 250, delay: 0 },
                "raster-fade-duration": 0,
                "raster-resampling": "linear",
                ...(soft ? { "raster-contrast": -0.25, "raster-saturation": -0.15 } : {}),
              },
            },
            below,
          );
          return { source, layer, url };
        };
        const fullOpacity = (id: string) => (id === "air-temperature" ? 0.3 : 0.42);
        const promote = (id: string, slot: Slot) => {
          if (instance.getLayer(slot.layer)) instance.setPaintProperty(slot.layer, "raster-opacity", fullOpacity(id));
          const old = shown.get(id);
          shown.set(id, slot);
          // The old picture leaves after the crossfade.
          window.setTimeout(() => removeSlot(old), 300);
        };
        instance.on("sourcedata", (event) => {
          if (!event.isSourceLoaded) return;
          for (const [id, slot] of waiting) {
            if (event.sourceId === slot.source && instance.isSourceLoaded(slot.source)) {
              waiting.delete(id);
              promote(id, slot);
            }
          }
        });
        const paintDanger = () => {
          for (const definition of LAYERS.filter((entry) => entry.kind === "raster_tiles")) {
            if (definition.source.kind !== "tile_template") continue;
            const id = definition.id;
            const date = rasters.current[id];
            const url = date ? (layerUrl(definition.source, date) ?? "") : "";
            if (!url) {
              removeSlot(shown.get(id));
              removeSlot(waiting.get(id));
              removeSlot(ahead.get(id));
              shown.delete(id);
              waiting.delete(id);
              ahead.delete(id);
              continue;
            }
            const current = shown.get(id);
            if (current?.url !== url && waiting.get(id)?.url !== url) {
              removeSlot(waiting.get(id));
              waiting.delete(id);
              const ready = ahead.get(id);
              if (ready?.url === url) {
                ahead.delete(id);
                promote(id, ready);
              } else if (current === undefined) {
                // Nothing on screen yet: show it at once and let it fill in.
                const slot = addSlot(definition, url, fullOpacity(id));
                if (slot) shown.set(id, slot);
              } else {
                const slot = addSlot(definition, url, 0);
                if (slot) waiting.set(id, slot);
              }
            }
            // Only a layer whose day follows the slider has a next day.
            const follows = definition.source.date === undefined && date !== undefined;
            const nextUrl = follows ? (layerUrl(definition.source, nextDate(date)) ?? "") : "";
            if (ahead.get(id)?.url !== nextUrl) {
              removeSlot(ahead.get(id));
              ahead.delete(id);
              if (nextUrl) {
                const slot = addSlot(definition, nextUrl, 0);
                if (slot) ahead.set(id, slot);
              }
            }
          }
        };
        paintDangerRef.current = paintDanger;

        // The report panel covers part of the map, so the camera is told how
        // much room it really has. A phone's sheet changes height, hence the
        // observer rather than a one-off measurement.
        // Setting padding stops any camera move under way, so it is applied
        // only when the free space really changed.
        let lastPadding = "";
        const applyPadding = () => {
          const panel = document.getElementById("report");
          const box = panel?.getBoundingClientRect();
          const narrow = window.innerWidth < 768;
          const topBar = document.querySelector(".top")?.getBoundingClientRect();
          const padding =
            narrow
              ? {
                  top: Math.round((topBar?.bottom ?? 96) + 8),
                  right: 8,
                  bottom: box ? Math.max(0, window.innerHeight - box.top) : 0,
                  left: 8,
                }
              : {
                  top: 72,
                  right: box ? Math.max(0, window.innerWidth - box.left) : 16,
                  bottom: 24,
                  left: 16,
                };
          const key = JSON.stringify(padding);
          if (key === lastPadding) return;
          lastPadding = key;
          instance.setPadding(padding);
        };

        /**
         * On a phone the credit line, the layer bar and the zoom buttons
         * share the strip above the report sheet. Their real heights are
         * published as custom properties so each one can sit clear of the
         * others however the credit wraps or the top bar folds.
         */
        const publishHeights = () => {
          const root = document.documentElement;
          const credit = document.querySelector(".maplibregl-ctrl-bottom-right");
          const creditHeight = credit?.getBoundingClientRect().height ?? 0;
          root.style.setProperty("--credit-h", `${Math.round(creditHeight)}px`);
          const topBar = document.querySelector(".top")?.getBoundingClientRect();
          root.style.setProperty("--top-bar-h", `${Math.round(topBar?.height ?? 96)}px`);
        };

        const measure = () => {
          publishHeights();
          applyPadding();
        };

        const watched = [
          document.getElementById("report"),
          document.querySelector(".top"),
          document.querySelector(".maplibregl-ctrl-bottom-right"),
        ].filter((node): node is HTMLElement => node !== null);
        const observer = new ResizeObserver(() => measure());
        for (const node of watched) observer.observe(node);
        measureRef.current = () => {
          const panel = document.getElementById("report");
          if (panel !== null) observer.observe(panel);
          measure();
        };
        window.addEventListener("resize", measure);
        measure();
        cleanUp.current = () => {
          window.removeEventListener("emerge-zoom", zoomBy);
          observer.disconnect();
          window.removeEventListener("resize", measure);
          document.documentElement.style.removeProperty("--credit-h");
          document.documentElement.style.removeProperty("--top-bar-h");
        };

        // Where the camera is, written onto the container, so the view can be
        // read from the page itself rather than guessed from the picture.
        const publishCamera = () => {
          const centre = instance.getCenter();
          node.dataset.centre = `${centre.lng.toFixed(4)},${centre.lat.toFixed(4)}`;
          node.dataset.zoom = instance.getZoom().toFixed(2);
        };
        instance.on("moveend", publishCamera);
        instance.on("error", (event) => {
          const sourceId = (event as unknown as { sourceId?: string }).sourceId;
          if (sourceId?.startsWith("emerge-raster-")) window.dispatchEvent(new CustomEvent("emerge-raster-error", { detail: sourceId.slice("emerge-raster-".length) }));
        });

        instance.on("load", () => {
          publishCamera();
          instance.getCanvas().setAttribute("aria-label", label.current);
          instance.setProjection({ type: projection });
          measure();
          paintSelection();
          paintCountries();
          paintFire();
          paintDanger();
          // A selection read from the address bar is already set by now.
          frameSelection(instance, current.current, boxes.current);
          setReady(true);
        });

        // A new style drops every source and layer, so they are put back.
        instance.on("style.load", () => {
          shown.clear();
          waiting.clear();
          ahead.clear();
          instance.setProjection({ type: projection });
          paintSelection();
          paintCountries();
          paintFire();
          paintDanger();
        });

        instance.on("click", (event) => {
          if (isDrawing.current || closingClick.current) return;
          const detection = instance.getLayer(recentLayer)
            ? instance.queryRenderedFeatures(event.point, { layers: [recentLayer] })[0]
            : undefined;
          if (detection?.geometry.type === "Point") {
            const [lon, lat] = detection.geometry.coordinates as [number, number];
            pickRecent.current(lat, lon);
            return;
          }
          const hit = instance.getLayer(countryHitLayer)
            ? instance.queryRenderedFeatures(event.point, { layers: [countryHitLayer] })
            : [];
          const iso3 = hit[0]?.properties?.iso3;
          pick.current(event.lngLat.lat, event.lngLat.lng);
          pointCountry.current(typeof iso3 === "string" && iso3 !== "" ? iso3 : null);
        });

        instance.getCanvas().style.cursor = "crosshair";
      } catch (error) {
        console.warn("map", error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      cleanUp.current?.();
      cleanUp.current = null;
      draw.current?.stop();
      draw.current = null;
      map.current?.remove();
      map.current = null;
    };
    // The map is built once; later changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    instance.setStyle(rasterStyle(basemapId));
  }, [basemapId]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    if (instance.loaded() || instance.isStyleLoaded()) {
      instance.setProjection({ type: projection });
    }
  }, [projection]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    const source = instance.getSource(selectionSource) as GeoJSONSource | undefined;
    source?.setData(selectionFeatures(selection));
    const chosen = outlineIso3 ?? "";
    for (const layer of [countryChosenFill, countryChosenLine]) {
      if (instance.getLayer(layer)) instance.setFilter(layer, ["==", ["get", "iso3"], chosen]);
    }
    // The report panel opens or closes with the selection, so the free space
    // is measured before the camera moves into it.
    measureRef.current?.();
    // The country boxes arrive with their file, which can be after a link
    // naming a country has already been read, so this runs again then.
    frameSelection(instance, selection, countryBoxes);
  }, [selection, countryBoxes, outlineIso3]);

  // Fire danger: the day changed, so the old tiles go and the new ones come.
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;
    paintDangerRef.current?.();
  }, [rasterKey, ready]);

  // Handing a year to the map costs tens of milliseconds, so while the year
  // slider is being dragged only the year it rests on is handed over.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fireData.current.history = historyCells.length > 0 ? firePoints(historyCells) : noPoints;
      const source = map.current?.getSource(historySource) as GeoJSONSource | undefined;
      source?.setData(fireData.current.history);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [historyCells, ready]);

  useEffect(() => {
    fireData.current.recent = recentPoints.length > 0 ? recentFeatures(recentPoints) : noPoints;
    const source = map.current?.getSource(recentSource) as GeoJSONSource | undefined;
    source?.setData(fireData.current.recent);
  }, [recentPoints, ready]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    let cancelled = false;

    if (!drawing) {
      draw.current?.stop();
      draw.current = null;
      return;
    }

    (async () => {
      const [{ TerraDraw, TerraDrawPolygonMode }, { TerraDrawMapLibreGLAdapter }] =
        await Promise.all([
          import("terra-draw"),
          import("terra-draw-maplibre-gl-adapter"),
        ]);
      if (cancelled) return;

      const instrument = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map: instance }),
        modes: [new TerraDrawPolygonMode()],
      });
      instrument.start();
      instrument.setMode("polygon");
      instrument.on("finish", (id, context) => {
        if (context.action !== "draw") return;
        const feature = instrument
          .getSnapshot()
          .find((candidate) => candidate.id === id);
        if (feature === undefined || feature.geometry.type !== "Polygon") return;
        const ring = feature.geometry.coordinates[0] as [lon: number, lat: number][];
        closingClick.current = true;
        window.setTimeout(() => {
          closingClick.current = false;
        }, 400);
        area.current(ring);
        instrument.clear();
        drawEnd.current();
      });
      draw.current = instrument;
    })();

    return () => {
      cancelled = true;
    };
  }, [drawing]);

  return (
    <>
      <div ref={container} className="map" data-history={historyKey} />
      {failed ? (
        <p className="glass" style={{ position: "fixed", inset: "auto 16px 16px", padding: 12 }}>
          {t("failed")}
        </p>
      ) : null}
    </>
  );
}
