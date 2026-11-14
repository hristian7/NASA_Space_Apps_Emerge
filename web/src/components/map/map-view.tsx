"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { TerraDraw } from "terra-draw";
import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { basemaps, defaultBasemapId, getBasemap } from "@/config/basemaps";
import { layer as layerById, layerUrl } from "@/config/layers";
import {
  emptyFeatures,
  ringBounds,
  selectionCentre,
  selectionFeatures,
  zoomForRadius,
} from "@/lib/ui/geo";
import {
  historyRampTokens,
} from "@/lib/layers/history";
import {
  rgbaFrom,
  recentRadiusPx,
  type HistoryCell,
  type RecentPoint,
} from "@/lib/layers/overlay";
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
  /** The day the fire danger tiles show, or null when that layer is off. */
  dangerDate: string | null;
  onPickPoint: (lat: number, lon: number) => void;
  onPickRecent: (lat: number, lon: number) => void;
  onDrawArea: (ring: [lon: number, lat: number][]) => void;
  onDrawingEnd: () => void;
};

const workerPath = "/vendor/maplibre-worker";
const selectionSource = "emerge-selection";
const fillLayer = "emerge-selection-fill";
const lineLayer = "emerge-selection-line";
const pointLayer = "emerge-selection-point";
const dangerSource = "emerge-danger";
const dangerLayer = "emerge-danger-tiles";

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
      { id: "base", type: "raster", source: "base" },
    ],
  } satisfies StyleSpecification;
}

/** Moves the camera so the chosen place, and its search circle, are in view. */
function frameSelection(instance: MapLibreMap, selection: Selection | null): void {
  const centre = selectionCentre(selection);
  if (centre === null || selection === null) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 0 : 650;
  const box = instance.getContainer().getBoundingClientRect();
  const smallest = Math.min(box.width, box.height);

  if (selection.kind === "polygon") {
    instance.fitBounds(ringBounds(selection.ring), {
      padding: Math.round(Math.min(90, smallest / 6)),
      maxZoom: 8,
      duration,
    });
    return;
  }

  if (selection.kind === "point") {
    instance.easeTo({
      center: centre,
      zoom: zoomForRadius(selection.lat, selection.radiusKm, smallest),
      duration,
    });
  }
}

/** The tile source for one day of fire danger, or nothing when it is off. */
function dangerTiles(date: string | null): string | null {
  if (date === null) return null;
  const definition = layerById("fire-danger");
  if (definition === undefined) return null;
  return layerUrl(definition.source, date);
}

