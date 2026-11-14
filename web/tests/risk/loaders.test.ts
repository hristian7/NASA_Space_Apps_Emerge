import { describe, expect, it } from "vitest";
import { exampleMode, loadRiskCountry, loadRiskIndex, regionSpots, showForecast } from "../../src/lib/risk/loaders";
import type { RiskCountry, RiskMeta, RiskSpot } from "../../src/types/risk";
const fetch404 = (async () => new Response(null, { status: 404 })) as typeof fetch;
describe("risk static contract", () => {
  it("preserves null and sorts the supplied ranks without mutating input", () => {
    const records = [{ rank: 2, p: null }, { rank: 1, p: 0 }] as RiskSpot[];
    const file: RiskCountry = { country: "BGR", days: ["2026-11-15"], regions: { "BG-01": { "2026-11-15": records } } };
    const result = regionSpots(file, "BG-01", "2026-11-15");
    expect(result.map(s => s.rank)).toEqual([1, 2]);
    expect(result.map(s => s.p)).toEqual([0, null]);
    expect(records[0].rank).toBe(2);
  });
  it("selects all vegetation separately and handles older files", () => {
    const forest = [{ rank: 1 }] as RiskSpot[];
    const farmland = [{ rank: 1, fire_type: "farmland" }] as RiskSpot[];
    const file: RiskCountry = { country: "BGR", days: ["d"], regions: { r: { d: forest } }, all_vegetation: { r: { d: farmland } } };
    expect(regionSpots(file, "r", "d")).toEqual(forest);
    expect(regionSpots(file, "r", "d", "all")).toEqual(farmland);
    expect(regionSpots({ ...file, all_vegetation: undefined }, "r", "d", "all")).toEqual([]);
  });
  it("labels an absent country and returns no records", async () => {
    expect(await loadRiskCountry("USA", false, fetch404)).toEqual({ status: "missing", file: { country: "USA", days: [], regions: {} } });
  });
  it("keeps missing metadata in the placeholder", async () => {
    expect(await loadRiskIndex(false, fetch404)).toEqual({ meta: null, regions: [] });
    expect(showForecast(null, false)).toBe(false);
  });
  it("requires readiness for real files and explicit opt-in for examples", () => {
    const meta = { engine_ready: false, example: true } as RiskMeta;
    expect(showForecast(meta, false)).toBe(false);
    expect(showForecast(meta, true)).toBe(true);
    expect(showForecast({ ...meta, engine_ready: true, example: false }, false)).toBe(true);
    expect(showForecast({ ...meta, engine_ready: true }, false)).toBe(false);
    expect(exampleMode("?risk=example", "")).toBe(true);
    expect(exampleMode("", "example")).toBe(true);
    expect(exampleMode("?risk=real", "")).toBe(false);
  });
  it("does not disguise a failed server as missing data", async () => {
    const failed = (async () => new Response(null, { status: 500 })) as typeof fetch;
    await expect(loadRiskCountry("BGR", false, failed)).rejects.toThrow("500");
  });
  it("rejects paths masquerading as countries", async () => {
    await expect(loadRiskCountry("../meta", false, fetch404)).rejects.toThrow("Invalid country");
  });
});
