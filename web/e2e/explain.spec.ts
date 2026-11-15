import { expect, test } from "@playwright/test";
import { readData } from "./data";

interface Scorecard {
  scopes: Record<"europe" | "world", { years: Record<string, { selections: { forest_wildland: { pooled: { methods: Record<string, { capture_rate: number }> } } } }> }>;
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

test("the How it works page shows the hold-out bars from the scorecard and shares by section", async ({ page }) => {
  const card = readData<Scorecard>("risk/scorecard.json");
  const world = card.scopes.world.years["2025"].selections.forest_wildland.pooled.methods;

  await page.goto("/how-it-works", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/How Emerge works/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /How Emerge works/);
  await expect(page.getByRole("heading", { level: 1, name: "How Emerge works" })).toBeVisible();

  for (const id of ["sources", "record", "model", "compare", "limits"]) {
    await expect(page.locator(`section#${id} h2 a[href="#${id}"]`)).toHaveCount(1);
  }

  const compare = page.locator("section#compare");
  for (const value of [world.model, world.history, world.fwi, world.random].map((m) => m.capture_rate)) {
    await expect(compare.getByText(pct(value), { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Risk outlook (unofficial)")).toBeVisible();
  await expect(page.getByText(/Research prototype\. Not an official warning\. Follow local authorities \(112/)).toBeVisible();
});

test("the About page lists every source group with anchors, and links the explainer", async ({ page }) => {
  await page.goto("/about#software", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/About Emerge/);
  await expect(page.locator("section#software")).toBeInViewport();
  for (const id of ["satellite", "weather", "imagery", "boundaries", "reported", "software", "fonts"]) {
    await expect(page.locator(`section#${id} li`).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /NASA GFWED GEOS-5 fire-weather forecasts/ })).toHaveAttribute(
    "href",
    "https://data.giss.nasa.gov/impacts/gfwed/",
  );
  await page.getByRole("link", { name: "How Emerge works" }).first().click();
  await expect(page).toHaveURL(/\/how-it-works$/);
});

test("both pages read in Bulgarian", async ({ page, context }) => {
  await context.addCookies([{ name: "emerge-locale", value: "bg", url: "http://localhost" }]);
  await page.goto("/how-it-works", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Как работи Emerge" })).toBeVisible();
  await page.goto("/about", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Сателитни данни за пожари" })).toBeVisible();
});
