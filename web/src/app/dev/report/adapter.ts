/**
 * TEMPORARY. A stand-in for the number logic, so the report components can be
 * looked at before web/src/lib/stats exists. Delete this file once the real
 * logic lands: nothing outside this dev folder may import it.
 */

import type { CountryFile } from "@/types/data";
import type { SatelliteMonth, Series, Unit } from "@/types/ui";
import type { AnomalyPoint, YearTotal } from "@/components/report/types";
import { yearTotalsFromMonths } from "@/components/report/lib/aggregate";

export function seriesFromCountryFile(file: CountryFile, unit: Unit): Series {
  return {
    unit,
    months: file.months.map((month) => ({
      y: month.y,
      m: month.m,
      value: unit === "cd" ? month.cd : month.hot,
      lo: unit === "cd" ? month.cd_lo : month.hot_lo,
      hi: unit === "cd" ? month.cd_hi : month.hot_hi,
      src: month.src,
      flags: month.flags,
    })),
    cellCount: 1,
    lowConfidence: false,
  };
}

export function satelliteMonthsFromCountryFile(
  file: CountryFile,
  lastMonths: number,
): SatelliteMonth[] {
  return file.months.slice(-lastMonths).map((month) => ({
    y: month.y,
    m: month.m,
    terra: month.terra,
    aqua: month.aqua,
    snpp: month.snpp,
    noaa20: month.noaa20,
    noaa21: month.noaa21,
  }));
}

/** TEMPORARY: section 3 of docs/number-logic.md, for the anomaly ramp only. */
export function anomalyPointsFromSeries(series: Series): AnomalyPoint[] {
  const byMonth = new Map<number, number[]>();
  for (const month of series.months) {
    if (month.value === null) {
      continue;
    }
    const held = byMonth.get(month.m);
    if (held === undefined) {
      byMonth.set(month.m, [month.value]);
    } else {
      held.push(month.value);
    }
  }

  const medians = new Map<number, number>();
  for (const [month, values] of byMonth) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    medians.set(
      month,
      sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2,
    );
  }

  return series.months.map((month) => {
    const median = medians.get(month.m) ?? 0;
    return {
      y: month.y,
      m: month.m,
      ratio:
        month.value === null || median === 0 ? null : month.value / median,
    };
  });
}

export function yearTotals(series: Series): YearTotal[] {
  return yearTotalsFromMonths(series.months);
}
