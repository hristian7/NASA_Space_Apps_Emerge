import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aerosolIndexPalette } from "../../src/lib/layers/aerosol-palette";
import { aerosolIndexOf, keepPlumes, smokeThreshold } from "../../src/lib/layers/smoke";

describe("smoke layer", () => {
  it("reads every colour of NASA's aerosol index map back to its class", () => {
    expect(aerosolIndexPalette).toHaveLength(202);
    expect(aerosolIndexOf(255, 255, 255)).toBe(-Infinity);
    expect(aerosolIndexOf(240, 240, 240)).toBe(0);
    expect(aerosolIndexOf(115, 0, 25)).toBe(5);
    expect(aerosolIndexOf(1, 2, 3)).toBeNull();
  });

  it("clears clean air and thin haze and keeps plumes, stronger where thicker", () => {
    const at = (value: number) => {
      const [r, g, b] = aerosolIndexPalette.find((entry) => entry[3] === value)!;
      return [r, g, b];
    };
    const pixels = new Uint8ClampedArray([
      ...at(0.5), 255,
      ...at(smokeThreshold), 255,
      ...at(4), 255,
      0, 0, 0, 0,
      1, 2, 3, 255,
    ]);
    expect(keepPlumes(pixels)).toBe(2);
    expect(pixels[3]).toBe(0);
    expect(pixels[7]).toBeGreaterThan(0);
    expect(pixels[11]).toBe(255);
    expect(pixels[7]).toBeLessThan(pixels[11]);
    expect(pixels[15]).toBe(0);
    expect(pixels[19]).toBe(0);
  });

  it("names the layer in both languages", () => {
    for (const locale of ["en", "bg"]) {
      const layers = JSON.parse(readFileSync(new URL(`../../messages/layers.${locale}.json`, import.meta.url), "utf8"));
      for (const key of ["smoke", "smokeExplain", "smokeTime"]) expect(layers[key], `${locale} ${key}`).toBeTruthy();
    }
  });
});
