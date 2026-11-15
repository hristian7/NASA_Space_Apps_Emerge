import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LAYERS } from "../../src/config/layers";
import { panelLayers } from "../../src/lib/layers/url-state";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "..", "messages");

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(messagesDir, `layers.${locale}.json`), "utf8"));
}

function at(source: Record<string, unknown>, key: string): unknown {
  return key
    .replace(/^layers\./, "")
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      source,
    );
}

describe("the registry drives the panel list", () => {
  it("lists every layer that carries a panel block, in its stated order", () => {
    const listed = panelLayers().map((entry) => entry.id);
    const expected = LAYERS.filter((entry) => entry.panel !== undefined)
      .slice()
      .sort((a, b) => (a.panel?.order ?? 0) - (b.panel?.order ?? 0))
      .map((entry) => entry.id);
    expect(listed).toEqual(expected);
    expect(listed).toEqual(["harmonized-history", "recent-fires", "fire-danger", "nasa-fwi", "soil-moisture", "greenness", "land-type", "air-temperature", "wind", "rain", "smoke"]);
  });

  it("replaces AIRS with forecast temperature while keeping its stable key", () => {
    const temperature = LAYERS.find(entry => entry.id === "air-temperature");
    expect(temperature?.kind).toBe("temperature_field");
    expect(temperature?.source).toEqual({ kind: "api_route", path: "https://api.open-meteo.com/v1/forecast" });
    expect(temperature?.panel?.urlKey).toBe("t");
    expect(temperature?.panel?.control).toBe("danger_day");
    expect(temperature?.loader).toEqual({ status: "built", module: "lib/layers/temperature", fn: "fetchTemperature" });
  });

  it("pins IMERG to its available observation and supported tile zoom", () => {
    const rain = LAYERS.find(entry => entry.id === "rain");
    expect(rain?.source.kind).toBe("tile_template");
    if (rain?.source.kind !== "tile_template") throw new Error("Expected IMERG tiles");
    expect(rain.source.urlTemplate).toBe("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png");
    expect(rain.source.maxzoom).toBe(6);
    expect(rain.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rain.panel?.control).toBe("none");
    expect(rain.credit).toBe("NASA GPM IMERG / NASA GIBS");
  });

  it("leaves out a layer with no panel block", () => {
    const extra = {
      ...LAYERS[0],
      id: "test-layer",
      panel: undefined,
    };
    expect(extra.panel).toBeUndefined();
    expect(panelLayers().some((entry) => entry.id === "test-layer")).toBe(false);
  });

  it("gives every listed layer a name, an explanation and a time line in both languages", () => {
    for (const locale of ["en", "bg"]) {
      const source = messages(locale);
      for (const entry of panelLayers()) {
        expect(at(source, entry.nameKey), `${locale} ${entry.nameKey}`).toBeTypeOf("string");
        expect(
          at(source, entry.panel?.explainKey ?? ""),
          `${locale} ${entry.panel?.explainKey}`,
        ).toBeTypeOf("string");
        expect(
          at(source, entry.panel?.timeKey ?? ""),
          `${locale} ${entry.panel?.timeKey}`,
        ).toBeTypeOf("string");
      }
    }
  });

  it("gives every listed layer its own address-bar key and a credit", () => {
    const keys = panelLayers().map((entry) => entry.panel?.urlKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of panelLayers()) {
      expect(entry.credit.length).toBeGreaterThan(0);
    }
  });

  it("names the fire danger layer as the specification requires it", () => {
    for (const locale of ["en", "bg"]) {
      const title = String(at(messages(locale), "layers.fireDanger"));
      expect(/\(/.test(title), `${locale}: ${title}`).toBe(true);
      for (const banned of ["warning", "red flag", "code red", "предупреждение"]) {
        expect(title.toLowerCase().includes(banned), `${locale}: ${banned}`).toBe(false);
      }
    }
  });
});
