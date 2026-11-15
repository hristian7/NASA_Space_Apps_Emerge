import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AnchorHeading from "@/components/explain/anchor-heading";
import InfoPage from "@/components/explain/info-page";
import { formGroupOrder, formRows, formText, type FormGroup, type FormRow } from "@/lib/ui/sources";
import CopyButton from "./copy-button";
import "../about/about.css";
import "./data-sources.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sources");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "website", siteName: "Emerge" },
    twitter: { card: "summary", title: t("metaTitle"), description: t("metaDescription") },
  };
}

const referencesUrl = "https://github.com/hristian7/NASA_Space_Apps_Emerge/blob/main/docs/references.md";

type T = (key: string, values?: Record<string, string | number>) => string;

function Card({ row, about, t }: { row: FormRow; about: T; t: T }) {
  return (
    <li className="ab-card ds-card">
      {row.provider ? <span className="ab-provider">{row.provider}</span> : null}
      <a className="ab-name" href={row.url} target="_blank" rel="noreferrer noopener">
        {row.linkText}
        <span className="sr-only"> ({t("opensNewTab")})</span>
      </a>
      <span className="ds-url">{row.url}</span>
      <p className="ab-use">{about(`used.${row.id}`)}</p>
      {row.experimental ? (
        <span className="ab-roles">
          <span className="ab-role" data-role="experimental">
            {t("experimental")}
          </span>
        </span>
      ) : null}
    </li>
  );
}

export default async function DataSourcesPage() {
  const t = (await getTranslations("sources")) as unknown as T;
  const about = (await getTranslations("about")) as unknown as T;
  const nasa = formRows("nasa");
  const rest = formRows("other");
  const subgroups = formGroupOrder
    .filter((group): group is Exclude<FormGroup, "nasa"> => group !== "nasa")
    .map((group) => ({ group, rows: rest.filter((row) => row.group === group) }))
    .filter((entry) => entry.rows.length > 0);
  const copyLabels = { label: t("copy"), done: t("copied"), fallback: t("copyFallback") };

  return (
    <InfoPage current="sources" className="ab ds">
      <header>
        <h1>{t("title")}</h1>
        <p>{t("lead")}</p>
        <p className="ds-count">{t("count", { n: nasa.length, m: rest.length })}</p>
      </header>

      <section id="nasa" className="ab-group" data-section="nasa">
        <div className="ds-head">
          <AnchorHeading id="nasa" label={about("anchorLabel")}>
            {t("nasaHeading")}
          </AnchorHeading>
          <CopyButton text={formText(nasa)} {...copyLabels} />
        </div>
        <p className="ab-prose">{t("nasaNote")}</p>
        <ul className="ab-cards">
          {nasa.map((row) => (
            <Card key={row.id} row={row} about={about} t={t} />
          ))}
        </ul>
      </section>

      <section id="other" className="ab-group" data-section="other">
        <div className="ds-head">
          <AnchorHeading id="other" label={about("anchorLabel")}>
            {t("otherHeading")}
          </AnchorHeading>
          <CopyButton text={formText(rest)} {...copyLabels} />
        </div>
        {subgroups.map(({ group, rows }) => (
          <div key={group} className="ds-sub" data-group={group}>
            <h3>{t(`groups.${group}`)}</h3>
            <ul className="ab-cards" data-compact={group === "software" || group === "tools" || undefined}>
              {rows.map((row) => (
                <Card key={row.id} row={row} about={about} t={t} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="ds-full">
        <a href={referencesUrl} target="_blank" rel="noreferrer noopener">
          {t("fullList")}
        </a>
      </p>
    </InfoPage>
  );
}
