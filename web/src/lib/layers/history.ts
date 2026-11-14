/**
 * The history layer: one square per 0.25 degree cell, coloured by how many
 * fire days that cell had in the chosen year.
 *
 * The class breaks are fixed, not fitted to the year on screen. A ramp that
 * rescales itself every year would make two years look alike when one had ten
 * times the fire, so the same colour means the same number in every year.
 */

export const historyYearStart = 2001;

/**
 * Lower edge of each class, in fire days. A cell below the first is not drawn.
 *
 * Chosen on the whole world, every year from 2000 to 2025 together: these four
 * classes hold 22, 29, 23 and 25 per cent of the cells over the full record,
 * and no single year collapses into one class (2003 is 15/29/25/30, 2024 is
 * 27/27/21/25). A yearly cell can reach the thousands, so a top class starting
 * at 21 would have swallowed half the world.
 */
export const historyBreaks: readonly number[] = [1, 5, 25, 100];

/** Ramp tokens, lightest class first. */
export const historyRampTokens: readonly string[] = [
  '--ramp-0',
  '--ramp-1',
  '--ramp-2',
  '--ramp-3',
];

/** Which class a value falls in, or -1 when there is nothing to draw. */
export function historyClass(fireDays: number): number {
  if (!Number.isFinite(fireDays) || fireDays < historyBreaks[0]) return -1;
  let found = 0;
  for (let index = 0; index < historyBreaks.length; index += 1) {
    if (fireDays >= historyBreaks[index]) found = index;
  }
  return found;
}

/** Last year the control offers: the last year the data set reaches. */
export function historyYearEnd(lastMonth: string | null | undefined): number {
  const year = Number(String(lastMonth ?? '').slice(0, 4));
  if (!Number.isFinite(year) || year < historyYearStart) return historyYearStart;
  return year;
}

/** Keeps a year inside the control's range. */
export function clampHistoryYear(year: number, lastMonth: string | null | undefined): number {
  const end = historyYearEnd(lastMonth);
  if (!Number.isFinite(year)) return end;
  return Math.min(end, Math.max(historyYearStart, Math.round(year)));
}

/** Every year the control can step through, oldest first. */
export function historyYears(lastMonth: string | null | undefined): number[] {
  const end = historyYearEnd(lastMonth);
  const years: number[] = [];
  for (let year = historyYearStart; year <= end; year += 1) years.push(year);
  return years;
}

/** The four corners of a cell, in GeoJSON order, as deck.gl wants them. */
export function cellPolygon(
  lat: number,
  lon: number,
  cellDeg: number,
): [number, number][] {
  const half = cellDeg / 2;
  return [
    [lon - half, lat - half],
    [lon + half, lat - half],
    [lon + half, lat + half],
    [lon - half, lat + half],
  ];
}
