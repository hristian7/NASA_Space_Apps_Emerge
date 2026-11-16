import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { brierSkill, claimAllowed, SHIPPED_GRID_G, loadScorecard, parseScorecard, weakSlices, type RiskScorecard } from "../../src/app/proof/risk-data";
const fixture = (): RiskScorecard => JSON.parse(readFileSync("public/data/risk/example/scorecard.json", "utf8"));
const request = (body: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(body), { status });
describe("risk scorecard contract", () => {
  it("absent file is not tested", async () => expect(await loadScorecard(false, request(null, 404))).toBeNull());
  it("loads baseline-only rows without inventing a model", async () => {
    const card = fixture();
    for (const s of Object.values(card.scopes.europe.years["2025"].selections)) delete s.pooled.methods.model;
    expect((await loadScorecard(false, request(card)))?.scopes.europe.years["2025"].selections.forest_wildland.pooled.methods.model).toBeUndefined();
  });
  it("loads model rows", async () => expect((await loadScorecard(false, request(fixture())))?.scopes.europe.years["2025"].selections.forest_wildland.pooled.methods.model).toBeDefined());
  it("selects the example URL explicitly", async () => {
    const urls: string[] = [];
    await loadScorecard(true, async input => { urls.push(String(input)); return new Response(JSON.stringify(fixture())); });
    expect(urls).toEqual(["/data/risk/example/scorecard.json"]);
  });
  it("preserves null Brier, while zero remains a measured value", () => {
    const s = fixture().scopes.europe.years["2025"].selections.forest_wildland;
    s.probability.brier_skill = null;
    expect(brierSkill(s,"model")).toBeNull();
    expect(brierSkill(s,"history")).toBe(0);
    expect(brierSkill(s,"fwi")).toBeNull();
    expect(brierSkill(s,"random")).toBeNull();
  });
  it("does not disguise a server error as no test", async () => expect(loadScorecard(false,request(null,500))).rejects.toThrow());
  it("rejects an unrelated or malformed file", () => {
    expect(parseScorecard({})).toBeNull();
    expect(parseScorecard({...fixture(),scopes:{europe:{years:{}}}})).toBeNull();
  });
  it("never claims accuracy for example results or a grid the app does not ship", () => {
    const card = fixture(), scope=card.scopes.europe, s=scope.years["2025"].selections.forest_wildland;
    s.bootstrap.fwi!.claim_permitted=true;
    card.grid_g=scope.grid_g=SHIPPED_GRID_G;
    expect(claimAllowed(card,scope,s,"fwi")).toBe(false);
    card.example=false;
    card.grid_g=scope.grid_g=0.1;
    expect(claimAllowed(card,scope,s,"fwi")).toBe(false);
    card.grid_g=scope.grid_g=SHIPPED_GRID_G;
    expect(claimAllowed(card,scope,s,"fwi")).toBe(true);
    s.bootstrap.fwi!.interval_95[0]=0;
    expect(claimAllowed(card,scope,s,"fwi")).toBe(false);
  });
  it("keeps losing slices, including small regions", () => {
    const s = fixture().scopes.europe.years["2025"].selections.forest_wildland;
    s.regions={tiny:{land_spots:2,region_days:1,methods:{model:{capture_rate:0,hit_rate:0},random:{capture_rate:1,hit_rate:1}}}};
    expect(weakSlices(s).some(row=>row.name==="tiny")).toBe(true);
  });
});
describe("the published scorecard", () => {
  it("parses the real file, including slices without a per-region breakdown", () => {
    const real = JSON.parse(readFileSync("public/data/risk/scorecard.json", "utf8"));
    const card = parseScorecard(real);
    expect(card).not.toBeNull();
    for (const scope of Object.values(card!.scopes)) {
      for (const selection of Object.values(scope.years[String(card!.test_year)].selections)) {
        expect(selection.regions).toBeTypeOf("object");
      }
    }
  });
});
describe("compact region rows", () => {
  it("expands every region of the published file into named rows that weakSlices can read", () => {
    const card = parseScorecard(JSON.parse(readFileSync("public/data/risk/scorecard.json", "utf8")))!;
    const s = card.scopes.europe.years[String(card.test_year)].selections.forest_wildland;
    const rows = Object.values(s.regions);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.methods).toBeTypeOf("object");
    expect(() => weakSlices(s)).not.toThrow();
  });
});

