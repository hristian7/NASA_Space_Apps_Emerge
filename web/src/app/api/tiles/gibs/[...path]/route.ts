/**
 * GET /api/tiles/gibs/<layer>/default/<date>/<matrix>/<z>/<y>/<x>.png
 *
 * One NASA GIBS data tile, passed through unchanged. GIBS marks these tiles
 * `no-store`; a tile for a fixed date does not change within a day, so the
 * answer is cached for a day by the browser and the CDN. Errors are passed on
 * uncached, so an intermittent GIBS failure is retried on the next request.
 */

import { gibsUpstream } from '../../../../../lib/layers/tile-proxy';

export const runtime = 'nodejs';

const cacheControl = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const upstream = gibsUpstream((await params).path);
  if (upstream === null) return new Response('not a tile this app serves', { status: 404 });

  let response: Response;
  try {
    response = await fetch(upstream, { cache: 'no-store' });
  } catch {
    return new Response('tile service unreachable', { status: 502, headers: { 'cache-control': 'no-store' } });
  }
  if (!response.ok) {
    return new Response(null, { status: response.status, headers: { 'cache-control': 'no-store' } });
  }
  return new Response(response.body, {
    headers: {
      'content-type': response.headers.get('content-type') ?? 'image/png',
      'cache-control': cacheControl,
    },
  });
}
