/** The statistics behind the figures on the screens (docs/number-logic.md sections 3 to 7). */

export { betaQuantile, incompleteBeta, logBeta, logGamma } from "./beta";
export { chance, fireYearCounts, jeffreysRange, FIRE_THRESHOLD } from "./chance";
export { mean, median, olsSlope } from "./numbers";
export { completeYearTotals, extremes, trend, MIN_TREND_YEARS } from "./trend";
export {
  historyFor,
  unusual,
  unusualFromHistory,
  unusualToDate,
  valueAt,
  MIN_COMPARE_DAYS,
  MIN_HISTORY_YEARS,
} from "./unusual";
export { isEstimatedYear, rankWindow, windowYearLabel, FIRST_MEASURED_YEAR } from "./window";
export type { YearTotal } from "./trend";
