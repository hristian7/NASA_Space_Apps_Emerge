import { expect, type Page } from "@playwright/test";

/**
 * The map streams tiles for as long as it is on screen, so "the network went
 * quiet" never happens here. Every spec waits for the thing it is about to
 * look at instead.
 */
export async function openReport(page: Page, search: string): Promise<void> {
  await page.goto(search, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('svg[role="grid"]');
}

/** The calendar, as a grid of cells with their spoken labels. */
export function calendar(page: Page) {
  return page.locator('svg[role="grid"]');
}

/** One month's cell, found by the words it says. */
export function monthCell(page: Page, label: string) {
  return page.locator(`[role="gridcell"][aria-label^="${label}:"]`);
}

/**
 * One button of the unit toggle. The glossary names some of the same words
 * further down the panel, so the search is kept inside the toggle itself.
 */
export function unitButton(page: Page, name: string, group = "Values shown") {
  return page
    .getByRole("group", { name: group })
    .getByRole("button", { name, exact: true });
}

/** The full sheet, so a phone-sized viewport shows the whole report. */
export async function openSheet(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-sheet", "full"),
  );
}

/**
 * The layer list: a dock that is always open from 1024px wide, a panel behind
 * the tool column's button on narrower screens. Opens it either way.
 */
export async function openLayers(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector("#layer-panel.docked") !== null || window.matchMedia("(max-width: 1023px)").matches,
  );
  const panel = page.locator("#layer-panel");
  if (!(await panel.isVisible())) {
    await page.getByRole("button", { name: "Layers and legend" }).click();
  }
  await expect(panel).toBeVisible();
}

/** Closes the narrow-screen layer panel; the wide-screen dock stays, clear of the map's middle. */
export async function closeLayers(page: Page): Promise<void> {
  const close = page.locator("#layer-panel:not(.docked)").getByRole("button", { name: "Close", exact: true });
  if (await close.isVisible()) await close.click();
}
