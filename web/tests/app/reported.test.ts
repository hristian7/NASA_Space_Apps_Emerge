import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReportedFile } from "../../src/types/data";
import {
  hasNationalReport,
  seriesViews,
  sharedYears,
} from "../../src/components/app/reported";
import {
  ISO3_TO_ISO2,
  localizedCountryName,
} from "../../src/components/app/country-codes";

function reported(iso3: string): ReportedFile {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "public", "data", "reported", `${iso3}.json`),
      "utf8",
    ),
  ) as ReportedFile;
}

describe("reading a country's published figures", () => {
  it("keeps every series of the file, the primary one first", () => {
    const views = seriesViews(reported("BGR"));
    expect(views.length).toBeGreaterThan(1);
    expect(views[0].kind).toBe("national_report");
    expect(views.some((view) => view.kind === "satellite_estimate")).toBe(true);
  });

  it("carries each series' own source, note and fetch date", () => {
    for (const view of seriesViews(reported("BGR"))) {
      expect(view.name.length).toBeGreaterThan(0);
      expect(view.note).not.toBeNull();
      expect(view.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("puts the newest year first and names the span it really holds", () => {
    const [first] = seriesViews(reported("USA"));
    const years = first.years.map((row) => row.y);
    expect(years[0]).toBeGreaterThan(years[years.length - 1]);
    expect(first.latest?.y).toBe(years[0]);
    expect(first.span).toEqual([years[years.length - 1], years[0]]);
    expect(first.oneYear).toBe(false);
  });

  it("leaves out a year with no figure at all", () => {
    const file: ReportedFile = {
      schema: "emerge-reported-2",
      example: false,
      built: "2026-11-14",
      iso3: "TST",
      scope: "national",
      kind: "national_report",
      source: {
        name: "A source",
        url: null,
        fetched: null,
        covers: [2020, 2022],
        note: null,
      },
      units: { fires: "count", burned_ha: "hectares" },
      years: [],
      series: [
        {
          kind: "national_report",
          source: {
            name: "A source",
            url: null,
            fetched: null,
            covers: [2020, 2022],
            note: null,
          },
          years: [
            { y: 2020, fires: null, burned_ha: null },
            { y: 2021, fires: 5, burned_ha: null },
          ],
        },
      ],
    };
    const [view] = seriesViews(file);
    expect(view.years.map((row) => row.y)).toEqual([2021]);
    expect(view.oneYear).toBe(true);
    expect(view.span).toEqual([2021, 2021]);
  });

  it("reads a file written to the older schema as one series", () => {
    const file = reported("BGR");
    const old: ReportedFile = {
      ...file,
      schema: "emerge-reported-1",
      series: undefined,
    };
    const views = seriesViews(old);
    expect(views).toHaveLength(1);
    expect(views[0].years.length).toBeGreaterThan(0);
  });

  it("says whether a national authority published anything at all", () => {
    expect(hasNationalReport(reported("BGR"))).toBe(true);
    expect(hasNationalReport(reported("USA"))).toBe(true);
  });

  it("finds the years a series and our own record share", () => {
    const [view] = seriesViews(reported("BGR"));
    const ours = view.years.slice(0, 2).map((row) => ({ y: row.y }));
    expect(sharedYears(view, ours)).toEqual(ours.map((row) => row.y));
  });
});

describe("naming a country in the reader's language", () => {
  it("asks the browser, which knows both languages", () => {
    expect(localizedCountryName("BGR", "en")).toBe(
      new Intl.DisplayNames(["en"], { type: "region" }).of("BG"),
    );
    expect(localizedCountryName("BGR", "bg")).toBe(
      new Intl.DisplayNames(["bg"], { type: "region" }).of("BG"),
    );
    expect(localizedCountryName("BRA", "bg")).not.toBe("Brazil");
  });

  it("answers null for a code the browser cannot name", () => {
    expect(localizedCountryName("XKX", "en")).toBeNull();
    expect(localizedCountryName("ZZZ", "en")).toBeNull();
  });

  it("maps every country the data set holds, or leaves it to the fallback", () => {
    const index = JSON.parse(
      readFileSync(
        join(process.cwd(), "public", "data", "countries", "index.json"),
        "utf8",
      ),
    ) as { countries: { iso3: string }[] };
    const missing = index.countries
      .map((row) => row.iso3)
      .filter((iso3) => ISO3_TO_ISO2[iso3] === undefined);
    // Only codes that are not ISO 3166-1 may be missing.
    expect(missing).toEqual(["XKX"]);
  });

  it("maps every three letter code to a distinct two letter one", () => {
    const seen = new Set(Object.values(ISO3_TO_ISO2));
    expect(seen.size).toBe(Object.keys(ISO3_TO_ISO2).length);
    for (const [three, two] of Object.entries(ISO3_TO_ISO2)) {
      expect(three).toMatch(/^[A-Z]{3}$/);
      expect(two).toMatch(/^[A-Z]{2}$/);
    }
  });
});
