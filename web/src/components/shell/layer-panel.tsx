"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getMeta } from "@/lib/data/api";
import { formatIsoDate, type ReportLocale } from "@/components/report/lib/format";
import { panelLayers } from "@/lib/layers/url-state";
import type { LayerState } from "@/lib/layers/url-state";
import { dangerClasses, dangerDate } from "@/lib/layers/danger";
import DriverLegend from "./driver-legend";
import { historyRampTokens } from "@/lib/layers/history";
import { recentWindows, type RecentWindow } from "@/lib/layers/firms";
import type { RecentPayload } from "@/lib/layers/recent";
import type { LayerDefinition } from "@/config/layers";
import Disclaimer from "./disclaimer";

export type LoadStatus = "off" | "loading" | "ready" | "empty" | "failed";

type Props = {
  state: LayerState;
  lastMonth: string | null;
  historyStatus: LoadStatus;
  historyCellCount: number;
  recentStatus: LoadStatus;
  recent: RecentPayload | null;
  onToggle: (id: string) => void;
  onWindow: (window: RecentWindow) => void;
  /** Opened and closed from the map's tool column. */
  open: boolean;
  onClose: () => void;
  view: "history" | "forecast";
};

/** Which layers each view lists. Recent fires belong to both. */
const viewLayers: Record<Props["view"], string[]> = {
  history: ["harmonized-history", "recent-fires"],
  forecast: ["fire-danger", "nasa-fwi", "wind", "air-temperature", "soil-moisture", "greenness", "land-type", "recent-fires"],
};

/** Registry keys carry their namespace; `useTranslations` already has it. */
function short(key: string): string {
  return key.startsWith("layers.") ? key.slice("layers.".length) : key;
}

