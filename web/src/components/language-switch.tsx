import { getLocale, getTranslations } from "next-intl/server";
import { setLocale } from "@/i18n/set-locale";
import { locales } from "@/i18n/locales";

export default async function LanguageSwitch() {
  const current = await getLocale();
  const t = await getTranslations("language");

  return (
    <form action={setLocale} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">{t("label")}</span>
      <div className="flex gap-2">
        {locales.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              aria-pressed={active}
              className={
                active
                  ? "rounded border border-line bg-raised px-3 py-1.5 text-sm text-ink"
                  : "rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
              }
            >
              {t(locale)}
            </button>
          );
        })}
      </div>
    </form>
  );
}
