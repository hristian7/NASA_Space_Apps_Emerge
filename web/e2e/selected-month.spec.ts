import { expect, test } from "@playwright/test";
import { calendar, monthCell, openReport } from "./helpers";
import {
  lastCompleteMonthName,
  lastDataDay,
  lastMonthIsPart,
  lastMonthIsReadable,
  partMonthName,
} from "./data";

const READABLE = "meta.json marks the record's last month as no-data";

/**
 * The month the two monthly cards follow.
 *
 * A part month compared with whole months reads as a collapse in fire rather
 * than as a month that has not finished, so the default is the last month the
 * record holds in full. The part month is still selectable and says which days
 * it holds. Every date here is read from meta.json as the spec runs.
 */
test("the default month is the last complete month of the record", async ({
  page,
}) => {
  await openReport(page, "/?sel=c:BGR");

  await expect(calendar(page)).toBeVisible();
  await expect(
    page.getByText(`Selected month: ${lastCompleteMonthName()}`),
  ).toBeVisible();
});

test("a country's part month shows its days and offers no comparison", async ({
  page,
}) => {
  test.skip(!lastMonthIsPart(), "the record ends on a whole month");
  test.skip(!lastMonthIsReadable(), READABLE);
  const last = lastDataDay();

  await openReport(page, `/?sel=c:BGR&mo=${last.y}-${String(last.m).padStart(2, "0")}`);

  await expect(page.getByText(`Selected month: ${partMonthName()}`)).toBeVisible();
  const note = page.locator('[data-testid="month-note"]');
  await expect(note).toBeVisible();
  await expect(note).toContainText("This month so far");
  await expect(note).toContainText(`Days 1 to ${last.d}`);
  await expect(note).toContainText("point or a drawn area");
  // Never the wording for a finished month with too little history.
  await expect(note).not.toContainText("Not enough past years");
});

test("a point's part month is compared with the same days in past years", async ({
  page,
}) => {
  test.skip(!lastMonthIsPart(), "the record ends on a whole month");
  test.skip(!lastMonthIsReadable(), READABLE);
  const last = lastDataDay();

  await openReport(
    page,
    `/?sel=p:42.7,23.3,50&mo=${last.y}-${String(last.m).padStart(2, "0")}`,
  );

  await expect(page.getByText(`Selected month: ${partMonthName()}`)).toBeVisible();
  // Either the to-date comparison, or the honest "too early" when the record
  // holds fewer than eight days of the month.
  const card = page.getByRole("region", { name: "Is this unusual?" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(
    last.d < 8 ? "Too early in the month" : "month so far",
  );
});

test("the part month is marked as a part month in the calendar", async ({ page }) => {
  test.skip(!lastMonthIsPart(), "the record ends on a whole month");
  test.skip(!lastMonthIsReadable(), READABLE);
  const last = lastDataDay();
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  await openReport(page, "/?sel=c:BGR");
  await expect(
    monthCell(page, `${names[last.m - 1]} ${last.y}`),
  ).toHaveAttribute("aria-label", /part of the month only/);
});
