/**
 * The raw hotspots CSV: one row per detection, with comment lines that say
 * what was asked for, where the data comes from and how it was cleaned.
 */

import { csvRow, commentLine } from "../csv/text";
import { MIN_MODIS_CONFIDENCE, type HotspotRow } from "./filter";
import { describeArea, MAX_ROWS, type HotspotRequest } from "./query";

/** The column line, in order. */
export const HOTSPOT_COLUMNS = [
  "date",
  "time",
  "latitude",
  "longitude",
  "satellite",
  "sensor",
  "confidence",
  "frp",
  "daynight",
  "scan",
  "track",
  "provisional",
] as const;

/** The comment block at the top of the file. */
export function hotspotHeader(request: HotspotRequest): string {
  const lines = [
    "Emerge: individual fire detections (raw hotspots)",
    `Request: ${describeArea(request.area)}, from ${request.from} to ${request.to}`,
    "Sources: NASA FIRMS (MODIS Terra and Aqua, VIIRS S-NPP, NOAA-20, NOAA-21), read through the firms-catalog mirror",
    "Licence: data CC0 1.0 (NASA), catalogue code Apache-2.0",
    request.clean
      ? `Cleaning: vegetation fires only (type 0), MODIS confidence ${MIN_MODIS_CONFIDENCE} or more, VIIRS confidence n or h`
      : "Cleaning: switched off, every detection in the area and range is listed",
    "provisional = the near-real-time row carries no type, so the static-source mask that would drop gas flares and volcanoes could not be applied; the row is kept as it is",
    "Times are UTC. frp is fire radiative power in MW. scan and track are the footprint size (km for MODIS, metres for VIIRS)",
    `Limit: at most ${MAX_ROWS} rows. When the answer is cut, a notice line follows the last row`,
  ];
  return lines.map(commentLine).join("");
}

/** The line that says the answer was cut short. */
export function cutNotice(limit = MAX_ROWS): string {
  return commentLine(
    `Notice: the answer was cut at ${limit} rows. Ask for a smaller area or a shorter range to see every detection.`,
  );
}

/** A number as text, or an empty field for null. */
function num(value: number | null): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : String(value);
}

/** One CSV line for one detection. */
export function hotspotRowText(row: HotspotRow): string {
  return csvRow([
    row.date,
    row.time,
    num(row.lat),
    num(row.lon),
    row.satellite ?? "",
    row.sensor ?? "",
    row.confidence ?? "",
    num(row.frp),
    row.daynight ?? "",
    num(row.scan),
    num(row.track),
    row.provisional ? "true" : "false",
  ]);
}

/** The column line. */
export function hotspotColumnLine(): string {
  return csvRow(HOTSPOT_COLUMNS as readonly string[]);
}

/**
 * The whole CSV for a list of rows, used by the tests and by small answers.
 * The cut notice goes after the last row, because a stream cannot know at the
 * top whether the rows still to come will reach the limit.
 */
export function hotspotsCsv(request: HotspotRequest, rows: readonly HotspotRow[], cut = false): string {
  let out = hotspotHeader(request);
  out += hotspotColumnLine();
  for (const row of rows) out += hotspotRowText(row);
  if (cut) out += cutNotice();
  return out;
}
