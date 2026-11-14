/**
 * The monthly numbers download (docs/number-logic.md section 8).
 *
 * Columns: year,month,unit,value,low,high,source,flags. Values are rounded to
 * whole numbers, null is an empty field and zero is "0".
 */

import type { Series } from "../../types/ui";
import { headerLines, type CsvHeader } from "./header";
import { csvRow, wholeNumber } from "./text";

/** The column line, in the frozen order. */
export const MONTHLY_COLUMNS = [
  "year",
  "month",
  "unit",
  "value",
  "low",
  "high",
  "source",
  "flags",
] as const;

/** Several flags share one field, joined with a bar (number-logic section 9, ruling 8). */
export const FLAG_SEPARATOR = "|";

/** The monthly CSV for a series, as one string. */
export function monthlyCsv(series: Series, header: CsvHeader): string {
  let out = headerLines(header);
  out += csvRow(MONTHLY_COLUMNS as readonly string[]);
  for (const point of series.months) {
    out += csvRow([
      String(point.y),
      String(point.m),
      series.unit,
      wholeNumber(point.value),
      wholeNumber(point.lo),
      wholeNumber(point.hi),
      point.src ?? "",
      point.flags.join(FLAG_SEPARATOR),
    ]);
  }
  return out;
}
