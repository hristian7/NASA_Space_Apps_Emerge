// Plain-words builders. Pure: every figure arrives in the props and every
// phrase arrives through the injected `t`, so the same function serves the
// components and the tests in both languages.

import type { Chance, Unusual, WindowComparison } from "@/types/ui";
import type { Translate } from "../types";
import {
  formatCount,
  formatPercent,
  formatRatio,
  monthLong,
  type ReportLocale,
} from "./format";

/** Compress consecutive comparison years while keeping gaps visible. */
export function formatComparisonYears(years: readonly number[], locale: ReportLocale): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i];
    ranges.push(start === end ? String(start) : `${start} ${locale === "bg" ? "до" : "to"} ${end}`);
  }
  return ranges.join(", ");
}

export interface SentenceContext {
  t: Translate;
  locale: ReportLocale;
}

export interface UnusualText {
  /** One short line, suitable for a card heading. */
  headline: string;
  /** Supporting clauses, already complete sentences or phrases. */
  clauses: string[];
}

/**
 * "Is this unusual?" in words. Follows the shape M5 asks for: the median
 * first, then the average, then the count of past years beaten.
 */
export function unusualText(
  unusual: Unusual,
  month: number,
  { t, locale }: SentenceContext,
): UnusualText {
  const monthName = monthLong(month, locale);

  if (unusual.status === "no_history") {
    return {
      headline: t("unusual.headline.noHistory"),
      clauses: [t("unusual.noHistory", { month: monthName })],
    };
  }

  if (unusual.status === "too_early") {
    return {
      headline: t("unusual.headline.tooEarly"),
      clauses: [t("unusual.tooEarly")],
    };
  }

  const clauses: string[] = [];

  if (unusual.value === 0) {
    clauses.push(t("unusual.noFire", { month: monthName }));
  } else if (unusual.ratioMedian === null && unusual.median === 0) {
    clauses.push(
      t("unusual.medianZero", {
        month: monthName,
        years: formatCount(unusual.years, locale),
      }),
    );
  } else if (unusual.ratioMedian !== null) {
    clauses.push(
      t("unusual.ratioMedian", {
        ratio: formatRatio(unusual.ratioMedian, locale),
        month: monthName,
      }),
    );
  }

  if (unusual.ratioMean !== null && unusual.value !== 0) {
    clauses.push(
      t("unusual.ratioMean", { ratio: formatRatio(unusual.ratioMean, locale) }),
    );
  }

  if (unusual.years > 0) {
    clauses.push(
      t("unusual.higherThan", {
        higher: formatCount(unusual.higherThan, locale),
        years: formatCount(unusual.years, locale),
      }),
    );
  }

  return { headline: t(`unusual.headline.${unusual.status}`), clauses };
}

/** The big figure on the unusual card, or an empty string when there is none. */
export function unusualFigure(
  unusual: Unusual,
  locale: ReportLocale,
): string {
  if (unusual.ratioMedian === null || unusual.value === 0) {
    return formatCount(unusual.value, locale);
  }
  return formatRatio(unusual.ratioMedian, locale);
}

export interface ChanceText {
  figure: string;
  range: string;
  detail: string;
}

/** "Chance of fire this month" in words, with its range. */
export function chanceText(
  chance: Chance,
  month: number,
  { t, locale }: SentenceContext,
): ChanceText {
  const monthName = monthLong(month, locale);

  if (chance.p === null || chance.years === 0) {
    return {
      figure: "",
      range: "",
      detail: t("chance.noHistory", { month: monthName }),
    };
  }

  return {
    figure: formatPercent(chance.p, locale),
    range:
      chance.lo === null || chance.hi === null
        ? ""
        : t("chance.range", {
            lo: formatPercent(chance.lo, locale),
            hi: formatPercent(chance.hi, locale),
          }),
    detail: t("chance.detail", {
      month: monthName,
      fireYears: formatCount(chance.fireYears, locale),
      years: formatCount(chance.years, locale),
    }),
  };
}

/** The rank of the current window among past years, in words. */
export function windowRankText(
  comparison: WindowComparison,
  { t, locale }: SentenceContext,
): string {
  if (comparison.rank === null && comparison.current.hot === null) {
    // No rank because the window itself has no measurement yet, which is a
    // different thing from having no past years to rank it against.
    return t("window.noCurrent", { days: formatCount(comparison.days, locale) });
  }
  if (comparison.rank === null || comparison.of <= 1) {
    return t("window.noPast", { days: formatCount(comparison.days, locale) });
  }
  if (comparison.rank === 1) {
    return t("window.highest", {
      days: formatCount(comparison.days, locale),
      of: formatCount(comparison.of, locale),
    });
  }
  return t("window.rank", {
    rank: formatCount(comparison.rank, locale),
    of: formatCount(comparison.of, locale),
    days: formatCount(comparison.days, locale),
  });
}

/** "estimated" or "measured", from the src label on a month. */
export function isEstimated(src: string | null): boolean {
  return src !== null && src.startsWith("estimated");
}

export function sourceLabel(src: string | null, t: Translate): string {
  if (src === null) {
    return t("source.none");
  }
  if (isEstimated(src)) {
    return t("source.estimated");
  }
  if (src === "provisional") {
    return t("source.provisional");
  }
  return t("source.measured");
}

/**
 * The same label, but with the two kinds of measurement told apart: data the
 * provider still revises, and data measured by the newer satellites and scaled
 * to the reference one. The calendar and the table say which, because a reader
 * comparing this month with last year needs to know.
 */
export function sourceDetail(src: string | null, t: Translate): string {
  if (src === "measured_calibrated") {
    return t("source.calibrated");
  }
  return sourceLabel(src, t);
}
