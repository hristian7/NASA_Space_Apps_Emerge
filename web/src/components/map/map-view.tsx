"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { TerraDraw } from "terra-draw";
import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { basemaps, defaultBasemapId, getBasemap } from "@/config/basemaps";
import { LAYERS, layerUrl } from "@/config/layers";
import { CELL_DEG } from "@/lib/data/cell";
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
import {
  historyRampTokens,
} from "@/lib/layers/history";
import {
  aggregateCells,
  mergeFactor,
  rgbaFrom,
  recentRadiusPx,
  type HistoryCell,
  type RecentPoint,
} from "@/lib/layers/overlay";
import { useWindLayer } from "./wind-layer";
import { tokenColor } from "@/lib/ui/token-color";

export type Projection = "globe" | "mercator";

type Props = {
  selection: Selection | null;
  basemapId: string;
  projection: Projection;
  drawing: boolean;
  /** Cells of the chosen history year, already classed. Empty when the layer is off. */
  historyCells: HistoryCell[];
  /** Recent detections. Empty when the layer is off. */
  recentPoints: RecentPoint[];
  rasterDates: Record<string, string>;
  /** What a plain click on the map chooses. */
  pickMode: "country" | "point";
  onPickPoint: (lat: number, lon: number) => void;
  onPickCountry: (iso3: string) => void;
  onPickRecent: (lat: number, lon: number) => void;
  onDrawArea: (ring: [lon: number, lat: number][]) => void;
  onDrawingEnd: () => void;
};

const workerPath = "/vendor/maplibre-worker";
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


