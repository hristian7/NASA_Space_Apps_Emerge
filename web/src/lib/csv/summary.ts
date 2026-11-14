/**
 * The analytics summary download (docs/number-logic.md section 8).
 *
 * Columns: key,value. One row per figure: the worst month, the worst year, the
 * trend per decade, this month's status and ratios, and the chance of fire
 * with its range. A figure that does not exist leaves its value empty.
 */

import type { Chance, Extremes, Trend, Unusual } from "../../types/ui";
import { headerLines, type CsvHeader } from "./header";
import { csvRow, decimalNumber, wholeNumber } from "./text";

/** The column line, in the frozen order. */
export const SUMMARY_COLUMNS = ["key", "value"] as const;

export interface SummaryFigures {
  extremes: Extremes;
  trend: Trend;
  unusual: Unusual;
  chance: Chance;
}

/** A month as "YYYY-MM", with the month zero padded. */
function monthKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Every summary row, in order, as key and value pairs. */
export function summaryRows(figures: SummaryFigures): [string, string][] {
  const { extremes, trend, unusual, chance } = figures;
  const worstMonth = extremes.worstMonth;
  const worstYear = extremes.worstYear;
  return [
    ["worst_month", worstMonth ? monthKey(worstMonth.y, worstMonth.m) : ""],
    ["worst_month_value", worstMonth ? wholeNumber(worstMonth.value) : ""],
    ["worst_year", worstYear ? String(worstYear.y) : ""],
    ["worst_year_value", worstYear ? wholeNumber(worstYear.value) : ""],
    ["trend_per_decade_share", decimalNumber(trend.perDecadeShare)],
    ["unusual_status", unusual.status],
    ["unusual_ratio_median", decimalNumber(unusual.ratioMedian)],
    ["unusual_ratio_mean", decimalNumber(unusual.ratioMean)],
    ["chance_of_fire", decimalNumber(chance.p)],
    ["chance_of_fire_low", decimalNumber(chance.lo)],
    ["chance_of_fire_high", decimalNumber(chance.hi)],
  ];
}

/** The summary CSV, as one string. */
export function summaryCsv(figures: SummaryFigures, header: CsvHeader): string {
  let out = headerLines(header);
  out += csvRow(SUMMARY_COLUMNS as readonly string[]);
  for (const [key, value] of summaryRows(figures)) out += csvRow([key, value]);
  return out;
}
