import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The specs read the data they assert on, so a refreshed export does not turn
 * a passing spec red. Only the structure is written down here; every number
 * comes from the files the app itself serves.
 */
const dataDir = join(process.cwd(), "public", "data");

export function readData<T>(path: string): T {
  return JSON.parse(readFileSync(join(dataDir, path), "utf8")) as T;
}

export interface CountryMonth {
  y: number;
  m: number;
  hot: number;
  hot_lo: number;
  hot_hi: number;
  cd: number;
  cd_lo: number;
  cd_hi: number;
  src: string;
}

export function countryMonths(iso3: string): CountryMonth[] {
  return readData<{ months: CountryMonth[] }>(`countries/${iso3}.json`).months;
}

export function monthOf(iso3: string, y: number, m: number): CountryMonth {
  const found = countryMonths(iso3).find((row) => row.y === y && row.m === m);
  if (found === undefined) throw new Error(`${iso3} has no ${y}-${m}`);
  return found;
}

/** The same grouping the report uses, so a figure can be looked for as shown. */
export function asShown(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The record's last day, as the data set states it. */
export function lastDataDay(): { y: number; m: number; d: number; iso: string } {
  const iso = readData<{ last_data_day: string }>("meta.json").last_data_day;
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, iso };
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** True when the record stops before the end of its last month. */
export function lastMonthIsPart(): boolean {
  const last = lastDataDay();
  return last.d < daysIn(last.y, last.m);
}

/** The last month of the record that has all of its days. */
export function lastCompleteMonthName(): string {
  const last = lastDataDay();
  const complete = lastMonthIsPart()
    ? last.m === 1
      ? { y: last.y - 1, m: 12 }
      : { y: last.y, m: last.m - 1 }
    : { y: last.y, m: last.m };
  return `${MONTHS[complete.m - 1]} ${complete.y}`;
}

/** How the app names the part month the record stops inside. */
export function partMonthName(): string {
  const last = lastDataDay();
  return `1 to ${last.d} ${MONTHS[last.m - 1]} ${last.y}`;
}

/**
 * True when the record's own last month carries a measurement. meta.json can
 * mark it as a no-data period left over from an older export, which makes
 * every month of that year read as "no measurement"; the flows that need a
 * readable last month skip rather than assert something the data cannot show.
 * The defect itself is pinned in web/tests/app/meta-no-data.test.ts.
 */
export function lastMonthIsReadable(): boolean {
  const meta = readData<{
    last_data_day: string;
    no_data: { scope: string; from: string | null; to: string | null; days: number | null }[];
  }>("meta.json");
  const day = meta.last_data_day;
  return !meta.no_data.some(
    (period) =>
      period.scope === "global" &&
      period.days === null &&
      (period.from ?? "0000-01-01") <= day &&
      day <= (period.to ?? "9999-12-31"),
  );
}
