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
};

const stepMs = 1100;

/**
 * One time control for both views: the fire history moves by year, the
 * forecast by day. Play steps forward and stops at the end.
 */
export default function TimeSlider({ view, years, year, onYear, day, onDay }: Props) {
  const t = useTranslations("shell");
  const locale = useLocale();
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

  return (
    <div className="timeline glass" role="group" aria-label={history ? t("historyTime") : t("forecastTime")}>
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
        <span className="timeline-value num">{history ? value : dayLabel(value)}</span>
        <span className="timeline-kind">{history ? t("historyTime") : t("forecastTime")}</span>
      </div>
      <div className="timeline-track">
        <input
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          value={index}
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
