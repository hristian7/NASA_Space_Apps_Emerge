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
