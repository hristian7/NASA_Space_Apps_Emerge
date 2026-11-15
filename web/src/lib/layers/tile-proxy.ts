/**
 * NASA GIBS answers its dated data tiles with `no-store`, so a browser fetches
 * every tile again on each visit, and MapLibre's globe asks for the same polar
 * tile once per world copy it draws. These tiles are served through this app's
 * own route instead, byte for byte, with cache headers, so repeats come from
 * the browser or the CDN rather than from the other side of the Atlantic.
 *
 * Only the registry's own GIBS layers and the exact tile path shape are passed
 * on; anything else is refused, so the route is not an open relay.
 */

import { LAYERS } from '../../config/layers';

export const gibsOrigin = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
export const tileProxyPath = '/api/tiles/gibs/';

/** GIBS layer names the registry draws as data layers. */
export const proxiedGibsLayers: ReadonlySet<string> = new Set(
  LAYERS.flatMap((entry) =>
    entry.source.kind === 'tile_template' && entry.source.urlTemplate.startsWith(gibsOrigin)
      ? [entry.source.urlTemplate.slice(gibsOrigin.length).split('/')[0]]
      : [],
  ),
);

const tilePath = /^default\/\d{4}-\d{2}-\d{2}\/GoogleMapsCompatible_Level\d{1,2}\/(?:\d{1,2}|\{z\})\/(?:\d{1,7}|\{y\})\/(?:\d{1,7}|\{x\})\.png$/;

/** The address the map should ask for: the route for a GIBS data layer, the original otherwise. */
export function proxyTileUrl(url: string): string {
  if (!url.startsWith(gibsOrigin)) return url;
  const rest = url.slice(gibsOrigin.length);
  const [layer, ...tail] = rest.split('/');
  if (!proxiedGibsLayers.has(layer) || !tilePath.test(tail.join('/'))) return url;
  return `${tileProxyPath}${rest}`;
}

/** The GIBS address for a path under the route, or null when it is not one of ours. */
export function gibsUpstream(segments: readonly string[]): string | null {
  const [layer, ...tail] = segments;
  if (layer === undefined || !proxiedGibsLayers.has(layer)) return null;
  const rest = tail.join('/');
  if (!tilePath.test(rest) || rest.includes('{')) return null;
  return `${gibsOrigin}${layer}/${rest}`;
}
