"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import BrandLogo from "./brand-logo";
import LanguageSwitch from "./language-switch";

type Props = {
  openMenu: "place" | "view" | null;
  onToggleMenu: (menu: "place" | "view") => void;
};

export default function TopBar({ openMenu, onToggleMenu }: Props) {
  const t = useTranslations("shell");

  return (
    <header className="top">
      <span className="brand">
        <BrandLogo label={t("name")} />
      </span>
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
      <span className="spacer" />
      <nav className="chip-group glass" aria-label={t("name")}>
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
