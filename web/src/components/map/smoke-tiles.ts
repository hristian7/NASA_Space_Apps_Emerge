import type { AddProtocolAction } from 'maplibre-gl';
import { keepPlumes } from '@/lib/layers/smoke';

/** Map addresses for the smoke layer: `emerge-smoke://` followed by the tile's own path on this site. */
export const smokeScheme = 'emerge-smoke';

export function smokeTileUrl(url: string): string {
  return url.startsWith('/') ? `${smokeScheme}:/${url}` : url;
}

/**
 * Fetches NASA's aerosol index tile, then clears everything below the smoke
 * threshold so only plumes are drawn. The colours stay NASA's own.
 */
export const smokeTile: AddProtocolAction = async (request, abort) => {
  const path = request.url.slice(`${smokeScheme}:/`.length);
  const response = await fetch(path, { signal: abort.signal });
  if (!response.ok) throw new Error(`Smoke tile: ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Smoke canvas unavailable');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  keepPlumes(image.data);
  context.putImageData(image, 0, 0);
  if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Smoke image unavailable')))));
  return { data: await blob.arrayBuffer() };
};
