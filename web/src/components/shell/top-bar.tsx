"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import BrandLogo from "./brand-logo";
import LanguageSwitch from "./language-switch";
import ViewTabs, { type AppView } from "./view-tabs";

type Props = {
  view?: AppView;
  openMenu?: "place" | "view" | null;
  onToggleMenu?: (menu: "place" | "view") => void;
};

/**
 * The bar across the top of both views. The Place and View menus belong to
 * the history map, so the forecast view shows the bar without them.
 */
export default function TopBar({ view = "history", openMenu = null, onToggleMenu }: Props) {
  const t = useTranslations("shell");

  return (
    <header className={view === "forecast" ? "top top-flow" : "top"}>
      <span className="brand">
        <BrandLogo label={t("name")} />
      </span>
      {onToggleMenu ? (
        <div className="chip-group glass">
          <button
            type="button"
            className="chip"
            aria-expanded={openMenu === "place"}
            aria-controls="place-menu"
            onClick={() => onToggleMenu("place")}
          >
            {t("placeMenu")}
          </button>
          <button
            type="button"
            className="chip"
            aria-expanded={openMenu === "view"}
            aria-controls="view-menu"
            onClick={() => onToggleMenu("view")}
          >
            {t("viewMenu")}
          </button>
        </div>
      ) : null}
      <span className="spacer" />
      <ViewTabs current={view} />
      <span className="spacer" />
      <nav className="chip-group glass top-links" aria-label={t("name")}>
        <Link className="chip" href="/proof">
          {t("proofLink")}
        </Link>
        <Link className="chip" href="/about">
          {t("aboutLink")}
        </Link>
      </nav>
      <LanguageSwitch />
    </header>
  );
}
