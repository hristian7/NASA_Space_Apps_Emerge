/**
 * The comment lines every download starts with (docs/number-logic.md section 8):
 * the title, the selection in words, the date range, the data date, the
 * sources, and the legend line.
 *
 * The rules fix which lines appear and their order, not their wording, so the
 * wording lives here in one place. A caller that needs exact text (a test with
 * expected answers, or a translated download) passes `lines` instead.
 */

import { commentLine } from "./text";

/** The line the rules require word for word. */
export const LEGEND_LINE = "empty = no measurement, 0 = no fire seen";

export interface CsvHeader {
  /** First comment line, for example "Emerge: monthly fire history". */
  title: string;
  /** The selection in words, for example "Point 42.70 N, 23.32 E within 50 km". */
  selection: string;
  /** The date range in words, for example "Nov 2000 to Oct 2026". */
  dateRange: string;
  /** The last day of satellite data, for example "2026-11-14". */
  dataDate: string;
  /** One entry per source, joined into a single line. */
  sources: readonly string[];
  /** Extra lines after the sources, for example a notice that rows were cut. */
  notices?: readonly string[];
  /** Exact comment lines. When given, every field above is ignored. */
  lines?: readonly string[];
}

/** The comment block, each line already prefixed with "# " and ended with "\n". */
export function headerLines(header: CsvHeader): string {
  if (header.lines) return header.lines.map(commentLine).join("");
  const lines = [
    header.title,
    `Selection: ${header.selection}`,
    `Dates: ${header.dateRange}`,
    `Data date: ${header.dataDate}`,
    `Sources: ${header.sources.join("; ")}`,
    ...(header.notices ?? []),
    LEGEND_LINE,
  ];
  return lines.map(commentLine).join("");
}
