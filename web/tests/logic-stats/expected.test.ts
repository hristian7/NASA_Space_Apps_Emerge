/**
 * The authority for the statistics and the downloads.
 *
 * tests/expected/logic/ holds the expected answers, written by a separate
 * agent from docs/number-logic.md before this code existed. Nothing here is
 * adjusted to match our output: a difference is a failure of our code.
 *
 * Every case file whose name starts with unusual_, chance_, window_, trend_ or
 * csv_ is loaded. Numbers are compared to 6 decimals, CSV text exactly. When
 * the folder is missing the suite FAILS: a silent skip would let the figures
 * ship unchecked.
 *
 * The case files are read field by field under normalized names (ratio_median
 * and ratioMedian are the same field), and only the fields a case states are
 * compared, so the oracle is free in how it spells and groups them.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { MonthPoint, Series, WindowYear } from "../../src/types/ui";
import { monthlyCsv, summaryCsv } from "../../src/lib/csv";
import {
  chance,
  extremes,
  jeffreysRange,
  rankWindow,
  trend,
  unusual,
  unusualFromHistory,
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

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Field names match ignoring case and underscores, so either spelling works. */
function norm(key: string): string {
  return key.replace(/_/g, "").toLowerCase();
}

function field(source: unknown, ...names: string[]): unknown {
  if (!isObject(source)) return undefined;
  for (const name of names) {
    const target = norm(name);
    for (const key of Object.keys(source)) {
      if (norm(key) === target) return source[key];
    }
  }
  return undefined;
}

function numberField(source: unknown, ...names: string[]): number | undefined {
  const value = field(source, ...names);
  return typeof value === "number" ? value : undefined;
}

function numberList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((v) => typeof v === "number")) return undefined;
  return value as number[];
}

/** Metadata the oracle may carry in a case; never compared as a result field. */
const META_KEYS = new Set(
  [
    "name",
    "case",
    "id",
    "label",
    "note",
    "notes",
    "comment",
    "rule",
    "description",
    "why",
    "input",
    "inputs",
    "args",
    "expected",
    "want",
    "result",
    "output",
    "series",
    "history",
    "pastvalues",
    "past",
    "kind",
    "header",
    "figures",
  ].map(norm),
);

interface Compared {
  count: number;
}

/** Compare every field the case states against our result. Counts what was compared. */
function compareFields(got: unknown, want: unknown, where: string, seen: Compared): void {
  if (Array.isArray(want)) {
    expect(Array.isArray(got), `${where} should be a list`).toBe(true);
    const list = got as unknown[];
    expect(list.length, `${where} length`).toBe(want.length);
    want.forEach((item, i) => compareFields(list[i], item, `${where}[${i}]`, seen));
    return;
  }
  if (isObject(want)) {
    for (const key of Object.keys(want)) {
      if (META_KEYS.has(norm(key))) continue;
      const mine = field(got, key);
      // Our result has no such field: the oracle may state inputs beside results.
      if (mine === undefined) continue;
      compareFields(mine, want[key], `${where}.${key}`, seen);
    }
    return;
  }
  seen.count += 1;
  if (typeof want === "number") {
    if (got === null || got === undefined) {
      expect(got, `${where} should be ${want}`).toBe(want);
      return;
    }
    expect(typeof got, `${where} should be a number`).toBe("number");
    expect(got as number, where).toBeCloseTo(want, 6);
    return;
  }
  expect(got, where).toStrictEqual(want);
}

function asSeries(value: unknown): Series | undefined {
  const monthsRaw = Array.isArray(value) ? value : field(value, "months");
  if (!Array.isArray(monthsRaw)) return undefined;
  const months: MonthPoint[] = monthsRaw.map((raw) => {
    const y = numberField(raw, "y", "year") ?? 0;
    const m = numberField(raw, "m", "month") ?? 0;
    const value = field(raw, "value", "v");
    const lo = field(raw, "lo", "low");
    const hi = field(raw, "hi", "high");
    const src = field(raw, "src", "source");
    const flags = field(raw, "flags");
    return {
      y,
      m,
      value: typeof value === "number" ? value : null,
      lo: typeof lo === "number" ? lo : null,
      hi: typeof hi === "number" ? hi : null,
      src: (typeof src === "string" ? src : null) as MonthPoint["src"],
      flags: (Array.isArray(flags) ? flags : []) as MonthPoint["flags"],
    };
  });
  const unit = field(value, "unit");
  return {
    unit: unit === "cd" ? "cd" : "hot",
    months,
    cellCount: numberField(value, "cellCount") ?? 1,
    lowConfidence: field(value, "lowConfidence") === true,
  };
}

function asWindowYear(value: unknown): WindowYear {
  const hot = field(value, "hot");
  const frp = field(value, "frp");
  return {
    year: numberField(value, "year", "y") ?? 0,
    hot: typeof hot === "number" ? hot : null,
    frp: typeof frp === "number" ? frp : null,
    estimated: field(value, "estimated") === true,
  };
}

