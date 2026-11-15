import scorecardJson from "../../../public/data/risk/scorecard.json";
import riskMetaJson from "../../../public/data/risk/meta.json";
import validationJson from "../../../public/data/validation.json";

/**
 * Every number on the How it works page, read from committed files. The page
 * renders on the server, so the full scorecard never reaches a browser.
 */

type Method = "model" | "history" | "fwi" | "random";
export const methodOrder: Method[] = ["model", "history", "fwi", "random"];

interface MethodScore {
  capture_rate: number;
  hit_rate: number;
}
interface Boot {
  difference: number;
  interval_95: [number, number];
  claim_permitted: boolean;
}
interface SelectionLike {
  pooled: { region_days: number; new_fires: number; methods: Record<Method, MethodScore> };
  continuing: { methods: Record<Method, { capture_rate: number }> };
  bootstrap: Partial<Record<Method, Boot>>;
  probability: { brier_skill: number; reliability: { bin: number; predicted: number; observed: number }[] };
}
interface WeekSelection {
  pooled: { methods: Record<Method, MethodScore> };
  bootstrap: Partial<Record<Method, Boot>>;
}

const card = scorecardJson as unknown as {
  test_year: number;
  grid_g: number;
  model_version: string;
  scopes: Record<"europe" | "world", { years: Record<string, { weather_days: number; selections: Record<string, SelectionLike> }> }>;
  daily_log?: { date: string; scope: "world" | "europe"; new_fires: number; captured_by_us: number; captured_by_index: number; regions_scored: number }[];
  week?: { leads: Record<string, { scopes: Record<"europe" | "world", { selections: Record<string, WeekSelection> }> }> };
};

export type Scope = "europe" | "world";
export const scopes: Scope[] = ["europe", "world"];

function selection(scope: Scope): SelectionLike {
  return card.scopes[scope].years[String(card.test_year)].selections.forest_wildland;
}

export const testYear = card.test_year;
export const gridDeg = card.grid_g;
export const weatherDays = card.scopes.world.years[String(card.test_year)].weather_days;

export const capture = Object.fromEntries(
  scopes.map((scope) => [scope, Object.fromEntries(methodOrder.map((m) => [m, selection(scope).pooled.methods[m].capture_rate]))]),
) as Record<Scope, Record<Method, number>>;

export const hitRate = Object.fromEntries(scopes.map((s) => [s, selection(s).pooled.methods.model.hit_rate])) as Record<Scope, number>;
export const regionDays = Object.fromEntries(scopes.map((s) => [s, selection(s).pooled.region_days])) as Record<Scope, number>;
export const newFires = Object.fromEntries(scopes.map((s) => [s, selection(s).pooled.new_fires])) as Record<Scope, number>;

export const continuing = Object.fromEntries(
  scopes.map((s) => [s, { model: selection(s).continuing.methods.model.capture_rate, history: selection(s).continuing.methods.history.capture_rate }]),
) as Record<Scope, { model: number; history: number }>;

export const gains = scopes.flatMap((scope) =>
  (["fwi", "history"] as const).map((against) => {
    const b = selection(scope).bootstrap[against] as Boot;
    return { scope, against, difference: b.difference, low: b.interval_95[0], high: b.interval_95[1], claim: b.claim_permitted };
  }),
);

/** Lowest probability bin of the reliability check, Europe. */
export const lowBin = (() => {
  const bin = selection("europe").probability.reliability.find((row) => row.bin === 0)!;
  return { predicted: bin.predicted, observed: bin.observed };
})();

export const brierSkill = Object.fromEntries(scopes.map((s) => [s, selection(s).probability.brier_skill])) as Record<Scope, number>;

export const week = Object.entries(card.week?.leads ?? {})
  .map(([lead, entry]) => {
    const pick = (scope: Scope) => entry.scopes[scope]?.selections.forest_wildland;
    const world = pick("world");
    const europe = pick("europe");
    return world && europe
      ? {
          lead: Number(lead),
          world: { model: world.pooled.methods.model.capture_rate, history: world.pooled.methods.history.capture_rate },
          europe: { model: europe.pooled.methods.model.capture_rate, history: europe.pooled.methods.history.capture_rate },
          worldClaim: world.bootstrap.history?.claim_permitted === true,
        }
      : null;
  })
  .filter((row): row is NonNullable<typeof row> => row !== null)
  .sort((a, b) => a.lead - b.lead);

