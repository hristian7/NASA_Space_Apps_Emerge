/**
 * "Is this unusual?" (docs/number-logic.md sections 3 and 4).
 *
 * Section 3 works on a finished month of a monthly series. Section 4 asks the
 * same question of the unfinished month, from daily sums, and adds the
 * too_early rule. Both run through unusualFromHistory.
 */

import type { Series, Unusual } from "../../types/ui";
import { mean, median } from "./numbers";

/** Fewer history years than this gives status no_history (number-logic 3, our choice). */
export const MIN_HISTORY_YEARS = 3;

/** Shortest run of days that may be compared (number-logic 4; NASA warns shorter runs are biased). */
export const MIN_COMPARE_DAYS = 8;

/** Above the median by more than this share is "above". */
const ABOVE_FACTOR = 1.25;

/** Below the median by more than this share is "below". */
const BELOW_FACTOR = 0.75;

function ratio(value: number, denominator: number | null): number | null {
  if (denominator === null || denominator === 0) return null;
  return value / denominator;
}

/**
 * No comparison was possible, so only the current value and the size of the
 * history are reported (number-logic section 9, ruling 4).
 */
function withoutComparison(status: "no_history" | "too_early", value: number | null, years: number): Unusual {
  return {
    status,
    value,
    median: null,
    mean: null,
    ratioMedian: null,
    ratioMean: null,
    higherThan: 0,
    years,
  };
}

/**
 * The core comparison: one value against the same period in past years.
 *
 * `history` holds one number per past year with a measurement, in any order.
 * A null `value` means the period itself has no measurement, so there is
 * nothing to compare and the status is no_history.
 */
export function unusualFromHistory(value: number | null, history: readonly number[]): Unusual {
  const years = history.length;
  if (value === null || years < MIN_HISTORY_YEARS) {
    return withoutComparison("no_history", value, years);
  }

  const med = median(history);
  const avg = mean(history);
  if (med === null) return withoutComparison("no_history", value, years);

  let higherThan = 0;
  for (const past of history) if (past < value) higherThan += 1;

  let status: Unusual["status"];
  if (med === 0) {
    status = value > 0 ? "above" : "near";
  } else if (value > ABOVE_FACTOR * med) {
    status = "above";
  } else if (value < BELOW_FACTOR * med) {
    status = "below";
  } else {
    status = "near";
  }

  return {
    status,
    value,
    median: med,
    mean: avg,
    ratioMedian: ratio(value, med),
    ratioMean: ratio(value, avg),
    higherThan,
    years,
  };
}

/** History for month `m` in every year before `y` that has a measurement. */
export function historyFor(series: Series, y: number, m: number): number[] {
  const history: number[] = [];
  for (const point of series.months) {
    if (point.m !== m || point.y >= y) continue;
    if (point.value === null) continue;
    history.push(point.value);
  }
  return history;
}

/** The value of month `m` of year `y`, or null when the series does not hold it. */
export function valueAt(series: Series, y: number, m: number): number | null {
  for (const point of series.months) {
    if (point.y === y && point.m === m) return point.value;
  }
  return null;
}

/** Section 3: a finished month of a monthly series against the same month in past years. */
export function unusual(series: Series, y: number, m: number): Unusual {
  return unusualFromHistory(valueAt(series, y, m), historyFor(series, y, m));
}

/**
 * Section 4: the unfinished month. `currentValue` is the sum of days 1 to
 * `dayOfMonth` of the current month, `pastValues` the same days of that month
 * in each past year. Under 8 days the comparison is too short to trust, so the
 * status is too_early whatever the numbers say.
 */
export function unusualToDate(
  currentValue: number | null,
  pastValues: readonly number[],
  dayOfMonth: number,
): Unusual {
  if (dayOfMonth < MIN_COMPARE_DAYS) {
    return withoutComparison("too_early", currentValue, pastValues.length);
  }
  return unusualFromHistory(currentValue, pastValues);
}
