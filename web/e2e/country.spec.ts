import { expect, test } from "@playwright/test";
import { calendar, monthCell, openReport, unitButton } from "./helpers";
import { asShown, lastCompleteMonthName, monthOf } from "./data";

/**
 * Bulgaria, the whole record: the calendar is there, the unit toggle changes
 * the numbers, and clicking a month moves the two monthly cards onto it. The
 * two figures are read from the country file as the spec runs, so a refreshed
 * export keeps this honest instead of breaking it.
 */
test("a country shows a calendar that answers the unit toggle and the month", async ({
  page,
}) => {
  const august = monthOf("BGR", 2024, 8);

  await openReport(page, "/?sel=c:BGR");

  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText("Bulgaria", { exact: true })).toBeVisible();

  await expect(monthCell(page, "August 2024")).toHaveAttribute(
    "aria-label",
    new RegExp(`${asShown(august.cd)} fire days`),
  );

  await unitButton(page, "Hotspots").click();
  await expect(monthCell(page, "August 2024")).toHaveAttribute(
    "aria-label",
    new RegExp(`${asShown(august.hot)} hotspots`),
  );

  await unitButton(page, "Fire days").click();
  await expect(monthCell(page, "August 2024")).toHaveAttribute(
    "aria-label",
    new RegExp(`${asShown(august.cd)} fire days`),
  );

  // The month the cards follow to begin with is the last COMPLETE month of
  // the record, never the part month it stops inside.
  await expect(
    page.getByText(`Selected month: ${lastCompleteMonthName()}`),
  ).toBeVisible();

  await monthCell(page, "August 2024").click();
  await expect(page.getByText("Selected month: August 2024")).toBeVisible();
  // A whole country is near certain to see fire in any month, so the card
  // shows a typical number of fire days instead of a share (M13).
  await expect(page.getByText("A typical number of fire days this month")).toBeVisible();
  await expect(page.getByText(/the usual August/)).toBeVisible();
  // The month travels in the address bar, so the view can be shared.
  expect(page.url()).toContain("mo=2024-08");

  await unitButton(page, "Per satellite").click();
  await expect(page.getByText("Raw counts per satellite").first()).toBeVisible();

  await unitButton(page, "Anomaly").click();
  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText(/Colour steps: under half/)).toBeVisible();
});
