import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import metaJson from "../../../public/data/meta.json";
import AnchorHeading from "@/components/explain/anchor-heading";
import InfoPage from "@/components/explain/info-page";
import SatelliteTimeline, { satelliteLanes } from "@/components/explain/satellite-timeline";
import { officialServices } from "@/lib/ui/credits";
import { roleOrder, sourceGroups, type Source } from "@/lib/ui/sources";
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

const record = metaJson as unknown as { first_month: string; last_month: string };
const aboutGroups = sourceGroups.map((group) => ({ ...group, rows: group.rows.filter((row) => !row.formOnly) }));
const sourceCount = aboutGroups.reduce((sum, group) => sum + group.rows.length, 0);
const compactGroups = new Set(["software", "fonts", "video"]);

type T = (key: string, values?: Record<string, string | number>) => string;

function Card({ row, t, compact }: { row: Source; t: T; compact: boolean }) {
  return (
    <li className="ab-card" data-compact={compact || undefined}>
      {row.provider ? <span className="ab-provider">{row.provider}</span> : null}
      <a className="ab-name" href={row.url} target="_blank" rel="noreferrer noopener">
        {row.name}
      </a>
      <p className="ab-use">{t(`used.${row.id}`)}</p>
      {row.roles ? (
        <span className="ab-roles">
          {row.roles.map((role) => (
            <span key={role} className="ab-role" data-role={role}>
              {t(`roles.${role}`)}
            </span>
          ))}
        </span>
      ) : null}
      <span className="ab-licence">{row.licence}</span>
    </li>
  );
}

export default async function AboutPage() {
  const t = (await getTranslations("about")) as unknown as T;
  const home = await getTranslations("home");
  const shell = await getTranslations("shell");

  const groups = aboutGroups.filter((group) => group.id !== "project");
  const project = aboutGroups.find((group) => group.id === "project");
  const sections = [
    { id: "what", title: home("aboutWhatHeading") },
    ...groups.map((group) => ({ id: group.id, title: t(`groups.${group.id}`) })),
    { id: "project", title: t("groups.project") },
    { id: "official", title: home("aboutOfficialHeading") },
  ];

  return (
    <InfoPage current="about" className="ab">
      <header>
        <h1>{home("aboutTitle")}</h1>
        <p>{t("lead")}</p>
      </header>

      <nav className="ab-toc" aria-label={t("onThisPage")}>
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>

      <section id="what">
        <AnchorHeading id="what" label={t("anchorLabel")}>
          {home("aboutWhatHeading")}
        </AnchorHeading>
        <div className="ab-stats">
          <div>
            <strong>{t("statYears", { from: record.first_month.slice(0, 4), to: record.last_month.slice(0, 4) })}</strong>
            <span>{t("statYearsLabel")}</span>
          </div>
          <div>
            <strong>{t("statSatellites", { n: satelliteLanes.length })}</strong>
            <span>{t("statSatellitesLabel")}</span>
          </div>
          <div>
            <strong>{t("statSources", { n: sourceCount })}</strong>
            <span>{t("statSourcesLabel")}</span>
          </div>
        </div>
        <div className="ab-what">
          <div className="ab-prose">
            <p>{t("whatBody")}</p>
            <p>{t("notBody")}</p>
          </div>
          <Link className="ab-how" href="/how-it-works">
            <strong>{t("howLink")} →</strong>
            <span>{t("howLinkBody")}</span>
          </Link>
        </div>
      </section>

      <section id="credits" className="ab-credits">
        <AnchorHeading id="credits" label={t("anchorLabel")}>
          {home("aboutCreditsHeading")}
        </AnchorHeading>
        <p className="ab-prose">{t("creditsLead")}</p>
        <p className="ab-legend">
          <span>{t("rolesLead")}</span>
          {roleOrder.map((role) => (
            <span key={role} className="ab-role" data-role={role}>
              {t(`roles.${role}`)}
            </span>
          ))}
        </p>
      </section>

      {groups.map((group) => (
        <section key={group.id} id={group.id} className="ab-group">
          {group.aliases?.map((alias) => <span key={alias} id={alias} className="ab-alias" aria-hidden="true" />)}
          <AnchorHeading id={group.id} label={t("anchorLabel")}>
            {t(`groups.${group.id}`)}
          </AnchorHeading>
          {group.id === "satellite" ? (
            <figure className="ab-timeline">
              <figcaption className="label">{t("timelineCaption")}</figcaption>
              <SatelliteTimeline />
            </figure>
          ) : null}
          <ul className="ab-cards" data-compact={compactGroups.has(group.id) || undefined}>
            {group.rows.map((row) => (
              <Card key={row.id} row={row} t={t} compact={compactGroups.has(group.id)} />
            ))}
          </ul>
        </section>
      ))}

      {project ? (
        <section id="project" className="ab-group">
          <AnchorHeading id="project" label={t("anchorLabel")}>
            {t("groups.project")}
          </AnchorHeading>
          <p className="ab-prose">{t("projectBody")}</p>
          <ul className="ab-cards">
            {project.rows.map((row) => (
              <Card key={row.id} row={row} t={t} compact={false} />
            ))}
          </ul>
          <p className="ab-licences">
            <span>{t("projectCode")}</span>
            <span>{t("projectData")}</span>
          </p>
        </section>
      ) : null}

      <section id="official">
        <AnchorHeading id="official" label={t("anchorLabel")}>
          {home("aboutOfficialHeading")}
        </AnchorHeading>
        <p>{home("aboutOfficialBody")}</p>
        <ul className="ab-official">
          {officialServices.map((service) => (
            <li key={service.key}>
              <a href={service.url} target="_blank" rel="noreferrer noopener">
                {shell(service.key)}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </InfoPage>
  );
}
