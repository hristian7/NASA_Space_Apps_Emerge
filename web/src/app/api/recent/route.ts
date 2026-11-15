/**
 * GET /api/recent: NASA's near-real-time fire detections for the last 24 hours
 * or the last 7 days, as compact JSON the map can draw straight away (S5).
 *
 * The files themselves are public and need no key, but none of them sends an
 * allow-origin header, so a browser cannot read them. This route reads them
 * instead, applies the project's cleaning rule, keeps only latitude, longitude,
 * date and time, heat output, satellite and confidence, and caches the result
 * for an hour. FIRMS refreshes these files a few times an hour, so an hour-old
 * answer is still a fair picture and the files are not fetched per visitor.
 *
 * Query: `window=24h|7d`, `cap=<points>` (at most 60000), and optionally
 * `near=<lat>,<lon>,<km>` (km at most 300) to keep only detections within that
 * distance of a point, for a place's active-fire check.
 */

import { firmsFiles, isRecentWindow, satelliteLabels, type RecentWindow } from '../../../lib/layers/firms';
import { compactRecent, parseFirmsCsv, type RecentPayload, type RecentRow } from '../../../lib/layers/recent';
import { distanceKm } from '../../../lib/risk/geo';

/** The seven day files are tens of megabytes together; the default is too short. */
export const maxDuration = 120;

export const runtime = 'nodejs';

const cacheSeconds = 3600;
const defaultCap = 20000;
const maxCap = 60000;

interface CacheEntry {
  at: number;
  body: string;
}

// One process serves many visitors, so a finished answer is held here as well
// as in the cache header. A cold start simply fetches again.
const cache = new Map<string, CacheEntry>();

// The parsed files per window, so point checks do not fetch them again.
const rowCache = new Map<string, { at: number; rows: RecentRow[]; sources: { sat: number; rows: number; ok: boolean }[] }>();

function nearFrom(raw: string | null): { lat: number; lon: number; km: number } | null | 'bad' {
  if (raw === null) return null;
  const [lat, lon, km] = raw.split(',').map(Number);
  if (![lat, lon, km].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || km <= 0 || km > 300) return 'bad';
  return { lat, lon, km };
}

function capFrom(raw: string | null): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return defaultCap;
  return Math.min(maxCap, Math.round(value));
}

async function readFiles(window: RecentWindow): Promise<{
  rows: RecentRow[];
  sources: { sat: number; rows: number; ok: boolean }[];
}> {
  const files = firmsFiles(window);
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const response = await fetch(file.url, {
          headers: { accept: 'text/csv,text/plain' },
          cache: 'no-store',
        });
        if (!response.ok) return { sat: file.sat, rows: [] as RecentRow[], ok: false };
        const text = await response.text();
        return { sat: file.sat, rows: parseFirmsCsv(text, file.sensor, file.sat), ok: true };
      } catch {
        return { sat: file.sat, rows: [] as RecentRow[], ok: false };
      }
    }),
  );

  return {
    rows: results.flatMap((entry) => entry.rows),
    sources: results.map((entry) => ({ sat: entry.sat, rows: entry.rows.length, ok: entry.ok })),
  };
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get('window');
  if (raw !== null && !isRecentWindow(raw)) {
    return new Response(JSON.stringify({ error: 'window must be 24h or 7d' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  const window: RecentWindow = isRecentWindow(raw) ? raw : '24h';
  const cap = capFrom(url.searchParams.get('cap'));
  const near = nearFrom(url.searchParams.get('near'));
  if (near === 'bad') {
    return new Response(JSON.stringify({ error: 'near must be lat,lon,km with km up to 300' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  const key = near === null ? `${window}:${cap}` : `${window}:${cap}:${near.lat.toFixed(3)},${near.lon.toFixed(3)},${near.km}`;

  const held = cache.get(key);
  if (held !== undefined && Date.now() - held.at < cacheSeconds * 1000) {
    return new Response(held.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=60, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
      },
    });
  }

  let payload: RecentPayload;
  try {
    const heldRows = rowCache.get(window);
    const fresh = heldRows !== undefined && Date.now() - heldRows.at < cacheSeconds * 1000 ? heldRows : null;
    const read = fresh ?? { at: Date.now(), ...(await readFiles(window)) };
    if (fresh === null && read.sources.some((entry) => entry.ok)) rowCache.set(window, read);
    const { sources } = read;
    const rows = near === null ? read.rows : read.rows.filter((row) => distanceKm(near.lat, near.lon, row.lat, row.lon) <= near.km);
    if (sources.every((entry) => !entry.ok)) {
      return new Response(JSON.stringify({ error: 'the fire detection files could not be read' }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    payload = compactRecent(rows, {
      window,
      cap,
      built: new Date().toISOString(),
      sources,
    });
    payload.satLabels = satelliteLabels;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `the fire detection files could not be read: ${String(error)}` }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  const body = JSON.stringify(payload);
  // Point checks make one entry each; a long-lived process must not keep them all.
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), body });

  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=60, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
    },
  });
}
