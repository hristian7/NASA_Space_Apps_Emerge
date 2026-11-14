"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import BrandLogo from "./brand-logo";
import SearchBox from "./search-box";
import { AboutMenu, LanguageMenu } from "./top-menus";
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

  return (
    <header className={onView ? "top" : "top top-flow"}>
      <Link className="brand" href="/">
        <BrandLogo label={t("name")} />
      </Link>
      <ViewTabs current={view} onChange={onView} />
      {onCountry && onPoint ? <SearchBox onCountry={onCountry} onPoint={onPoint} /> : null}
      <span className="spacer" />
      <AboutMenu />
      <LanguageMenu />
    </header>
  );
}
