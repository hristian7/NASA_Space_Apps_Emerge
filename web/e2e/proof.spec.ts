import { expect, test } from "@playwright/test";

/**
 * The proof page renders the committed validation file. While that file is the
 * example one, the page has to say so before any table is read.
 */
test("the proof page shows the example banner and the tables from the file", async ({
  page,
}) => {
  await page.goto("/proof", { waitUntil: "domcontentloaded" });

  const banner = page.locator('[data-testid="proof-example"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("example file");

  await expect(page.getByRole("heading", { name: "How we know it is right" })).toBeVisible();
  for (const heading of [
    "How the check was made",
    "Hold-out results",
    "Does the range hold",
    "Control totals",
    "What this data cannot do",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // The grid size is a real number in the example file, so it is on the page.
  await expect(page.getByText("0.25", { exact: true }).first()).toBeVisible();
  // The measured columns are still empty there, and the page says so plainly.
  await expect(page.getByText("not yet measured").first()).toBeVisible();
});
