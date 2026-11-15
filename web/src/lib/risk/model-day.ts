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
