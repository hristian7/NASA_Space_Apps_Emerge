"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import MapView, { type Projection } from "@/components/map/map-view";
import ViewSettings from "@/components/map/view-settings";
import SelectionTools from "@/components/selection/selection-tools";
import MenuPanel from "@/components/ui/menu-panel";
import { defaultBasemapId } from "@/config/basemaps";
import { closeRing, selectionSearch, selectionFromSearch } from "@/lib/ui/selection-url";
import ReportPanel from "./report-panel";
import TopBar from "./top-bar";

const sheetHeights = ["peek", "half", "full"] as const;
const defaultRadiusKm = 50;

export default function AppShell() {
  const t = useTranslations("shell");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
  const [basemapId, setBasemapId] = useState(defaultBasemapId);
  const [projection, setProjection] = useState<Projection>("globe");
  const [drawing, setDrawing] = useState(false);
  const [menu, setMenu] = useState<"place" | "view" | null>(null);

  // The address bar is the source of truth on arrival, so a copied link opens
  // the same place. Read here rather than through the router's hooks, which
  // would turn this page into a client-only render.
  useEffect(() => {
    const restored = selectionFromSearch(window.location.search);
    if (restored === null) return;
    setSelection(restored);
    if (restored.kind === "point") setRadiusKm(restored.radiusKm);
  }, []);

  const apply = useCallback((next: Selection | null) => {
    setSelection(next);
    const search = selectionSearch(window.location.search, next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, []);

  const pickPoint = useCallback(
    (lat: number, lon: number) => {
      apply({ kind: "point", lat, lon, radiusKm });
    },
    [apply, radiusKm],
  );

  const changeRadius = useCallback(
    (km: number) => {
      setRadiusKm(km);
      setSelection((current) => {
        if (current === null || current.kind !== "point") return current;
        const next: Selection = { ...current, radiusKm: km };
        const search = selectionSearch(window.location.search, next);
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${search}${window.location.hash}`,
        );
        return next;
      });
    },
    [],
  );

  const cycleSheet = useCallback(() => {
    const root = document.documentElement;
    const now = root.getAttribute("data-sheet") ?? "half";
    const index = sheetHeights.indexOf(now as (typeof sheetHeights)[number]);
    root.setAttribute("data-sheet", sheetHeights[(index + 1) % sheetHeights.length]);
  }, []);

  return (
    <>
      <MapView
        selection={selection}
        basemapId={basemapId}
        projection={projection}
        drawing={drawing}
        onPickPoint={pickPoint}
        onDrawArea={(ring) => apply({ kind: "polygon", ring: closeRing(ring) })}
        onDrawingEnd={() => setDrawing(false)}
      />

      <TopBar
        openMenu={menu}
        onToggleMenu={(which) => setMenu((current) => (current === which ? null : which))}
      />

      {menu === "place" ? (
        <MenuPanel
          id="place-menu"
          title={t("placeMenu")}
          closeLabel={t("closeMenu")}
          onClose={() => setMenu(null)}
        >
          <SelectionTools
            selection={selection}
            radiusKm={radiusKm}
            drawing={drawing}
            onRadiusChange={changeRadius}
            onPoint={pickPoint}
            onCountry={(iso3) => apply({ kind: "country", iso3 })}
            onDrawToggle={() => setDrawing((value) => !value)}
            onClear={() => apply(null)}
          />
        </MenuPanel>
      ) : null}

      {menu === "view" ? (
        <MenuPanel
          id="view-menu"
          title={t("viewMenu")}
          closeLabel={t("closeMenu")}
          onClose={() => setMenu(null)}
        >
          <ViewSettings
            basemapId={basemapId}
            projection={projection}
            onBasemapChange={setBasemapId}
            onProjectionChange={setProjection}
          />
        </MenuPanel>
      ) : null}

      <ReportPanel selection={selection} onCycleHeight={cycleSheet} />
    </>
  );
}
