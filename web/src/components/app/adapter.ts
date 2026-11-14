/**
 * The glue between the number logic and the report components.
 *
 * Nothing here decides a figure. Every number comes out of web/src/lib: the
 * anomaly ratio and the typical month are read off `unusual` from the stats
 * module, the series comes from the data module, and the limits on the
 * hotspots link are the ones the query module already enforces. What this file
 * does is shape, clip and name: it turns a logic result into the props a
 * component takes, cuts a series down to the chosen date range, and writes the
 * selection in words for a CSV comment line.
 */

import type { MonthPoint, Selection, Series } from "../../types/ui";
import type { AnomalyPoint, MonthKey, Scope } from "../report/types";
import { historyFor, median, unusual } from "../../lib/stats";
import { haversineKm } from "../../lib/data/api";
import { MAX_DAYS, MAX_RADIUS_KM, FIRST_DAY } from "../../lib/hotspots/query";
import type { Bbox } from "../../lib/hotspots/geo";

/** Above this width a chance of fire is near certain, so M13 asks for days instead. */
export const LARGE_AREA_KM = 50;

export function sameMonth(a: MonthKey | null, b: MonthKey | null): boolean {
  if (a === null || b === null) return a === b;
  return a.y === b.y && a.m === b.m;
}

/** A month as one sortable number, so a range test is a comparison. */
export function monthRank(month: MonthKey): number {
  return month.y * 12 + (month.m - 1);
}

export function monthsOf(series: Series): MonthKey[] {
  return series.months.map((point) => ({ y: point.y, m: point.m }));
}

/** The last month the series has a measurement for, or the last month at all. */
export function lastMonthWithData(series: Series): MonthKey | null {
  let last: MonthKey | null = null;
  for (const point of series.months) {
    if (point.value !== null) last = { y: point.y, m: point.m };
  }
  if (last !== null) return last;
  const final = series.months[series.months.length - 1];
  return final === undefined ? null : { y: final.y, m: final.m };
}

/** The months inside the range, both ends included. A null end means no limit. */
export function clipSeries(
  series: Series,
  from: MonthKey | null,
  to: MonthKey | null,
): Series {
  const low = from === null ? -Infinity : monthRank(from);
  const high = to === null ? Infinity : monthRank(to);
  if (low === -Infinity && high === Infinity) return series;
  const months = series.months.filter((point) => {
    const rank = monthRank(point);
    return rank >= low && rank <= high;
  });
  return { ...series, months };
}

/** The same clipping for anything else keyed by month, such as the anomaly. */
export function clipByMonth<T extends MonthKey>(
  rows: T[],
  from: MonthKey | null,
  to: MonthKey | null,
): T[] {
  const low = from === null ? -Infinity : monthRank(from);
  const high = to === null ? Infinity : monthRank(to);
  return rows.filter((row) => {
    const rank = monthRank(row);
    return rank >= low && rank <= high;
  });
}

/**
 * The anomaly ramp: each month against the median of the same month in the
 * years before it. The ratio is `unusual`'s own `ratioMedian`, so the rule
 * lives in the stats module and not here.
 */
export function anomalyPoints(series: Series): AnomalyPoint[] {
  return series.months.map((point) => ({
    y: point.y,
    m: point.m,
    ratio: unusual(series, point.y, point.m).ratioMedian,
  }));
}

/**
 * M13: for a country or a wide area the chance of fire is near certain, so the
 * card shows a typical number of fire days instead. That typical figure is the
 * median of the same month in past years, which is `unusual`'s own median.
 */
export function typicalFireDays(
  fireDays: Series,
  month: MonthKey,
): number | null {
  // The median of the same month in the years before it, which is what the
  // comparison rule uses. It is taken from the history directly so that a
  // month still being measured still has a typical figure beside it.
  return median(historyFor(fireDays, month.y, month.m));
}

export function scopeOf(selection: Selection): Scope {
  return selection.kind === "country" ? "country" : "area";
}

/** True when the chance of fire would read near 100 per cent (M13). */
export function isLargeArea(selection: Selection): boolean {
  if (selection.kind === "country") return true;
  if (selection.kind === "point") return selection.radiusKm > LARGE_AREA_KM;
  const box = ringBox(selection.ring);
  // How far the drawn area reaches from its middle, north to south.
  const reach = haversineKm(box.south, box.west, box.north, box.west) / 2;
  return reach > LARGE_AREA_KM;
}

/** The smallest box around a drawn ring. */
export function ringBox(ring: [lon: number, lat: number][]): Bbox {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const [lon, lat] of ring) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, south, east, north };
}

