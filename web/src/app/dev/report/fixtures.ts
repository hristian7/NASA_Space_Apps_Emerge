/**
 * FIXTURES. Hand-written props, not real figures: they exist so every state of
 * every report component can be looked at. Nothing here is a measurement and
 * nothing outside this dev folder may import it.
 */

import type {
  Chance,
  Extremes,
  MonthPoint,
  Series,
  Trend,
  Unusual,
  WindowComparison,
} from "@/types/ui";
import type { AnomalyPoint } from "@/components/report/types";

export const unusualAbove: Unusual = {
  status: "above",
  value: 1860,
  median: 886,
  mean: 1033,
  ratioMedian: 2.1,
  ratioMean: 1.8,
  higherThan: 23,
  years: 25,
};

export const unusualNear: Unusual = {
  status: "near",
  value: 910,
  median: 886,
  mean: 1033,
  ratioMedian: 1.03,
  ratioMean: 0.88,
  higherThan: 13,
  years: 25,
};

export const unusualBelow: Unusual = {
  status: "below",
  value: 240,
  median: 886,
  mean: 1033,
  ratioMedian: 0.27,
  ratioMean: 0.23,
  higherThan: 2,
  years: 25,
};

export const unusualNoHistory: Unusual = {
  status: "no_history",
  value: 12,
  median: null,
  mean: null,
  ratioMedian: null,
  ratioMean: null,
  higherThan: 0,
  years: 2,
};

export const unusualTooEarly: Unusual = {
  status: "too_early",
  value: 31,
  median: null,
  mean: null,
  ratioMedian: null,
  ratioMean: null,
  higherThan: 0,
  years: 25,
};

export const unusualMedianZero: Unusual = {
  status: "above",
  value: 44,
  median: 0,
  mean: 1.8,
  ratioMedian: null,
  ratioMean: 24.4,
  higherThan: 24,
  years: 25,
};

export const chanceSmallArea: Chance = {
  p: 0.72,
  lo: 0.54,
  hi: 0.86,
  fireYears: 18,
  years: 25,
};

export const chanceLargeArea: Chance = {
  p: 1,
  lo: 0.88,
  hi: 1,
  fireYears: 25,
  years: 25,
};

export const chanceNoHistory: Chance = {
  p: null,
  lo: null,
  hi: null,
  fireYears: 0,
  years: 0,
};

export const expectedFireDaysLargeArea = 1340;

export const windowComparison: WindowComparison = {
  days: 8,
  end: "2026-11-14",
  current: { year: 2026, hot: 412, frp: 3180, estimated: false },
  past: [
    { year: 2025, hot: 268, frp: 2010, estimated: false },
    { year: 2024, hot: 517, frp: 4420, estimated: false },
    { year: 2023, hot: 180, frp: 1290, estimated: false },
    { year: 2022, hot: 96, frp: 740, estimated: false },
    { year: 2021, hot: 342, frp: 2660, estimated: false },
    { year: 2020, hot: null, frp: null, estimated: false },
    { year: 2019, hot: 221, frp: 1610, estimated: false },
    { year: 2018, hot: 134, frp: 1020, estimated: false },
    { year: 2011, hot: 288, frp: 2140, estimated: true },
    { year: 2010, hot: 151, frp: 1180, estimated: true },
    { year: 2009, hot: 402, frp: 3040, estimated: true },
  ],
  rank: 2,
  of: 11,
};

export const windowNoPast: WindowComparison = {
  days: 8,
  end: "2026-11-14",
  current: { year: 2026, hot: 9, frp: 60, estimated: false },
  past: [],
  rank: null,
  of: 1,
};

export const trend: Trend = {
  slopePerYear: 41.6,
  perDecadeShare: 0.18,
  years: 24,
};

export const trendTooShort: Trend = {
  slopePerYear: null,
  perDecadeShare: null,
  years: 3,
};

export const extremes: Extremes = {
  worstMonth: { y: 2007, m: 7, value: 6904 },
  worstYear: { y: 2007, value: 21480 },
};

export const extremesEmpty: Extremes = {
  worstMonth: null,
  worstYear: null,
};

/**
 * A short series that holds every case M19 separates: a month with no
 * measurement at all, a month that was looked at and had no fire, estimated
 * months and measured months.
 */
