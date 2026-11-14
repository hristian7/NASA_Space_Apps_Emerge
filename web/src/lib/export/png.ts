/**
 * Saving an SVG as a PNG in the browser.
 *
 * Follows the six rules the risk spike measured (docs/plans/spike-results.md,
 * section d). A plain "copy the SVG into an image" produces black cells,
 * because the copy leaves the page's stylesheet behind:
 *
 *  1. every colour is written onto the element itself as plain rgb(...),
 *     resolved by painting one pixel on a canvas and reading it back;
 *  2. class and style are stripped from the copy;
 *  3. a web font is embedded as base64 when the caller owns one, and every
 *     text element carries its family, size and weight as attributes;
 *  4. the root carries an explicit xmlns, width and height;
 *  5. a background is painted first, or the PNG comes out transparent;
 *  6. the image is decoded before it is drawn, and the temporary address is
 *     released afterwards.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/** Rule 1: the measured PNG was twice the SVG's size. */
export const DEFAULT_SCALE = 2;

const CAPTION_HEIGHT = 54;
const CAPTION_PAD = 10;

export interface PngCaption {
  /** What the picture shows, for example "Fire calendar". */
  title: string;
  /** The place the numbers belong to. */
  place: string;
  /** The period the numbers cover. */
  dates: string;
}

export interface EmbeddedFont {
  family: string;
  /** A data: address holding the font file. */
  dataUrl: string;
  weight?: number;
  style?: string;
}

/**
 * One piece of the legend band drawn under the picture. A legend that lives in
 * HTML beside an SVG does not travel into the PNG, so the caller hands it over
 * as data: plain words, a run of touching colour swatches, and the keys for
 * zero, no data and estimated.
 */
export type PngLegendItem =
  | { kind: "text"; text: string }
  | { kind: "swatch"; colour: string }
  | {
      kind: "key";
      text: string;
      /** null draws the no-data key: an outline with a slash through it. */
      colour: string | null;
      pattern?: "stripes";
    };

export interface PngOptions {
  caption: PngCaption;
  /** Drawn in a band under the picture, in the order given. */
  legend?: readonly PngLegendItem[];
  /** Pixels per SVG unit. Two by default, as the spike measured. */
  scale?: number;
  /** Any CSS colour. Resolved to rgb before it is painted. */
  background?: string;
  /** Any CSS colour for the caption text. */
  textColor?: string;
  fontFamily?: string;
  titleSizePx?: number;
  captionSizePx?: number;
  /** Rule 3. Left out, the caption falls back to the family named above. */
  embedFont?: EmbeddedFont;
}

export interface PngResult {
  blob: Blob;
  /** Pixel size of the PNG. */
  width: number;
  height: number;
  /** Size of the SVG it came from, in its own units. */
  sourceWidth: number;
  sourceHeight: number;
  /** Height of the band the caption was drawn into, in PNG pixels. */
  captionHeight: number;
}

/** Properties copied from the live element onto the copy, as attributes. */
const PAINT_PROPERTIES = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
] as const;

const TEXT_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
] as const;

const COLOUR_PROPERTIES = new Set([
  "fill",
  "stroke",
  "color",
  "stop-color",
  "flood-color",
]);

/**
 * Turns any CSS colour the browser understands, including oklch, color-mix
 * and a var() already resolved by getComputedStyle, into rgb(...).
 */
export function createColourResolver(): (value: string) => string {
  const cache = new Map<string, string>();
  let context: CanvasRenderingContext2D | null = null;

  return (value: string): string => {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "none" || trimmed.startsWith("url(")) {
      return normaliseUrl(trimmed);
    }
    if (trimmed.startsWith("rgb(")) {
      return trimmed;
    }
    const cached = cache.get(trimmed);
    if (cached !== undefined) {
      return cached;
    }
    if (context === null) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      context = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (context === null) {
      return trimmed;
    }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000";
    context.fillStyle = trimmed;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    const resolved =
      a === 255
        ? `rgb(${r},${g},${b})`
        : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
    cache.set(trimmed, resolved);
    return resolved;
  };
}

