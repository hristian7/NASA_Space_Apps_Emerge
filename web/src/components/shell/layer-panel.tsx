"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getMeta } from "@/lib/data/api";
import { formatCount, formatIsoDate, type ReportLocale } from "@/components/report/lib/format";
import { panelLayers } from "@/lib/layers/url-state";
import type { LayerState } from "@/lib/layers/url-state";
import { dangerClasses, dangerDate } from "@/lib/layers/danger";
import DriverLegend from "./driver-legend";
import { historyRampTokens } from "@/lib/layers/history";
import { recentWindows, type RecentWindow } from "@/lib/layers/firms";
import type { RecentPayload } from "@/lib/layers/recent";
import type { LayerDefinition } from "@/config/layers";
import Disclaimer from "./disclaimer";
import { useTemperatureStatus } from "@/components/map/temperature-field";
import { temperatureGradient } from "@/lib/layers/temperature";

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
  /** Set while the map shows one calendar month for the chosen place. */
  monthLabel?: string | null;
  /** Opened and closed from the map's tool column. */
  open: boolean;
  /** Always shown on a wide screen, collapsible to its title bar. */
  docked?: boolean;
  onClose: () => void;
  view: "history" | "forecast";
};

/** Which layers each view lists. Recent fires belong to both. */
const viewLayers: Record<Props["view"], string[]> = {
  history: ["harmonized-history", "recent-fires"],
  forecast: ["fire-danger", "nasa-fwi", "wind", "air-temperature", "rain", "soil-moisture", "greenness", "land-type", "recent-fires"],
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
  docked = false,
  onClose,
  view,
  monthLabel = null,
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
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(dockKey) === "1");
    } catch {
      // Storage can be blocked; the dock then starts open.
    }
  }, []);
  const collapse = (next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(dockKey, next ? "1" : "0");
    } catch {
      // Not remembered when storage is blocked.
    }
  };
  const [about, setAbout] = useState<string[]>([]);
  const shut = docked && collapsed;
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
        if (definition.id === "air-temperature") return <TemperatureLegend day={state.dangerDay} />;
        if (definition.id === "rain") return <RainLegend />;
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
      if (monthLabel !== null) return t("historyMonthTime", { month: monthLabel });
      if (historyStatus === "loading") return t("loading");
      if (historyStatus === "empty") return t("noYearData", { year: state.historyYear });
      if (historyStatus === "failed") return t("failed");
      if (lastDay === undefined) return t("loading");
      if (lastDay === null) return t("failed");
      if (lastDay.slice(0, 4) === String(state.historyYear) && !lastDay.endsWith("-12-31")) {
        return t("harmonizedHistoryPartialTime", {
          year: state.historyYear, date: formatIsoDate(lastDay, locale), cells: formatCount(historyCellCount, locale),
        });
      }
      return t(key, { year: state.historyYear, cells: formatCount(historyCellCount, locale) });
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
    <section
      className={docked ? "layers glass docked" : "layers glass"}
      id="layer-panel"
      aria-label={t("title")}
      hidden={!docked && !open}
      data-collapsed={shut ? "" : undefined}
    >
      {docked ? (
        <h2 className="layers-dockHead">
          <button type="button" className="layers-head" aria-expanded={!collapsed} aria-controls="layer-list" onClick={() => collapse(!collapsed)}>
            <span>{t("title")}</span>
            <span className="layers-count num">{t("onCount", { count: onCount })}</span>
          </button>
        </h2>
      ) : (
        <div className="layers-head">
          <h2>{t("title")}</h2>
          <span className="layers-count num">{t("onCount", { count: onCount })}</span>
          <button type="button" className="layers-close" aria-label={shell("closeMenu")} onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div id="layer-list" className="layers-body" hidden={shut}>
        {layers.map((definition) => {
          const on = state.on.includes(definition.id);
          const name = t(short(definition.nameKey));
          const aboutOpen = !docked || about.includes(definition.id);
          const aboutId = `layer-about-${definition.id}`;
          return (
            <div className="layer-row" key={definition.id} data-on={on}>
              <div className="layer-line">
                <label className="layer-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={on}
                    onChange={() => { setRasterErrors((current) => current.filter((id) => id !== definition.id)); onToggle(definition.id); }}
                  />
                  <span>{name}</span>
                </label>
                {docked ? (
                  <button
                    type="button"
                    className="layer-about"
                    aria-expanded={aboutOpen}
                    aria-controls={aboutId}
                    aria-label={t("aboutLayer", { name })}
                    onClick={() => setAbout((current) => (current.includes(definition.id) ? current.filter((id) => id !== definition.id) : [...current, definition.id]))}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="10" cy="6.4" r="1" fill="currentColor" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <p className="hint" id={aboutId} hidden={!aboutOpen}>{t(short(definition.panel?.explainKey ?? ""))}</p>

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

const dockKey = "emerge-layer-dock-collapsed";

/** Weather legends share the established ramp layout and typography. */
function TemperatureLegend({ day }: { day: number }) {
  const t = useTranslations("layers");
  const status = useTemperatureStatus();
  const date = status.date || dangerDate(day);
  return (
    <div className="ramp-key" data-temperature-state={status.state}>
      <div className="ramp-bar" aria-hidden="true" style={{ background: temperatureGradient }} />
      <div className="ramp-ticks num">
        <span style={{ left: "0%" }} data-edge="start">≤ -40</span>
        <span style={{ left: "44.444%" }}>0</span>
        <span style={{ left: "100%" }} data-edge="end">≥ 50</span>
      </div>
      <p className="ramp-unit">{t("temperatureUnit")}</p>
      <p className="hint" aria-live="polite">
        {t("temperatureDate", { date })} {day > 9 || status.state === "empty" || status.state === "failed" ? t("temperatureNoData") : status.state === "ready" ? t("temperatureCredit") : t("loading")}
      </p>
    </div>
  );
}

function RainLegend() {
  const t = useTranslations("layers");
  return (
    <div className="ramp-key">
      {rainRamps.map((ramp) => (
        <div key={ramp.key}>
          <p className="ramp-unit">{t(ramp.key)}</p>
          <div className="ramp-bar" aria-hidden="true" style={{ background: ramp.gradient }} />
          <div className="ramp-ticks num">
            <span style={{ left: "0%" }} data-edge="start">0.1</span>
            <span style={{ left: "36.697%" }}>1</span>
            <span style={{ left: "73.394%" }}>10</span>
            <span style={{ left: "100%" }} data-edge="end">≥ 53.1</span>
          </div>
        </div>
      ))}
      <p className="hint">{t("rainNoData")}</p>
      <p className="hint">NASA GPM IMERG / NASA GIBS</p>
    </div>
  );
}

// NASA GIBS GPM_Precipitation_Rate colour map, logarithmic rates [V].
const rainRamps = [
  {
    "key": "rainUnit",
    "gradient": "linear-gradient(to right, rgb(0,118,78), rgb(0,145,41), rgb(16,173,0), rgb(95,200,0), rgb(195,228,0), rgb(255,194,1), rgb(255,115,28), rgb(255,38,38), rgb(231,0,0), rgb(169,0,0), rgb(106,0,0), rgb(51,0,0))"
  },
  {
    "key": "snowUnit",
    "gradient": "linear-gradient(to right, rgb(177,250,238), rgb(146,238,242), rgb(118,201,230), rgb(95,158,215), rgb(79,115,196), rgb(67,80,208), rgb(74,55,219), rgb(106,43,231), rgb(119,11,209), rgb(121,8,157), rgb(102,5,105), rgb(58,3,48))"
  }
];
