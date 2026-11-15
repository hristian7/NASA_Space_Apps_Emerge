"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales } from "@/i18n/locales";
import { setLocale } from "@/i18n/set-locale";
import { motionMs, usePresence } from "@/lib/ui/motion";

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
  const presence = usePresence(open, motionMs.fast);
  return { open, setOpen, root, shown: presence.mounted, state: presence.state };
}

const nativeName: Record<string, string> = { en: "English", bg: "Български" };

/** Language picker behind a globe, so more languages fit later without more buttons. */
export function LanguageMenu() {
  const t = useTranslations("shell");
  const current = useLocale();
  const { open, setOpen, root, shown, state } = useDropdown();
  return (
    <div className="dropdown lang-menu" ref={root}>
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
      {shown ? (
        <form action={setLocale} className="dropdown-list glass" data-state={state} inert={!open} aria-label={t("languageMenu")} onSubmit={() => setOpen(false)}>
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

/** One small button for the explanation pages and every data credit, each named once. */
function useCredits(): string[] {
  const t = useTranslations("shell");
  const layers = useTranslations("layers");
  return [
    layers("historyCredit"),
    layers("recentCredit"),
    layers("dangerCredit"),
    t("creditDrivers"),
    layers("windCredit"),
    t("creditForecastWeather"),
    t("creditBasemap"),
    t("creditSearch"),
    t("creditBorders"),
  ];
}

function InfoLinks({ onPick }: { onPick: () => void }) {
  const t = useTranslations("shell");
  const credits = useCredits();
  return (
    <>
      <Link className="dropdown-item" href="/about" onClick={onPick}>
        {t("aboutProject")}
      </Link>
      <Link className="dropdown-item" href="/proof" onClick={onPick}>
        {t("howWeKnow")}
      </Link>
      <h2 className="info-heading">{t("creditsHeading")}</h2>
      <ul className="info-credits">
        {credits.map((credit) => (
          <li key={credit}>{credit}</li>
        ))}
      </ul>
    </>
  );
}

export function InfoMenu() {
  const t = useTranslations("shell");
  const { open, setOpen, root, shown, state } = useDropdown();
  return (
    <div className="dropdown info-menu" ref={root}>
      <button
        type="button"
        className="icon-btn glass"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("infoMenu")}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="6.4" r="1" fill="currentColor" />
        </svg>
      </button>
      {shown ? (
        <div className="dropdown-list info-list glass" data-state={state} inert={!open} role="dialog" aria-label={t("infoMenu")}>
          <InfoLinks onPick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

/** On a phone, language and information share one menu button. */
export function MobileMenu() {
  const t = useTranslations("shell");
  const current = useLocale();
  const { open, setOpen, root, shown, state } = useDropdown();
  return (
    <div className="dropdown mobile-menu" ref={root}>
      <button
        type="button"
        className="icon-btn glass"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("menu")}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {shown ? (
        <div className="dropdown-list info-list glass" data-state={state} inert={!open} role="dialog" aria-label={t("menu")}>
          <form action={setLocale} className="menu-langs" aria-label={t("languageMenu")} onSubmit={() => setOpen(false)}>
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
          <InfoLinks onPick={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
