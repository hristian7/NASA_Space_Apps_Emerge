"use client";

import { useId, useMemo, useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import type { MonthPoint, Series } from "@/types/ui";
import type { AnomalyPoint, MonthKey, UnitMode, YearTotal } from "./types";
import {
  monthIndex,
  monthKey,
  yearTotalsFromSeries,
  yearsOf,
} from "./lib/aggregate";
import {
  anomalyToken,
  cellKind,
  rampStep,
  rampThresholds,
  rampToken,
} from "./lib/color-scale";
import {
  formatCount,
  formatRatio,
  monthInitial,
  monthYearLong,
  type ReportLocale,
} from "./lib/format";
import { isEstimated, sourceLabel } from "./lib/sentences";
import styles from "./report.module.css";

const LABEL_W = 28;
const CELL_W = 23;
const CELL_H = 12;
const STEP_X = 25;
const STEP_Y = 15;
const HEADER_H = 14;
const TOTAL_W = 58;
const GRID_W = LABEL_W + 12 * STEP_X + TOTAL_W;

export interface FireCalendarProps {
  series: Series;
  locale: ReportLocale;
  /** "anomaly" recolours the same months from the ratios in `anomaly`. */
  mode: UnitMode;
  anomaly?: AnomalyPoint[];
  selected?: MonthKey | null;
  onSelect?: (month: MonthKey) => void;
  /** Year totals from the number logic. Summed from the months when absent. */
  yearTotals?: YearTotal[];
  /** The accessible name of the grid. */
  label?: string;
  svgRef?: Ref<SVGSVGElement>;
}

interface HoverState {
  y: number;
  m: number;
  x: number;
  row: number;
}

export default function FireCalendar({
  series,
  locale,
  mode,
  anomaly,
  selected = null,
  onSelect,
  yearTotals,
  label,
  svgRef,
}: FireCalendarProps) {
  const t = useTranslations("report");
  const patternId = `${useId()}-hatch`;
  const [hover, setHover] = useState<HoverState | null>(null);

  const years = useMemo(() => yearsOf(series.months), [series.months]);
  const index = useMemo(() => monthIndex(series.months), [series.months]);
  const thresholds = useMemo(
    () => rampThresholds(series.months.map((month) => month.value)),
    [series.months],
  );
  const ratios = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const point of anomaly ?? []) {
      map.set(monthKey(point.y, point.m), point.ratio);
    }
    return map;
  }, [anomaly]);
  const totals = useMemo(
    () => yearTotals ?? yearTotalsFromSeries(series),
    [yearTotals, series],
  );
  const totalByYear = useMemo(() => {
    const map = new Map<number, YearTotal>();
    for (const total of totals) {
      map.set(total.y, total);
    }
    return map;
  }, [totals]);
  const maxTotal = useMemo(
    () =>
      Math.max(
        1,
        ...totals.map((total) => (total.value === null ? 0 : total.value)),
      ),
    [totals],
  );

  const height = HEADER_H + years.length * STEP_Y;
  const unitName = t(`unit.${mode === "anomaly" ? series.unit : mode}.short`);

  function fillFor(month: MonthPoint | undefined): string | null {
    if (month === undefined) {
      return null;
    }
    const kind = cellKind(month.value);
    if (kind === "nodata") {
      return null;
    }
    if (mode === "anomaly") {
      const ratio = ratios.get(monthKey(month.y, month.m)) ?? null;
      return anomalyToken(ratio) ?? "var(--empty)";
    }
    return rampToken(kind, rampStep(month.value ?? 0, thresholds));
  }

  function cellTitle(y: number, m: number, month: MonthPoint | undefined) {
    const when = monthYearLong(y, m, locale);
    if (month === undefined || month.value === null) {
      return `${when}: ${t("calendar.noData")}`;
    }
    const ratio = ratios.get(monthKey(y, m));
    const anomalyPart =
      mode === "anomaly" && ratio !== null && ratio !== undefined
        ? `, ${t("calendar.timesMedian", { ratio: formatRatio(ratio, locale) })}`
        : "";
    return `${when}: ${formatCount(month.value, locale)} ${unitName}${anomalyPart}, ${sourceLabel(month.src, t)}`;
  }

  function move(fromY: number, fromM: number, dy: number, dm: number) {
    const yearAt = years.indexOf(fromY) + dy;
    const month = fromM + dm;
    if (yearAt < 0 || yearAt >= years.length || month < 1 || month > 12) {
      return;
    }
    onSelect?.({ y: years[yearAt], m: month });
  }

  const hovered =
    hover === null ? undefined : index.get(monthKey(hover.y, hover.m));

  return (
    <div className={styles.calendarWrap}>
      <svg
        ref={svgRef}
        className={styles.calendar}
        viewBox={`0 0 ${GRID_W} ${height}`}
        role="grid"
        aria-label={label ?? t("calendar.label")}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern
            id={patternId}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line className={styles.hatchLine} x1="0" y1="0" x2="0" y2="4" />
          </pattern>
        </defs>

        <g role="row">
          {Array.from({ length: 12 }, (_, i) => (
            <text
              key={i}
              className={styles.monthHead}
              role="columnheader"
              x={LABEL_W + i * STEP_X + CELL_W / 2}
              y={HEADER_H - 5}
              textAnchor="middle"
            >
              {monthInitial(i + 1, locale)}
            </text>
          ))}
          <text
            className={styles.monthHead}
            role="columnheader"
            x={LABEL_W + 12 * STEP_X}
            y={HEADER_H - 5}
          >
            {t("calendar.yearTotal")}
          </text>
        </g>

        {years.map((year, row) => {
          const top = HEADER_H + row * STEP_Y;
          const total = totalByYear.get(year);
          const rowEstimated = total?.estimated === true;
          return (
            <g key={year} role="row">
              <text
                className={`${styles.yearHead} ${rowEstimated ? styles.yearHeadEstimated : ""}`}
                role="rowheader"
                x={rowEstimated ? 6 : 2}
                y={top + CELL_H - 2}
              >
                {year}
              </text>
              {rowEstimated ? (
                <rect
                  className={styles.estimatedMark}
                  x={0}
                  y={top}
                  width={2}
                  height={CELL_H}
                />
              ) : null}

              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const month = index.get(monthKey(year, m));
                const x = LABEL_W + i * STEP_X;
                const fill = fillFor(month);
                const kind = cellKind(month?.value ?? null);
                const estimated = isEstimated(month?.src ?? null);
                const isSelected =
                  selected !== null &&
                  selected.y === year &&
                  selected.m === m;
                const title = cellTitle(year, m, month);
                const focusable =
                  selected === null
                    ? row === 0 && m === 1
                    : isSelected;
                return (
                  <g key={m}>
                    {fill === null ? (
                      <>
                        <rect
                          className={styles.cellNoData}
                          x={x + 0.5}
                          y={top + 0.5}
                          width={CELL_W - 1}
                          height={CELL_H - 1}
                        />
                        <line
                          className={styles.cellNoDataSlash}
                          x1={x + 2}
                          y1={top + CELL_H - 2}
                          x2={x + CELL_W - 2}
                          y2={top + 2}
                        />
                      </>
                    ) : (
                      <rect
                        x={x}
                        y={top}
                        width={CELL_W}
                        height={CELL_H}
                        style={{ fill }}
                        className={kind === "zero" ? styles.cellZero : ""}
                      />
                    )}
                    {estimated && fill !== null ? (
                      <rect
                        className={styles.cellHatch}
                        x={x}
                        y={top}
                        width={CELL_W}
                        height={CELL_H}
                        fill={`url(#${patternId})`}
                      />
                    ) : null}
                    {isSelected ? (
                      <rect
                        className={styles.cellSelected}
                        x={x + 1}
                        y={top + 1}
                        width={CELL_W - 2}
                        height={CELL_H - 2}
                      />
                    ) : null}
                    <rect
                      className={styles.cell}
                      role="gridcell"
                      aria-label={title}
                      aria-selected={isSelected}
                      tabIndex={focusable ? 0 : -1}
                      x={x}
                      y={top}
                      width={CELL_W}
                      height={CELL_H}
                      fill="transparent"
                      onClick={() => onSelect?.({ y: year, m })}
                      onFocus={() => setHover({ y: year, m, x, row })}
                      onBlur={() => setHover(null)}
                      onMouseEnter={() => setHover({ y: year, m, x, row })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect?.({ y: year, m });
                        } else if (event.key === "ArrowRight") {
                          event.preventDefault();
                          move(year, m, 0, 1);
                        } else if (event.key === "ArrowLeft") {
                          event.preventDefault();
                          move(year, m, 0, -1);
                        } else if (event.key === "ArrowDown") {
                          event.preventDefault();
                          move(year, m, 1, 0);
                        } else if (event.key === "ArrowUp") {
                          event.preventDefault();
                          move(year, m, -1, 0);
                        }
                      }}
                    >
                      <title>{title}</title>
                    </rect>
                  </g>
                );
              })}

              <rect
                className={styles.totalTrack}
                x={LABEL_W + 12 * STEP_X}
                y={top + 3}
                width={26}
                height={CELL_H - 6}
              />
              <rect
                className={
                  selected !== null && selected.y === year
                    ? styles.totalSelected
                    : styles.total
                }
                x={LABEL_W + 12 * STEP_X}
                y={top + 3}
                width={
                  total?.value === null || total === undefined
                    ? 0
                    : Math.max(1, (total.value / maxTotal) * 26)
                }
                height={CELL_H - 6}
              />
              <text
                className={styles.yearHead}
                x={GRID_W}
                y={top + CELL_H - 2}
                textAnchor="end"
              >
                {total === undefined || total.value === null
                  ? "-"
                  : formatCount(total.value, locale)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null ? (
        <div
          className={styles.tip}
          style={{
            left: `${((hover.x + CELL_W / 2) / GRID_W) * 100}%`,
            top: `${((HEADER_H + hover.row * STEP_Y + CELL_H + 4) / height) * 100}%`,
            transform:
              hover.x > GRID_W / 2 ? "translateX(-100%)" : "translateX(-12px)",
          }}
          role="status"
        >
          <span className={styles.tipTitle}>
            {monthYearLong(hover.y, hover.m, locale)}
          </span>
          {hovered === undefined || hovered.value === null ? (
            <span className={styles.tipRow}>{t("calendar.noData")}</span>
          ) : (
            <>
              <span className={`${styles.tipRow} ${styles.num}`}>
                {formatCount(hovered.value, locale)} {unitName}
              </span>
              <span className={`${styles.tipRow} ${styles.num}`}>
                {hovered.lo === null || hovered.hi === null
                  ? t("calendar.noRange")
                  : t("calendar.range", {
                      lo: formatCount(hovered.lo, locale),
                      hi: formatCount(hovered.hi, locale),
                    })}
              </span>
              {mode === "anomaly" ? (
                <span className={`${styles.tipRow} ${styles.num}`}>
                  {(() => {
                    const ratio = ratios.get(monthKey(hover.y, hover.m));
                    return ratio === null || ratio === undefined
                      ? t("calendar.noComparison")
                      : t("calendar.timesMedian", {
                          ratio: formatRatio(ratio, locale),
                        });
                  })()}
                </span>
              ) : null}
              <span className={styles.tipRow}>
                {sourceLabel(hovered.src, t)}
              </span>
            </>
          )}
        </div>
      ) : null}

      <CalendarLegend
        mode={mode}
        thresholds={thresholds}
        locale={locale}
      />
    </div>
  );
}

