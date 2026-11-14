/**
 * From cells to a monthly series: docs/number-logic.md section 2, to the
 * letter, with the rulings in that page's section 9.
 *
 *  - A month's value is the sum over cells of weight x cell value; lo and hi
 *    the same way. Nothing is rounded here.
 *  - The series lists every month from Nov 2000 to meta's last data month.
 *  - A month inside a no-data period in meta.json is null. A selection whose
 *    cells never saw fire is 0 in every covered month, never empty.
 *  - A month a cell does not list counts as 0 for that cell from February
 *    2012. Before that it takes the cell group's background value for the
 *    calendar month and period (section 9, ruling 10, in background.ts).
 *  - src is the label the contract's date rule gives, not a cell's own label.
 *    flags are the union of the contributing cells' flags, plus
 *    low_confidence when the selection is smaller than one cell.
 */

import type { FlagLabel, MetaFile, SrcLabel, TileCell, TileFile } from '../../types/data';
import type { MonthPoint, SatelliteMonth, Selection, Series, Unit } from '../../types/ui';

import { backgroundValue, loadBackground, setBackgroundStatus } from './background';
import { monthFromIndex, monthIndex } from './cell';
import { DataError, DataSource } from './source';
import { loadCountry, loadMeta, loadReported, loadTiles } from './loaders';
import { haversineKm, ringCenter, selectionCells, tilesForSelection } from './selection';
import type { ReportedFile } from '../../types/data';

/** The first month any harmonized number exists for. */
export const FIRST_MONTH_INDEX = monthIndex(2000, 11);

