import { expect, test } from "@playwright/test";
import { calendar, monthCell, openReport } from "./helpers";
import { asShown, monthOf } from "./data";

/**
 * Switching the language keeps the view: the same selection, the same unit,
 * the same month and the same range, with every word in the other language.
 */
test("the language switch keeps the view", async ({ page }) => {
  const august = monthOf("BGR", 2024, 8);

  await openReport(page, "/?sel=c:BGR&u=hot&mo=2024-08");

  await expect(page.getByText("Selected month: August 2024")).toBeVisible();
  await expect(monthCell(page, "August 2024")).toHaveAttribute(
    "aria-label",
    new RegExp(`${asShown(august.hot)} hotspots`),
  );

  await page.getByRole("button", { name: "Bulgarian" }).click();
  await page.waitForSelector('svg[role="grid"]');

  await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText("Избран месец: август 2024")).toBeVisible();
  // The same figure, written the way Bulgarian groups digits.
  const asBulgarian = new Intl.NumberFormat("bg-BG", {
    maximumFractionDigits: 0,
  }).format(Math.round(august.hot));
  await expect(monthCell(page, "август 2024")).toHaveAttribute(
    "aria-label",
    new RegExp(`${asBulgarian.replace(/\u00a0|\u202f/g, "\\s")} горещи точки`),
  );
  expect(page.url()).toContain("sel=c:BGR");
  expect(page.url()).toContain("u=hot");

  await page.getByRole("button", { name: "English" }).click();
  await page.waitForSelector('svg[role="grid"]');
  await expect(page.getByText("Selected month: August 2024")).toBeVisible();
});
