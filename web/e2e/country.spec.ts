import { expect, test } from "@playwright/test";
import { calendar, monthCell, openReport, unitButton } from "./helpers";

/**
 * Bulgaria, the whole record: the calendar is there, the unit toggle changes
 * the numbers, and clicking a month moves the two monthly cards onto it.
 */
test("a country shows a calendar that answers the unit toggle and the month", async ({
  page,
}) => {
  await openReport(page, "/?sel=c:BGR");

  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText("Bulgaria", { exact: true })).toBeVisible();

  // A whole country is near certain to see fire in any month, so the card
  // shows a typical number of fire days instead of a share (M13).
  await expect(page.getByText("Expected fire days this month")).toBeVisible();

  // August 2024 in fire days, from the country file.
  const august = monthCell(page, "August 2024");
  await expect(august).toHaveAttribute("aria-label", /395 fire days/);

  await unitButton(page, "Hotspots").click();
  await expect(monthCell(page, "August 2024")).toHaveAttribute(
    "aria-label",
    /638 hotspots/,
  );

  await unitButton(page, "Fire days").click();
  await expect(monthCell(page, "August 2024")).toHaveAttribute(
    "aria-label",
    /395 fire days/,
  );

  // The last month of the record is the one the cards follow to begin with.
  await expect(page.getByText("Selected month: December 2025")).toBeVisible();

  await monthCell(page, "August 2024").click();
  await expect(page.getByText("Selected month: August 2024")).toBeVisible();
  await expect(page.getByText(/the usual August/)).toBeVisible();
  // The month travels in the address bar, so the view can be shared.
  expect(page.url()).toContain("mo=2024-08");

  await unitButton(page, "Per satellite").click();
  await expect(page.getByText("Raw counts per satellite").first()).toBeVisible();

  await unitButton(page, "Anomaly").click();
  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText(/Colour steps: under half/)).toBeVisible();
});
