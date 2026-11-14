/**
 * One place for the screens to import from.
 *
 * Everything a screen needs about numbers goes through this facade: the
 * selection rules, the monthly series, the daily inputs and the two files
 * that are read as they are. The modules behind it can move without a screen
 * changing an import.
 */

export { DataError, DataSource, dataSource, setDataSource, httpFetcher, streamGunzip } from './source';
export type { Fetcher, Gunzip, DataSourceOptions } from './source';

export {
  loadCountry,
  loadDaily,
  loadDailyTiles,
  loadGlobeYear,
  loadMeta as getMeta,
  loadReported,
  loadTile,
  loadTiles,
  loadValidation as getValidation,
} from './loaders';

export { getPerSatellite, getReported, getSeries, isNoDataMonth, srcForMonth } from './series';

export {
  backgroundPeriod,
  backgroundStatus,
  backgroundValue,
  loadBackground,
} from './background';
export type { BackgroundFile, BackgroundPeriod, BackgroundStatus } from './background';

export { getMonthToDate, getWindowTotals, windowYears } from './daily';
export type { MonthToDate, WindowTotals } from './daily';

export {
  cellWeight,
  containingCellId,
  haversineKm,
  pointInRing,
  ringCenter,
  selectionBounds,
  selectionCells,
  subCellCenters,
  tilesForSelection,
} from './selection';
export type { SelectionBounds, SelectionCells, WeightedCell } from './selection';

export {
  cellCenter,
  cellId,
  monthFromIndex,
  monthIndex,
  precisionRadiusKm,
  tileFromKey,
  tileKey,
  wrapLon,
} from './cell';
