import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { capture, conversion, featureGroups, gains, levelBands, testYear } from "../../src/app/how-it-works/facts";
import { sourceGroups } from "../../src/lib/ui/sources";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const messages = (name: string) =>
  JSON.parse(readFileSync(join(here, "..", "..", "messages", name), "utf8")) as Record<string, Record<string, string>>;

describe("How it works facts", () => {
  it("lists exactly the model features in pipeline/risk/features.py", () => {
    const source = readFileSync(join(repo, "pipeline", "risk", "features.py"), "utf8");
    const tuple = (name: string) => {
      const match = new RegExp(`${name} = ([^\\n]*(?:\\n[ ]+[^\\n]*)*)`).exec(source);
      return [...(match?.[1] ?? "").matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]);
    };
    const expected = [...tuple("WEATHER"), ...tuple("FEATURES").filter((f) => f !== "WEATHER")];
    const shown = featureGroups.flatMap((group) => [...group.features]);
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual([...expected].sort());
  });

  it("reads the 2025 hold-out numbers from the scorecard", () => {
    expect(testYear).toBe(2025);
    expect(capture.europe.model).toBeCloseTo(0.538, 3);
    expect(capture.europe.history).toBeCloseTo(0.51, 3);
    expect(capture.europe.fwi).toBeCloseTo(0.411, 3);
    expect(capture.europe.random).toBeCloseTo(0.394, 3);
    expect(capture.world.model).toBeCloseTo(0.204, 3);
    expect(capture.world.history).toBeCloseTo(0.167, 3);
    expect(capture.world.fwi).toBeCloseTo(0.112, 3);
    expect(capture.world.random).toBeCloseTo(0.105, 3);
  });

  it("shows a gain only where its whole interval is above zero", () => {
    expect(gains).toHaveLength(4);
    for (const gain of gains) {
      expect(gain.claim).toBe(true);
      expect(gain.low).toBeGreaterThan(0);
      expect(gain.difference).toBeGreaterThan(gain.low);
      expect(gain.high).toBeGreaterThan(gain.difference);
    }
  });

  it("reads conversion and level figures from the committed files", () => {
    expect(conversion.ratio).toBe(2.7);
    expect(conversion.pooledForward).toBeCloseTo(0.1, 2);
    expect(conversion.rangeHeld.map((r) => r.country).sort()).toEqual(["Bulgaria", "United_States"]);
    expect(levelBands).toEqual([0.01, 0.02, 0.05, 0.1]);
  });
});

describe("source register", () => {
  const ids = sourceGroups.flatMap((group) => group.rows.map((row) => row.id));

  it("has unique ids and https links", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of sourceGroups.flatMap((group) => group.rows)) expect(row.url).toMatch(/^https:\/\//);
  });

  it.each(["en", "bg"])("names a use and a group heading for every row in %s", (locale) => {
    const about = messages(`about.${locale}.json`);
    for (const id of ids) expect(about.used[id], id).toBeTruthy();
    for (const group of sourceGroups) expect(about.groups[group.id], group.id).toBeTruthy();
  });

  it("covers every link in docs/references.md", () => {
    const references = readFileSync(join(repo, "docs", "references.md"), "utf8");
    const hosts = new Set(
      [...references.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((m) => m[1].replace(/^www\./, "")),
    );
    const listed = new Set(sourceGroups.flatMap((g) => g.rows.map((r) => new URL(r.url).host.replace(/^www\./, ""))));
    const notCredited = [
      // Documentation pages behind a listed resource, not resources of their own.
      "mapping.emergency.copernicus.eu",
      "emergency.copernicus.eu",
      "maps.effis.emergency.copernicus.eu",
      "portal.nccs.nasa.gov",
      "daac.ornl.gov",
      "doi.gov",
      "visibleearth.nasa.gov",
      "cpc.ncep.noaa.gov",
      "ncei.noaa.gov",
      "xgboost.ai",
      "pytorch.org",
      "rasterio.readthedocs.io",
      "shapely.readthedocs.io",
      "fonts.google.com",
    ];
    const missing = [...hosts].filter((host) => !listed.has(host) && !notCredited.includes(host));
    expect(missing).toEqual([]);
  });
});
