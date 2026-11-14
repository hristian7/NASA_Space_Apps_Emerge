import { describe, expect, it } from "vitest";
import english from "../../messages/country.en.json";
import bulgarian from "../../messages/country.bg.json";
import { ISO3_TO_ISO2 } from "../../src/components/app/country-codes";
import { readFileSync } from "node:fs";

const index = JSON.parse(readFileSync("public/data/countries/index.json", "utf8")) as {
  countries: { iso3: string }[];
};
const meta = JSON.parse(readFileSync("public/data/meta.json", "utf8")) as { countries: string[] };

describe("country names", () => {
  it("provides readable names in both languages for every country the app lists", () => {
    const codes = new Set([...Object.keys(ISO3_TO_ISO2), "XKX", ...meta.countries, ...index.countries.map((row) => row.iso3)]);
    for (const messages of [english, bulgarian]) {
      for (const code of codes) {
        const name = (messages as Record<string, string>)[code];
        expect(name, code).toBeTruthy();
        expect(name, code).not.toMatch(/^(country\.)?[A-Z]{3}$/);
      }
    }
  });

  it("preserves existing names and identifies the requested countries", () => {
    expect([english.BGR, english.USA, english.BRA, english.AUS]).toEqual(["Bulgaria", "United States", "Brazil", "Australia"]);
    expect([bulgarian.BGR, bulgarian.USA, bulgarian.BRA, bulgarian.AUS]).toEqual(["България", "САЩ", "Бразилия", "Австралия"]);
  });
});
