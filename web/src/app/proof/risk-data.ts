import { riskRoot } from "../../lib/risk/loaders";

/** The nested export written by the risk scorecard builder. Missing scores stay null. */
export const methods = ["model", "fwi", "history", "random"] as const;
export type Method = (typeof methods)[number];
export type Metric = number | null;
export interface Scores {
  capture_rate: Metric;
  hit_rate: Metric;
  lift_over_random?: Metric;
  captured_new?: number;
}
export interface Aggregate {
  region_days: number;
  new_fires?: number;
  fires?: number;
  land_spots?: number;
  methods: Partial<Record<Method, Scores>>;
}
export interface Bootstrap {
  difference: Metric;
  interval_95: [Metric, Metric];
  valid_draws: number;
  bootstrap_passed: boolean;
  claim_permitted: boolean;
}
export interface Selection {
  coverage: { eligible_spot_days: number; scored_spot_days: number; eligible_new_fires: number; scored_new_fires: number };
  pooled: Aggregate;
  continuing?: Aggregate;
  region_days_without_scores: number;
  regions_under_20: Aggregate;
  regions_20_or_more: Aggregate;
  regions: Record<string, Aggregate>;
  months: Record<string, Aggregate>;
  bootstrap: Partial<Record<Method, Bootstrap>>;
  probability: { n: number; brier_skill?: Metric; history_brier_skill?: Metric };
}
export interface Scope {
  grid_g: number;
  years: Record<string, { weather_days: number; first_day: string; last_day: string; selections: Record<string, Selection> }>;
}
export interface DailyLogRow {
  date: string;
  scope: "world" | "europe";
  new_fires: number;
  captured_by_us: number;
  captured_by_index: number;
  regions_scored: number;
}
export interface WeekScore {
  verdict: string;
  scopes: Record<string, { weather_days: number; missing_weather_days: number; selections: Record<string, { coverage: Selection["coverage"]; pooled: Aggregate; region_days_without_scores: number; bootstrap: Partial<Record<Method, Bootstrap>> }> }>;
}
export interface RiskScorecard {
  schema: "emerge-risk-scorecard-1";
  example?: boolean;
  grid_g: number;
  test_year: number;
  scopes: Record<string, Scope>;
  daily_log?: DailyLogRow[];
  week?: { test_year: number; leads: Record<string, WeekScore> };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function aggregate(value: unknown): boolean {
  return record(value) && typeof value.region_days === "number" && record(value.methods);
}
/**
 * The exporter writes each region as a plain list in the order of
 * `region_fields`, to keep the file small; the screen reads named rows.
 */
function expandRegions(regions: Record<string, unknown>, fields: unknown): Record<string, unknown> {
  if (!Array.isArray(fields)) return regions;
  const out: Record<string, unknown> = {};
  for (const [name, row] of Object.entries(regions)) {
    if (!Array.isArray(row)) { out[name] = row; continue; }
    const v = Object.fromEntries(fields.map((field, i) => [String(field), row[i] ?? null])) as Record<string, number | null>;
    out[name] = {
      land_spots: v.land_spots, min_scored_spots: v.min_scored_spots, max_scored_spots: v.max_scored_spots,
      region_days: v.fire_positive_region_days ?? 0, new_fires: v.new_fires ?? 0,
      methods: {
        model: { capture_rate: v.model_capture, hit_rate: v.model_hit, lift_over_random: v.model_lift },
        fwi: { capture_rate: v.fwi_capture }, history: { capture_rate: v.history_capture }, random: { capture_rate: v.random_capture },
      },
    };
  }
  return out;
}

export function parseScorecard(value: unknown): RiskScorecard | null {
  if (!record(value) || value.schema !== "emerge-risk-scorecard-1" ||
      typeof value.grid_g !== "number" || typeof value.test_year !== "number" || !record(value.scopes)) return null;
  if (value.daily_log !== undefined && (!Array.isArray(value.daily_log) || value.daily_log.some(row =>
    !record(row) || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
    (row.scope !== "world" && row.scope !== "europe") ||
    [row.new_fires, row.captured_by_us, row.captured_by_index, row.regions_scored].some(n =>
      typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)))) return null;
  if (value.week !== undefined) {
    if (!record(value.week) || value.week.test_year !== value.test_year || !record(value.week.leads)) return null;
    for (const [lead, entry] of Object.entries(value.week.leads)) {
      if (!/^[3-8]$/.test(lead) || !record(entry) || typeof entry.verdict !== "string" || !record(entry.scopes)) return null;
      for (const scope of Object.values(entry.scopes)) {
        if (!record(scope) || typeof scope.weather_days !== "number" || typeof scope.missing_weather_days !== "number" || !record(scope.selections)) return null;
        for (const selection of Object.values(scope.selections)) {
          if (!record(selection) || !record(selection.coverage) || !aggregate(selection.pooled) || !record(selection.bootstrap)) return null;
        }
      }
    }
  }
  for (const scope of Object.values(value.scopes)) {
    if (!record(scope) || typeof scope.grid_g !== "number" || !record(scope.years)) return null;
    const year = scope.years[String(value.test_year)];
    if (!record(year) || !record(year.selections)) return null;
    for (const selection of Object.values(year.selections)) {
      if (!record(selection) || !aggregate(selection.pooled) || !aggregate(selection.regions_under_20) ||
          !aggregate(selection.regions_20_or_more) || !record(selection.coverage) ||
          !(record(selection.regions) || selection.regions == null) ||
          !record(selection.months) || !record(selection.bootstrap) || !record(selection.probability)) return null;
      // The exporter leaves out the per-region breakdown of secondary slices to keep the file small.
      if (selection.regions == null) selection.regions = {};
      selection.regions = expandRegions(selection.regions as Record<string, unknown>, selection.region_fields);
    }
  }
  return value as unknown as RiskScorecard;
}

export async function loadScorecard(example = false, request: typeof fetch = fetch): Promise<RiskScorecard | null> {
  const response = await request(`${riskRoot(example)}/scorecard.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Scorecard request failed: ${response.status}`);
  const parsed = parseScorecard(await response.json());
  if (!parsed) throw new Error("Invalid scorecard");
  return parsed;
}

export function brierSkill(selection: Selection, method: Method): Metric {
  if (method === "fwi" || method === "random" || !selection.pooled.methods[method]) return null;
  return (method === "model" ? selection.probability.brier_skill : selection.probability.history_brier_skill) ?? null;
}

/**
 * Claims count only at the grid the app ships. The 0.1 degree run is on the
 * specification's cut list; the build ships at 0.25 degree and says so
 * (build plan section 8.4).
 */
export const SHIPPED_GRID_G = 0.25;

/** The specification requires the shipped grid, not just a producer's pass flag. */
export function claimAllowed(card: RiskScorecard, scope: Scope, selection: Selection, baseline: Method): boolean {
  const model = selection.pooled.methods.model?.capture_rate;
  const other = selection.pooled.methods[baseline]?.capture_rate;
  const boot = selection.bootstrap[baseline];
  return !card.example && card.test_year === 2025 && card.grid_g === SHIPPED_GRID_G && scope.grid_g === card.grid_g &&
    typeof model === "number" && typeof other === "number" && model > other &&
    boot?.claim_permitted === true && boot.bootstrap_passed && boot.valid_draws > 0 &&
    typeof boot.difference === "number" && boot.difference > 0 &&
    typeof boot.interval_95[0] === "number" && boot.interval_95[0] > 0;
}

export function weakSlices(selection: Selection): { kind: "regions" | "months"; name: string; row: Aggregate }[] {
  return (["months", "regions"] as const).flatMap(kind => Object.entries(selection[kind])
    .filter(([, row]) => {
      const model = row.methods.model?.capture_rate;
      return typeof model === "number" && methods.some(method => method !== "model" &&
        typeof row.methods[method]?.capture_rate === "number" && model < row.methods[method]!.capture_rate!);
    }).map(([name, row]) => ({ kind, name, row })));
}

/** Use complete UTC calendar days, ending yesterday. */
export function dailyWindow(rows: DailyLogRow[], days: number, now = new Date()): DailyLogRow[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const last = today - 86400000;
  const first = last - (days - 1) * 86400000;
  return rows.filter(row => {
    const date = Date.parse(`${row.date}T00:00:00Z`);
    return date >= first && date <= last;
  }).sort((a, b) => b.date.localeCompare(a.date) || a.scope.localeCompare(b.scope));
}
