import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Disclaimer from "@/components/shell/disclaimer";

export default async function ProofPage() {
  const home = await getTranslations("home");
  const shell = await getTranslations("shell");

  return (
    <main className="page">
      <nav className="chip-group">
        <Link className="chip" href="/">
          {home("backToMap")}
        </Link>
        <Link className="chip" href="/about">
          {shell("aboutLink")}
        </Link>
      </nav>

      <header>
        <h1>{home("proofTitle")}</h1>
      </header>

      <section className="box">
        <p>{home("proofLead")}</p>
        <p>{home("proofBody")}</p>
      </section>

      <Disclaimer />
    </main>
  );
}
