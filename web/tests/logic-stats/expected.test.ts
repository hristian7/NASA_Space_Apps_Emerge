/**
 * The authority for the statistics and the downloads.
 *
 * tests/expected/logic/ holds the expected answers, written by a separate
 * agent from docs/number-logic.md before this code existed. Nothing here is
 * adjusted to match our output: a difference is a failure of our code, and no
 * tolerance is widened and no case skipped to make a run green.
 *
 * Every case file whose name starts with unusual_, chance_, window_, trend_ or
 * csv_ is loaded, and every field of every case's `expected` is asserted:
 * numbers to 6 decimals, CSV text exactly, statuses and nulls as they stand.
 * When the folder is missing the suite FAILS; a silent skip would let the
 * figures ship unchecked.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { MonthPoint, Series, Unit, WindowYear } from "../../src/types/ui";
import {
  csvField,
  keyValueBody,
  monthlyBody,
  monthlyColumnLine,
  monthlyCsv,
  summaryColumnLine,
  type CsvHeader,
} from "../../src/lib/csv";
import {
  chance,
  completeYearTotals,
  extremes,
  isEstimatedYear,
  rankWindow,
  trend,
  unusual,
  unusualToDate,
} from "../../src/lib/stats";

const PREFIXES = ["unusual_", "chance_", "window_", "trend_", "csv_"];

/**
 * The folder is fixed. EMERGE_EXPECTED_LOGIC_DIR only moves it for a smoke
 * test of this loader itself; nothing in the app reads it.
 */
const expectedDir =
  process.env.EMERGE_EXPECTED_LOGIC_DIR ??
  fileURLToPath(new URL("../../../tests/expected/logic", import.meta.url));

type Json = Record<string, unknown>;

interface Case {
  name: string;
  input: Json;
  expected: Json;
}

/** How many decimals the expected answers carry. */
const DECIMALS = 6;

/** A number, a string, a boolean, null, a list or an object, compared field by field. */
function assertField(got: unknown, want: unknown, label: string): void {
  if (want === null) {
    expect(got, `${label} should be null`).toBeNull();
    return;
  }
  if (Array.isArray(want)) {
    expect(Array.isArray(got), `${label} should be a list`).toBe(true);
    const list = got as unknown[];
    expect(list.length, `${label} length`).toBe(want.length);
    want.forEach((item, i) => assertField(list[i], item, `${label}[${i}]`));
    return;
  }
  if (typeof want === "object") {
    expect(got, `${label} should be an object`).toBeTypeOf("object");
    expect(got, `${label} should not be null`).not.toBeNull();
    const mine = got as Json;
    const wanted = want as Json;
    for (const key of Object.keys(wanted)) {
      expect(Object.keys(mine), `${label}: our result has no field ${key}`).toContain(key);
      assertField(mine[key], wanted[key], `${label}.${key}`);
    }
    return;
  }
  if (typeof want === "number") {
    expect(typeof got, `${label} should be a number, not ${JSON.stringify(got)}`).toBe("number");
    expect(got as number, label).toBeCloseTo(want, DECIMALS);
    return;
  }
  expect(got, label).toStrictEqual(want);
}

/** Assert every field the case states, and nothing less. */
function assertCase(got: Json, expected: Json, label: string): void {
  const keys = Object.keys(expected);
  expect(keys.length, `${label}: the case states no expected field`).toBeGreaterThan(0);
  for (const key of keys) {
    expect(Object.keys(got), `${label}: our result has no field ${key}`).toContain(key);
    assertField(got[key], expected[key], `${label}.${key}`);
  }
}

function monthPoints(raw: unknown): MonthPoint[] {
  const list = raw as { y: number; m: number; value: number | null; lo?: number | null; hi?: number | null; src?: string | null; flags?: string[] }[];
  return list.map((row) => ({
    y: row.y,
    m: row.m,
    value: row.value ?? null,
    lo: row.lo ?? null,
    hi: row.hi ?? null,
    src: (row.src ?? null) as MonthPoint["src"],
    flags: (row.flags ?? []) as MonthPoint["flags"],
  }));
}

function seriesOf(raw: unknown, unit: Unit = "hot"): Series {
  return { unit, months: monthPoints(raw), cellCount: 1, lowConfidence: false };
}

/** A series from a year to twelve monthly values, index 0 being January. */
function seriesOfYears(years: Record<string, (number | null)[]>): Series {
  const months: MonthPoint[] = [];
  for (const key of Object.keys(years).sort()) {
    years[key].forEach((value, i) => {
      months.push({ y: Number(key), m: i + 1, value, lo: null, hi: null, src: null, flags: [] });
    });
  }
  return { unit: "hot", months, cellCount: 1, lowConfidence: false };
}

function windowYear(raw: unknown): WindowYear {
  const row = raw as { year: number; hot: number | null; frp: number | null; estimated?: boolean };
  return { year: row.year, hot: row.hot ?? null, frp: row.frp ?? null, estimated: row.estimated === true };
}

/** The header for a CSV case: the case files pin the body, not the wording of the comments. */
const csvHeader: CsvHeader = {
  title: "Emerge monthly fire history",
  selection: "box 22 to 29 east and 41 to 45 north",
  dateRange: "2000-11 to 2025-12",
  dataDate: "2025-12-31",
  sources: ["NASA FIRMS"],
};