export const dailyLog = [...(card.daily_log ?? [])].sort((a, b) => b.date.localeCompare(a.date) || a.scope.localeCompare(b.scope));

const risk = riskMetaJson as unknown as { level_bands: number[]; model_version: string; grid_g: number };
export const levelBands = risk.level_bands;
export const modelVersion = risk.model_version;

interface WorldScopeRow {
  test: string;
  group: string;
  n_countries: number;
  nrmse_p50: number | null;
  pooled_nrmse: number | null;
}
const val = validationJson as unknown as {
  method: { fit_months: string; world_fit_countries: number; train_years: [number, number]; test_years: [number, number] };
  world_scope: WorldScopeRow[];
  satellite_agreement: { pair: string; diff_pct: number; years: [number, number] }[];
  published_ratios: { scope: string; ours: number }[];
  range_coverage: { level_pct: number; unit: string; scope: string; country: string; test: string; observed_pct: number }[];
};

const worldRow = (test: string, group: string) => val.world_scope.find((r) => r.test === test && r.group === group)!;

export const conversion = {
  fitMonths: val.method.fit_months,
  countries: val.method.world_fit_countries,
  ratio: val.published_ratios.find((r) => r.scope === "world")!.ours,
  agreement: val.satellite_agreement[0],
  pooledForward: worldRow("t1", "pooled_world").pooled_nrmse!,
  pooledReverse: worldRow("t2", "pooled_world").pooled_nrmse!,
  scored: worldRow("t1", "all").n_countries,
  medianAll: worldRow("t1", "all").nrmse_p50!,
  medianLarge: worldRow("t1", "large").nrmse_p50!,
  medianSmall: worldRow("t1", "small").nrmse_p50!,
  rangeHeld: val.range_coverage
    .filter((r) => r.level_pct === 90 && r.unit === "cd" && r.scope === "cell_month" && r.test === "t1")
    .map((r) => ({ country: r.country, observed: r.observed_pct })),
};

/**
 * Worldwide fire cell-days per year in millions, Terra plus Aqua against
 * S-NPP: the table in docs/research/first-run-bulgaria-usa.md, "World findings".
 */
export const sensorYears = [
  { year: 2013, terra: 1.19, aqua: 2.54, snpp: 10.15, ratio: 2.71 },
  { year: 2016, terra: 1.28, aqua: 2.63, snpp: 10.71, ratio: 2.74 },
  { year: 2019, terra: 1.35, aqua: 2.63, snpp: 10.69, ratio: 2.69 },
  { year: 2021, terra: 1.3, aqua: 2.5, snpp: 10.24, ratio: 2.69 },
  { year: 2023, terra: 1.3, aqua: 2.75, snpp: 10.93, ratio: 2.7 },
];

/**
 * Published headline results, from docs/plans/2026-11-15-post-event-roadmap.md
 * sections 3 and 6. Each measures something different from our test.
 */
export const published = [
  { id: "wisp", figure: "54.1%" },
  { id: "orora", figure: "7.8 to 25%" },
  { id: "mesogeos", figure: "81%" },
  { id: "ecmwf", figure: null },
] as const;

/** From docs/plans/2026-11-15-submission-draft.md, "Limitations". */
export const sofiaTimesHistory = 4;

/** The model's inputs in display groups. Must list exactly FEATURES in pipeline/risk/features.py. */
export const featureGroups = [
  { id: "Weather", features: ["fwi", "ffmc", "dmc", "dc", "isi", "bui", "dsr", "fwi_x_forest"] },
  { id: "History", features: ["hist_p", "last_year_same_month", "days_since_log", "no_previous_fire"] },
  { id: "Nearby", features: ["fire_near_3d"] },
  { id: "Land", features: ["forest", "shrub_grass", "farmland", "fuel_unknown"] },
  { id: "Season", features: ["month_sin", "month_cos"] },
  { id: "Latitude", features: ["latitude"] },
] as const;

export const bootstrapDraws = (scorecardJson as unknown as { scopes: Record<Scope, { bootstrap_draws: number }> }).scopes.world.bootstrap_draws;
