import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openReport } from "./helpers";
import { monthOf } from "./data";

/**
 * The monthly CSV is built in the browser and saved as a file, so the spec
 * takes the saved file and reads its first lines: the comment block, then the
 * column line in the frozen order.
 */
test("the monthly CSV saves with its comment lines and its columns", async ({ page }) => {
  await openReport(page, "/?sel=c:BGR");

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Monthly numbers, CSV" }).click();
  const download = await saving;

  const path = await download.path();
  expect(path).not.toBeNull();
  const text = readFileSync(path as string, "utf8");
  const lines = text.split("\n");

  expect(lines[0]).toBe("# Emerge: monthly fire numbers");
  expect(lines[1]).toContain("# Selection: Country Bulgaria");
  expect(lines[2]).toContain("# Dates: Nov 2000 to Dec 2025");
  expect(lines[3]).toContain("# Data date:");
  expect(lines[4]).toContain("# Sources:");
  expect(text).toContain("# empty = no measurement, 0 = no fire seen");
  expect(lines[lines.findIndex((line) => !line.startsWith("#"))]).toBe(
    "year,month,unit,value,low,high,source,flags",
  );
  // August 2024 in fire days, exactly as the country file holds it.
  const august = monthOf("BGR", 2024, 8);
  expect(text).toContain(
    `2024,8,cd,${Math.round(august.cd)},${Math.round(august.cd_lo)},${Math.round(august.cd_hi)},${august.src},`,
  );
});

test("the summary CSV saves with the figures the logic worked out", async ({ page }) => {
  await openReport(page, "/?sel=c:BGR");

  const saving = page.waitForEvent("download");
  await page.getByRole("button", { name: "Summary, CSV" }).click();
  const download = await saving;
  const text = readFileSync((await download.path()) as string, "utf8");

  expect(text).toContain("key,value");
  expect(text).toContain("worst_month,");
  expect(text).toContain("chance_of_fire,");
  expect(text).toContain("# empty = no measurement, 0 = no fire seen");
});

test("the hotspots file is offered as a plain address with its limits named", async ({
  page,
}) => {
  await openReport(page, "/?sel=p:42.7,23.3,500");

  const link = page.getByRole("link", { name: /Hotspots, CSV, for \d{4}/ });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toContain("/api/hotspots?");
  // The route takes at most 200 km, whatever the selection asked for.
  expect(href).toContain("radius_km=200");
  await expect(page.locator('[data-testid="hotspots-note"]')).toContainText("366 days");
});
