import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AnchorHeading from "@/components/explain/anchor-heading";
import Disclaimer from "@/components/shell/disclaimer";
import { officialServices } from "@/lib/ui/credits";
import { sourceGroups } from "@/lib/ui/sources";
import "./about.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "website", siteName: "Emerge" },
    twitter: { card: "summary", title: t("metaTitle"), description: t("metaDescription") },
  };
}

export default async function AboutPage() {
  const t = await getTranslations("about");
  const home = await getTranslations("home");
  const shell = await getTranslations("shell");

  const sections = [
    { id: "what", title: home("aboutWhatHeading") },
    { id: "official", title: home("aboutOfficialHeading") },
    { id: "credits", title: home("aboutCreditsHeading") },
    ...sourceGroups.map((group) => ({ id: group.id, title: t(`groups.${group.id}`) })),
  ];

  return (
    <main className="page ab">
      <nav className="chip-group">
        <Link className="chip" href="/">
          {home("backToMap")}
        </Link>
        <Link className="chip" href="/how-it-works">
          {t("howLink")}
        </Link>
        <Link className="chip" href="/proof">
          {shell("proofLink")}
        </Link>
      </nav>

      <header>
        <h1>{home("aboutTitle")}</h1>
        <p>{t("lead")}</p>
      </header>

      <nav className="ab-toc" aria-label={t("onThisPage")}>
        <span className="label">{t("onThisPage")}</span>
        {sections.map((section) => (
          <a key={section.id} className="chip" href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>

      <section id="what">
        <AnchorHeading id="what" label={t("anchorLabel")}>
          {home("aboutWhatHeading")}
        </AnchorHeading>
        <p>{t("whatBody")}</p>
        <p>{t("notBody")}</p>
        <Link className="ab-how-card" href="/how-it-works">
          <strong>{t("howLink")} →</strong>
          <span>{t("howLinkBody")}</span>
        </Link>
      </section>

      <Disclaimer />

      <section id="official">
        <AnchorHeading id="official" label={t("anchorLabel")}>
          {home("aboutOfficialHeading")}
        </AnchorHeading>
        <p>{home("aboutOfficialBody")}</p>
        <ul>
          {officialServices.map((service) => (
            <li key={service.key}>
              <a href={service.url} target="_blank" rel="noreferrer noopener">
                {shell(service.key)}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id="credits">
        <AnchorHeading id="credits" label={t("anchorLabel")}>
          {home("aboutCreditsHeading")}
        </AnchorHeading>
        <p>{t("creditsLead")}</p>
      </section>

      {sourceGroups.map((group) => (
        <section key={group.id} id={group.id}>
          <AnchorHeading id={group.id} label={t("anchorLabel")}>
            {t(`groups.${group.id}`)}
          </AnchorHeading>
          <div className="ab-columns" aria-hidden="true">
            <span>
              {t("columnResource")} · {t("columnUse")}
            </span>
            <span>{t("columnLicence")}</span>
          </div>
          <ul className="ab-list">
            {group.rows.map((row) => (
              <li key={row.id} className="ab-row">
                <div>
                  <a className="ab-name" href={row.url} target="_blank" rel="noreferrer noopener">
                    {row.name}
                  </a>
                  <span className="ab-use">{t(`used.${row.id}`)}</span>
                </div>
                <span className="ab-licence">{row.licence}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