function runUnusual(input: Json): Json {
  if (input.historySums !== undefined) {
    return unusualToDate(
      (input.currentSum ?? null) as number | null,
      input.historySums as number[],
      input.dayOfMonth as number,
    ) as unknown as Json;
  }
  const series = seriesOf(input.series);
  return unusual(series, input.year as number, input.month as number) as unknown as Json;
}

function runChance(input: Json): Json {
  const series = seriesOf(input.series);
  return chance(series, input.month as number, input.year as number) as unknown as Json;
}

function runWindow(input: Json): Json {
  if (input.years !== undefined) {
    const estimated: Record<string, boolean> = {};
    for (const year of input.years as number[]) estimated[String(year)] = isEstimatedYear(year);
    return { estimated };
  }
  const comparison = rankWindow(
    input.days as number,
    input.end as string,
    windowYear(input.current),
    (input.past as unknown[]).map(windowYear),
  );
  const estimatedByYear: Record<string, boolean> = {};
  for (const row of comparison.past) estimatedByYear[String(row.year)] = row.estimated;
  return {
    days: comparison.days,
    end: comparison.end,
    rank: comparison.rank,
    of: comparison.of,
    rankedYears: comparison.past.filter((row) => row.hot !== null).map((row) => row.year),
    estimatedByYear,
  };
}

function runTrend(input: Json): Json {
  const series = seriesOfYears(input.years as Record<string, (number | null)[]>);
  const completeYears: Record<string, number> = {};
  for (const entry of completeYearTotals(series)) completeYears[String(entry.y)] = entry.total;
  return {
    trend: trend(series) as unknown as Json,
    extremes: extremes(series) as unknown as Json,
    completeYears,
  };
}

/** The checks a CSV case states as rules rather than as text. */
function runCsvChecks(csv: string, checks: Json[], label: string): void {
  const bodyRows = csv
    .split("\n")
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .slice(1);
  for (const check of checks) {
    const where = `${label}: ${String(check.rule)}`;
    switch (check.type) {
      case "doesNotContain":
        expect(csv.includes(check.text as string), where).toBe(false);
        break;
      case "everyLineEndsWith":
        expect(csv.endsWith(check.text as string), where).toBe(true);
        expect(csv.split("\n").pop(), `${where}: nothing after the last line end`).toBe("");
        break;
      case "rowEquals":
        expect(bodyRows, where).toContain(check.row as string);
        break;
      case "csvFieldQuoted":
        expect(csvField(check.sample as string), where).toBe(check.quoted as string);
        break;
      case "fieldCount":
        for (const row of bodyRows) {
          expect(row.split(",").length, `${where}: ${row}`).toBe(check.count as number);
        }
        break;
      case "doesNotMatch":
        // The rule is about the fire values, so it is read against the rows.
        for (const row of bodyRows) {
          expect(new RegExp(check.pattern as string).test(row), `${where}: ${row}`).toBe(false);
        }
        break;
      default:
        throw new Error(`${where}: this check type is not known: ${String(check.type)}`);
    }
  }
}

function runCsvCase(c: Case, label: string): void {
  // A summary case states its own key and value rows.
  if (c.input.rows !== undefined) {
    const rows = c.input.rows as [string, string][];
    if (c.expected.header !== undefined) {
      expect(summaryColumnLine().trimEnd(), `${label}.header`).toBe(c.expected.header as string);
    }
    expect(keyValueBody(rows), `${label}.bodyRows`).toBe(c.expected.bodyRows as string);
    return;
  }

  const series = seriesOf(c.input.months, (c.input.unit ?? "hot") as Unit);
  if (c.expected.checks !== undefined) {
    runCsvChecks(monthlyCsv(series, csvHeader), c.expected.checks as Json[], label);
    return;
  }
  if (c.expected.header !== undefined) {
    expect(monthlyColumnLine().trimEnd(), `${label}.header`).toBe(c.expected.header as string);
  }
  expect(monthlyBody(series), `${label}.bodyRows`).toBe(c.expected.bodyRows as string);
}

const dirExists = existsSync(expectedDir);
const files = dirExists
  ? readdirSync(expectedDir)
      .filter((name) => name.endsWith(".json") && PREFIXES.some((p) => name.startsWith(p)))
      .sort()
  : [];

describe("the expected answers for the statistics and the downloads", () => {
  it("are present", () => {
    expect(
      dirExists,
      `expected answers not found: ${expectedDir} does not exist, so the figures are unchecked`,
    ).toBe(true);
    expect(
      files.length,
      `expected answers not found: no case file in ${expectedDir} starts with ${PREFIXES.join(", ")}`,
    ).toBeGreaterThan(0);
  });
});

for (const file of files) {
  const parsed = JSON.parse(readFileSync(join(expectedDir, file), "utf8")) as { cases?: Case[] };
  const cases = parsed.cases ?? [];

  describe(file, () => {
    it("holds cases", () => {
      expect(cases.length, `${file} holds no cases`).toBeGreaterThan(0);
    });

    for (const c of cases) {
      it(c.name, () => {
        const label = `${file} / ${c.name}`;
        if (file.startsWith("csv_")) {
          runCsvCase(c, label);
          return;
        }
        let got: Json;
        if (file.startsWith("unusual_")) got = runUnusual(c.input);
        else if (file.startsWith("chance_")) got = runChance(c.input);
        else if (file.startsWith("window_")) got = runWindow(c.input);
        else got = runTrend(c.input);
        assertCase(got, c.expected, label);
      });
    }
  });
}
