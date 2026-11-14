"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales } from "@/i18n/locales";
import { setLocale } from "@/i18n/set-locale";

/** A small menu that closes on an outside click or Escape. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, root };
}

const nativeName: Record<string, string> = { en: "English", bg: "Български" };

/** Language picker behind a globe, so more languages fit later without more buttons. */
export function LanguageMenu() {
  const t = useTranslations("shell");
  const current = useLocale();
  const { open, setOpen, root } = useDropdown();
  return (
    <div className="dropdown" ref={root}>
      <button
        type="button"
        className="icon-btn glass"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("languageMenu")}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.8 10h14.4M10 2.8c2.2 2.3 2.2 12.1 0 14.4M10 2.8c-2.2 2.3-2.2 12.1 0 14.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span className="icon-btn-text">{current.toUpperCase()}</span>
      </button>
      {open ? (
        <form action={setLocale} className="dropdown-list glass" aria-label={t("languageMenu")} onSubmit={() => setOpen(false)}>
          {locales.map((locale) => (
            <button
              key={locale}
              type="submit"
              name="locale"
              value={locale}
              className="dropdown-item"
              aria-current={locale === current ? "true" : undefined}
              lang={locale}
            >
              {nativeName[locale] ?? locale.toUpperCase()}
            </button>
          ))}
        </form>
      ) : null}
    </div>
  );
}

/** The two explanation pages, grouped behind one entry. */
export function AboutMenu() {
  const t = useTranslations("shell");
  const { open, setOpen, root } = useDropdown();
  return (
    <div className="dropdown" ref={root}>
      <button
        type="button"
        className="chip-solo glass"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("aboutMenu")}
        onClick={() => setOpen(!open)}
      >
        <svg className="about-icon" viewBox="0 0 20 20" aria-hidden="true" width="18" height="18">
          <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="6.4" r="1" fill="currentColor" />
        </svg>
        <span className="about-text">{t("aboutMenu")}</span>
      </button>
      {open ? (
        <nav className="dropdown-list glass" aria-label={t("aboutMenu")}>
          <Link className="dropdown-item" href="/about" onClick={() => setOpen(false)}>
            {t("aboutProject")}
          </Link>
          <Link className="dropdown-item" href="/proof" onClick={() => setOpen(false)}>
            {t("howWeKnow")}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
