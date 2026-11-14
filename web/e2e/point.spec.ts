import { expect, test } from "@playwright/test";
import { calendar, openReport, unitButton } from "./helpers";

const lowConfidence = '[data-testid="low-confidence"]';

/**
 * A point with a search distance covers whole grid squares, so it is reported
 * plainly. With no distance at all the selection is smaller than one square
 * and the report has to say so.
 */
test("a point with 50 km reports without the low confidence label", async ({ page }) => {
  await openReport(page, "/?sel=p:42.7,23.3,50");

  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText("Point 42.700, 23.300, within 50 km")).toBeVisible();
  await expect(page.locator(lowConfidence)).toHaveCount(0);

  // Per-satellite counts are held for countries only, so the mode says so.
  const perSatellite = unitButton(page, "Per satellite");
  await expect(perSatellite).toBeDisabled();
});

test("a point with no distance says the figures are for the whole square", async ({
  page,
}) => {
  await openReport(page, "/?sel=p:42.7,23.3,0");

  await expect(calendar(page)).toBeVisible();
  await expect(page.locator(lowConfidence)).toBeVisible();
  await expect(page.locator(lowConfidence)).toContainText("smaller than one grid square");
});
