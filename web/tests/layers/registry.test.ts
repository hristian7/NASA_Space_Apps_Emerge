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
    expect(listed).toEqual(["harmonized-history", "recent-fires", "fire-danger"]);
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
