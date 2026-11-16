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

  // An open report covers the language button on a wide screen (by design),
  // so the switch is driven from the keyboard, which still reaches it.
  await page.getByRole("button", { name: "Language" }).press("Enter");
  await page.getByRole("button", { name: "Български" }).press("Enter");
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

  await page.getByRole("button", { name: "Език" }).press("Enter");
  await page.getByRole("button", { name: "English" }).press("Enter");
  await page.waitForSelector('svg[role="grid"]');
  await expect(page.getByText("Selected month: August 2024")).toBeVisible();
});

test.describe("a Bulgarian browser", () => {
  test.use({ locale: "bg-BG" });

  test("opens in Bulgarian until the switch says otherwise", async ({ page, context }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
    await expect(page.getByRole("button", { name: "Прогноза", exact: true })).toBeVisible();
    await context.addCookies([{ name: "emerge-locale", value: "en", url: page.url() }]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("button", { name: "Forecast", exact: true })).toBeVisible();
  });
});

test.describe("a visitor in Bulgaria with an English browser", () => {
  test.use({ locale: "en-GB", extraHTTPHeaders: { "x-vercel-ip-country": "BG" } });

  test("opens in Bulgarian", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });
});

test.describe("an English browser elsewhere", () => {
  test.use({ locale: "en-US", extraHTTPHeaders: { "x-vercel-ip-country": "DE" } });

  test("opens in English", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
