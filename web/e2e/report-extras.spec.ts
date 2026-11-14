import { expect, test } from "@playwright/test";
import { openReport, monthCell } from "./helpers";

test.use({ launchOptions: { args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test("season chart follows the selected year and fits the report", async ({ page }) => {
  await openReport(page, "/?sel=c:BGR");
  const chart = page.getByTestId("cumulative-chart");
  await expect(chart).toBeVisible();
  await monthCell(page, "August 2024").click();
  await expect(chart.getByRole("img")).toHaveAttribute("aria-label", /2024/);
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 375 || width === 1280) {
      await chart.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/report-extras-${width}.png` });
    }
  }
  const download = page.waitForEvent("download");
  await chart.getByRole("button", { name: "Download season chart PNG" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
