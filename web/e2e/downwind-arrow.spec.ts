import { expect, test } from "@playwright/test";

/**
 * A place already burning gets a short arrow on the map, pointing where the
 * day's wind blows to. These two places use the live recent-fire files: the
 * Sudan point had hundreds of detections around it in November 2026, Sofia none.
 */
const label = "Downwind: guide from the wind forecast, not a tested spread forecast";

test("a burning place gets the downwind arrow on the map, pointing the way the card says", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?v=f&sel=p:10.092,24.045,50", { waitUntil: "domcontentloaded" });
  const card = page.getByTestId("active-fire");
  await expect(card).toBeVisible({ timeout: 40_000 });
  const arrow = page.locator(".downwind-marker");
  await expect(arrow).toHaveCount(1);
  await expect(arrow.locator("svg")).toHaveAttribute("aria-label", label);
  // The marker's rotation is the same compass direction the card names.
  const sentence = await card.locator(".fire-wind p").first().innerText();
  const to = /towards the ([NSEW]{1,2})\./.exec(sentence)?.[1];
  expect(to).toBeDefined();
  const rotation = await arrow.evaluate((node) => Number(/rotateZ\((-?[\d.]+)deg\)/.exec((node as HTMLElement).style.transform)?.[1]));
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  expect(points[Math.round((((rotation % 360) + 360) % 360) / 45) % 8]).toBe(to);

  // Leaving the place removes the arrow.
  await page.getByRole("button", { name: "Close the report", exact: true }).click();
  await expect(arrow).toHaveCount(0);
});

test("a place with no fire nearby gets no arrow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?v=f&sel=p:42.6977,23.3219,50", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("fire-around")).toBeVisible({ timeout: 40_000 });
  await expect(page.locator(".fc-panel .fc-score").first()).toBeVisible();
  await expect(page.getByTestId("active-fire")).toHaveCount(0);
  await expect(page.locator(".downwind-marker")).toHaveCount(0);
});