function normaliseUrl(value: string): string {
  // getComputedStyle quotes the fragment; an attribute must not carry quotes.
  return value.replace(/url\(["']?([^"')]+)["']?\)/, "url($1)");
}

/**
 * Rule 1 and rule 2: paints the live computed values onto the copy and takes
 * the class and style attributes off it.
 */
export function inlineComputedPaint(
  source: SVGSVGElement,
  copy: SVGSVGElement,
  resolveColour: (value: string) => string,
): void {
  const live: Element[] = [source, ...Array.from(source.querySelectorAll("*"))];
  const copies: Element[] = [copy, ...Array.from(copy.querySelectorAll("*"))];

  for (let i = 0; i < live.length && i < copies.length; i += 1) {
    const from = live[i];
    const to = copies[i];
    if (!(from instanceof Element) || !(to instanceof Element)) {
      continue;
    }
    const computed = window.getComputedStyle(from);
    const properties =
      to.tagName === "text" || to.tagName === "tspan"
        ? [...PAINT_PROPERTIES, ...TEXT_PROPERTIES]
        : PAINT_PROPERTIES;

    for (const property of properties) {
      const value = computed.getPropertyValue(property);
      if (value === "") {
        continue;
      }
      to.setAttribute(
        property,
        COLOUR_PROPERTIES.has(property) ? resolveColour(value) : value.trim(),
      );
    }

    to.removeAttribute("class");
    to.removeAttribute("style");
  }
}

function captionNode(
  document_: Document,
  caption: PngCaption,
  width: number,
  options: {
    textColour: string;
    mutedColour: string;
    fontFamily: string;
    titleSize: number;
    captionSize: number;
  },
): SVGGElement {
  const group = document_.createElementNS(SVG_NS, "g") as SVGGElement;

  const title = document_.createElementNS(SVG_NS, "text");
  title.setAttribute("x", String(CAPTION_PAD));
  title.setAttribute("y", String(CAPTION_PAD + options.titleSize));
  title.setAttribute("fill", options.textColour);
  title.setAttribute("font-family", options.fontFamily);
  title.setAttribute("font-size", `${options.titleSize}px`);
  title.setAttribute("font-weight", "600");
  title.textContent = caption.title;
  group.appendChild(title);

  const place = document_.createElementNS(SVG_NS, "text");
  place.setAttribute("x", String(CAPTION_PAD));
  place.setAttribute(
    "y",
    String(CAPTION_PAD + options.titleSize + options.captionSize + 6),
  );
  place.setAttribute("fill", options.mutedColour);
  place.setAttribute("font-family", options.fontFamily);
  place.setAttribute("font-size", `${options.captionSize}px`);
  place.setAttribute("font-weight", "400");
  place.textContent = caption.place;
  group.appendChild(place);

  const dates = document_.createElementNS(SVG_NS, "text");
  dates.setAttribute("x", String(width - CAPTION_PAD));
  dates.setAttribute(
    "y",
    String(CAPTION_PAD + options.titleSize + options.captionSize + 6),
  );
  dates.setAttribute("text-anchor", "end");
  dates.setAttribute("fill", options.mutedColour);
  dates.setAttribute("font-family", options.fontFamily);
  dates.setAttribute("font-size", `${options.captionSize}px`);
  dates.setAttribute("font-weight", "400");
  dates.textContent = caption.dates;
  group.appendChild(dates);

  return group;
}

const LEGEND_SWATCH = 10;
const LEGEND_GAP = 6;
const LEGEND_TEXT = 10;
const LEGEND_PAD = 8;

/** Height of the legend band, 0 when there is nothing to draw. */
function legendHeight(items: readonly PngLegendItem[] | undefined): number {
  return items === undefined || items.length === 0
    ? 0
    : LEGEND_PAD + LEGEND_SWATCH + 4;
}

/**
 * The legend band: swatches of the same size as the calendar's keys, each with
 * its words beside it, laid left to right. Everything is written as attributes
 * because no stylesheet survives the copy.
 */
