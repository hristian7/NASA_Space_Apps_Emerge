/** The raw hotspots download (specification M11, spike a). */

export {
  cutNotice,
  hotspotColumnLine,
  hotspotHeader,
  hotspotRowText,
  hotspotsCsv,
  HOTSPOT_COLUMNS,
} from "./csv";
export {
  confidenceKept,
  inArea,
  isModis,
  keepRow,
  MIN_MODIS_CONFIDENCE,
  VEGETATION_TYPE,
  VIIRS_CONFIDENCE,
} from "./filter";
export type { Detection, FilterOptions, HotspotRow } from "./filter";
export { bboxAround, bboxesOverlap, distanceKm, inBbox, EARTH_RADIUS_KM } from "./geo";
export type { Bbox } from "./geo";
export {
  daysBetween,
  describeArea,
  isDay,
  parseHotspotQuery,
  readBox,
  yearsOf,
  FIRST_DAY,
  MAX_DAYS,
  MAX_RADIUS_KM,
  MAX_ROWS,
} from "./query";
export type { Area, BboxArea, HotspotRequest, ParseResult, PointArea } from "./query";
export { blockCounts, openYear, overlappingRanges, toDetection, yearUrl } from "./read";
export type { RowRange, YearReader } from "./read";
export { streamHotspotsCsv } from "./stream";
export type { StreamResult } from "./stream";
