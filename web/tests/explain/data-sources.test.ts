import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allFormRows, formRows, formText, sourceGroups } from "../../src/lib/ui/sources";

const here = dirname(fileURLToPath(import.meta.url));
const messages = (name: string) =>
  JSON.parse(readFileSync(join(here, "..", "..", "messages", name), "utf8")) as Record<string, unknown>;
const rows = sourceGroups.flatMap((group) => group.rows);

/** Every key the data sources page reads from its own messages. */
const pageKeys = [
  "metaTitle",
  "metaDescription",
  "title",
  "lead",
  "count",
  "nasaHeading",
  "nasaNote",
  "otherHeading",
  "groups.partner",
  "groups.data",
  "groups.software",
  "groups.tools",
  "copy",
  "copied",
  "copyFallback",
  "experimental",
  "opensNewTab",
  "fullList",
];

const at = (tree: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree);

describe("data sources page", () => {
  it("gives every source row a form section", () => {
    for (const row of rows) expect(["nasa", "partner", "other"], row.id).toContain(row.section);
  });

  it("uses full https links that parse", () => {
    for (const row of [...rows.map((r) => ({ id: r.id, url: r.url })), ...allFormRows]) {
      expect(row.url, row.id).toMatch(/^https:\/\//);
      expect(() => new URL(row.url), row.id).not.toThrow();
    }
  });

  it("lists the core NASA resources and no planned ones", () => {
    const nasa = formRows("nasa").map((row) => row.id);
    for (const id of ["firmsCountry", "gfwed", "imerg", "smap", "challenge"]) expect(nasa).toContain(id);
    const planned = new Set(rows.filter((row) => row.roles?.includes("planned")).map((row) => row.id));
    expect(planned.size).toBeGreaterThan(0);
    for (const id of nasa) expect(planned.has(id), id).toBe(false);
    // 14 before model v3, plus NASA SEDAC population (an input) and VIIRS greenness and SMAP soil moisture (tested).
    expect(nasa).toHaveLength(17);
  });

  it("puts each row in one section only", () => {
    const nasa = new Set(formRows("nasa").map((row) => row.id));
    const rest = formRows("other").map((row) => row.id);
    for (const id of rest) expect(nasa.has(id), id).toBe(false);
    expect(nasa.size + rest.length).toBe(allFormRows.length);
  });

  it("copies one Link Text<TAB>URL line per row", () => {
    for (const section of ["nasa", "other"] as const) {
      const list = formRows(section);
      const lines = formText(list).split("\n");
      expect(lines).toHaveLength(list.length);
      lines.forEach((line, i) => {
        const parts = line.split("\t");
        expect(parts, line).toHaveLength(2);
        expect(parts[0]).toBe(list[i].linkText);
        expect(parts[1]).toBe(list[i].url);
      });
    }
  });

  it.each(["en", "bg"])("has every page message and a use for every row in %s", (locale) => {
    const page = messages(`sources.${locale}.json`);
    for (const key of pageKeys) expect(at(page, key), key).toBeTruthy();
    const about = messages(`about.${locale}.json`) as { used: Record<string, string> };
    for (const row of allFormRows) expect(about.used[row.id], row.id).toBeTruthy();
    const info = messages(`info.${locale}.json`) as Record<string, string>;
    expect(info.sourcesTab).toBeTruthy();
    const shell = messages(`shell.${locale}.json`) as Record<string, string>;
    expect(shell.dataSources).toBeTruthy();
  });
});
