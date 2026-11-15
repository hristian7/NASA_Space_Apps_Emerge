import Link from "next/link";
import { getTranslations } from "next-intl/server";
import BrandLogo from "@/components/shell/brand-logo";
import Disclaimer from "@/components/shell/disclaimer";
import LanguageSwitch from "@/components/shell/language-switch";
import "./info-page.css";

export type InfoTab = "how" | "proof" | "about";

const tabs: { id: InfoTab; href: string; label: string }[] = [
  { id: "how", href: "/how-it-works", label: "howTab" },
  { id: "proof", href: "/proof", label: "proofTab" },
  { id: "about", href: "/about", label: "aboutTab" },
];

/** The frame shared by the three information pages: one header, one tab row, one footer. */
export default async function InfoPage({
  current,
  className = "",
  children,
}: {
  current: InfoTab;
  className?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("info");
  return (
    <div className="info">
      <header className="info-head">
        <div className="info-bar">
          <Link className="brand info-brand" href="/" aria-label={t("toMap")}>
            <BrandLogo label={t("toMap")} />
          </Link>
          <LanguageSwitch />
        </div>
        <nav className="info-tabs" aria-label={t("tabsLabel")}>
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              className="info-tab"
              href={tab.href}
              aria-current={tab.id === current ? "page" : undefined}
            >
              {t(tab.label)}
            </Link>
          ))}
        </nav>
      </header>

      <main className={`page info-main ${className}`.trim()}>{children}</main>

      <footer className="info-foot">
        <Disclaimer />
        <p className="info-foot-links">
          <Link href="/">{t("backToMap")}</Link>
          <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer noopener">
            {t("openSource")}
          </a>
        </p>
      </footer>
    </div>
  );
}