describe("daily log", () => {
  const row = { date: "2026-11-14", scope: "world" as const, new_fires: 752, captured_by_us: 156, captured_by_index: 99, regions_scored: 292 };
  it("accepts older files without a log and rejects malformed rows", () => {
    expect(parseScorecard(fixture())).not.toBeNull();
    expect(parseScorecard({ ...fixture(), daily_log: [{ ...row, new_fires: -1 }] })).toBeNull();
    expect(parseScorecard({ ...fixture(), daily_log: [row] })?.daily_log).toEqual([row]);
  });
  it("uses UTC calendar days and does not count future rows", async () => {
    const { dailyWindow } = await import("../../src/app/proof/risk-data");
    const rows = [row, { ...row, date: "2026-11-08" }, { ...row, date: "2026-10-20" }, { ...row, date: "2026-11-15" }, { ...row, date: "2026-11-07" }];
    const now = new Date("2026-11-15T23:59:00Z");
    expect(dailyWindow(rows, 7, now).map(item => item.date)).toEqual(["2026-11-14", "2026-11-08"]);
    expect(dailyWindow(rows, 30, now).map(item => item.date)).toEqual(["2026-11-14", "2026-11-08", "2026-11-07", "2026-10-20"]);
  });
});

describe("remote risk files", () => {
  it("uses the configured root for live files and leaves examples local", async () => {
    vi.stubEnv("NEXT_PUBLIC_RISK_DATA_URL", "https://risk.example/risk/");
    try {
      const urls: string[] = [];
      const fetcher: typeof fetch = async input => { urls.push(String(input)); return new Response(JSON.stringify(fixture())); };
      await loadScorecard(false, fetcher);
      await loadScorecard(true, fetcher);
      const { loadRiskCountry } = await import("../../src/lib/risk/loaders");
      await loadRiskCountry("BGR", false, fetcher);
      const { loadSpotScore } = await import("../../src/lib/risk/spot-scores");
      await loadSpotScore("BGR", "2026-11-14", 42, 23, async input => { urls.push(String(input)); return new Response(null, { status: 404 }); });
      expect(urls).toEqual(["https://risk.example/risk/scorecard.json", "/data/risk/example/scorecard.json",
        "https://risk.example/risk/latest/BGR.json", "https://risk.example/risk/scores/BGR.json"]);
    } finally { vi.unstubAllEnvs(); }
  });
});


describe("week scorecard contract", () => {
  it("accepts legacy cards and validates the optional week structure", () => {
    const old = fixture();
    expect(parseScorecard(old)).not.toBeNull();
    const real = JSON.parse(readFileSync("public/data/risk/scorecard.json", "utf8"));
    expect(parseScorecard(real)?.week?.leads["4"]?.scopes.world.selections.forest_wildland.pooled.methods.fwi?.capture_rate).toBeTypeOf("number");
    real.week.test_year = 2024;
    expect(parseScorecard(real)).toBeNull();
  });
});

describe("version comparison", () => {
  it("parses the published comparison of version 3 against version 2", () => {
    const card = parseScorecard(JSON.parse(readFileSync("public/data/risk/scorecard.json", "utf8")))!;
    expect(card.test_year).toBe(2026);
    expect(card.versus_previous?.previous_model).toBe("lightgbm-v2");
    expect(card.versus_previous!.capture.new).toBeGreaterThan(card.versus_previous!.capture.previous);
    expect(card.versus_previous!.capture.interval_95[0]).toBeGreaterThan(0);
  });
  it("rejects a malformed comparison instead of showing it", () => {
    const real = JSON.parse(readFileSync("public/data/risk/scorecard.json", "utf8"));
    real.versus_previous.capture.interval_95 = [0.1];
    expect(parseScorecard(real)).toBeNull();
  });
});
