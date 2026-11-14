import type { CountryResult, RiskCountry, RiskIndex, RiskMeta, RiskRegion, RiskSpot } from "../../types/risk";

export function exampleMode(search = "", environment = process.env.NEXT_PUBLIC_RISK_DATA): boolean {
  return new URLSearchParams(search).get("risk") === "example" || environment === "example";
}
export function riskRoot(example: boolean): string {
  return `/data/risk${example ? "/example" : ""}`;
}
/** Only absent files become empty states. Broken JSON/network/server errors stay errors. */
async function read<T>(path: string, fetcher: typeof fetch): Promise<T | null> {
  const response = await fetcher(path, { cache: "no-store" });
  // An unread error body keeps the request open, and a missing file is
  // answered with a streamed page, so it is cancelled before returning.
  if (!response.ok) void response.body?.cancel().catch(() => {});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Risk data: ${response.status}`);
  return response.json() as Promise<T>;
}
export async function loadRiskIndex(example: boolean, fetcher = fetch): Promise<RiskIndex> {
  const root = riskRoot(example);
  const meta = await read<RiskMeta>(`${root}/meta.json`, fetcher);
  if (!meta || (!meta.engine_ready && !example)) return { meta, regions: [] };
  const regions = await read<RiskRegion[]>(`${root}/regions.json`, fetcher);
  return { meta, regions: regions ?? [] };
}
export async function loadRiskCountry(country: string, example: boolean, fetcher = fetch): Promise<CountryResult> {
  if (!/^[A-Z]{3}$/.test(country)) throw new Error("Invalid country code");
  const file = await read<RiskCountry>(`${riskRoot(example)}/latest/${country}.json`, fetcher);
  return file ? { status: "ready", file } : { status: "missing", file: { country, days: [], regions: {} } };
}
export function regionSpots(file: RiskCountry | null, region: string, day: string): RiskSpot[] {
  return [...(file?.regions[region]?.[day] ?? [])].sort((a, b) => a.rank - b.rank).slice(0, 10);
}
export function showForecast(meta: RiskMeta | null, example: boolean): boolean {
  return meta !== null && (example || (meta.engine_ready && !meta.example));
}
export async function scorecardHref(example: boolean, fetcher = fetch): Promise<string> {
  const path = `${riskRoot(example)}/scorecard.json`;
  return (await read<unknown>(path, fetcher)) === null ? "/proof" : path;
}

export async function loadRiskWeek(country: string, example: boolean, fetcher = fetch): Promise<CountryResult> {
  if (!/^[A-Z]{3}$/.test(country)) throw new Error("Invalid country code");
  const file = await read<RiskCountry>(`${riskRoot(example)}/week/${country}.json`, fetcher);
  return file ? { status: "ready", file } : { status: "missing", file: { country, days: [], regions: {} } };
}
