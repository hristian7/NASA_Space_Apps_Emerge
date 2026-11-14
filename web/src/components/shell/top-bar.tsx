"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import BrandLogo from "./brand-logo";
import SearchBox from "./search-box";
import { InfoMenu, LanguageMenu, MobileMenu } from "./top-menus";
import ViewTabs, { type AppView } from "./view-tabs";

type Props = {
  view: AppView;
  onView?: (view: AppView) => void;
  onCountry?: (iso3: string) => void;
  onPoint?: (lat: number, lon: number) => void;
};

/**
 * Left: the name, the History / Forecast switch and the search. Right: the
 * explanation pages and the language. Other pages show the bar without the
 * search, linking back into the shell.
 */
export default function TopBar({ view, onView, onCountry, onPoint }: Props) {
  const t = useTranslations("shell");
  const s = useTranslations("search");
  // On a phone the search folds into an icon until it is wanted.
  const [searchOpen, setSearchOpen] = useState(false);
  const hasSearch = Boolean(onCountry && onPoint);

  return (
    <header className={onView ? "top" : "top top-flow"} data-search-open={searchOpen}>
      <Link className="brand" href="/">
        <BrandLogo label={t("name")} />
      </Link>
      <ViewTabs current={view} onChange={onView} />
      {hasSearch ? (
        <button
          type="button"
          className="icon-btn glass search-toggle"
          aria-expanded={searchOpen}
          aria-label={s("label")}
          onClick={() => setSearchOpen((value) => !value)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
      {onCountry && onPoint ? (
        <SearchBox
          onCountry={(iso3) => {
            setSearchOpen(false);
            onCountry(iso3);
          }}
          onPoint={(lat, lon) => {
            setSearchOpen(false);
            onPoint(lat, lon);
          }}
          autoFocus={searchOpen}
        />
      ) : null}
      <span className="spacer" />
      <LanguageMenu />
      <InfoMenu />
      <MobileMenu />
    </header>
  );
}