function legendNode(
  document_: Document,
  items: readonly PngLegendItem[],
  width: number,
  options: { textColour: string; lineColour: string; fontFamily: string },
): SVGGElement {
  const group = document_.createElementNS(SVG_NS, "g") as SVGGElement;
  const top = LEGEND_PAD / 2;
  let x = CAPTION_PAD;

  function words(text: string, after: number): void {
    const node = document_.createElementNS(SVG_NS, "text");
    node.setAttribute("x", String(x));
    node.setAttribute("y", String(top + LEGEND_SWATCH - 1));
    node.setAttribute("fill", options.textColour);
    node.setAttribute("font-family", options.fontFamily);
    node.setAttribute("font-size", `${LEGEND_TEXT}px`);
    node.setAttribute("font-weight", "400");
    node.textContent = text;
    group.appendChild(node);
    // A rough width per character, which is enough to keep the pieces apart.
    x += text.length * LEGEND_TEXT * 0.52 + after;
  }

  function box(colour: string | null, pattern?: "stripes"): void {
    const rect = document_.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(top));
    rect.setAttribute("width", String(LEGEND_SWATCH));
    rect.setAttribute("height", String(LEGEND_SWATCH));
    rect.setAttribute("fill", colour ?? "none");
    rect.setAttribute("stroke", options.lineColour);
    rect.setAttribute("stroke-width", "0.8");
    group.appendChild(rect);
    if (colour === null) {
      const slash = document_.createElementNS(SVG_NS, "line");
      slash.setAttribute("x1", String(x + 1.5));
      slash.setAttribute("y1", String(top + LEGEND_SWATCH - 1.5));
      slash.setAttribute("x2", String(x + LEGEND_SWATCH - 1.5));
      slash.setAttribute("y2", String(top + 1.5));
      slash.setAttribute("stroke", options.lineColour);
      slash.setAttribute("stroke-width", "0.8");
      group.appendChild(slash);
    }
    if (pattern === "stripes") {
      for (let i = 1; i < 4; i += 1) {
        const line = document_.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(x + i * 2.5));
        line.setAttribute("y1", String(top + LEGEND_SWATCH));
        line.setAttribute("x2", String(x + i * 2.5 + LEGEND_SWATCH / 2));
        line.setAttribute("y2", String(top));
        line.setAttribute("stroke", options.textColour);
        line.setAttribute("stroke-width", "0.6");
        group.appendChild(line);
      }
    }
  }

  for (const item of items) {
    if (x > width - 40) break;
    if (item.kind === "text") {
      words(item.text, LEGEND_GAP);
    } else if (item.kind === "swatch") {
      box(item.colour);
      x += LEGEND_SWATCH;
    } else {
      box(item.colour, item.pattern);
      x += LEGEND_SWATCH + 3;
      words(item.text, LEGEND_GAP + 4);
    }
  }

  return group;
}

