import { expect, test } from "@playwright/test";

/**
 * The Forecast panel follows the timeline day: moving from +1 to +4 changes
 * the weather tiles to that day's row, and past tomorrow the score section
 * says our model covers today and tomorrow only.
 */
test("moving the forecast day changes the weather tiles", async ({ page }) => {
  // A point forecast whose every value names its own row: seven past days,
  // then today and nine more.
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 7);
  const dates = Array.from({ length: 17 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
  await page.route("https://api.open-meteo.com/v1/forecast**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("past_days")) return route.continue();
    await route.fulfill({
      json: {
        daily: {
          time: dates,
          temperature_2m_max: dates.map((_, i) => 100 + i),
          relative_humidity_2m_min: dates.map((_, i) => 50 + i),
          wind_speed_10m_max: dates.map((_, i) => 10 + i),
          wind_gusts_10m_max: dates.map((_, i) => 20 + i),
          wind_direction_10m_dominant: dates.map(() => 90),
          precipitation_sum: dates.map(() => 0),
        },
        hourly: { time: [], soil_moisture_0_to_1cm: [] },
      },
      headers: { "access-control-allow-origin": "*" },
    });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?v=f&sel=p:42.6,23.5,50", { waitUntil: "domcontentloaded" });
  const temperature = page.locator(".fc-tileValue").first();
  await expect(temperature).toContainText("107");

  const slider = page.locator(".timeline input[type=range]");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { name: "Weather and ground here, tomorrow" })).toBeVisible();
  await expect(temperature).toContainText("108");

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(temperature).toContainText("111");
  await expect(page.getByRole("heading", { name: /^Weather and ground here, [A-Z][a-z]+ \d{1,2}$/ })).toBeVisible();
  await expect(page.getByText("Our model forecasts today and tomorrow; for this day, fire weather only.")).toBeVisible();
});
