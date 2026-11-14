/**
 * CSV text rules shared by every download (docs/number-logic.md section 8).
 *
 * Line ends are "\n". A field holding a comma is quoted. Null is an empty
 * field; zero is "0".
 */

/** Line end for every CSV this app writes. */
export const EOL = "\n";

/** Quote a field when it holds a comma, a quote, or a line end. Doubles inner quotes. */
export function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** One CSV line from its fields, quoted where needed, with the line end. */
export function csvRow(fields: readonly string[]): string {
  return fields.map(csvField).join(",") + EOL;
}

/**
 * A comment line. Comment lines start with "#" and are never quoted, so a
 * line end inside the text is replaced by a space.
 */
export function commentLine(text: string): string {
  const flat = text.replace(/[\r\n]+/g, " ");
  return (flat.startsWith("#") ? flat : `# ${flat}`) + EOL;
}

/**
 * A whole number, or an empty field for null. Zero is "0", never "-0".
 * Half goes up (number-logic section 9, ruling 8), which is Math.round.
 */
export function wholeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  return rounded === 0 ? "0" : String(rounded);
}

/**
 * A number for the summary rows: whole numbers as they are, others to at most
 * six decimals with trailing zeros cut. Empty for null.
 */
export function decimalNumber(value: number | null | undefined, decimals = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return value === 0 ? "0" : String(value);
  const fixed = value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
  return fixed === "-0" || fixed === "0" ? "0" : fixed;
}
