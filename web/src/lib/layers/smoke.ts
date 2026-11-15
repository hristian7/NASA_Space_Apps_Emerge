import { aerosolIndexPalette } from './aerosol-palette';

/**
 * Aerosol index from which a pixel is shown. Clean air and thin background
 * haze sit between 0 and about 1.5 and would cover the globe in pale yellow;
 * smoke and dust plumes read above it. A presentation choice [U].
 */
export const smokeThreshold = 1.5;

/** The index value at which the drawn plume reaches full strength. */
const fullAt = 3.5;

const valueByColour = new Map<number, number>();
for (const [r, g, b, lower] of aerosolIndexPalette) valueByColour.set((r << 16) | (g << 8) | b, lower ?? -Infinity);

/** The aerosol index class a tile colour stands for, or null for a colour outside NASA's map. */
export function aerosolIndexOf(r: number, g: number, b: number): number | null {
  return valueByColour.get((r << 16) | (g << 8) | b) ?? null;
}

/**
 * Keeps NASA's colours for smoke and dust plumes and clears everything below
 * the threshold, in place. Strength grows with the index, so a thick plume
 * reads stronger than its thin edge. Returns how many pixels stay visible.
 */
export function keepPlumes(pixels: Uint8ClampedArray): number {
  let kept = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const value = aerosolIndexOf(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (value === null || value < smokeThreshold) {
      pixels[i + 3] = 0;
      continue;
    }
    const strength = Math.min(1, 0.45 + 0.55 * ((value - smokeThreshold) / (fullAt - smokeThreshold)));
    pixels[i + 3] = Math.round(pixels[i + 3] * strength);
    kept++;
  }
  return kept;
}
