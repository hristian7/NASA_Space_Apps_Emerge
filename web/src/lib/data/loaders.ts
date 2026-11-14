/**
 * One loader per file in the frozen contract (docs/data-contract.md section 1).
 *
 * Absence is read file by file, not globally:
 *  - meta.json and validation.json must exist. Without meta nothing else can
 *    be read, so a missing one is an error.
 *  - A tile, a daily tile or a globe year that does not exist means "no fire
 *    cells in that square (or that year)", so the loader answers null and the
 *    caller treats it as zero fire, never as a failure.
 *  - A country or reported file that does not exist answers null: meta lists
 *    which ones exist, so asking for another one is a caller's question, not
 *    a broken data set.
 */

import type {
  CountryFile,
  DailyFile,
  GlobeFile,
  MetaFile,
  ReportedFile,
  TileFile,
  ValidationFile,
} from '../../types/data';

import { DataError, DataSource, dataSource } from './source';

function source(given?: DataSource): DataSource {
  return given ?? dataSource();
}

async function required<T>(src: DataSource, path: string): Promise<T> {
  const file = await src.json<T>(path);
  if (file === null) {
    throw new DataError('fetch', path, `${src.url(path)} is missing and the app cannot run without it`);
  }
  return file;
}

/** meta.json. Read first: it says which files exist and where there is no data. */
export function loadMeta(src?: DataSource): Promise<MetaFile> {
  return required<MetaFile>(source(src), 'meta.json');
}

/** validation.json, everything the "How we know it's right" page shows. */
export function loadValidation(src?: DataSource): Promise<ValidationFile> {
  return required<ValidationFile>(source(src), 'validation.json');
}

/** countries/<ISO3>.json. null when there is no file for that code. */
export function loadCountry(iso3: string, src?: DataSource): Promise<CountryFile | null> {
  return source(src).json<CountryFile>(`countries/${iso3}.json`);
}

/** reported/<ISO3>.json. null when the country has no reported figures. */
export function loadReported(iso3: string, src?: DataSource): Promise<ReportedFile | null> {
  return source(src).json<ReportedFile>(`reported/${iso3}.json`);
}

/** tiles/<key>.json.gz. null means no fire cells in that 5 degree square. */
export function loadTile(key: string, src?: DataSource): Promise<TileFile | null> {
  return source(src).json<TileFile>(`tiles/${key}.json.gz`);
}

/** daily/<key>.json.gz. null means no fire days in that square's window. */
export function loadDaily(key: string, src?: DataSource): Promise<DailyFile | null> {
  return source(src).json<DailyFile>(`daily/${key}.json.gz`);
}

/** globe/<year>.json. null means that year has no globe file. */
export function loadGlobeYear(year: number, src?: DataSource): Promise<GlobeFile | null> {
  return source(src).json<GlobeFile>(`globe/${year}.json`);
}

/** Loads several tiles at once. Squares with no file are left out. */
export async function loadTiles(keys: string[], src?: DataSource): Promise<TileFile[]> {
  const files = await Promise.all(keys.map((key) => loadTile(key, src)));
  return files.filter((file): file is TileFile => file !== null);
}

/** Loads several daily tiles at once. Squares with no file are left out. */
export async function loadDailyTiles(keys: string[], src?: DataSource): Promise<DailyFile[]> {
  const files = await Promise.all(keys.map((key) => loadDaily(key, src)));
  return files.filter((file): file is DailyFile => file !== null);
}
