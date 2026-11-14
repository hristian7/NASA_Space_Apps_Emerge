import { expect, test } from "@playwright/test";
import { openReport } from "./helpers";
import { readData } from "./data";

interface ReportedSeries {
  kind: "national_report" | "satellite_estimate";
  source: { name: string; note: string | null; fetched: string | null };
  years: { y: number; fires: number | null; burned_ha: number | null }[];
}

function seriesOf(iso3: string): ReportedSeries[] {
  return readData<{ series: ReportedSeries[] }>(`reported/${iso3}.json`).series;
}

/**
 * A count of fires by a national authority and an area mapped from satellite
 * images are not the same thing, and neither is our own count of detections.
 * Each stands under its own label, and the word "reported" never travels with
 * an estimate.
 */
test("Bulgaria shows both kinds, labelled apart", async ({ page }) => {
  const series = seriesOf("BGR");
  const national = series.find((row) => row.kind === "national_report");
  const estimate = series.find((row) => row.kind === "satellite_estimate");
  expect(national, "Bulgaria has a national report").toBeTruthy();
  expect(estimate, "Bulgaria has a satellite estimate").toBeTruthy();

  await openReport(page, "/?sel=c:BGR");

  const card = page.locator('[aria-labelledby="report-reported"]');
  await expect(card).toBeVisible();

  await expect(card).not.toContainText("No official national reported numbers available.");

  const reported = card.locator('[data-kind="national_report"]').first();
  await expect(reported).toContainText("Reported by national authorities");
  await expect(reported).toContainText(national?.source.name.slice(0, 40) ?? "");

  const mapped = card.locator('[data-kind="satellite_estimate"]').first();
  await expect(mapped).toContainText("Estimated from satellite mapping");
  await expect(mapped).toContainText(estimate?.source.name.slice(0, 30) ?? "");
  // The label of an estimate never calls it a report.
  const label = await mapped.locator("h3").innerText();
  expect(label.toLowerCase()).not.toContain("report");

  // Our own figures are a third, clearly separate measure.
  const ours = card.locator('[data-kind="detections"]');
  await expect(ours).toContainText("Detected by satellites");
  await expect(ours).toContainText("detections, not counts of fires");

  // The latest year of each series is readable without scrolling a table.
  const latest = national?.years
    .filter((row) => row.fires !== null || row.burned_ha !== null)
    .sort((a, b) => b.y - a.y)[0];
  await expect(reported).toContainText(String(latest?.y));
  await expect(reported).toContainText("Taken on");
});

test("a country with an estimate only never calls it a report", async ({ page }) => {
  // Brazil has no national report in the data set, only mapped estimates.
  const series = seriesOf("BRA");
  expect(series.every((row) => row.kind === "satellite_estimate")).toBe(true);

  await openReport(page, "/?sel=c:BRA");

  const card = page.locator('[aria-labelledby="report-reported"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-kind="national_report"]')).toHaveCount(0);
  const missing = card.getByText("No official national reported numbers available.", { exact: true });
  await expect(missing).toBeVisible();
  expect(await missing.evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('[data-kind="satellite_estimate"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(card.locator('[data-kind="satellite_estimate"]').first()).toContainText(
    "Estimated from satellite mapping",
  );
  await expect(card).toContainText(series[0].source.name.slice(0, 30));
});


test("Brazil explains missing national numbers in Bulgarian", async ({ page, context }) => {
  await context.addCookies([{ name: "emerge-locale", value: "bg", url: "http://localhost:4346" }]);
  await openReport(page, "/?sel=c:BRA");
  const card = page.locator('[aria-labelledby="report-reported"]');
  await expect(card.getByText("Няма налични официално докладвани национални данни.", { exact: true })).toBeVisible();
});
