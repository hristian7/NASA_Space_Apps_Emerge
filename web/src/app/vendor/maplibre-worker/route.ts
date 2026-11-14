import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * MapLibre 6 loads its worker from a separate file and works out the address
 * from its own module URL, which a bundled application does not have. Risk
 * spike (b) hit the resulting "Worker failed to load". Serving the library's
 * own worker file from a fixed address here, and pointing the library at it,
 * is the fix. Prerendered, so the deployed app reads no package files.
 */
export const dynamic = "force-static";

export async function GET() {
  // The bundler rewrites require.resolve, so the file is read by a path that
  // stays inside one folder, which also keeps the output trace small.
  const source = await readFile(
    join(process.cwd(), "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
    "utf8",
  );

  return new Response(source, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
