"use client";

import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { cornerCount } from "@/lib/ui/geo";
import { useCountryName } from "@/components/app/country-name";
import ForecastPanel from "@/components/forecast/ForecastPanel";
import Disclaimer from "./disclaimer";
import ReportSlot from "./report-slot";
import type { AppView } from "./view-tabs";

type Props = {
  selection: Selection;
  view: AppView;
  day: "today" | "tomorrow";
  onPickPoint: (lat: number, lon: number) => void;
  /** The country a clicked point lies in, offered as a whole-country report. */
  pointCountry: string | null;
  onWholeCountry: (iso3: string) => void;
  onClose: () => void;
  onCycleHeight: () => void;
};

/** A side panel on wide screens, a bottom sheet on phones. Shown only once a place is chosen. */
export default function ReportPanel({ selection, view, day, onPickPoint, pointCountry, onWholeCountry, onClose, onCycleHeight }: Props) {
  const t = useTranslations("shell");
  const s = useTranslations("selection");
  const countryName = useCountryName(selection.kind === "country" ? selection.iso3 : pointCountry);
  const degrees = (value: number) => value.toFixed(3);

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
    <aside className="report glass" id="report" aria-label={title}>
      <button type="button" className="handle" aria-label={t("sheetHandle")} onClick={onCycleHeight} />
      <div className="report-scroll">
        <header className="report-head">
          <div>
            <h1>{title}</h1>
            <p className="report-kind">{sub}</p>
            {pointCountry !== null && selection.kind === "point" ? (
              <button type="button" className="whole-country" onClick={() => onWholeCountry(pointCountry)}>
                {t("wholeCountry", { name: countryName })}
              </button>
            ) : null}
          </div>
          <button type="button" className="layers-close" aria-label={t("clearPlace")} onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div aria-live="polite" className="stack">
          {view === "history" ? (
            <ReportSlot selection={selection} />
          ) : (
            <ForecastPanel selection={selection} day={day} onPickPoint={onPickPoint} />
          )}
        </div>
      </div>
      <Disclaimer />
    </aside>
  );
}
