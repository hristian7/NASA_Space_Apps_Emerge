"use client";

import { useLocale, useTranslations } from "next-intl";
import { locales } from "@/i18n/locales";
import { setLocale } from "@/i18n/set-locale";

const shortLabel: Record<string, string> = { en: "EN", bg: "БГ" };

export default function LanguageSwitch() {
  const current = useLocale();
  const t = useTranslations("shell");

  return (
    <form action={setLocale} className="chip-group glass" aria-label={t("languageLabel")}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          className="chip"
          aria-pressed={locale === current}
          aria-label={locale === "en" ? t("languageEn") : t("languageBg")}
        >
          {shortLabel[locale] ?? locale.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
