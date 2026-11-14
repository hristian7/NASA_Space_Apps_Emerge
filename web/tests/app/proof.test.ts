import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ValidationFile } from "../../src/types/data";
import ProofTables from "../../src/app/proof/tables";
import proofEn from "../../messages/proof.en.json";

/** The words, read from the shipped file the way next-intl would. */
function translate(key: string, values?: Record<string, string | number>): string {
  const text = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node === null || node === undefined
          ? undefined
          : (node as Record<string, unknown>)[part],
      proofEn as unknown as Record<string, unknown>,
    );
  if (typeof text !== "string") throw new Error(`No English message for ${key}`);
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values?.[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Made-up numbers, none of which appear anywhere in the page's own words. If
 * one of them turns up in the markup it can only have come from this object,
 * which is the point of the page: it prints the file and types nothing.
 */
const invented: ValidationFile = {
  schema: "emerge-validation-1",
  example: false,
  built: "2026-11-15",
  method: {
    grid_deg: 0.3141,
    time_step: "month",
    model: "a made-up conversion",
    reference: "a made-up reference",
    train_years: [2013, 2017],
    test_years: [2018, 2021],
    pre_registered: true,
    leakage_check: "a made-up leakage check",
  },
  holdout: [
    {
      direction: "forward",
      unit: "hot",
      scope: "cell_month",
      train_years: [2013, 2017],
      test_years: [2018, 2021],
      n: 81731,
      nrmse: 0.4271,
      mae: 3.1416,
      bias_pct: -6.2831,
      r: 0.8123,
      slope: 1.0577,
    },
  ],
  slices: [
    { slice: "country", key: "BGR", unit: "cd", n: 7919, nrmse: 0.5236, bias_pct: 2.7182 },
  ],
  satellite_agreement: [
    { pair: "S-NPP against NOAA-20", unit: "hot", years: [2019, 2023], n: 6421, diff_pct: 1.6180 },
  ],
  published_ratios: [
    {
      scope: "a made-up scope",
      unit: "cd",
      ours: 0.9319,
      published: 0.9412,
      published_source: "a made-up publisher",
      note: "a made-up note",
    },
  ],
  range_coverage: [
    { level_pct: 90, unit: "hot", scope: "circle_month", n: 5177, observed_pct: 88.4512 },
  ],
  chance_of_fire: {
    brier: 0.1337,
    reliability: [{ bin: [0.4, 0.6], predicted: 0.5151, observed: 0.4949, n: 2048 }],
  },
  control_totals: [
    { check: "a made-up control total", passed: false, detail: "a made-up detail" },
  ],
  limits: [{ id: "made-up-limit", text: "A made-up sentence about what the data cannot do." }],
};

const numbers = [
  "0.3141",
  "81731",
  "0.4271",
  "3.1416",
  "-6.2831",
  "0.8123",
  "1.0577",
  "7919",
  "0.5236",
  "2.7182",
  "6421",
  "1.618",
  "0.9319",
  "0.9412",
  "5177",
  "88.4512",
  "0.1337",
  "0.5151",
  "0.4949",
  "2048",
  "90",
  "2013",
  "2017",
  "2018",
  "2021",
  "2019",
  "2023",
];

describe("the proof page", () => {
  const markup = renderToStaticMarkup(
    createElement(ProofTables, { validation: invented, t: translate }),
  );

  it.each(numbers)("prints %s, which can only come from the file", (value) => {
    expect(markup).toContain(value);
  });

  it("prints the words that came with those numbers", () => {
    for (const text of [
      "a made-up conversion",
      "a made-up reference",
      "a made-up leakage check",
      "a made-up publisher",
      "a made-up control total",
      "A made-up sentence about what the data cannot do.",
    ]) {
      expect(markup).toContain(text);
    }
  });

  it("says plainly when a figure has not been measured yet", () => {
    const empty: ValidationFile = {
      ...invented,
      method: { ...invented.method, model: null, train_years: null },
      holdout: [{ ...invented.holdout[0], n: null, nrmse: null }],
      slices: [],
      satellite_agreement: [],
      published_ratios: [],
      chance_of_fire: { brier: null, reliability: [] },
      control_totals: [],
      limits: [],
    };
    const blank = renderToStaticMarkup(
      createElement(ProofTables, { validation: empty, t: translate }),
    );
    expect(blank).toContain(translate("empty"));
    expect(blank).toContain(translate("slices.none"));
    expect(blank).toContain(translate("limits.none"));
    expect(blank).not.toContain("81731");
  });

  it("names a control total that did not pass as not passing", () => {
    expect(markup).toContain(translate("controls.failed"));
  });
});

it("localizes shipped validation text and preserves decimal precision in Bulgarian", async () => {
  const proofBg = (await import("../../messages/proof.bg.json")).default;
  const validation = (await import("../../public/data/validation.json")).default as unknown as ValidationFile;
  const bg: typeof translate = (key, values) => {
    const message = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], proofBg);
    if (typeof message !== "string") throw new Error(`No Bulgarian message for ${key}`);
    return message.replace(/\{(\w+)\}/g, (whole, name: string) => values?.[name] === undefined ? whole : String(values[name]));
  };
  const markup = renderToStaticMarkup(createElement(ProofTables, { validation, t: bg }));
  expect(markup).toContain("0,25");
  expect(markup).toContain("0,198284");
  expect(markup).toContain("България");
  expect(markup).toContain("Съединени щати");
  expect(markup).toContain(" и ");
  expect(markup).not.toContain("Ratio of sums");
  expect(markup).not.toContain("Harmonized numbers exist");
  expect(markup).not.toContain("matches exactly");
  expect(markup).not.toContain(" and ");
});
