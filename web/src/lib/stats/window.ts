/**
 * "This fire vs past fires" (docs/number-logic.md section 6).
 *
 * The windows themselves are built from the daily files by another part of the
 * app. This file ranks them: rank 1 is the highest hot count, ties share the
 * better rank, and a past year with no measurement is left out of the ranking.
 */

import type { WindowComparison, WindowYear } from "../../types/ui";

/** S-NPP starts on 20 Jan 2012, so earlier years are converted MODIS. */
export const FIRST_MEASURED_YEAR = 2012;

/** Section 6: years before 2012 are marked estimated. */
export function isEstimatedYear(year: number): boolean {
  return year < FIRST_MEASURED_YEAR;
}

/**
 * The year that labels a window, which is the year of its last day
 * (number-logic section 9, ruling 6). A window crossing 1 Jan therefore
 * carries the later year.
 */
export function windowYearLabel(endDate: string): number {
  const year = Number(endDate.slice(0, 4));
  if (!Number.isFinite(year)) throw new Error(`a window end needs the form YYYY-MM-DD, not ${endDate}`);
  return year;
}

function normalize(row: WindowYear): WindowYear {
  return {
    year: row.year,
    hot: row.hot,
    frp: row.frp,
    estimated: isEstimatedYear(row.year),
  };
}

/**
 * Rank the current window against the same calendar window in past years.
 *
 * `past` is returned as given (order included), because the chart shows a bar
 * per year and a year with no measurement still has to be shown as no data.
 * Only the ranking and `of` leave the null years out.
 */
export function rankWindow(
  days: number,
  end: string,
  current: WindowYear,
  past: readonly WindowYear[],
): WindowComparison {
  const ranked = past.filter((row) => row.hot !== null);
  const of = ranked.length + 1;

  let rank: number | null = null;
  if (ranked.length > 0 && current.hot !== null) {
    let higher = 0;
    for (const row of ranked) {
      if ((row.hot as number) > current.hot) higher += 1;
    }
    rank = 1 + higher;
  }

  return {
    days,
    end,
    current: normalize(current),
    past: past.map(normalize),
    rank,
    of,
  };
}
