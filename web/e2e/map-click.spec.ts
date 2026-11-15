import { expect, test } from "@playwright/test";
import { readData } from "./data";

/**
 * The History card is titled by the date its example forecast is valid for,
 * worked out here from the calendar: that date today, tomorrow, or past.
 */
function historyCardTitle(): string {
  const validFor = readData<{ days: { tomorrow: string } }>("risk/example/meta.json").days.tomorrow;
  const utc = (offset: number) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
  };
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (localToday > validFor) return "Chance of a new fire here";
  if (validFor === utc(0)) return "Chance of a new fire here today";
  if (validFor === utc(1)) return "Chance of a new fire here tomorrow";
  return `Chance of a new fire here, latest forecast for ${validFor}`;
}

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
  await expect(page.getByRole("heading", { name: historyCardTitle(), exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Forecast", exact: true }).click();
  await expect(page).toHaveURL(/[?&]v=f(&|$)/);
  await expect(page).toHaveURL(/sel=p:/);
  await expect(page.getByText(/^Chance a new fire starts here (today|tomorrow) \(unofficial\)$/)).toBeVisible();
});
