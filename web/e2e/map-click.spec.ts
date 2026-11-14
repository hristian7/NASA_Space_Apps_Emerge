import { expect, test } from "@playwright/test";

/**
 * A plain click on the map picks a point with the current search distance,
 * never a whole country: the point's fire history and its next-day risk card
 * show on History, and the score and weather show on Forecast.
 */
test("a map click picks a point and shows its history and risk", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?risk=example", { waitUntil: "domcontentloaded" });
  // The map writes its camera onto its container once it has loaded.
  await page.waitForSelector(".map[data-zoom]");

  await page.locator(".map canvas").click({ position: { x: 640, y: 450 } });

  await expect(page).toHaveURL(/[?&]sel=p:-?\d+(\.\d+)?,-?\d+(\.\d+)?,50(&|$)/);
  await expect(page).not.toHaveURL(/sel=c:/);
  await expect(page.getByText(/^Point · 50 km$/)).toBeVisible();
  await page.waitForSelector('svg[role="grid"]');
  await expect(page.getByRole("heading", { name: "Tomorrow's risk here" })).toBeVisible();

  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await expect(page).toHaveURL(/[?&]v=f(&|$)/);
  await expect(page).toHaveURL(/sel=p:/);
  await expect(page.getByText(/Our fire risk score for (today|tomorrow) \(unofficial\)/)).toBeVisible();
});
