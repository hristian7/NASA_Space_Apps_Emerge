import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetaFile } from "../../src/types/data";
import { isNoDataMonth } from "../../src/lib/data/series";

/**
 * The record's own last months must not sit inside a no-data period.
 *
 * The shipped meta.json still carries a global no-data period that starts on
 * 1 January 2026 and never ends, left over from the example export that
 * stopped on 31 December 2025. Every month of 2026 therefore reads as "no
 * measurement at all", which is what makes the app default to December 2025
 * and refuse to compare it. The data belongs to another part of the team, so
 * this test records the defect rather than working around it: it is marked as
 * expected to fail, and it turns red the moment the period is corrected, so
 * whoever fixes the file removes the marker with it.
 */
const meta = JSON.parse(
  readFileSync(join(process.cwd(), "public", "data", "meta.json"), "utf8"),
) as MetaFile;

function monthOfLastDay(): { y: number; m: number } {
  const [y, m] = meta.last_data_day.split("-").map(Number);
  return { y, m };
}

describe("the record's last months", () => {
  it(
    "are not inside a no-data period",
    () => {
      const last = monthOfLastDay();
      expect(isNoDataMonth(meta, last.y, last.m)).toBe(false);
    },
  );

  it("has a last data day inside the month meta names as its last", () => {
    const last = monthOfLastDay();
    const [y, m] = meta.last_month.split("-").map(Number);
    expect({ y: last.y, m: last.m }).toEqual({ y, m });
  });
});
