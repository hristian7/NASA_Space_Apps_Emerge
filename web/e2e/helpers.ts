import type { Page } from "@playwright/test";

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
