/**
 * Map styles reject modern colour formats, and the look tokens are written in
 * oklch, so a token has to be turned into plain rgb before it reaches the map.
 * Painting one pixel and reading it back is the only conversion that follows
 * whatever the browser actually computed.
 */
let probe: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D | null {
  if (probe !== null) return probe;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  probe = canvas.getContext("2d", { willReadFrequently: true });
  return probe;
}

export function tokenColor(name: string, fallback = "rgb(255,255,255)"): string {
  const ctx = context();
  if (ctx === null) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value === "") return fallback;
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r},${g},${b})`;
  } catch {
    return fallback;
  }
}
