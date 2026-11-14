import { expect, test } from "@playwright/test";
import { calendar, openReport } from "./helpers";
import { readData } from "./data";

const area = "/?sel=a:42.5,23.1;42.9,23.1;42.9,23.9;42.5,23.9";

/**
 * A drawn area is weighted over the squares it covers, so it reports like a
 * point but is named by its corners. The officially reported figures beside it
 * are national, so they have to be labelled as context.
 */
test("a drawn area reports, and says its reported figures are national", async ({
  page,
}) => {
  await openReport(page, area);

  await expect(calendar(page)).toBeVisible();
  await expect(page.getByText("Area with 4 corners")).toBeVisible();

  await expect(page.getByText(/Country total, for context/)).toBeVisible();

  // This area reaches about 22 km from its middle, under the 50 km above
  // which a chance of fire stops saying anything, so the share is shown.
  await expect(page.getByText("How often fire was seen here this month")).toBeVisible();

  // The date range cuts the calendar down to the months it names: one row
  // per year from 2020 to the last data year.
  const lastYear = Number(readData<{ last_data_day: string }>("meta.json").last_data_day.slice(0, 4));
  await page.selectOption('select[name="range-from"]', "2020-01");
  await expect(page.locator('[role="rowheader"]')).toHaveCount(lastYear - 2020 + 1);
  await expect(calendar(page)).toBeVisible();
  expect(page.url()).toContain("from=2020-01");
});
