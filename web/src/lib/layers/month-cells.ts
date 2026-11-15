import { booleanPointInPolygon } from '@turf/turf';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Selection } from '../../types/ui';
import { CELL_DEG, cellCenter, monthIndex } from '../data/cell';
import { loadMeta, loadTiles } from '../data/loaders';
import { selectionCells, tilesForSelection } from '../data/selection';
import { cellPolygon, historyClass } from './history';
import type { HistoryCell } from './overlay';

/** A country's box larger than this many 5 degree tiles is not drawn by month. */
export const MONTH_TILE_LIMIT = 160;

type CountryShape = Feature<Polygon | MultiPolygon, { iso3: string }>;
let outlines: Promise<FeatureCollection<Polygon | MultiPolygon, { iso3: string }>> | null = null;

function countryOutline(iso3: string): Promise<CountryShape | null> {
  outlines ??= fetch('/geo/countries.json').then((response) => {
    if (!response.ok) throw new Error(`Country outlines: ${response.status}`);
    return response.json();
  });
  return outlines.then((all) => all.features.find((feature) => feature.properties.iso3 === iso3) ?? null);
}

function boxRing(bbox: [number, number, number, number]): [number, number][] {
  const [w, s, e, n] = bbox;
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}

/**
 * The fire days of one month for a selection, cell by cell, from the shipped
 * tiles: a point or drawn area keeps its own cells; a country keeps the cells
 * whose centre lies inside its outline. Returns null when the selection is too
 * large to draw by month.
 */
export async function monthCells(
  selection: Selection,
  y: number,
  m: number,
  countryBox?: [number, number, number, number],
): Promise<HistoryCell[] | null> {
  const meta = await loadMeta();
  const mi = monthIndex(y, m);
  const available = new Set(meta.tiles);

  let keep: (id: number, lat: number, lon: number) => boolean;
  let keys: string[];
  if (selection.kind === 'country') {
    if (countryBox === undefined) return null;
    const shape = await countryOutline(selection.iso3);
    if (shape === null) return null;
    keys = tilesForSelection({ kind: 'polygon', ring: boxRing(countryBox) });
    keep = (_id, lat, lon) => booleanPointInPolygon([lon, lat], shape);
  } else {
    const ids = new Set(selectionCells(selection).cells.map((cell) => cell.id));
    keys = tilesForSelection(selection);
    keep = (id) => ids.has(id);
  }
  keys = keys.filter((key) => available.size === 0 || available.has(key));
  if (keys.length > MONTH_TILE_LIMIT) return null;

  const files = await loadTiles(keys);
  const cells: HistoryCell[] = [];
  for (const file of files) {
    for (const cell of file.cells) {
      const at = cell.mi.indexOf(mi);
      if (at < 0) continue;
      const fireDays = cell.cd[at];
      if (!(fireDays > 0)) continue;
      const { lat, lon } = cellCenter(cell.id);
      if (!keep(cell.id, lat, lon)) continue;
      cells.push({
        polygon: cellPolygon(lat, lon, CELL_DEG),
        fireDays,
        hotspots: cell.hot[at],
        lat,
        lon,
        klass: historyClass(fireDays),
      });
    }
  }
  return cells;
}
