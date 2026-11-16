import { expect, test } from "@playwright/test";

/**
 * On a phone the report is a sheet under the timeline: the timeline's note
 * opens only on request, the whole top strip resizes the sheet, and the
 * header with its close button stays in view while the report scrolls.
 */
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test("the timeline note opens from its button and closes on a tap outside", async ({ page }) => {
  await page.goto("/?v=f&lay=d,g&sel=p:42.6977,23.3219,50", { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: "Layers the slider does not move", exact: true });
  await expect(button).toBeVisible();
  await expect(page.locator(".timeline-note")).toHaveCount(0);
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".timeline-note")).toContainText("The slider moves fire history and fire danger.");
  await page.locator(".report-head h1").click();
  await expect(page.locator(".timeline-note")).toHaveCount(0);
});

test("a tap on the sheet's top strip toggles between half and full", async ({ page }) => {
  await page.goto("/?v=f&sel=p:42.6977,23.3219,50", { waitUntil: "domcontentloaded" });
  const strip = page.getByRole("button", { name: "Change the panel height", exact: true });
  await expect(strip).toBeVisible();
  const box = await strip.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await page.evaluate(() => document.documentElement.setAttribute("data-sheet", "half"));
  await strip.click();
  await expect(page.locator("html")).toHaveAttribute("data-sheet", "full");
  await strip.click();
  await expect(page.locator("html")).toHaveAttribute("data-sheet", "half");
});

test("the sheet header and its close button stay in view while the report scrolls", async ({ page }) => {
  await page.goto("/?v=f&sel=p:42.6977,23.3219,50", { waitUntil: "domcontentloaded" });
  await page.locator(".fc-tiles").waitFor({ timeout: 40_000 });
  await page.evaluate(() => document.documentElement.setAttribute("data-sheet", "full"));
  const close = page.getByRole("button", { name: "Close the report", exact: true });
  // The sheet grows to full height first; measure once it has settled.
  let settled = -1;
  await expect.poll(async () => {
    const y = (await close.boundingBox())?.y ?? -1;
    const still = y === settled;
    settled = y;
    return still;
  }).toBe(true);
  const before = await close.boundingBox();
  await page.locator(".report-scroll").evaluate((node) => {
    node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
  });
  await expect.poll(() => page.locator(".report-scroll").evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
  await expect(close).toBeInViewport();
  const after = await close.boundingBox();
  expect(after?.y).toBe(before?.y);
});
