/**
 * GET /api/hotspots: a CSV of individual fire detections for one area and one
 * date range, read from the public yearly files (specification M11).
 *
 * Query: lat, lon, radius_km (0 to 200), or bbox=west,south,east,north; plus
 * from and to as YYYY-MM-DD, at most 366 days apart.
 *
 * No key and no secret: the files are public and the licence is CC0.
 */

import { parseHotspotQuery, streamHotspotsCsv } from "../../../lib/hotspots";

/** The reader needs Node streams and buffers. */
export const runtime = "nodejs";

/** Reading several blocks of a 1.2 GB file over the network takes time. */
export const maxDuration = 300;

/** Every answer is built from the request, so nothing is cached by route config. */
export const dynamic = "force-dynamic";

function fileName(from: string, to: string): string {
  return `emerge-hotspots-${from}-to-${to}.csv`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parseHotspotQuery(url.searchParams);
  if (!parsed.ok) {
    return new Response(`${parsed.message}\n`, {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Verification only, and never in production: the cleaning rules off, so the
  // row count can be compared with a count taken straight from the files.
  const raw = url.searchParams.get("clean") === "0" && process.env.NODE_ENV !== "production";
  const hotspotRequest = { ...parsed.request, clean: !raw };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamHotspotsCsv(hotspotRequest, (text) => {
          controller.enqueue(encoder.encode(text));
        });
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        controller.enqueue(encoder.encode(`# The read failed before the end: ${message}\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName(hotspotRequest.from, hotspotRequest.to)}"`,
      "cache-control": "public, max-age=0, s-maxage=86400",
    },
  });
}