const edgeMonths: MonthPoint[] = [
  { y: 2010, m: 1, value: null, lo: null, hi: null, src: null, flags: [] },
  { y: 2010, m: 2, value: 0, lo: 0, hi: 0, src: "estimated_modis", flags: [] },
  { y: 2010, m: 3, value: 12, lo: 8, hi: 19, src: "estimated_modis", flags: [] },
  { y: 2010, m: 4, value: 48, lo: 33, hi: 70, src: "estimated_modis", flags: [] },
  { y: 2010, m: 5, value: 140, lo: 98, hi: 196, src: "estimated_terra", flags: [] },
  { y: 2010, m: 6, value: null, lo: null, hi: null, src: null, flags: [] },
  { y: 2010, m: 7, value: 610, lo: 427, hi: 854, src: "estimated_modis", flags: [] },
  { y: 2010, m: 8, value: 980, lo: 686, hi: 1372, src: "estimated_modis", flags: [] },
  { y: 2010, m: 9, value: 320, lo: 224, hi: 448, src: "estimated_modis", flags: [] },
  { y: 2010, m: 10, value: 85, lo: 60, hi: 119, src: "estimated_modis", flags: [] },
  { y: 2010, m: 11, value: 0, lo: 0, hi: 0, src: "estimated_modis", flags: [] },
  { y: 2010, m: 12, value: 4, lo: 3, hi: 6, src: "estimated_modis", flags: [] },
  { y: 2011, m: 1, value: 2, lo: 1, hi: 3, src: "estimated_modis", flags: [] },
  { y: 2011, m: 2, value: 0, lo: 0, hi: 0, src: "estimated_modis", flags: [] },
  { y: 2011, m: 3, value: 26, lo: 18, hi: 36, src: "estimated_modis", flags: [] },
  { y: 2011, m: 4, value: 92, lo: 64, hi: 129, src: "estimated_modis", flags: [] },
  { y: 2011, m: 5, value: 210, lo: 147, hi: 294, src: "estimated_modis", flags: [] },
  { y: 2011, m: 6, value: 430, lo: 301, hi: 602, src: "estimated_modis", flags: [] },
  { y: 2011, m: 7, value: 1240, lo: 868, hi: 1736, src: "estimated_modis", flags: [] },
  { y: 2011, m: 8, value: 1810, lo: 1267, hi: 2534, src: "estimated_modis", flags: [] },
  { y: 2011, m: 9, value: 540, lo: 378, hi: 756, src: "estimated_modis", flags: [] },
  { y: 2011, m: 10, value: 110, lo: 77, hi: 154, src: "estimated_modis", flags: [] },
  { y: 2011, m: 11, value: 6, lo: 4, hi: 8, src: "estimated_modis", flags: [] },
  { y: 2011, m: 12, value: 0, lo: 0, hi: 0, src: "estimated_modis", flags: [] },
  { y: 2012, m: 1, value: 3, lo: 3, hi: 3, src: "estimated_modis", flags: [] },
  { y: 2012, m: 2, value: 9, lo: 9, hi: 9, src: "measured", flags: [] },
  { y: 2012, m: 3, value: 31, lo: 31, hi: 31, src: "measured", flags: [] },
  { y: 2012, m: 4, value: 104, lo: 104, hi: 104, src: "measured", flags: [] },
  { y: 2012, m: 5, value: 268, lo: 268, hi: 268, src: "measured", flags: [] },
  { y: 2012, m: 6, value: 512, lo: 512, hi: 512, src: "measured", flags: [] },
  { y: 2012, m: 7, value: 1480, lo: 1480, hi: 1480, src: "measured", flags: [] },
  { y: 2012, m: 8, value: 2130, lo: 2130, hi: 2130, src: "measured", flags: [] },
  { y: 2012, m: 9, value: 660, lo: 660, hi: 660, src: "measured", flags: [] },
  { y: 2012, m: 10, value: 0, lo: 0, hi: 0, src: "measured", flags: [] },
  { y: 2012, m: 11, value: 14, lo: 14, hi: 14, src: "measured", flags: [] },
  {
    y: 2012,
    m: 12,
    value: 2,
    lo: 2,
    hi: 2,
    src: "provisional",
    flags: ["partial_month"],
  },
];

export const edgeSeries: Series = {
  unit: "cd",
  months: edgeMonths,
  cellCount: 1,
  lowConfidence: true,
};

export const edgeAnomaly: AnomalyPoint[] = edgeMonths.map((month, i) => ({
  y: month.y,
  m: month.m,
  ratio:
    month.value === null
      ? null
      : i % 11 === 0
        ? null
        : [0.3, 0.65, 0.95, 1.1, 1.6, 3.2][i % 6],
}));