function rasterStyle(id: string): StyleSpecification | string {
  const basemap = getBasemap(id) ?? getBasemap(defaultBasemapId) ?? basemaps[0];
  if (basemap.style !== undefined) return basemap.style;

  return {
    version: 8,
    sources: {
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
  recentPoints,
  rasterDates,
  pickMode,
  onPickPoint,
  onPickCountry,
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
  // Only how many cells are merged into one square, not the zoom itself, so a
  // small camera move does not rebuild the layer.
  const [factor, setFactor] = useState(8);
  const overlay = useRef<{ setProps: (props: { layers: unknown[] }) => void } | null>(null);
  const pickRecent = useRef(onPickRecent);
  pickRecent.current = onPickRecent;
  const rasters = useRef(rasterDates);
  rasters.current = rasterDates;
  const paintDangerRef = useRef<(() => void) | null>(null);
  const paintCountriesRef = useRef<(() => void) | null>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const rasterKey = JSON.stringify(rasterDates);
  useWindLayer(map, ready, Boolean(rasterDates.wind));

  // Latest values the map's own listeners need, without rebuilding the map.
  const pick = useRef(onPickPoint);
  const pickCountry = useRef(onPickCountry);
  pickCountry.current = onPickCountry;
  const mode = useRef(pickMode);
  mode.current = pickMode;
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

        // Every credit in one place: the map's own button, which opens the
        // full list. Layers drawn outside MapLibre add theirs here.
        instance.addControl(
          new maplibregl.AttributionControl({
            compact: true,
            customAttribution: [
              "Fire history: NASA FIRMS (MODIS, VIIRS), harmonized by this project",
              "Wind and weather: Open-Meteo",
              "Place search: Photon, data from OpenStreetMap contributors (ODbL)",
              "Country borders: Natural Earth",
            ],
          }),
          "bottom-right",
        );
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
          const chosen = current.current?.kind === "country" ? current.current.iso3 : "";
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
        const paintDanger = () => {
          for (const definition of LAYERS.filter((entry) => entry.kind === "raster_tiles")) {
            const source = `emerge-raster-${definition.id}`;
            const layer = `${source}-tiles`;
            if (instance.getLayer(layer)) instance.removeLayer(layer);
            if (instance.getSource(source)) instance.removeSource(source);
            const date = rasters.current[definition.id];
            const tiles = date && layerUrl(definition.source, date);
            if (!tiles || definition.source.kind !== "tile_template") continue;
            instance.addSource(source, { type: "raster", tiles: [tiles], tileSize: definition.source.tileSize, attribution: definition.credit, ...(definition.source.kind === "tile_template" && definition.source.maxzoom !== undefined ? { maxzoom: definition.source.maxzoom } : {}) });
            instance.addLayer({ id: layer, type: "raster", source, paint: { "raster-opacity": 0.42 } }, instance.getLayer(fillLayer) ? fillLayer : undefined);
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
          // The credits start folded behind their button on every screen size.
          const credits = node.querySelector(".maplibregl-ctrl-attrib");
          credits?.classList.remove("maplibregl-compact-show");
          credits?.removeAttribute("open");
          publishCamera();
          instance.getCanvas().setAttribute("aria-label", label.current);
          instance.setProjection({ type: projection });
          measure();
          paintSelection();
          paintCountries();
          paintDanger();
          // A selection read from the address bar is already set by now.
          frameSelection(instance, current.current, boxes.current);
          setFactor(mergeFactor(instance.getZoom()));
          setReady(true);
        });

        // A new style drops every source and layer, so they are put back.
        instance.on("style.load", () => {
          instance.setProjection({ type: projection });
          paintSelection();
          paintCountries();
          paintDanger();
        });

        instance.on("zoomend", () => {
          setFactor(mergeFactor(instance.getZoom()));
        });

        instance.on("click", (event) => {
          if (isDrawing.current || closingClick.current) return;
          if (mode.current === "point") {
            pick.current(event.lngLat.lat, event.lngLat.lng);
            return;
          }
          const hit = instance.getLayer(countryHitLayer)
            ? instance.queryRenderedFeatures(event.point, { layers: [countryHitLayer] })
            : [];
          const iso3 = hit[0]?.properties?.iso3;
          if (typeof iso3 === "string" && iso3 !== "") pickCountry.current(iso3);
        });

        instance.on("mousemove", (event) => {
          if (mode.current !== "country" || isDrawing.current) {
            instance.getCanvas().style.cursor = "";
            return;
          }
          const over = instance.getLayer(countryHitLayer)
            ? instance.queryRenderedFeatures(event.point, { layers: [countryHitLayer] }).length > 0
            : false;
          instance.getCanvas().style.cursor = over ? "pointer" : "";
        });
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
    const chosen = selection?.kind === "country" ? selection.iso3 : "";
    for (const layer of [countryChosenFill, countryChosenLine]) {
      if (instance.getLayer(layer)) instance.setFilter(layer, ["==", ["get", "iso3"], chosen]);
    }
    // The report panel opens or closes with the selection, so the free space
    // is measured before the camera moves into it.
    measureRef.current?.();
    // The country boxes arrive with their file, which can be after a link
    // naming a country has already been read, so this runs again then.
    frameSelection(instance, selection, countryBoxes);
  }, [selection, countryBoxes]);

  // Fire danger: the day changed, so the old tiles go and the new ones come.
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;
    paintDangerRef.current?.();
  }, [rasterKey, ready]);

  // What the history layer actually draws at this zoom. Merging is done here
  // rather than in the loader, because only the map knows how close the
  // camera is.
  const drawnCells = useMemo(
    () => aggregateCells(historyCells, factor, CELL_DEG),
    [historyCells, factor],
  );

  // History cells and recent detections, drawn over the map by deck.gl.
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;
    let cancelled = false;

    (async () => {
      const [{ MapboxOverlay }, { SolidPolygonLayer, ScatterplotLayer }] = await Promise.all([
        import("@deck.gl/mapbox"),
        import("@deck.gl/layers"),
      ]);
      if (cancelled || map.current === null) return;

      const ramp = historyRampTokens.map((token) => rgbaFrom(tokenColor(token), 170));
      const edge = rgbaFrom(tokenColor("--ramp-3"), 90);
      const dot = rgbaFrom(tokenColor("--accent"), 230);
      const hot = rgbaFrom(tokenColor("--ramp-3"), 240);

      const layers: unknown[] = [];
      if (drawnCells.length > 0) {
        layers.push(
          new SolidPolygonLayer<HistoryCell>({
            id: "emerge-history",
            data: drawnCells,
            getPolygon: (cell) => cell.polygon,
            getFillColor: (cell) => ramp[cell.klass] ?? ramp[0],
            filled: true,
            extruded: false,
            pickable: false,
            updateTriggers: { getFillColor: [drawnCells.length] },
          }),
        );
      }
      if (recentPoints.length > 0) {
        layers.push(
          new ScatterplotLayer<RecentPoint>({
            id: "emerge-recent",
            data: recentPoints,
            getPosition: (point) => point.position,
            getRadius: (point) => recentRadiusPx(point.frp),
            radiusUnits: "pixels",
            radiusMinPixels: 2,
            getFillColor: (point) => (point.conf === 1 ? hot : dot),
            stroked: false,
            pickable: true,
            onClick: (info: { object?: RecentPoint }) => {
              const point = info.object;
              if (point === undefined) return false;
              pickRecent.current(point.position[1], point.position[0]);
              return true;
            },
          }),
        );
      }

      if (overlay.current === null) {
        const control = new MapboxOverlay({ interleaved: false, layers: layers as never[] });
        overlay.current = control as unknown as { setProps: (props: { layers: unknown[] }) => void };
        instance.addControl(control as never);
      } else {
        overlay.current.setProps({ layers });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drawnCells, recentPoints, ready]);

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
      <div ref={container} className="map" />
      {failed ? (
        <p className="glass" style={{ position: "fixed", inset: "auto 16px 16px", padding: 12 }}>
          {t("failed")}
        </p>
      ) : null}
    </>
  );
}
