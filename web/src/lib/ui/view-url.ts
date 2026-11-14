/**
 * The rest of the view in the address bar, beside the selection's own `sel`.
 *
 *   u=cd                what the numbers count: cd, hot, sat or anomaly
 *   mo=2024-08          the month the two monthly cards follow
 *   from=2012-02        first month of the date range
 *   to=2025-12          last month of the date range
 *
 * Together with `sel` these four restore the whole view, so a copied link
 * opens what the sender saw. Anything unreadable decodes to null and the view
 * falls back to its default, as a hand-edited link should.
 */

import type { MonthKey, UnitMode } from "../../components/report/types";
import { DEFAULT_UNIT_MODE, UNIT_MODES } from "../../components/report/lib/constants";
import { removeQueryParam, setQueryParam } from "./query";

export const unitParam = "u";
export const monthParam = "mo";
export const fromParam = "from";
export const toParam = "to";

export interface ViewState {
  unit: UnitMode;
  /** null means "the last month that has data". */
  month: MonthKey | null;
  /** null means "the first month of the record". */
  from: MonthKey | null;
  /** null means "the last month of the record". */
  to: MonthKey | null;
}

export const defaultView: ViewState = {
  unit: DEFAULT_UNIT_MODE,
  month: null,
  from: null,
  to: null,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "2024-08". */
export function encodeMonth(month: MonthKey): string {
  return `${month.y}-${pad2(month.m)}`;
}

export function decodeMonth(value: string | null | undefined): MonthKey | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  if (match === null) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (y < 1900 || y > 2999 || m < 1 || m > 12) return null;
  return { y, m };
}

export function decodeUnit(value: string | null | undefined): UnitMode | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return UNIT_MODES.includes(text as UnitMode) ? (text as UnitMode) : null;
}

export function decodeView(search: string): ViewState {
  const params = new URLSearchParams(search);
  return {
    unit: decodeUnit(params.get(unitParam)) ?? defaultView.unit,
    month: decodeMonth(params.get(monthParam)),
    from: decodeMonth(params.get(fromParam)),
    to: decodeMonth(params.get(toParam)),
  };
}

/**
 * Writes the four parameters into a query string, keeping everything else
 * (the selection and the look) exactly as typed. A value that is the default
 * is dropped rather than written, so a plain link stays short.
 */
export function viewSearch(search: string, view: ViewState): string {
  let out = search;
  out =
    view.unit === defaultView.unit
      ? removeQueryParam(out, unitParam)
      : setQueryParam(out, unitParam, view.unit);
  for (const [key, month] of [
    [monthParam, view.month],
    [fromParam, view.from],
    [toParam, view.to],
  ] as [string, MonthKey | null][]) {
    out =
      month === null
        ? removeQueryParam(out, key)
        : setQueryParam(out, key, encodeMonth(month));
  }
  return out;
}
