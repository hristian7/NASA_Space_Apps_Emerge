/**
 * Reading a country's reported-numbers file.
 *
 * A file carries one series per source, and the two kinds are not the same
 * thing: a national report is what a country's own authority counted, and a
 * satellite estimate is burned area somebody mapped from images. The card
 * shows both, each under its own label, and the word "reported" never travels
 * with an estimate. Nothing is computed here beyond sorting and picking the
 * latest year.
 */

import type {
  ReportedFile,
  ReportedKind,
  ReportedSeries,
  ReportedYear,
} from "../../types/data";

export interface SeriesView {
  kind: ReportedKind;
  /** The agency or publication behind this series. */
  name: string;
  url: string | null;
  fetched: string | null;
  note: string | null;
  /** Years with at least one figure, newest first. */
  years: ReportedYear[];
  /** The newest year that has a figure. */
  latest: ReportedYear | null;
  /** First and last year with a figure, which can be narrower than `covers`. */
  span: [number, number] | null;
  /** True when the series holds a single year, which is worth saying. */
  oneYear: boolean;
}

function hasFigure(year: ReportedYear): boolean {
  return year.fires !== null || year.burned_ha !== null;
}

function viewOf(series: ReportedSeries): SeriesView {
  const years = series.years.filter(hasFigure).sort((a, b) => b.y - a.y);
  const span: [number, number] | null =
    years.length === 0 ? null : [years[years.length - 1].y, years[0].y];
  return {
    kind: series.kind,
    name: series.source.name,
    url: series.source.url,
    fetched: series.source.fetched,
    note: series.source.note,
    years,
    latest: years[0] ?? null,
    span,
    oneYear: years.length === 1,
  };
}

/**
 * Every series in the file, the primary one first. A file written to the older
 * schema carries one series in its top-level fields, so it reads the same way.
 */
export function seriesViews(file: ReportedFile): SeriesView[] {
  const list: ReportedSeries[] =
    file.series !== undefined && file.series.length > 0
      ? file.series
      : [
          {
            kind: file.kind ?? "national_report",
            source: file.source,
            years: file.years,
          },
        ];
  return list.map(viewOf).filter((view) => view.years.length > 0);
}

/** True when any series in the file is a national report. */
export function hasNationalReport(file: ReportedFile): boolean {
  return seriesViews(file).some((view) => view.kind === "national_report");
}

/** The years both a series and our own record hold, newest first. */
export function sharedYears(
  view: SeriesView,
  ours: { y: number }[],
): number[] {
  const mine = new Set(ours.map((row) => row.y));
  return view.years.filter((row) => mine.has(row.y)).map((row) => row.y);
}
