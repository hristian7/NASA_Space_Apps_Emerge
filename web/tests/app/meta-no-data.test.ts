import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetaFile } from "../../src/types/data";
import { isNoDataMonth } from "../../src/lib/data/series";

/**
 * The record's own last months must not sit inside a no-data period.
 *
 * An export that stops mid-month once shipped a global no-data period starting
 * on 1 January of that year, which made every month of it read as "no
 * measurement at all" and sent the app back to the previous December. The
 * check stays so the same slip is caught at the data's edge rather than in the
 * screens.
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
