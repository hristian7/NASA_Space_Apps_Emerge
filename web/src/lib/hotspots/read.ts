/**
 * Reading individual detections out of the public yearly files.
 *
 * The method is the one the spike measured (docs/plans/spike-results.md,
 * section a): read the file's block list first, keep only the blocks whose
 * area overlaps the request, read those blocks, then filter the rows. Dates do
 * not narrow the search, because every block spans the whole year.
 */

import {
  asyncBufferFromUrl,
  cachedAsyncBuffer,
  parquetMetadataAsync,
  parquetReadObjects,
  type FileMetaData,
} from "hyparquet";
import { compressors } from "hyparquet-compressors";

import type { Detection } from "./filter";
import { bboxesOverlap, type Bbox } from "./geo";

/** Where the yearly files live. One file per year, named directly. */
export const CATALOG_BASE =
  "https://data.source.coop/portolan-mirrors/firms-catalog/detections";

/** The columns the download needs. Reading fewer columns means fewer bytes. */
export const READ_COLUMNS = [
  "acq_date",
  "acq_datetime",
  "sensor",
  "satellite",
  "confidence",
  "frp",
  "daynight",
  "scan",
  "track",
  "type",
  "geometry",
];

/** The address of one year's file. */
export function yearUrl(year: number): string {
  return `${CATALOG_BASE}/year=${year}/detections.parquet`;
}

export interface RowRange {
  start: number;
  end: number;
}

interface GeoStats {
  bbox?: { xmin: number; xmax: number; ymin: number; ymax: number };
}

/** The box a block covers, from the geometry column's own statistics. */
function blockBox(group: FileMetaData["row_groups"][number]): Bbox | null {
  for (const column of group.columns) {
    const meta = column.meta_data;
    if (!meta || meta.path_in_schema.join(".") !== "geometry") continue;
    const stats = meta.geospatial_statistics as GeoStats | undefined;
    const box = stats?.bbox;
    if (!box) return null;
    return { west: box.xmin, east: box.xmax, south: box.ymin, north: box.ymax };
  }
  return null;
}

/**
 * The row ranges to read: one per run of neighbouring blocks that overlap the
 * box. A block with no stated area is read, because leaving it out would drop
 * detections without saying so.
 */
export function overlappingRanges(metadata: FileMetaData, box: Bbox): RowRange[] {
  const ranges: RowRange[] = [];
  let start = 0;
  for (const group of metadata.row_groups) {
    const rows = Number(group.num_rows);
    const groupBox = blockBox(group);
    if (groupBox === null || bboxesOverlap(groupBox, box)) {
      const last = ranges[ranges.length - 1];
      if (last && last.end === start) last.end = start + rows;
      else ranges.push({ start, end: start + rows });
    }
    start += rows;
  }
  return ranges;
}

/** How many blocks a file holds, and how many the box keeps. */
export function blockCounts(metadata: FileMetaData, box: Bbox): { total: number; kept: number } {
  let kept = 0;
  for (const group of metadata.row_groups) {
    const groupBox = blockBox(group);
    if (groupBox === null || bboxesOverlap(groupBox, box)) kept += 1;
  }
  return { total: metadata.row_groups.length, kept };
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  // Timestamps in the file are microseconds.
  if (typeof value === "bigint") return new Date(Number(value) / 1000);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Longitude and latitude from the geometry column; the file has no separate columns. */
function position(value: unknown): [number, number] | null {
  if (!value || typeof value !== "object") return null;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = asNumber(coordinates[0]);
  const lat = asNumber(coordinates[1]);
  if (lon === null || lat === null) return null;
  return [lon, lat];
}

/** One file row as a detection, or null when it carries no usable position or date. */
export function toDetection(row: Record<string, unknown>): Detection | null {
  const place = position(row.geometry);
  if (!place) return null;
  const day = asDate(row.acq_date);
  const moment = asDate(row.acq_datetime);
  const date = day ?? moment;
  if (!date) return null;
  const type = asNumber(row.type);
  return {
    date: date.toISOString().slice(0, 10),
    time: moment ? moment.toISOString().slice(11, 16) : "",
    lat: place[1],
    lon: place[0],
    satellite: asText(row.satellite),
    sensor: asText(row.sensor),
    confidence: asText(row.confidence),
    frp: asNumber(row.frp),
    daynight: asText(row.daynight),
    scan: asNumber(row.scan),
    track: asNumber(row.track),
    type: row.type === null || row.type === undefined ? null : type,
  };
}

export interface YearReader {
  year: number;
  ranges: RowRange[];
  blocks: { total: number; kept: number };
  read: (range: RowRange) => Promise<Detection[]>;
}

/** Open one year's file and work out which row ranges the box needs. */
export async function openYear(year: number, box: Bbox): Promise<YearReader> {
  const file = cachedAsyncBuffer(await asyncBufferFromUrl({ url: yearUrl(year) }));
  const metadata = await parquetMetadataAsync(file);
  const ranges = overlappingRanges(metadata, box);
  const blocks = blockCounts(metadata, box);
  return {
    year,
    ranges,
    blocks,
    read: async (range: RowRange) => {
      const rows = await parquetReadObjects({
        file,
        metadata,
        compressors,
        columns: READ_COLUMNS,
        rowStart: range.start,
        rowEnd: range.end,
      });
      const out: Detection[] = [];
      for (const row of rows) {
        const detection = toDetection(row as Record<string, unknown>);
        if (detection) out.push(detection);
      }
      return out;
    },
  };
}
