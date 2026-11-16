import { expect, test, type Page } from "@playwright/test";

/**
 * Our model scores new fires only, so a square already burning gets a near-zero
 * chance. Where the recent-fire check finds a detection in the square or its
 * neighbours, the card says so and shows no level at all.
 */
const place = { lat: 43.53, lon: 24.13 };

async function stubNearbyFires(page: Page, detections: { lat: number; lon: number; hoursAgo: number }[]) {
  await page.route(/\/api\/recent\?.*near=/, async (route) => {
    const dates: string[] = [];
    const cols = { lat: [] as number[], lon: [] as number[], date: [] as number[], minute: [] as number[], frp: [] as number[], sat: [] as number[], conf: [] as number[] };
    for (const detection of detections) {
      const at = new Date(Date.now() - detection.hoursAgo * 3600 * 1000);
      const day = at.toISOString().slice(0, 10);
      if (!dates.includes(day)) dates.push(day);
      cols.lat.push(detection.lat);
      cols.lon.push(detection.lon);
      cols.date.push(dates.indexOf(day));
      cols.minute.push(at.getUTCHours() * 60 + at.getUTCMinutes());
      cols.frp.push(12);
      cols.sat.push(1);
      cols.conf.push(1);
    }
    await route.fulfill({
      json: { schema: "emerge-recent-1", window: "7d", built: new Date().toISOString(), dataTime: null, dataStart: null, total: detections.length, shown: detections.length, capped: false, satLabels: [], confLabels: [], dates, cols, sources: [] },
    });
  });
}

test("a place with a fire in its square shows the active-fire card and no level", async ({ page }) => {
  await stubNearbyFires(page, [
    { lat: place.lat + 0.01, lon: place.lon + 0.01, hoursAgo: 3 },
    { lat: place.lat - 0.02, lon: place.lon, hoursAgo: 40 },
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?v=f&sel=p:${place.lat},${place.lon},50`, { waitUntil: "domcontentloaded" });
  const card = page.getByTestId("active-fire");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Active fire nearby");
  const around = page.locator(".fc-panel").getByTestId("fire-around");
  await expect(around.locator(".fire-figures p").nth(0)).toHaveText("1in the last 24 hours");
  await expect(around.locator(".fire-figures p").nth(1)).toHaveText("2in the last 7 days");
  await expect(around.locator(".fire-verdict")).toHaveText("Some fires nearby this week.");
  await expect(card).toContainText("Our score covers new fires only; this area is already burning.");
  await expect(card).toContainText("Guide from the wind forecast, not a tested spread forecast.");
  await expect(page.locator(".fc-scoreRow")).toHaveCount(0);
  await expect(page.locator(".fc-panel").getByText(/^Level \d$/)).toHaveCount(0);

  // The History tab's card follows the same rule.
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".risk-here").getByTestId("active-fire")).toBeVisible();
  await expect(page.locator(".risk-here").getByText(/^Level \d$/)).toHaveCount(0);
});

test("a place with no recent fire nearby keeps its score", async ({ page }) => {
  // Three squares away: counted by no rule.
  await stubNearbyFires(page, [{ lat: place.lat + 0.8, lon: place.lon, hoursAgo: 3 }]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/?v=f&sel=p:${place.lat},${place.lon},0`, { waitUntil: "domcontentloaded" });
  // The score block replaces the "checking" line once the fire check has answered.
  await expect(page.locator(".fc-panel .fc-score").first()).toBeVisible();
  await expect(page.getByText("Checking recent fires nearby…")).toHaveCount(0);
  await expect(page.getByTestId("active-fire")).toHaveCount(0);
  // About 89 km away: outside the 50 km of "fire around here" too.
  await expect(page.getByTestId("fire-around").locator(".fire-verdict")).toHaveText("No fires detected nearby this week.");
  await expect(page.locator(".fc-panel .fc-note").first()).toHaveText("Counts only new fires in this 28 km square; fires already burning nearby are shown above.");
});
