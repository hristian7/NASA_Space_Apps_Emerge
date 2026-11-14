import Link from "next/link";
import homeEn from "../../../messages/home.en.json";
import { getTranslations } from "next-intl/server";
import Disclaimer from "@/components/shell/disclaimer";
import { dataCredits, officialServices, softwareCredits, type Credit } from "@/lib/ui/credits";

function CreditTable({
  rows,
  resource,
  licence,
  translate,
}: {
  rows: Credit[];
  resource: string;
  licence: string;
  translate: (key: string) => string;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{resource}</th>
          <th scope="col">{licence}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <a href={row.url} target="_blank" rel="noreferrer noopener">
                {creditText(row.name, homeEn.creditNames, "creditNames", translate)}
              </a>
            </td>
            <td>{creditText(row.licence, homeEn.creditLicences, "creditLicences", translate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AboutPage() {
  const home = await getTranslations("home");
  const shell = await getTranslations("shell");

  return (
    <main className="page">
      <nav className="chip-group">
        <Link className="chip" href="/">
          {home("backToMap")}
        </Link>
        <Link className="chip" href="/proof">
          {shell("proofLink")}
        </Link>
      </nav>

      <header>
        <h1>{home("aboutTitle")}</h1>
        <p>{home("aboutLead")}</p>
      </header>

      <section>
        <h2>{home("aboutWhatHeading")}</h2>
        <p>{home("aboutWhatBody")}</p>
      </section>

      <section>
        <h2>{home("aboutHonestHeading")}</h2>
        <p>{home("aboutHonestBody")}</p>
      </section>

      <Disclaimer />

      <section>
        <h2>{home("aboutOfficialHeading")}</h2>
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

      <section>
        <h2>{home("aboutCreditsHeading")}</h2>
        <p>{home("aboutCreditsBody")}</p>
        <h3 className="label">{home("aboutDataHeading")}</h3>
        <CreditTable
          translate={home}
          rows={dataCredits}
          resource={home("columnResource")}
          licence={home("columnLicence")}
        />
        <h3 className="label">{home("aboutSoftwareHeading")}</h3>
        <CreditTable
          translate={home}
          rows={softwareCredits}
          resource={home("columnResource")}
          licence={home("columnLicence")}
        />
      </section>
    </main>
  );
}

function creditText(value: string, sources: Record<string, string>, prefix: string, translate: (key: string) => string): string {
  const match = Object.entries(sources).find(([, source]) => source === value);
  return match ? translate(`${prefix}.${match[0]}`) : value;
}
