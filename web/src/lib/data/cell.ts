/**
 * Grid and calendar helpers for the frozen data contract.
 *
 * Pure functions, no imports, no side effects. Every rule here is written out
 * in docs/data-contract.md; the two must stay in step.
 */

/** Side of one harmonization cell, in degrees. */
export const CELL_DEG = 0.25;

/** Rows in the 0.25 degree grid (180 / 0.25). */
export const GRID_ROWS = 720;

/** Columns in the 0.25 degree grid (360 / 0.25). */
export const GRID_COLS = 1440;

/** Side of one tile, in degrees. */
export const TILE_DEG = 5;

/** Mean Earth radius in km, used for every distance in the contract. */
export const EARTH_RADIUS_KM = 6371.0088;

/** Month index 0 is January 2000. */
export const MONTH_EPOCH_YEAR = 2000;

/** Wrap a longitude into [-180, 180). 180 becomes -180. */
export function wrapLon(lon: number): number {
  const x = ((lon + 180) % 360 + 360) % 360;
  return x - 180;
}

/** Row of the 0.25 degree grid for a latitude. Latitude 90 gives row 0; -90 clamps to 719. */
export function cellRow(lat: number): number {
  const row = Math.floor((90 - lat) / CELL_DEG);
  if (row < 0) return 0;
  if (row > GRID_ROWS - 1) return GRID_ROWS - 1;
  return row;
}

/** Column of the 0.25 degree grid for a longitude. */
export function cellCol(lon: number): number {
  const col = Math.floor((wrapLon(lon) + 180) / CELL_DEG);
  if (col < 0) return 0;
  if (col > GRID_COLS - 1) return GRID_COLS - 1;
  return col;
}

/** Cell id of the 0.25 degree cell holding this point: row * 1440 + col. */
export function cellId(lat: number, lon: number): number {
  return cellRow(lat) * GRID_COLS + cellCol(lon);
}

/** Centre of a cell, in degrees. */
export function cellCenter(id: number): { lat: number; lon: number } {
  const row = Math.floor(id / GRID_COLS);
  const col = id - row * GRID_COLS;
  return {
    lat: 90 - CELL_DEG * row - CELL_DEG / 2,
    lon: -180 + CELL_DEG * col + CELL_DEG / 2,
  };
}

/**
 * Half the diagonal of a 0.25 degree cell whose centre sits at this latitude,
 * in km. This is how far a point inside the cell can be from the cell centre,
 * so it is the honest precision of any cell value.
 */
export function precisionRadiusKm(lat: number): number {
  const height = EARTH_RADIUS_KM * CELL_DEG * (Math.PI / 180);
  const width = height * Math.cos((lat * Math.PI) / 180);
  return Math.sqrt(height * height + width * width) / 2;
}

/** Lower-left corner of the 5 degree tile holding this point. */
export function tileOrigin(lat: number, lon: number): { lat0: number; lon0: number } {
  let lat0 = Math.floor(lat / TILE_DEG) * TILE_DEG;
  if (lat0 > 90 - TILE_DEG) lat0 = 90 - TILE_DEG;
  if (lat0 < -90) lat0 = -90;
  return { lat0, lon0: Math.floor(wrapLon(lon) / TILE_DEG) * TILE_DEG };
}

/** Tile key of the point: "<lat0>_<lon0>", for example "40_20" or "35_-120". */
export function tileKey(lat: number, lon: number): string {
  const { lat0, lon0 } = tileOrigin(lat, lon);
  return `${lat0}_${lon0}`;
}

/** Read a tile key back into its lower-left corner. */
export function tileFromKey(key: string): { lat0: number; lon0: number } {
  const cut = key.indexOf('_');
  return {
    lat0: Number(key.slice(0, cut)),
    lon0: Number(key.slice(cut + 1)),
  };
}

/** Month index: January 2000 is 0, November 2000 is 10, December 2025 is 311. */
export function monthIndex(y: number, m: number): number {
  return (y - MONTH_EPOCH_YEAR) * 12 + (m - 1);
}

/** Inverse of monthIndex. */
export function monthFromIndex(i: number): { y: number; m: number } {
  const y = MONTH_EPOCH_YEAR + Math.floor(i / 12);
  return { y, m: i - (y - MONTH_EPOCH_YEAR) * 12 + 1 };
}
