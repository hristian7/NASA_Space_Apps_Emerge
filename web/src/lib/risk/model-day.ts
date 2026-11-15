/**
 * Which published model day to show for a viewed calendar day. The files name
 * their days "today" and "tomorrow" from the day they were made, so on the
 * next calendar day "tomorrow" is the one valid today.
 *
 * - A published day valid for the viewed date is shown as that date.
 * - Viewing today with no match shows the latest published day before it,
 *   labelled as the latest forecast.
 * - Any other day without a match has no model score.
 */
export function pickModelDay(
  days: { today?: string | null; tomorrow?: string | null },
  viewed: string,
  offset: number,
): { date: string; latest: boolean } | null {
  const published = [days.today, days.tomorrow].filter((date): date is string => Boolean(date));
  if (published.includes(viewed)) return { date: viewed, latest: false };
  if (offset !== 0) return null;
  const earlier = published.filter((date) => date < viewed).sort();
  const last = earlier[earlier.length - 1];
  return last === undefined ? null : { date: last, latest: true };
}

/** Message key for the History card's title. */
export type HereTitle = "here" | "hereToday" | "hereLatest" | "hereDated";

/**
 * The History card's title, from the date its forecast is valid for: today's
 * or tomorrow's by that date, the dated wording once it has passed (or while
 * nothing is loaded yet), and the latest-forecast wording for a later date.
 */
export function hereTitle(validFor: string | null, today: string, tomorrow: string, stale: boolean): HereTitle {
  if (validFor === null || stale) return "hereDated";
  if (validFor === today) return "hereToday";
  if (validFor === tomorrow) return "here";
  return "hereLatest";
}
