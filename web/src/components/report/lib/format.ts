// Number, month and date formatting. Pure: the locale is always passed in, so
// a server render and a browser render of the same props agree.

export type ReportLocale = "en" | "bg";

const INTL_LOCALE: Record<ReportLocale, string> = {
  en: "en-US",
  bg: "bg-BG",
};

const MONTH_SHORT: Record<ReportLocale, string[]> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  bg: [
    "яну",
    "фев",
    "мар",
    "апр",
    "май",
    "юни",
    "юли",
    "авг",
    "сеп",
    "окт",
    "ное",
    "дек",
  ],
};

const MONTH_LONG: Record<ReportLocale, string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  bg: [
    "януари",
    "февруари",
    "март",
    "април",
    "май",
    "юни",
    "юли",
    "август",
    "септември",
    "октомври",
    "ноември",
    "декември",
  ],
};

const MONTH_INITIAL: Record<ReportLocale, string[]> = {
  en: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  bg: ["Я", "Ф", "М", "А", "М", "Ю", "Ю", "А", "С", "О", "Н", "Д"],
};

export function intlLocale(locale: ReportLocale): string {
  return INTL_LOCALE[locale];
}

/** Whole numbers with the language's own group separator. */
export function formatCount(
  value: number | null | undefined,
  locale: ReportLocale,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

/** One decimal place, for ratios such as "2.1 times". */
export function formatRatio(
  value: number | null | undefined,
  locale: ReportLocale,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** A share of 1 as a whole percentage. */
export function formatPercent(
  value: number | null | undefined,
  locale: ReportLocale,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

/** A signed change per year, keeping one decimal for small slopes. */
export function formatSigned(
  value: number | null | undefined,
  locale: ReportLocale,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  const digits = Math.abs(value) >= 100 ? 0 : 1;
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
}

export function monthInitial(m: number, locale: ReportLocale): string {
  return MONTH_INITIAL[locale][m - 1] ?? "";
}

export function monthShort(m: number, locale: ReportLocale): string {
  return MONTH_SHORT[locale][m - 1] ?? "";
}

export function monthLong(m: number, locale: ReportLocale): string {
  return MONTH_LONG[locale][m - 1] ?? "";
}

/** "August 2024" / "август 2024". */
export function monthYearLong(
  y: number,
  m: number,
  locale: ReportLocale,
): string {
  const name = monthLong(m, locale);
  return name === "" ? String(y) : `${name} ${y}`;
}

/** "Aug 2024" / "авг 2024". */
export function monthYearShort(
  y: number,
  m: number,
  locale: ReportLocale,
): string {
  const name = monthShort(m, locale);
  return name === "" ? String(y) : `${name} ${y}`;
}

/** An ISO date as the language writes it. Returns the input when unparseable. */
export function formatIsoDate(iso: string, locale: ReportLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) {
    return iso;
  }
  const [, y, m, d] = match;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

/** "159 to 295", or an empty string when either end is missing. */
export function formatRange(
  lo: number | null,
  hi: number | null,
  locale: ReportLocale,
  joiner: string,
): string {
  if (lo === null || hi === null) {
    return "";
  }
  return `${formatCount(lo, locale)} ${joiner} ${formatCount(hi, locale)}`;
}
