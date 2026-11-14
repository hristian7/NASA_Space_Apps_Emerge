"use client";

import { useMemo, type Ref } from "react";
import { useTranslations } from "next-intl";
import type { Trend } from "@/types/ui";
import type { YearTotal } from "./types";
import { formatCount, type ReportLocale } from "./lib/format";
import styles from "./styles";

const W = 386;
const H = 136;
const PAD_L = 34;
const PAD_R = 6;
const PAD_T = 8;
const PAD_B = 18;

export interface TrendChartProps {
  years: YearTotal[];
  trend: Trend;
  locale: ReportLocale;
  unitShortKey?: "cd" | "hot";
  svgRef?: Ref<SVGSVGElement>;
}

/** Yearly totals, measured against estimated, with the ranges as bands. */
export default function TrendChart({
  years,
  trend,
  locale,
  unitShortKey = "cd",
  svgRef,
}: TrendChartProps) {
  const t = useTranslations("report");
  const unit = t(`unit.${unitShortKey}.short`);

  const drawn = useMemo(
    () => years.filter((year) => year.value !== null),
    [years],
  );

  const geometry = useMemo(() => {
    if (drawn.length === 0) {
      return null;
    }
    const firstYear = drawn[0].y;
    const lastYear = drawn[drawn.length - 1].y;
    const span = Math.max(1, lastYear - firstYear);
    const top = Math.max(
      1,
      ...drawn.map((year) => Math.max(year.value ?? 0, year.hi ?? 0)),
    );
    const x = (year: number) =>
      PAD_L + ((year - firstYear) / span) * (W - PAD_L - PAD_R);
    const y = (value: number) =>
      PAD_T + (1 - value / top) * (H - PAD_T - PAD_B);
    return { firstYear, lastYear, top, x, y };
  }, [drawn]);

  if (geometry === null) {
    return (
      <section className={styles.section} aria-labelledby="report-trend-chart">
        <h2 className={styles.heading} id="report-trend-chart">
          {t("trend.heading")}
        </h2>
        <p className={styles.cardLine}>{t("trend.noYears")}</p>
      </section>
    );
  }

  const { firstYear, lastYear, top, x, y } = geometry;

  const bandTop = drawn
    .map((year) => `${x(year.y)},${y(year.hi ?? year.value ?? 0)}`)
    .join(" ");
  const bandBottom = drawn
    .slice()
    .reverse()
    .map((year) => `${x(year.y)},${y(year.lo ?? year.value ?? 0)}`)
    .join(" ");

  const segments: { estimated: boolean; points: string }[] = [];
  for (let i = 1; i < drawn.length; i += 1) {
    const from = drawn[i - 1];
    const to = drawn[i];
    segments.push({
      estimated: from.estimated || to.estimated,
      points: `${x(from.y)},${y(from.value ?? 0)} ${x(to.y)},${y(to.value ?? 0)}`,
    });
  }

  const summary = t("trend.summary", {
    first: firstYear,
    last: lastYear,
    max: formatCount(top, locale),
    unit,
    years: formatCount(trend.years, locale),
  });

  return (
    <section className={styles.section} aria-labelledby="report-trend-chart">
      <h2 className={styles.heading} id="report-trend-chart">
        {t("trend.heading")}
      </h2>
      <svg
        ref={svgRef}
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
      >
        <title>{summary}</title>
        <line
          className={styles.axis}
          x1={PAD_L}
          y1={H - PAD_B}
          x2={W - PAD_R}
          y2={H - PAD_B}
        />
        <line
          className={styles.axis}
          x1={PAD_L}
          y1={PAD_T}
          x2={PAD_L}
          y2={H - PAD_B}
        />
        <polygon className={styles.band} points={`${bandTop} ${bandBottom}`} />
        {segments.map((segment) => (
          <polyline
            key={segment.points}
            className={segment.estimated ? styles.lineEstimated : styles.line}
            points={segment.points}
          />
        ))}
        {drawn.map((year) => (
          <circle
            key={year.y}
            className={year.estimated ? styles.estimatedMark : styles.dot}
            cx={x(year.y)}
            cy={y(year.value ?? 0)}
            r={year.estimated ? 1.6 : 2}
          >
            <title>
              {`${year.y}: ${formatCount(year.value, locale)} ${unit}`}
            </title>
          </circle>
        ))}
        <text x={PAD_L - 4} y={PAD_T + 4} textAnchor="end">
          {formatCount(top, locale)}
        </text>
        <text x={PAD_L - 4} y={H - PAD_B} textAnchor="end">
          0
        </text>
        <text x={PAD_L} y={H - 6}>
          {firstYear}
        </text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end">
          {lastYear}
        </text>
      </svg>
      <p className={styles.sub}>{t("trend.lineKey")}</p>
    </section>
  );
}
