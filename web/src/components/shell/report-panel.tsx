"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { cornerCount } from "@/lib/ui/geo";
import { useCountryName } from "@/components/app/country-name";
import ForecastPanel from "@/components/forecast/ForecastPanel";
import Disclaimer from "./disclaimer";
import ReportSlot from "./report-slot";
import type { MapMonth } from "@/components/app/report-view";
import type { AppView } from "./view-tabs";

type Props = {
  selection: Selection;
  /** Set while the panel plays its exit, after the place was cleared. */
  closing?: boolean;
  view: AppView;
  /** Forecast day offset on the timeline: 0 today, up to 9. */
  day: number;
  onPickPoint: (lat: number, lon: number) => void;
  /** The country a clicked point lies in, offered as a whole-country report. */
  pointCountry: string | null;
  onWholeCountry: (iso3: string) => void;
  onClose: () => void;
  mapMonth: MapMonth;
  onMapMonth: (month: MapMonth) => void;
  onCycleHeight: () => void;
};

/** A side panel on wide screens, a bottom sheet on phones. Shown only once a place is chosen. */
/** Sheet heights a drag settles on, as shares of the window height. */
const stops = { peek: 0.22, half: 0.52, full: 1 } as const;

export default function ReportPanel({ selection, closing = false, view, day, onPickPoint, pointCountry, onWholeCountry, onClose, onCycleHeight, mapMonth, onMapMonth }: Props) {
  const t = useTranslations("shell");
  const s = useTranslations("selection");
  const countryName = useCountryName(selection.kind === "country" ? selection.iso3 : pointCountry);
  const degrees = (value: number) => value.toFixed(3);

  // On a phone the handle can be dragged: the sheet follows the finger, then
  // settles on the nearest of the three heights.
  const dragged = useRef(false);
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (window.innerWidth >= 768) return;
    const root = document.documentElement;
    const sheet = event.currentTarget.parentElement;
    if (sheet === null) return;
    const startY = event.clientY;
    const startHeight = sheet.getBoundingClientRect().height;
    const topBar = document.querySelector(".top")?.getBoundingClientRect().bottom ?? 60;
    const tallest = window.innerHeight - topBar - 16;
    dragged.current = false;
    const move = (next: PointerEvent) => {
      const delta = startY - next.clientY;
      if (Math.abs(delta) > 4) dragged.current = true;
      if (!dragged.current) return;
      const height = Math.min(tallest, Math.max(96, startHeight + delta));
      root.setAttribute("data-sheet", "drag");
      root.style.setProperty("--sheet-drag", `${Math.round(height)}px`);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!dragged.current) return;
      const height = parseFloat(root.style.getPropertyValue("--sheet-drag")) || startHeight;
      const share = height / window.innerHeight;
      const nearest = (Object.entries(stops) as [keyof typeof stops, number][]).sort(
        (a, b) => Math.abs(a[1] - share) - Math.abs(b[1] - share),
      )[0][0];
      root.setAttribute("data-sheet", nearest);
      root.style.removeProperty("--sheet-drag");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const title =
    selection.kind === "country"
      ? countryName
      : selection.kind === "point"
        ? `${degrees(selection.lat)}, ${degrees(selection.lon)}`
        : s("area", { corners: cornerCount(selection) });
  const sub =
    selection.kind === "country"
      ? s("kindCountry")
      : selection.kind === "point"
        ? selection.radiusKm > 0
          ? `${s("kindPoint")} · ${selection.radiusKm} ${s("radiusUnit")}`
          : s("kindPoint")
        : s("kindArea");

  return (
    <aside className="report glass" id="report" aria-label={title} data-state={closing ? "closing" : "open"} inert={closing}>
      <button
        type="button"
        className="handle"
        aria-label={t("sheetHandle")}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onCycleHeight();
        }}
        onPointerDown={startDrag}
      />
      <div className="report-scroll">
        <header className="report-head">
          <div>
            <h1>{title}</h1>
            <p className="report-kind">
              <span>{sub}</span>
              {pointCountry !== null && selection.kind === "point" ? (
                <button type="button" className="whole-country inline" onClick={() => onWholeCountry(pointCountry)}>
                  {t("wholeCountry", { name: countryName })}
                </button>
              ) : null}
            </p>
          </div>
          <button type="button" className="layers-close" aria-label={t("clearPlace")} onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div aria-live="polite" className="stack">
          <div key={view} className="view-swap">
            {view === "history" ? (
              <ReportSlot selection={selection} mapMonth={mapMonth} onMapMonth={onMapMonth} />
            ) : (
              <ForecastPanel selection={selection} day={day} onPickPoint={onPickPoint} />
            )}
          </div>
        </div>
        {/* At the end of the panel's own scroll, not pinned over it. */}
        <Disclaimer />
      </div>
    </aside>
  );
}
