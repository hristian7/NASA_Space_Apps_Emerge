import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import InfoPage from "@/components/explain/info-page";
import ProofView from "./proof-view";

export async function generateMetadata(): Promise<Metadata> {
  const proof = await getTranslations("proof");
  return {
    title: `${proof("title")} · Emerge`,
    description: proof("lead"),
    openGraph: { title: `${proof("title")} · Emerge`, description: proof("lead"), type: "article", siteName: "Emerge" },
  };
}

export default async function ProofPage() {
  const home = await getTranslations("home");
  const proof = await getTranslations("proof");

  return (
    <InfoPage current="proof">
      <header>
        <h1>{proof("title")}</h1>
        <p>{proof("lead")}</p>
      </header>

      <section className="box">
        <p>{home("proofBody")}</p>
      </section>

      <ProofView />
    </InfoPage>
  );
}