/** Flags in the contract's own order, so a union is always written the same way. */
const FLAG_ORDER: FlagLabel[] = ['example', 'partial_month', 'snpp_gap_filled', 'low_confidence'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function monthKey(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * True when a whole month lies inside a period with no measurement at all.
 *
 * Only `scope: "global"` periods count. The `satellite` entries say that one
 * raw column is missing, not that the harmonized value is unknown: NOAA-21 is
 * absent from the whole example set, so reading those as no-data would make
 * every month of every series null.
 */
export function isNoDataMonth(meta: MetaFile, y: number, m: number): boolean {
  const first = `${monthKey(y, m)}-01`;
  const last = `${monthKey(y, m)}-${pad2(daysInMonth(y, m))}`;
  for (const period of meta.no_data) {
    if (period.scope !== 'global') continue;
    // A period with a day count is a scatter of single days inside the range,
    // and the range alone cannot say which. A whole month is never no-data
    // because of it.
    if (period.days !== null) continue;
    const from = period.from ?? '0000-01-01';
    const to = period.to ?? '9999-12-31';
    if (from <= first && last <= to) return true;
  }
  return false;
}

/** The src label the contract's date rule gives a month, or null outside every period. */
export function srcForMonth(meta: MetaFile, y: number, m: number): SrcLabel | null {
  const key = monthKey(y, m);
  for (const period of meta.src_periods) {
    const to = period.to ?? '9999-12';
    if (period.from <= key && key <= to) return period.src;
  }
  return null;
}

/** Last month of the series, from meta.last_month. */
export function lastMonthIndex(meta: MetaFile): number {
  const [y, m] = meta.last_month.split('-').map(Number);
  return monthIndex(y, m);
}

/** Labels of a bit set over a file's flag_labels, lowest bit first. */
export function decodeFlags(bits: number, labels: FlagLabel[]): FlagLabel[] {
  const out: FlagLabel[] = [];
  for (let k = 0; k < labels.length; k += 1) {
    if ((bits >> k) & 1) out.push(labels[k]);
  }
  return out;
}

function orderedFlags(set: Set<FlagLabel>): FlagLabel[] {
  return FLAG_ORDER.filter((flag) => set.has(flag));
}

interface CellSeries {
  weight: number;
  /** Month index to position in the cell's parallel arrays. */
  at: Map<number, number>;
  cell: TileCell;
  flagLabels: FlagLabel[];
  /** The cell's background group, when the tile carries one. */
  group: string | null;
}

function indexTiles(files: TileFile[]): Map<number, { cell: TileCell; flagLabels: FlagLabel[] }> {
  const byId = new Map<number, { cell: TileCell; flagLabels: FlagLabel[] }>();
  for (const file of files) {
    for (const cell of file.cells) {
      byId.set(cell.id, { cell, flagLabels: file.flag_labels });
    }
  }
  return byId;
}

/**
 * The monthly series for a selection, in one unit.
 *
 * A country uses its own file as it is (cellCount 1, never low confidence); a
 * point or a drawn area sums its weighted cells out of the tiles its bounding
 * box touches.
 */
export async function getSeries(
  selection: Selection,
  unit: Unit,
  src?: DataSource,
): Promise<Series> {
  const meta = await loadMeta(src);
  const last = lastMonthIndex(meta);

  if (selection.kind === 'country') {
    return countrySeries(meta, selection.iso3, unit, last, src);
  }

  const { cells, lowConfidence } = selectionCells(selection);
  const wanted = tilesForSelection(selection);
  const keys = meta.tiles.length > 0 ? wanted.filter((key) => meta.tiles.includes(key)) : wanted;
  const [files, background] = await Promise.all([loadTiles(keys, src), loadBackground(src)]);
  const byId = indexTiles(files);

  const series: CellSeries[] = [];
  let cellsWithoutGroup = 0;
  const groupsNotFound = new Set<string>();
  for (const weighted of cells) {
    const found = byId.get(weighted.id);
    if (!found) continue;
    const at = new Map<number, number>();
    found.cell.mi.forEach((mi, position) => at.set(mi, position));
    const group = found.cell.g ?? null;
    if (group === null) cellsWithoutGroup += 1;
    else if (background && !background.groups[group]) groupsNotFound.add(group);
    series.push({
      weight: weighted.weight,
      at,
      cell: found.cell,
      flagLabels: found.flagLabels,
      group,
    });
  }
  setBackgroundStatus({
    loaded: background !== null,
    cellsWithoutGroup,
    groupsNotFound: [...groupsNotFound],
  });

  const months: MonthPoint[] = [];
  for (let mi = FIRST_MONTH_INDEX; mi <= last; mi += 1) {
    const { y, m } = monthFromIndex(mi);
    const point: MonthPoint = {
      y,
      m,
      value: null,
      lo: null,
      hi: null,
      src: srcForMonth(meta, y, m),
      flags: [],
    };
    const flags = new Set<FlagLabel>();
    if (lowConfidence) flags.add('low_confidence');

    if (!isNoDataMonth(meta, y, m)) {
      let value = 0;
      let lo = 0;
      let hi = 0;
      for (const entry of series) {
        const position = entry.at.get(mi);
        if (position === undefined) {
          const bg = backgroundValue(background, entry.group, y, m, unit);
          if (bg) {
            value += entry.weight * bg.value;
            hi += entry.weight * bg.hi;
          }
          continue;
        }
        const cell = entry.cell;
        value += entry.weight * (unit === 'hot' ? cell.hot[position] : cell.cd[position]);
        lo += entry.weight * (unit === 'hot' ? cell.hot_lo[position] : cell.cd_lo[position]);
        hi += entry.weight * (unit === 'hot' ? cell.hot_hi[position] : cell.cd_hi[position]);
        for (const flag of decodeFlags(cell.flags[position], entry.flagLabels)) flags.add(flag);
      }
      point.value = value;
      point.lo = lo;
      point.hi = hi;
    }

    point.flags = orderedFlags(flags);
    months.push(point);
  }

  return { unit, months, cellCount: cells.length, lowConfidence };
}

async function countrySeries(
  meta: MetaFile,
  iso3: string,
  unit: Unit,
  last: number,
  src?: DataSource,
): Promise<Series> {
  const file = await loadCountry(iso3, src);
  if (!file) {
    throw new DataError('fetch', `countries/${iso3}.json`, `no country file for ${iso3}`);
  }
  const byIndex = new Map<number, (typeof file.months)[number]>();
  for (const month of file.months) byIndex.set(monthIndex(month.y, month.m), month);

  const months: MonthPoint[] = [];
  for (let mi = FIRST_MONTH_INDEX; mi <= last; mi += 1) {
    const { y, m } = monthFromIndex(mi);
    const row = byIndex.get(mi);
    const noData = isNoDataMonth(meta, y, m);
    const flags = new Set<FlagLabel>();
    if (row && !noData) for (const flag of row.flags) flags.add(flag);
    months.push({
      y,
      m,
      value: row && !noData ? (unit === 'hot' ? row.hot : row.cd) : null,
      lo: row && !noData ? (unit === 'hot' ? row.hot_lo : row.cd_lo) : null,
      hi: row && !noData ? (unit === 'hot' ? row.hot_hi : row.cd_hi) : null,
      src: srcForMonth(meta, y, m),
      flags: orderedFlags(flags),
    });
  }
  return { unit, months, cellCount: 1, lowConfidence: false };
}

/**
 * Raw counts per satellite, for the "measured per satellite" view. They live
 * in the country files only, so anything but a country selection gives null.
 */
export async function getPerSatellite(
  selection: Selection,
  src?: DataSource,
): Promise<SatelliteMonth[] | null> {
  if (selection.kind !== 'country') return null;
  const file = await loadCountry(selection.iso3, src);
  if (!file) return null;
  return file.months.map((month) => ({
    y: month.y,
    m: month.m,
    terra: month.terra,
    aqua: month.aqua,
    snpp: month.snpp,
    noaa20: month.noaa20,
    noaa21: month.noaa21,
  }));
}

/**
 * The officially reported figures to show beside the detected ones.
 *
 * A country selection gets its own file. For a point or a drawn area the
 * figures are national totals shown "for context", so one country has to be
 * chosen without any border data in the set. The only honest signal the files
 * carry is the country record itself: its lat and lon are the mean of its
 * fire cells and its precision_radius_km reaches the furthest of them, so the
 * circle covers all of that country's data. A point is attributed to a
 * country whose circle contains it, nearest centre first; when no circle
 * contains it the answer is null rather than a guess.
 */
export async function getReported(
  selection: Selection,
  src?: DataSource,
): Promise<ReportedFile | null> {
  if (selection.kind === 'country') return loadReported(selection.iso3, src);

  const meta = await loadMeta(src);
  const point =
    selection.kind === 'point'
      ? { lat: selection.lat, lon: selection.lon }
      : ringCenter(selection.ring);

  const candidates = await Promise.all(meta.countries.map((iso3) => loadCountry(iso3, src)));
  let best: { iso3: string; distance: number } | null = null;
  for (const country of candidates) {
    if (!country) continue;
    const distance = haversineKm(point.lat, point.lon, country.lat, country.lon);
    if (distance > country.precision_radius_km) continue;
    if (!best || distance < best.distance) best = { iso3: country.iso3, distance };
  }
  if (!best) return null;
  if (!meta.reported.includes(best.iso3)) return null;
  return loadReported(best.iso3, src);
}
