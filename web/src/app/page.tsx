import Link from "next/link";
import { getTranslations } from "next-intl/server";
import LanguageSwitch from "@/components/language-switch";

export default async function Home() {
  const t = await getTranslations("app");
  const en = await getTranslations({ locale: "en", namespace: "app" });
  const bg = await getTranslations({ locale: "bg", namespace: "app" });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("name")}
        </h1>
        <p className="text-lg text-muted">{t("tagline")}</p>
        <LanguageSwitch />
      </header>

      <nav>
        <Link
          href="/preview"
          className="inline-block rounded border border-line bg-raised px-4 py-2 text-sm text-ink hover:border-ink"
        >
          {t("previewLink")}
        </Link>
      </nav>

      <footer className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted">
        <p lang="en">{en("disclaimer")}</p>
        <p lang="bg">{bg("disclaimer")}</p>
      </footer>
    </main>
  );
}
