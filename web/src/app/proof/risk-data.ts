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
export interface RiskScorecard {
  schema: "emerge-risk-scorecard-1";
  example?: boolean;
  grid_g: number;
  test_year: number;
  scopes: Record<string, Scope>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function aggregate(value: unknown): boolean {
  return record(value) && typeof value.region_days === "number" && record(value.methods);
}
export function parseScorecard(value: unknown): RiskScorecard | null {
  if (!record(value) || value.schema !== "emerge-risk-scorecard-1" ||
      typeof value.grid_g !== "number" || typeof value.test_year !== "number" || !record(value.scopes)) return null;
  for (const scope of Object.values(value.scopes)) {
    if (!record(scope) || typeof scope.grid_g !== "number" || !record(scope.years)) return null;
    const year = scope.years[String(value.test_year)];
    if (!record(year) || !record(year.selections)) return null;
    for (const selection of Object.values(year.selections)) {
      if (!record(selection) || !aggregate(selection.pooled) || !aggregate(selection.regions_under_20) ||
          !aggregate(selection.regions_20_or_more) || !record(selection.coverage) ||
          !record(selection.regions) || !record(selection.months) || !record(selection.bootstrap) || !record(selection.probability)) return null;
    }
  }
  return value as unknown as RiskScorecard;
}

export async function loadScorecard(example = false, request: typeof fetch = fetch): Promise<RiskScorecard | null> {
  const response = await request(`/data/risk/${example ? "example/" : ""}scorecard.json`);
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

/** The specification requires the shipped grid, not just a producer's pass flag. */
export function claimAllowed(card: RiskScorecard, scope: Scope, selection: Selection, baseline: Method): boolean {
  const model = selection.pooled.methods.model?.capture_rate;
  const other = selection.pooled.methods[baseline]?.capture_rate;
  const boot = selection.bootstrap[baseline];
  return !card.example && card.test_year === 2025 && card.grid_g === 0.1 && scope.grid_g === card.grid_g &&
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
