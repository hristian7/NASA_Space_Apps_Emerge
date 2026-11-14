/** The CSV downloads (docs/number-logic.md section 8). */

export { headerLines, LEGEND_LINE } from "./header";
export type { CsvHeader } from "./header";
export { monthlyBody, monthlyColumnLine, monthlyCsv, FLAG_SEPARATOR, MONTHLY_COLUMNS } from "./monthly";
export { keyValueBody, summaryColumnLine, summaryCsv, summaryRows, SUMMARY_COLUMNS } from "./summary";
export type { SummaryFigures } from "./summary";
export { commentLine, csvField, csvRow, decimalNumber, wholeNumber, EOL } from "./text";