export interface HotspotsLink {
  href: string;
  from: string;
  to: string;
  /** True when the file covers the box around the selection, not its shape. */
  box: boolean;
  /**
   * True when the selection's box reaches across the 180 degree line, which
   * the route does not take, so only the side holding the selection's middle
   * was asked for. The United States is the case that matters.
   */
  partial: boolean;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayOf(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function widen(box: Bbox): Bbox {
  // The route needs west < east and south < north, which a single drawn line
  // or a one-cell country centre would not give.
  const pad = 0.01;
  return {
    west: Math.max(-180, box.west - pad),
    south: Math.max(-90, box.south - pad),
    east: Math.min(180, box.east + pad),
    north: Math.min(90, box.north + pad),
  };
}

/**
 * The address of the hotspots file for a selection and one year.
 *
 * The caps are the route's own: a point reaches at most 200 km, and one
 * request covers at most 366 days, so the range is a single calendar year cut
 * to the record's first and last day. A country or a drawn area is asked for
 * as the box around it, because the route takes a box and not a shape.
 */
export function hotspotsLink(input: {
  selection: Selection;
  year: number;
  lastDay: string;
  /** The country's own box, from the data set's country index. */
  countryBox?: Bbox | null;
  /** The middle of the country, which decides which side of a wrapped box to ask for. */
  countryLon?: number | null;
}): HotspotsLink | null {
  const { selection, year, lastDay } = input;
  const params = new URLSearchParams();
  let box = false;
  let partial = false;

  if (selection.kind === "point") {
    params.set("lat", String(selection.lat));
    params.set("lon", String(selection.lon));
    params.set("radius_km", String(Math.min(selection.radiusKm, MAX_RADIUS_KM)));
  } else {
    const shape =
      selection.kind === "polygon"
        ? ringBox(selection.ring)
        : (input.countryBox ?? null);
    if (shape === null) return null;
    let wide = widen(shape);
    if (wide.west >= wide.east) {
      // A box reaching across the 180 degree line, which the route refuses.
      // The side holding the country's middle is asked for, and the caller
      // says plainly that the file covers that side only.
      partial = true;
      const middle = input.countryLon ?? 0;
      wide =
        middle < 0
          ? { ...wide, west: -180 }
          : { ...wide, east: 180 };
    }
    params.set(
      "bbox",
      [wide.west, wide.south, wide.east, wide.north]
        .map((value) => String(Number(value.toFixed(4))))
        .join(","),
    );
    box = true;
  }

  const first = dayOf(year, 1, 1);
  const last = dayOf(year, 12, 31);
  const from = first < FIRST_DAY ? FIRST_DAY : first;
  const to = last > lastDay ? lastDay : last;
  if (to < from) return null;
  // One request covers at most MAX_DAYS days; a calendar year never does more,
  // and the check stays here so a future wider range cannot slip through.
  const span =
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
    ) + 1;
  if (span > MAX_DAYS) return null;
  params.set("from", from);
  params.set("to", to);

  return { href: `/api/hotspots?${params.toString()}`, from, to, box, partial };
}

/** The selection in English words, for a CSV comment line. */
export function selectionForCsv(
  selection: Selection,
  countryName?: string | null,
): string {
  if (selection.kind === "country") {
    return `Country ${countryName ?? selection.iso3} (${selection.iso3})`;
  }
  if (selection.kind === "point") {
    const lat = `${Math.abs(selection.lat).toFixed(3)} ${selection.lat < 0 ? "S" : "N"}`;
    const lon = `${Math.abs(selection.lon).toFixed(3)} ${selection.lon < 0 ? "W" : "E"}`;
    return selection.radiusKm > 0
      ? `Point ${lat}, ${lon} within ${selection.radiusKm} km`
      : `Point ${lat}, ${lon}, nearest grid square`;
  }
  const corners = selection.ring.length > 1 ? selection.ring.length - 1 : selection.ring.length;
  const box = ringBox(selection.ring);
  return `Drawn area of ${corners} corners, box west ${box.west.toFixed(3)} south ${box.south.toFixed(3)} east ${box.east.toFixed(3)} north ${box.north.toFixed(3)}`;
}

/** "Nov 2000 to Dec 2025", in English, for a CSV comment line. */
export function rangeForCsv(from: MonthKey, to: MonthKey): string {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${names[from.m - 1]} ${from.y} to ${names[to.m - 1]} ${to.y}`;
}

/** True when every month that has a measurement is 0 (M19's "looked, saw nothing"). */
export function noFireEver(series: Series): boolean {
  let measured = false;
  for (const point of series.months) {
    if (point.value === null) continue;
    measured = true;
    if (point.value > 0) return false;
  }
  return measured;
}

/** The month a monthly card is about, from the series' own months. */
export function resolveMonth(
  series: Series,
  wanted: MonthKey | null,
): MonthKey | null {
  if (wanted !== null) {
    const held = series.months.some(
      (point) => point.y === wanted.y && point.m === wanted.m,
    );
    if (held) return wanted;
  }
  return lastMonthWithData(series);
}

/** The point of one month, or undefined when the series does not hold it. */
export function pointAt(series: Series, month: MonthKey): MonthPoint | undefined {
  return series.months.find(
    (point) => point.y === month.y && point.m === month.m,
  );
}

/** Days in a calendar month. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * The month the record stops inside, when it stops before that month is over.
 * Null when the last day of data is also the last day of its month, so every
 * month of the record is complete.
 */
export function unfinishedMonthOf(lastDataDay: string): MonthKey | null {
  const [y, m, d] = lastDataDay.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return d < daysInMonth(y, m) ? { y, m } : null;
}

/** How many days of the unfinished month the record holds. */
export function daysSoFar(lastDataDay: string): number {
  return Number(lastDataDay.slice(8, 10));
}

/**
 * The last month of the record that is complete. A part month is never the
 * default, because comparing it with whole months reads as a collapse in fire
 * rather than as a month that has not finished.
 */
export function lastCompleteMonth(lastDataDay: string): MonthKey | null {
  const [y, m, d] = lastDataDay.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (d >= daysInMonth(y, m)) return { y, m };
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
