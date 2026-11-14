/**
 * The fire danger layer: the Copernicus GWIS fire weather index, drawn as
 * map tiles for one day between today and nine days ahead.
 *
 * The six classes, their thresholds and their colours are the ones the service
 * draws itself. They were read from its own legend image on 14 Nov 2026
 * (`request=GetLegendGraphic&layer=ecmwf.fwi`), so the legend in the panel and
 * the colours on the map cannot drift apart.
 *
 * Checked the same day: the tile address answers with a PNG for today, for
 * five days ahead and for nine days ahead, and sends an allow-origin header,
 * so the map fetches these tiles itself. Ten days ahead came back blank.
 */

export const dangerDayMin = 0;
export const dangerDayMax = 9;

export interface DangerClass {
  /** Key under the `layers` namespace for the plain-words label. */
  labelKey: string;
  /** The service's own colour, already in a format the map accepts. */
  color: string;
  /** The service's own range, printed as it prints it. */
  range: string;
}

export const dangerClasses: readonly DangerClass[] = [
  { labelKey: 'danger.low', color: 'rgb(156,255,192)', range: 'under 11.2' },
  { labelKey: 'danger.moderate', color: 'rgb(205,226,78)', range: '11.2 to 21.3' },
  { labelKey: 'danger.high', color: 'rgb(230,172,0)', range: '21.3 to 38.0' },
  { labelKey: 'danger.veryHigh', color: 'rgb(217,112,16)', range: '38.0 to 50.0' },
  { labelKey: 'danger.extreme', color: 'rgb(173,6,14)', range: '50.0 to 70.0' },
  { labelKey: 'danger.veryExtreme', color: 'rgb(58,0,21)', range: 'over 70.0' },
];

/** Keeps a day offset inside today to nine days ahead. */
export function clampDangerDay(offset: number): number {
  if (!Number.isFinite(offset)) return dangerDayMin;
  return Math.min(dangerDayMax, Math.max(dangerDayMin, Math.round(offset)));
}

/** The date a day offset stands for, as YYYY-MM-DD in UTC. */
export function dangerDate(offset: number, today: Date = new Date()): string {
  const day = clampDangerDay(offset);
  const moved = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + day),
  );
  return moved.toISOString().slice(0, 10);
}

/** Every day offset the control offers. */
export function dangerDays(): number[] {
  const days: number[] = [];
  for (let day = dangerDayMin; day <= dangerDayMax; day += 1) days.push(day);
  return days;
}
