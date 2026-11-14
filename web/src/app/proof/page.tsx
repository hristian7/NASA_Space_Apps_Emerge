import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Disclaimer from "@/components/shell/disclaimer";
import ProofView from "./proof-view";

export default async function ProofPage() {
  const home = await getTranslations("home");
  const shell = await getTranslations("shell");
  const proof = await getTranslations("proof");

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
        <h1>{proof("title")}</h1>
      </header>

      <section className="box">
        <p>{proof("lead")}</p>
        <p>{home("proofBody")}</p>
      </section>

      <ProofView />

      <Disclaimer />
    </main>
  );
}
