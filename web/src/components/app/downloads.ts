/**
 * The CSV downloads, built by web/src/lib/csv and saved as files.
 *
 * The comment lines are English in every language, because a downloaded file
 * travels further than the page it came from and its columns are English too.
 * The names of the sources come from the data set's own meta.json, so a new
 * source appears in every file without a change here.
 */

import type { MetaFile } from "@/types/data";
import type { Chance, Extremes, Selection, Series, Trend, Unusual } from "@/types/ui";
import type { MonthKey } from "@/components/report/types";
import { monthlyCsv, summaryCsv, type CsvHeader } from "@/lib/csv";
import { rangeForCsv, selectionForCsv } from "./adapter";
import countryNamesEn from "../../../messages/country.en.json";

const names = countryNamesEn as Record<string, string>;

export interface HeaderInput {
  selection: Selection;
  meta: MetaFile;
  from: MonthKey;
  to: MonthKey;
  title: string;
  notices?: string[];
}

export function csvHeader(input: HeaderInput): CsvHeader {
  const countryName =
    input.selection.kind === "country" ? names[input.selection.iso3] : null;
  return {
    title: input.title,
    selection: selectionForCsv(input.selection, countryName),
    dateRange: rangeForCsv(input.from, input.to),
    dataDate: input.meta.last_data_day,
    sources: input.meta.sources.map((source) => source.name),
    notices: input.notices,
  };
}

export function monthlyFile(series: Series, header: CsvHeader): string {
  return monthlyCsv(series, header);
}

export function summaryFile(
  figures: { extremes: Extremes; trend: Trend; unusual: Unusual; chance: Chance },
  header: CsvHeader,
): string {
  return summaryCsv(figures, header);
}

/** A file name with no spaces or punctuation a file system dislikes. */
export function csvFilename(parts: string[]): string {
  const stem = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${stem === "" ? "emerge" : stem}.csv`;
}

/** Hands the text to the browser as a file. */
export function saveText(text: string, filename: string, type = "text/csv"): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const address = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = address;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(address);
  }
}