export default function MapView({
  selection,
  basemapId,
  projection,
  drawing,
  historyCells,
  recentPoints,
  dangerDate,
  onPickPoint,
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
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const overlay = useRef<{ setProps: (props: { layers: unknown[] }) => void } | null>(null);
  const pickRecent = useRef(onPickRecent);
  pickRecent.current = onPickRecent;
  // The danger date is read inside the map's own style listener, which is not
  // rebuilt when a prop changes.
  const danger = useRef(dangerDate);
  danger.current = dangerDate;
  const paintDangerRef = useRef<(() => void) | null>(null);

  // Latest values the map's own listeners need, without rebuilding the map.
  const pick = useRef(onPickPoint);
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

        instance.addControl(
          new maplibregl.AttributionControl({ compact: false }),
          "bottom-right",
        );
        instance.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "bottom-left",
        );

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

        // A new style wipes every source, so the tiles are put back the same
        // way the selection is.
        const paintDanger = () => {
          const tiles = dangerTiles(danger.current);
          if (tiles === null) {
            if (instance.getLayer(dangerLayer) !== undefined) instance.removeLayer(dangerLayer);
            if (instance.getSource(dangerSource) !== undefined) instance.removeSource(dangerSource);
            return;
          }
          const definition = layerById("fire-danger");
          if (instance.getSource(dangerSource) === undefined) {
            instance.addSource(dangerSource, {
              type: "raster",
              tiles: [tiles],
              tileSize:
                definition?.source.kind === "tile_template" ? definition.source.tileSize : 256,
              attribution: definition?.credit ?? "",
            });
          }
          if (instance.getLayer(dangerLayer) === undefined) {
            // Under the selection outline, so the chosen place stays readable.
            const below = instance.getLayer(fillLayer) === undefined ? undefined : fillLayer;
            instance.addLayer(
              {
                id: dangerLayer,
                type: "raster",
                source: dangerSource,
                paint: { "raster-opacity": 0.62 },
              },
              below,
            );
          }
        };
        paintDangerRef.current = paintDanger;

        // The report panel covers part of the map, so the camera is told how
        // much room it really has. A phone's sheet changes height, hence the
        // observer rather than a one-off measurement.
        const applyPadding = () => {
          const panel = document.getElementById("report");
          const box = panel?.getBoundingClientRect();
          const narrow = window.innerWidth < 768;
          instance.setPadding(
            narrow
              ? {
                  top: 104,
                  right: 8,
                  bottom: box ? Math.max(0, window.innerHeight - box.top) : 0,
                  left: 8,
                }
              : {
                  top: 72,
                  right: box ? Math.max(0, window.innerWidth - box.left) : 16,
                  bottom: 24,
                  left: 16,
                },
          );
        };

        const panel = document.getElementById("report");
        const observer = panel === null ? null : new ResizeObserver(() => applyPadding());
        if (panel !== null && observer !== null) observer.observe(panel);
        window.addEventListener("resize", applyPadding);
        cleanUp.current = () => {
          observer?.disconnect();
          window.removeEventListener("resize", applyPadding);
        };

        instance.on("load", () => {
          instance.getCanvas().setAttribute("aria-label", label.current);
          instance.setProjection({ type: projection });
          applyPadding();
          paintSelection();
          paintDanger();
          // A selection read from the address bar is already set by now.
          frameSelection(instance, current.current);
          setReady(true);
        });

        // A new style drops every source and layer, so they are put back.
        instance.on("style.load", () => {
          instance.setProjection({ type: projection });
          paintSelection();
          paintDanger();
        });

        instance.on("click", (event) => {
          if (isDrawing.current || closingClick.current) return;
          pick.current(event.lngLat.lat, event.lngLat.lng);
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
    frameSelection(instance, selection);
  }, [selection]);

  // Fire danger: the day changed, so the old tiles go and the new ones come.
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;
    if (instance.getLayer(dangerLayer) !== undefined) instance.removeLayer(dangerLayer);
    if (instance.getSource(dangerSource) !== undefined) instance.removeSource(dangerSource);
    paintDangerRef.current?.();
  }, [dangerDate, ready]);

  // History cells and recent detections, drawn over the map by deck.gl.
  useEffect(() => {
    const instance = map.current;
    if (instance === null || !ready) return;
    let cancelled = false;

    (async () => {
      const [{ MapboxOverlay }, { PolygonLayer, ScatterplotLayer }] = await Promise.all([
        import("@deck.gl/mapbox"),
        import("@deck.gl/layers"),
      ]);
      if (cancelled || map.current === null) return;

      const ramp = historyRampTokens.map((token) => rgbaFrom(tokenColor(token), 170));
      const edge = rgbaFrom(tokenColor("--ramp-3"), 90);
      const dot = rgbaFrom(tokenColor("--accent"), 230);
      const hot = rgbaFrom(tokenColor("--ramp-3"), 240);

      const layers: unknown[] = [];
      if (historyCells.length > 0) {
        layers.push(
          new PolygonLayer<HistoryCell>({
            id: "emerge-history",
            data: historyCells,
            getPolygon: (cell) => cell.polygon,
            getFillColor: (cell) => ramp[cell.klass] ?? ramp[0],
            getLineColor: edge,
            lineWidthMinPixels: 0,
            stroked: false,
            filled: true,
            pickable: false,
            updateTriggers: { getFillColor: [historyCells.length] },
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
  }, [historyCells, recentPoints, ready]);

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
