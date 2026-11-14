import { expect, test } from "@playwright/test";
import { readData } from "./data";

interface Validation {
  example: boolean;
  built: string;
  holdout: { n: number | null; nrmse: number | null }[];
  range_coverage: { observed_pct: number | null; level_pct: number }[];
  limits: { id: string; text: string }[];
}

/**
 * The proof page renders the committed validation file. On the real file there
 * is no example banner, and the numbers on the page are the file's own: two of
 * them are read here as the spec runs and looked for in the markup.
 */
test("the proof page shows the real tables, with the numbers from the file", async ({
  page,
}) => {
  const validation = readData<Validation>("validation.json");
  expect(validation.example, "this spec is for the real export").toBe(false);

  await page.goto("/proof", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("table");

  await expect(page.locator('[data-testid="proof-example"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "How we know it is right" }),
  ).toBeVisible();
  await expect(page.getByText(`File built on ${validation.built}`)).toBeVisible();

  for (const heading of [
    "How the check was made",
    "Hold-out results",
    "Does the range hold",
    "Control totals",
    "What this data cannot do",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // Two numbers that can only have come from the file.
  const holdout = validation.holdout.find((row) => row.nrmse !== null);
  const coverage = validation.range_coverage.find((row) => row.observed_pct !== null);
  expect(holdout, "the file carries a scored hold-out row").toBeTruthy();
  expect(coverage, "the file carries a range coverage row").toBeTruthy();
  const body = page.locator("main");
  await expect(body).toContainText(String(holdout?.nrmse));
  await expect(body).toContainText(String(coverage?.observed_pct));

  // Every limit the file states is on the page, in its own words.
  expect(validation.limits.length).toBeGreaterThan(0);
  for (const limit of validation.limits) {
    await expect(body).toContainText(limit.text.slice(0, 60));
  }
});