function sourceSize(source: SVGSVGElement): { width: number; height: number } {
  const box = source.viewBox.baseVal;
  if (box !== null && box.width > 0 && box.height > 0) {
    return { width: box.width, height: box.height };
  }
  const rect = source.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

/** Builds the standalone SVG that is handed to the image decoder. */
export function buildExportSvg(
  source: SVGSVGElement,
  options: PngOptions,
): {
  markup: string;
  width: number;
  height: number;
  captionHeight: number;
  legendHeight: number;
} {
  const resolveColour = createColourResolver();
  const computed = window.getComputedStyle(source);
  const background = resolveColour(
    options.background ?? readBackground(source) ?? "#ffffff",
  );
  const textColour = resolveColour(options.textColor ?? computed.color);
  const mutedColour = textColour.startsWith("rgb(")
    ? textColour.replace("rgb(", "rgba(").replace(")", ",0.72)")
    : textColour;

  const lineColour = textColour.startsWith("rgb(")
    ? textColour.replace("rgb(", "rgba(").replace(")", ",0.35)")
    : textColour;

  const { width, height } = sourceSize(source);
  const captionHeight = CAPTION_HEIGHT;
  const legend = legendHeight(options.legend);
  const totalHeight = height + captionHeight + legend;

  const root = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  // Rule 4.
  root.setAttribute("xmlns", SVG_NS);
  root.setAttributeNS(
    "http://www.w3.org/2000/xmlns/",
    "xmlns:xlink",
    XLINK_NS,
  );
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(totalHeight));
  root.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);

  // Rule 3: the only stylesheet that survives is the embedded font.
  if (options.embedFont !== undefined) {
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = `@font-face{font-family:'${options.embedFont.family}';font-style:${options.embedFont.style ?? "normal"};font-weight:${options.embedFont.weight ?? 400};src:url('${options.embedFont.dataUrl}');}`;
    root.appendChild(style);
  }

  // Rule 5.
  const backdrop = document.createElementNS(SVG_NS, "rect");
  backdrop.setAttribute("x", "0");
  backdrop.setAttribute("y", "0");
  backdrop.setAttribute("width", String(width));
  backdrop.setAttribute("height", String(totalHeight));
  backdrop.setAttribute("fill", background);
  root.appendChild(backdrop);

  const fontFamily =
    options.fontFamily ??
    options.embedFont?.family ??
    computed.fontFamily.replace(/"/g, "'");

  root.appendChild(
    captionNode(document, options.caption, width, {
      textColour,
      mutedColour,
      fontFamily,
      titleSize: options.titleSizePx ?? 17,
      captionSize: options.captionSizePx ?? 12,
    }),
  );

  const copy = source.cloneNode(true) as SVGSVGElement;
  inlineComputedPaint(source, copy, resolveColour);
  copy.setAttribute("x", "0");
  copy.setAttribute("y", String(captionHeight));
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  copy.removeAttribute("role");
  copy.removeAttribute("aria-label");
  root.appendChild(copy);

  if (options.legend !== undefined && options.legend.length > 0) {
    const band = legendNode(document, options.legend, width, {
      textColour,
      lineColour,
      fontFamily,
    });
    band.setAttribute("transform", `translate(0,${captionHeight + height})`);
    root.appendChild(band);
  }

  return {
    markup: new XMLSerializer().serializeToString(root),
    width,
    height: totalHeight,
    captionHeight,
    legendHeight: legend,
  };
}

function readBackground(element: Element): string | null {
  let node: Element | null = element;
  while (node !== null) {
    const colour = window.getComputedStyle(node).backgroundColor;
    if (
      colour !== "" &&
      colour !== "transparent" &&
      !colour.startsWith("rgba(0, 0, 0, 0)")
    ) {
      return colour;
    }
    node = node.parentElement;
  }
  return null;
}

/** Draws the SVG into a PNG at `scale` times its own size. */
export async function svgToPng(
  source: SVGSVGElement,
  options: PngOptions,
): Promise<PngResult> {
  const scale = options.scale ?? DEFAULT_SCALE;
  const built = buildExportSvg(source, options);
  const blob = new Blob([built.markup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const address = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "sync";
    image.src = address;
    // Rule 6.
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(built.width * scale);
    canvas.height = Math.round(built.height * scale);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("This browser gave no 2d drawing context.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result === null) {
          reject(new Error("The browser produced no PNG."));
          return;
        }
        resolve(result);
      }, "image/png");
    });

    return {
      blob: png,
      width: canvas.width,
      height: canvas.height,
      sourceWidth: built.width,
      sourceHeight: built.height - built.captionHeight - built.legendHeight,
      captionHeight: Math.round(built.captionHeight * scale),
    };
  } finally {
    URL.revokeObjectURL(address);
  }
}

/** Saves the PNG to the visitor's downloads. */
export async function downloadSvgAsPng(
  source: SVGSVGElement,
  filename: string,
  options: PngOptions,
): Promise<PngResult> {
  const result = await svgToPng(source, options);
  const address = URL.createObjectURL(result.blob);
  try {
    const link = document.createElement("a");
    link.href = address;
    link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(address);
  }
  return result;
}

/** A file name with no spaces or punctuation that a file system dislikes. */
export function pngFilename(parts: string[]): string {
  const stem = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${stem === "" ? "emerge" : stem}.png`;
}
