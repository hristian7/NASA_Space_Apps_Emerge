import { expect, test } from "@playwright/test";

test("the data sources page lists NASA data first and copies it for the form", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/data-sources");
  await expect(page.getByRole("heading", { level: 1, name: "Data sources" })).toBeVisible();
  await expect(page.locator('.info-tab[aria-current="page"]')).toHaveText("Data sources");

  const nasa = page.locator('section[data-section="nasa"]');
  await expect(nasa.locator(".ds-card")).toHaveCount(14);
  await expect(page.locator('section[data-section="other"] .ds-sub')).toHaveCount(4);

  await nasa.getByRole("button", { name: "Copy for the NASA form" }).click();
  await expect(nasa.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const lines = copied.split("\n");
  expect(lines).toHaveLength(14);
  expect(lines[0]).toBe("NASA FIRMS archive: MODIS C6.1 and VIIRS 375 m fire detections\thttps://firms.modaps.eosdis.nasa.gov/country/");

  const width = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(width).toBe(true);
});

test("the data sources page reads in Bulgarian and is reachable from the info tabs", async ({ page, context }) => {
  await context.addCookies([{ name: "emerge-locale", value: "bg", url: "http://localhost" }]);
  await page.goto("/about");
  await page.locator(".info-tab", { hasText: "Източници на данни" }).click();
  await expect(page).toHaveURL(/\/data-sources$/);
  await expect(page.getByRole("heading", { level: 1, name: "Източници на данни" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Копирай за формуляра на НАСА" }).first()).toBeVisible();
});
