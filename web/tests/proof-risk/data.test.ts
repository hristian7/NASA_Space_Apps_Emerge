import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { brierSkill, claimAllowed, loadScorecard, parseScorecard, weakSlices, type RiskScorecard } from "../../src/app/proof/risk-data";
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
  it("never claims accuracy for example or development-grid results", () => {
    const card = fixture(), scope=card.scopes.europe, s=scope.years["2025"].selections.forest_wildland;
    s.bootstrap.fwi!.claim_permitted=true;
    expect(claimAllowed(card,scope,s,"fwi")).toBe(false);
    card.example=false;
    expect(claimAllowed(card,scope,s,"fwi")).toBe(false);
    card.grid_g=scope.grid_g=0.1;
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