function caseInput(c: Json): unknown {
  const nested = field(c, "input", "inputs", "args");
  return nested === undefined ? c : nested;
}

function caseExpected(c: Json): unknown {
  const nested = field(c, "expected", "want", "result", "output");
  return nested === undefined ? c : nested;
}

function caseName(c: Json, index: number): string {
  const name = field(c, "name", "case", "id", "label");
  return typeof name === "string" ? name : `case ${index + 1}`;
}

function casesOf(parsed: unknown): Json[] {
  const list = Array.isArray(parsed) ? parsed : field(parsed, "cases", "tests", "items");
  if (!Array.isArray(list)) return [];
  return list.filter(isObject);
}

function runUnusual(input: unknown): unknown {
  const history = numberList(field(input, "history", "pastValues", "past", "pastvalues"));
  const day = numberField(input, "dayOfMonth", "day", "d", "days");
  if (history) {
    const value = field(input, "value", "currentValue", "current");
    const current = typeof value === "number" ? value : null;
    if (day !== undefined) return unusualToDate(current, history, day);
    return unusualFromHistory(current, history);
  }
  const series = asSeries(field(input, "series", "months") ?? input);
  const y = numberField(input, "y", "year");
  const m = numberField(input, "m", "month");
  if (series && y !== undefined && m !== undefined) return unusual(series, y, m);
  throw new Error("an unusual case needs a history, or a series with a year and a month");
}

function runChance(input: unknown): unknown {
  const series = asSeries(field(input, "series", "months") ?? input);
  const y = numberField(input, "y", "year");
  const m = numberField(input, "m", "month");
  if (series && series.months.length > 0 && y !== undefined && m !== undefined) {
    return chance(series, m, y);
  }
  const years = numberField(input, "years", "n");
  const fireYears = numberField(input, "fireYears", "k", "successes");
  if (years !== undefined && fireYears !== undefined) {
    const range = jeffreysRange(fireYears, years);
    return { p: years === 0 ? null : fireYears / years, ...range, fireYears, years };
  }
  throw new Error("a chance case needs a series with a year and a month, or counts");
}

function runWindow(input: unknown): unknown {
  const days = numberField(input, "days", "window") ?? 8;
  const endRaw = field(input, "end", "endDate");
  const end = typeof endRaw === "string" ? endRaw : "";
  const current = asWindowYear(field(input, "current", "currentYear", "now"));
  const pastRaw = field(input, "past", "pastYears", "years");
  const past = Array.isArray(pastRaw) ? pastRaw.map(asWindowYear) : [];
  return rankWindow(days, end, current, past);
}

function runTrend(input: unknown): unknown {
  const series = asSeries(field(input, "series", "months") ?? input);
  if (!series) throw new Error("a trend case needs a series");
  return { ...trend(series), ...extremes(series) };
}

function runCsv(input: unknown): string {
  const header = (field(input, "header") ?? input) as never;
  const kindRaw = field(input, "kind", "csv", "which", "type");
  const kind = typeof kindRaw === "string" ? kindRaw.toLowerCase() : "";
  const series = asSeries(field(input, "series", "months"));
  const figures = field(input, "figures", "summary");
  if (kind.includes("summary") || (figures !== undefined && !kind.includes("month"))) {
    return summaryCsv(figures as never, header);
  }
  if (!series) throw new Error("a monthly csv case needs a series");
  return monthlyCsv(series, header);
}

function expectedText(c: Json): string | undefined {
  const value = field(c, "csv", "text", "expected", "want", "output", "content");
  return typeof value === "string" ? value : undefined;
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
  const parsed = JSON.parse(readFileSync(join(expectedDir, file), "utf8")) as unknown;
  const cases = casesOf(parsed);

  describe(file, () => {
    it("holds cases", () => {
      expect(cases.length, `${file} holds no cases`).toBeGreaterThan(0);
    });

    for (const [index, c] of cases.entries()) {
      it(caseName(c, index), () => {
        const input = caseInput(c);
        if (file.startsWith("csv_")) {
          const want = expectedText(c);
          expect(want, `${file}: the case holds no expected CSV text`).toBeTypeOf("string");
          expect(runCsv(input)).toBe(want);
          return;
        }
        let got: unknown;
        if (file.startsWith("unusual_")) got = runUnusual(input);
        else if (file.startsWith("chance_")) got = runChance(input);
        else if (file.startsWith("window_")) got = runWindow(input);
        else got = runTrend(input);

        const seen: Compared = { count: 0 };
        compareFields(got, caseExpected(c), file, seen);
        expect(seen.count, `${file}: no field of the case could be compared`).toBeGreaterThan(0);
      });
    }
  });
}
