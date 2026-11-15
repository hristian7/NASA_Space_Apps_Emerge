import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { RiskScorecard } from "../src/app/proof/risk-data";

test.use({ launchOptions: { args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
const fixture = (): RiskScorecard => JSON.parse(readFileSync("public/data/risk/example/scorecard.json", "utf8"));
function baselines() {
  const card = fixture();
  card.example = false;
  for (const scope of Object.values(card.scopes)) for (const year of Object.values(scope.years)) for (const s of Object.values(year.selections)) {
    for (const row of [s.pooled, s.regions_under_20, s.regions_20_or_more, ...Object.values(s.regions), ...Object.values(s.months), ...(s.continuing ? [s.continuing] : [])]) delete row.methods.model;
    s.bootstrap = {};
    delete s.probability.brier_skill;
  }
  return card;
}

for (const state of ["absent", "baselines", "model"] as const) {
  test(`${state} state renders and fits all required widths`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().includes("404")) errors.push(message.text()); });
    if (state !== "model") await page.route("**/data/risk/scorecard.json", route => state === "absent"
      ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ json: baselines() }));
    await page.goto(state === "model" ? "/proof?risk=example" : "/proof");
    const section = page.getByTestId("proof-risk");
    await expect(section).toBeVisible();
    if (state === "absent") {
      await expect(section).toContainText("Not tested yet. No next-day scorecard is available.");
      await expect(section.locator("table")).toHaveCount(0);
    } else {
      const selection = page.getByTestId("risk-selection-europe-forest_wildland");
      await expect(selection).toContainText("2,696,741 of 4,508,529");
      await expect(selection.locator("table").first()).toContainText("41.1%");
      await expect(selection.locator("table").first()).toContainText("51%");
      await expect(selection.locator("table").first()).toContainText("Not a probability");
      await expect(selection).toContainText("Regions with fewer than 20 spots");
      if (state === "baselines") {
        await expect(selection.getByTestId("risk-verdict")).toContainText("Model not tested yet");
        await expect(section).not.toContainText("Example only");
        await expect(selection).toContainText("bootstrap not tested yet");
      } else {
        await expect(section).toContainText("Example only");
        await expect(selection.getByTestId("risk-verdict")).toContainText("The model caught 51%");
        await expect(section).not.toContainText("More accurate than");
        await expect(selection).toContainText("95% interval");
        await expect(selection.getByTestId("risk-weak-slices").locator("li").first()).toBeVisible();
      }
    }
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      // Check the new section itself too, not just the document viewport.
      expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (width === 375 || width === 1280) {
        await section.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`${state}-${width}.png`) });
      }
    }
    expect(errors).toEqual([]);
  });
}

test("Bulgarian scorecard and absent state fit the phone", async ({ page, context, baseURL }, testInfo) => {
  await context.addCookies([{ name: "emerge-locale", value: "bg", url: baseURL! }]);
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/proof?risk=example");
  const section = page.getByTestId("proof-risk");
  await expect(section).toContainText("Само пример.");
  await expect(section).toContainText("Моделът улови 51%");
  await expect(section).toContainText("Къде моделът губи");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("bg-375.png") });
  await page.goto("/proof");
  await expect(page.getByTestId("risk-week-table")).toContainText("Седмична прогноза");
  await page.route("**/data/risk/scorecard.json", route => route.fulfill({ status: 404, body: "" }));
  await page.goto("/proof");
  await expect(section).toContainText("Все още не е проверено.");
});

test("read errors are not presented as an untested model", async ({ page }) => {
  await page.route("**/data/risk/scorecard.json", route => route.fulfill({ status: 503, body: "" }));
  await page.goto("/proof");
  await expect(page.getByTestId("proof-risk")).toContainText("could not be read");
});

test("week outlook displays the measured lead scores at phone and desktop widths", async ({ page }, testInfo) => {
  const card: RiskScorecard = JSON.parse(readFileSync("public/data/risk/scorecard.json", "utf8"));
  await page.goto("/proof");
  const table = page.getByTestId("risk-week-table");
  await expect(table.locator("tbody tr")).toHaveCount(6);
  const first = card.week!.leads["3"].scopes.world.selections.forest_wildland.pooled.methods;
  const percent = (n: number) => new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(n);
  await expect(table.locator("tbody tr").first()).toContainText(percent(first.fwi!.capture_rate!));
  await expect(table.locator("tbody tr").first()).toContainText(percent(first.history!.capture_rate!));
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await table.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`week-proof-${width}.png`) });
  }
});
