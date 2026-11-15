import { expect, test } from "@playwright/test";
import { monthCell, openLayers, openReport } from "./helpers";

/**
 * Plan 1 gap M4: a month clicked in the fire calendar is drawn on the map for
 * the chosen place, the labels say which month, and the same month again
 * goes back to the history year.
 */
test("a calendar month click shows that month on the map", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openReport(page, "/?sel=c:BGR");
  const map = page.locator(".map");
  await expect(map).toHaveAttribute("data-history", /^year:\d{4}$/);

  await monthCell(page, "July 2007").click();
  await expect(map).toHaveAttribute("data-history", "month:2007-07");
  await expect(page.locator(".timeline-value")).toHaveText("July 2007");
  await openLayers(page);
  await expect(page.locator(".layer-row").first()).toContainText("Fire days, July 2007");

  await monthCell(page, "July 2007").click();
  await expect(map).toHaveAttribute("data-history", /^year:\d{4}$/);
  await expect(page.locator(".timeline-value")).not.toHaveText("July 2007");
});
