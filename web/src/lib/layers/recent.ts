/**
 * Turning FIRMS near-real-time CSV rows into the compact shape the map draws.
 *
 * The cleaning rule is the project's own (specification section 4.1): MODIS
 * confidence 30 or more, VIIRS confidence nominal or high. The live files
 * spell the VIIRS value out as `low`, `nominal`, `high` rather than the single
 * letters the archive uses, so the first letter is what is read.
 *
 * These files carry no `type` column at all, so a detection cannot be told
 * apart from a gas flare or another standing heat source here. The layer says
 * so in its own words; nothing in this file pretends otherwise.
 *
 * Confidence is kept as one of two bands rather than a number, because MODIS
 * reports a percentage and VIIRS reports a word. FIRMS describes the MODIS
 * bands as low below 30, nominal from 30 to 80 and high above 80, which is the
 * split used here, so both sensors end up on the same two words.
 */

export const confidenceLabels: readonly string[] = ['nominal', 'high'];

/** One detection, before it is packed into columns. */
export interface RecentRow {
  lat: number;
  lon: number;
  /** Acquisition date, YYYY-MM-DD. */
  date: string;
  /** Minutes after midnight UTC. */
  minute: number;
  /** Fire radiative power in megawatts. */
  frp: number;
  /** Index into the satellite labels. */
  sat: number;
  /** 0 nominal, 1 high. */
  conf: number;
}

export interface RecentPayload {
  schema: 'emerge-recent-1';
  window: string;
  /** When the route read the files, as an ISO instant. */
  built: string;
  /** Latest acquisition in the kept rows, as `YYYY-MM-DD HH:MM` in UTC. */
  dataTime: string | null;
  /** Earliest acquisition in the kept rows, same shape. */
  dataStart: string | null;
  /** Rows that passed the cleaning rule. */
  total: number;
  /** Rows in `cols`, which is `total` unless the cap cut it. */
  shown: number;
  capped: boolean;
  satLabels: readonly string[];
  confLabels: readonly string[];
  dates: string[];
  cols: {
    lat: number[];
    lon: number[];
    date: number[];
    minute: number[];
    frp: number[];
    sat: number[];
    conf: number[];
  };
  /** One entry per file read, so a missing satellite is visible. */
  sources: { sat: number; rows: number; ok: boolean }[];
}

function confidenceBand(raw: string, sensor: 'modis' | 'viirs'): number | null {
  const value = raw.trim().toLowerCase();
  if (sensor === 'modis') {
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent < 30) return null;
    return percent > 80 ? 1 : 0;
  }
  const first = value.charAt(0);
  if (first === 'n') return 0;
  if (first === 'h') return 1;
  return null;
}

/** `0017` or `17` or `1745` as minutes after midnight. */
function minuteOfDay(raw: string): number | null {
  const digits = raw.trim().padStart(4, '0');
  if (!/^\d{4}$/.test(digits)) return null;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function columnIndex(header: string[], name: string): number {
  return header.indexOf(name);
}

/**
 * Reads one FIRMS CSV. Rows that fail the cleaning rule, or that are
 * unreadable, are dropped silently: a single bad line must not lose a file.
 */
export function parseFirmsCsv(
  text: string,
  sensor: 'modis' | 'viirs',
  sat: number,
): RecentRow[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].trim().split(',');
  const iLat = columnIndex(header, 'latitude');
  const iLon = columnIndex(header, 'longitude');
  const iDate = columnIndex(header, 'acq_date');
  const iTime = columnIndex(header, 'acq_time');
  const iConf = columnIndex(header, 'confidence');
  const iFrp = columnIndex(header, 'frp');
  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0 || iConf < 0) return [];

  const rows: RecentRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '' || line === '\r') continue;
    const parts = line.split(',');
    if (parts.length <= iConf) continue;

    const conf = confidenceBand(parts[iConf], sensor);
    if (conf === null) continue;

    const lat = Number(parts[iLat]);
    const lon = Number(parts[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const date = parts[iDate].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const minute = minuteOfDay(parts[iTime]);
    if (minute === null) continue;

    const frpRaw = iFrp >= 0 && iFrp < parts.length ? Number(parts[iFrp]) : 0;
    const frp = Number.isFinite(frpRaw) && frpRaw > 0 ? frpRaw : 0;

    rows.push({ lat, lon, date, minute, frp, sat, conf });
  }
  return rows;
}

/** `YYYY-MM-DD HH:MM`, the shape the panel shows. */
function stamp(date: string, minute: number): string {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0');
  const rest = String(minute % 60).padStart(2, '0');
  return `${date} ${hour}:${rest}`;
}

/**
 * Packs rows into columns, keeping at most `cap` of them. When the cap bites,
 * the strongest detections by heat output are the ones kept, and the reply
 * says so, because a map that silently drops two thirds of its points would
 * be read as the whole picture.
 */
export function compactRecent(
  rows: RecentRow[],
  options: {
    window: string;
    cap: number;
    built: string;
    sources: { sat: number; rows: number; ok: boolean }[];
  },
): RecentPayload {
  const total = rows.length;
  const capped = total > options.cap;
  const kept = capped
    ? [...rows].sort((a, b) => b.frp - a.frp).slice(0, options.cap)
    : rows;

  const dates: string[] = [];
  const dateIndex = new Map<string, number>();
  const cols: RecentPayload['cols'] = {
    lat: [],
    lon: [],
    date: [],
    minute: [],
    frp: [],
    sat: [],
    conf: [],
  };

  let newest: RecentRow | null = null;
  let oldest: RecentRow | null = null;

  for (const row of kept) {
    let index = dateIndex.get(row.date);
    if (index === undefined) {
      index = dates.length;
      dates.push(row.date);
      dateIndex.set(row.date, index);
    }
    cols.lat.push(Number(row.lat.toFixed(5)));
    cols.lon.push(Number(row.lon.toFixed(5)));
    cols.date.push(index);
    cols.minute.push(row.minute);
    cols.frp.push(Number(row.frp.toFixed(1)));
    cols.sat.push(row.sat);
    cols.conf.push(row.conf);

    const key = `${row.date} ${String(row.minute).padStart(4, '0')}`;
    if (newest === null || key > `${newest.date} ${String(newest.minute).padStart(4, '0')}`) {
      newest = row;
    }
    if (oldest === null || key < `${oldest.date} ${String(oldest.minute).padStart(4, '0')}`) {
      oldest = row;
    }
  }

  return {
    schema: 'emerge-recent-1',
    window: options.window,
    built: options.built,
    dataTime: newest === null ? null : stamp(newest.date, newest.minute),
    dataStart: oldest === null ? null : stamp(oldest.date, oldest.minute),
    total,
    shown: kept.length,
    capped,
    satLabels: [],
    confLabels: confidenceLabels,
    dates,
    cols,
    sources: options.sources,
  };
}

/** Point size in pixels for one detection, by heat output. */
export function recentRadiusPx(frp: number): number {
  if (frp >= 100) return 5.5;
  if (frp >= 20) return 4;
  return 2.8;
}
