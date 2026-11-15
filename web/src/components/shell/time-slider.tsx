"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dangerDate, dangerDays } from "@/lib/layers/danger";
import type { AppView } from "./view-tabs";

type Props = {
  view: AppView;
  years: number[];
  year: number;
  onYear: (year: number) => void;
  day: number;
  onDay: (day: number) => void;
  /** Layers on screen that show their own latest date and ignore the slider. */
  fixedLayers: { nameKey: string; date: string }[];
  /** Set while the map shows one calendar month: replaces the year label. */
  monthLabel?: string | null;
  /** Monthly fire days drawn behind the year track: the chosen place's, or the world's. */
  activity: { first: string; values: (number | null)[]; place: string | null } | null;
};

const stepMs = 1100;

/**
 * One time control for both views: the fire history moves by year, the
 * forecast by day. Play steps forward and stops at the end.
 */
export default function TimeSlider({ view, years, year, onYear, day, onDay, fixedLayers, activity, monthLabel = null }: Props) {
  const t = useTranslations("shell");
  const layerNames = useTranslations("layers");
  const locale = useLocale();
  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const [playing, setPlaying] = useState(false);

  const history = view === "history";
  const values = history ? years : dangerDays();
  const value = history ? year : day;
  const index = Math.max(0, values.indexOf(value));
  const set = history ? onYear : onDay;

  useEffect(() => setPlaying(false), [view]);

  useEffect(() => {
    if (!playing) return;
    if (index >= values.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => set(values[index + 1]), stepMs);
    return () => window.clearTimeout(timer);
  }, [playing, index, values, set]);

  const dayLabel = (offset: number) => {
    const date = new Date(`${dangerDate(offset)}T00:00:00Z`);
    const weekday = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
    return offset === 0 ? `${t("todayShort")}, ${weekday}` : weekday;
  };

  const last = values[values.length - 1];
  const ticks = history
    ? values.filter((entry) => entry === values[0] || entry === last || (entry % 5 === 0 && last - entry > 2 && entry - values[0] > 2))
    : values;

  if (values.length === 0) return null;

  // One thin bar per month, centred on its year's stop on the track, on a
  // square-root scale so quiet years still show next to the busiest ones.
  const span = Math.max(1, values.length - 1);
  const bars: { x: number; w: number; h: number; on: boolean }[] = [];
  if (history && activity !== null && values.length > 1) {
    const [fy, fm] = activity.first.split("-").map(Number);
    const top = Math.max(1, ...activity.values.map((value) => value ?? 0));
    activity.values.forEach((value, index) => {
      if (value === null || value <= 0) return;
      const total = fm - 1 + index;
      const y = fy + Math.floor(total / 12);
      const m = (total % 12) + 1;
      const x = (y - values[0] + (m - 0.5) / 12 - 0.5) / span;
      if (x < -0.001 || x > 1.001) return;
      bars.push({ x, w: 1 / 12 / span, h: Math.sqrt(value / top), on: y === year });
    });
  }


  return (
    <div className="timeline glass" role="group" aria-label={history ? t("historyTime") : t("forecastTime")}>
      {fixedLayers.length > 0 ? (
        <p className="timeline-note glass" role="note">
          {t("timelineFixed", {
            layers: fixedLayers
              .map((entry) => `${layerNames(entry.nameKey.replace(/^layers\./, ""))} (${shortDate(entry.date)})`)
              .join(", "),
          })}
        </p>
      ) : null}
      <button
        type="button"
        className="tool play"
        aria-label={playing ? t("pause") : t("play")}
        onClick={() => {
          if (!playing && index >= values.length - 1) set(values[0]);
          setPlaying(!playing);
        }}
      >
        {playing ? (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 4.8v10.4L15.2 10z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="timeline-now">
        <span key={`${view}:${monthLabel ?? value}`} className="timeline-value num">{history ? (monthLabel ?? value) : dayLabel(value)}</span>
        <span className="timeline-kind">
          {history && monthLabel !== null
            ? t("monthOnMap")
            : history
            ? activity?.place
              ? t("activityPlace", { place: activity.place })
              : t("activityWorld")
            : t("forecastTime")}
        </span>
      </div>
      <div className="timeline-track">
        {values.length > 1 ? (
          <svg className={history ? "timeline-bars" : "timeline-bars days"} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
            {values.slice(1).map((entry, index) => (
              <line
                key={entry}
                className="timeline-sep"
                x1={((index + 0.5) / span) * 1000}
                x2={((index + 0.5) / span) * 1000}
                y1={0}
                y2={100}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {bars.map((bar) => (
              <rect
                key={bar.x}
                className={bar.on ? "timeline-bar on" : "timeline-bar"}
                x={bar.x * 1000 - (bar.w * 1000) / 2}
                width={Math.max(0.6, bar.w * 1000 * 0.8)}
                y={100 - bar.h * 100}
                height={bar.h * 100}
              />
            ))}
          </svg>
        ) : null}
        <input
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          value={index}
          style={{ "--fill": `${(index / Math.max(1, values.length - 1)) * 100}%` } as React.CSSProperties}
          aria-label={history ? t("historyTime") : t("forecastTime")}
          aria-valuetext={history ? String(value) : dayLabel(value)}
          onChange={(event) => {
            setPlaying(false);
            set(values[Number(event.target.value)]);
          }}
        />
        <div className="timeline-ticks num" aria-hidden="true">
          {ticks.map((entry) => (
            <span
              key={entry}
              data-minor={!history && entry % 3 !== 0 ? "" : undefined}
              style={{ left: `${(values.indexOf(entry) / Math.max(1, values.length - 1)) * 100}%` }}
            >
              {history ? entry : entry === 0 ? t("todayShort") : t("dayAhead", { n: entry })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
