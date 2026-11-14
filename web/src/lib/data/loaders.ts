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
  CountryIndexFile,
  DailyFile,
  GlobeFile,
  MetaFile,
  ReportedFile,
  TileFile,
  ValidationFile,
} from '../../types/data';

import { cellCenter, precisionRadiusKm } from './cell';
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

/**
 * globe/<year>.json.gz, one year of totals per cell. null means that year has
 * no globe file.
 *
 * The file is slim: the columns are id, hot, cd and frp only, and the point
 * comes from the id (`point_from_id`), which is why the world layer fits in a
 * static budget. globeCells below turns it into one record per cell with the
 * centre and the precision worked out, for a layer that wants objects.
 */
export function loadGlobeYear(year: number, src?: DataSource): Promise<GlobeFile | null> {
  return source(src).json<GlobeFile>(`globe/${year}.json.gz`);
}

/** One cell of a globe year, with the point worked out from the id. */
export interface GlobeCell {
  /** Cell id: row * 1440 + col. */
  id: number;
  /** Cell centre latitude. */
  lat: number;
  /** Cell centre longitude. */
  lon: number;
  /** How far inside the cell a point can be from that centre, in km. */
  precisionRadiusKm: number;
  /** Hotspots that year. */
  hot: number;
  /** Fire days (fire cell-days) that year. */
  cd: number;
  /** Fire radiative power that year, in MW. */
  frp: number;
}

/**
 * The cells of a globe year as records. The centre and the precision are
 * derived from the id with the frozen grid rule, because the file does not
 * carry them.
 */
export function globeCells(file: GlobeFile): GlobeCell[] {
  const { id, hot, cd, frp } = file.cols;
  const out: GlobeCell[] = [];
  for (let at = 0; at < id.length; at += 1) {
    const centre = cellCenter(id[at]);
    out.push({
      id: id[at],
      lat: centre.lat,
      lon: centre.lon,
      precisionRadiusKm: precisionRadiusKm(centre.lat),
      hot: hot[at],
      cd: cd[at],
      frp: frp[at],
    });
  }
  return out;
}

/**
 * countries/index.json: one line per country file, for the country search
 * box. null when the file is not there, so a caller can fall back to the
 * plain list of codes in meta.json.
 *
 * A box with `west` greater than `east` crosses the 180 degree line.
 */
export function loadCountryIndex(src?: DataSource): Promise<CountryIndexFile | null> {
  return source(src).json<CountryIndexFile>('countries/index.json');
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
