import { expect, test } from "@playwright/test";
import { readData } from "./data";

interface Scorecard {
  /** The year the shipped model was tested on; the page shows that year. */
  test_year: number;
  scopes: Record<"europe" | "world", { years: Record<string, { selections: { forest_wildland: { pooled: { methods: Record<string, { capture_rate: number }> } } } }> }>;
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

test("the How it works page shows the hold-out bars from the scorecard and shares by section", async ({ page }) => {
  const card = readData<Scorecard>("risk/scorecard.json");
  const world = card.scopes.world.years[String(card.test_year)].selections.forest_wildland.pooled.methods;

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
  for (const id of ["satellite", "weather", "land", "maps", "reported", "software", "fonts", "experimental", "video", "project"]) {
    await expect(page.locator(`section#${id} li.ab-card`).first()).toBeVisible();
  }
  // Earlier section anchors stay valid after the regrouping.
  for (const id of ["what", "official", "credits", "imagery", "boundaries", "planned"]) {
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
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

test("the information pages share one header with the current tab marked", async ({ page }) => {
  for (const [path, tab] of [
    ["/how-it-works", "How it works"],
    ["/proof#next-day-risk", "Proof"],
    ["/about", "About and credits"],
    ["/data-sources", "Data sources"],
  ] as const) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const tabs = page.getByRole("navigation", { name: "Information pages" });
    await expect(tabs.getByRole("link")).toHaveText(["How it works", "Proof", "About and credits", "Data sources"]);
    await expect(tabs.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Emerge, back to the map" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("contentinfo").getByText(/Research prototype\. Not an official warning/)).toBeVisible();
  }
});
