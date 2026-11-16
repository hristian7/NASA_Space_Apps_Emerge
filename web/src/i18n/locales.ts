export const locales = ["en", "bg"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeCookieName = "emerge-locale";

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}

/**
 * The language for a visit. A choice made with the switch (the cookie) always
 * wins. Otherwise Bulgarian when the browser's first language the site speaks
 * is Bulgarian, or when the visitor is in Bulgaria; English for everyone else.
 */
export function pickLocale({
  stored,
  acceptLanguage,
  country,
}: {
  stored?: string;
  acceptLanguage?: string | null;
  country?: string | null;
}): Locale {
  if (isLocale(stored)) return stored;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { base: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.base !== "" && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .find((entry) => isLocale(entry.base));
  if (preferred !== undefined && preferred.base === "bg") return "bg";
  if (country?.trim().toUpperCase() === "BG") return "bg";
  return defaultLocale;
}