export default function LayerPanel({
  state,
  lastMonth,
  historyStatus,
  historyCellCount,
  recentStatus,
  recent,
  onToggle,
  onWindow,
  open,
  onClose,
  view,
}: Props) {
  const t = useTranslations("layers");
  const locale = useLocale() as ReportLocale;
  const [lastDay, setLastDay] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getMeta().then((meta) => {
      if (!cancelled) setLastDay(meta.last_data_day);
    }).catch(() => {
      if (!cancelled) setLastDay(null);
    });
    return () => { cancelled = true; };
  }, []);
  const shell = useTranslations("shell");
  const keyText = useTranslations("legend");
  const [rasterErrors, setRasterErrors] = useState<string[]>([]);
  const [wind, setWind] = useState({ state: "loading", time: "" });
  useEffect(() => {
    const update = (event: Event) => setWind((event as CustomEvent<{ state: string; time: string }>).detail);
    window.addEventListener("emerge-wind", update);
    return () => window.removeEventListener("emerge-wind", update);
  }, []);

  useEffect(() => {
    const update = (event: Event) => setRasterErrors((current) => [...new Set([...current, (event as CustomEvent<string>).detail])]);
    window.addEventListener("emerge-raster-error", update);
    return () => window.removeEventListener("emerge-raster-error", update);
  }, []);

  const layers = panelLayers().filter((entry) => viewLayers[view].includes(entry.id));
  const onCount = layers.filter((entry) => state.on.includes(entry.id)).length;
  const dangerOn = layers.some(
    (entry) => entry.panel?.showsDisclaimer === true && state.on.includes(entry.id),
  );

  const control = (definition: LayerDefinition) => {
    switch (definition.panel?.control) {
      case "history_year":
      case "danger_day":
        // The time slider at the bottom of the map sets these.
        return null;
      case "recent_window":
        return (
          <div className="layer-control">
            <span className="label" id="layer-window">
              {t("windowLabel")}
            </span>
            <div className="row" role="group" aria-labelledby="layer-window">
              {recentWindows.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className="chip"
                  aria-pressed={candidate === state.recentWindow}
                  onClick={() => onWindow(candidate)}
                >
                  {t(candidate === "24h" ? "window24h" : "window7d")}
                </button>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const legend = (definition: LayerDefinition) => {
    switch (definition.panel?.legend.kind) {
      case "ramp":
        return (
          <>
            <div className="ramp-key">
              <div
                className="ramp-bar"
                aria-hidden="true"
                style={{ background: `linear-gradient(to right, ${historyRampTokens.map((token) => `var(${token})`).join(", ")})` }}
              />
              <div className="ramp-ends">
                <span>{keyText("heatLess")}</span>
                <span>{keyText("heatMore")}</span>
              </div>
            </div>
            <p className="hint">{keyText("heatNote")}</p>
          </>
        );
      case "points":
        return (
          <ul className="legend">
            <li>
              <span className="dot small" aria-hidden="true" />
              <span>{t("pointSmall")}</span>
            </li>
            <li>
              <span className="dot large" aria-hidden="true" />
              <span>{t("pointLarge")}</span>
            </li>
            <li>
              <span className="dot high" aria-hidden="true" />
              <span>{t("pointHigh")}</span>
            </li>
          </ul>
        );
      case "classes":
        if (definition.id !== "fire-danger") return <DriverLegend id={definition.id} />;
        return (
          <ul className="legend">
            {dangerClasses.map((entry) => (
              <li key={entry.labelKey}>
                <span className="swatch" style={{ background: entry.color }} aria-hidden="true" />
                <span>{t(short(`layers.${entry.labelKey}`))}</span>
                <span className="legend-word num">{entry.range}</span>
              </li>
            ))}
          </ul>
        );
      default:
        return null;
    }
  };

  const timeLine = (definition: LayerDefinition) => {
    const key = short(definition.panel?.timeKey ?? "");
    if (definition.id === "harmonized-history") {
      if (historyStatus === "loading") return t("loading");
      if (historyStatus === "empty") return t("noYearData", { year: state.historyYear });
      if (historyStatus === "failed") return t("failed");
      if (lastDay === undefined) return t("loading");
      if (lastDay === null) return t("failed");
      if (lastDay.slice(0, 4) === String(state.historyYear) && !lastDay.endsWith("-12-31")) {
        return t("harmonizedHistoryPartialTime", {
          year: state.historyYear, date: formatIsoDate(lastDay, locale), cells: historyCellCount,
        });
      }
      return t(key, { year: state.historyYear, cells: historyCellCount });
    }
    if (definition.id === "recent-fires") {
      if (recentStatus === "loading") return t("loading");
      if (recentStatus === "failed") return t("failed");
      if (recent === null || recent.shown === 0) return t("noRecent");
      if (recent.capped) {
        return t("recentFiresTimeCapped", {
          shown: recent.shown,
          total: recent.total,
          from: recent.dataStart ?? "",
          to: recent.dataTime ?? "",
        });
      }
      return t(key, {
        shown: recent.shown,
        total: recent.total,
        from: recent.dataStart ?? "",
        to: recent.dataTime ?? "",
      });
    }
    if (rasterErrors.includes(definition.id)) return t("failed");
    if (definition.id === "wind") {
      if (wind.state === "loading") return t("loading");
      if (wind.state !== "ready") return t("windNoData");
      return t(key, { date: wind.time });
    }
    return t(key, { date: definition.source.kind === "tile_template" ? definition.source.date ?? dangerDate(state.dangerDay) : "" });
  };

  return (
    <section className="layers glass" id="layer-panel" aria-label={t("title")} hidden={!open}>
      <div className="layers-head">
        <h2>{t("title")}</h2>
        <span className="layers-count num">{t("onCount", { count: onCount })}</span>
        <button type="button" className="layers-close" aria-label={shell("closeMenu")} onClick={onClose}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div id="layer-list" className="layers-body">
        {layers.map((definition) => {
          const on = state.on.includes(definition.id);
          return (
            <div className="layer-row" key={definition.id}>
              <label className="layer-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={on}
                  onChange={() => { setRasterErrors((current) => current.filter((id) => id !== definition.id)); onToggle(definition.id); }}
                />
                <span>{t(short(definition.nameKey))}</span>
              </label>
              <p className="hint">{t(short(definition.panel?.explainKey ?? ""))}</p>

              {on ? (
                <div className="layer-open">
                  {control(definition)}
                  {legend(definition)}
                  <p className="hint" aria-live="polite">
                    {timeLine(definition)}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}

        {dangerOn ? (
          <div className="layer-disclaimer">
            <Disclaimer />
          </div>
        ) : null}
      </div>
    </section>
  );
}