function CalendarLegend({
  mode,
  thresholds,
  locale,
}: {
  mode: UnitMode;
  thresholds: number[];
  locale: ReportLocale;
}) {
  const t = useTranslations("report");

  const steps =
    mode === "anomaly"
      ? [0, 1, 2, 3, 4, 5].map((i) => `var(--anom-${i})`)
      : [0, 1, 2, 3].map((i) => `var(--ramp-${i})`);

  const stepText =
    mode === "anomaly"
      ? t("legend.anomalySteps")
      : t("legend.rampSteps", {
          first: `1 - ${formatCount(thresholds[0] - 1, locale)}`,
          second: `${formatCount(thresholds[0], locale)} - ${formatCount(thresholds[1] - 1, locale)}`,
          third: `${formatCount(thresholds[1], locale)} - ${formatCount(thresholds[2] - 1, locale)}`,
          fourth: formatCount(thresholds[2], locale),
        });

  return (
    <>
      <div className={styles.legend}>
        <span className={styles.legendKey}>
          <span>{mode === "anomaly" ? t("legend.below") : t("legend.less")}</span>
          <span className={styles.legendSteps}>
            {steps.map((token) => (
              <span
                key={token}
                className={styles.legendSwatch}
                style={{ background: token }}
              />
            ))}
          </span>
          <span>{mode === "anomaly" ? t("legend.above") : t("legend.more")}</span>
        </span>
        <span className={styles.legendKey}>
          <span
            className={`${styles.legendSwatch} ${styles.legendSwatchZero}`}
          />
          <span>{t("legend.zero")}</span>
        </span>
        <span className={styles.legendKey}>
          <span
            className={`${styles.legendSwatch} ${styles.legendSwatchNoData}`}
          />
          <span>{t("legend.noData")}</span>
        </span>
        <span className={styles.legendKey}>
          <span
            className={`${styles.legendSwatch} ${styles.legendSwatchEstimated}`}
          />
          <span>{t("legend.estimated")}</span>
        </span>
      </div>
      <p className={styles.sub}>{stepText}</p>
    </>
  );
}
