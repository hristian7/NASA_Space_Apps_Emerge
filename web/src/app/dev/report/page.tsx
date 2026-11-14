import type { Metadata } from "next";
import Gallery, { type Look } from "./gallery";
import reportEn from "../../../../messages/report.en.json";
import reportBg from "../../../../messages/report.bg.json";

export const metadata: Metadata = {
  title: "Report components",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LOOKS: Look[] = ["ember", "field", "ops"];

function pick<T extends string>(
  value: string | string[] | undefined,
  allowed: T[],
  fallback: T,
): T {
  const first = Array.isArray(value) ? value[0] : value;
  return allowed.includes(first as T) ? (first as T) : fallback;
}

/**
 * Dev only. Shows every report component with realistic props. The shell's
 * message loader is not wired yet, so this page carries the report messages
 * itself.
 */
export default async function ReportDevPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const look = pick(query.d, LOOKS, "ember");
  const locale = pick(query.lang, ["en", "bg"], "en");
  const messages = locale === "bg" ? reportBg : reportEn;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Public+Sans:wght@400;500;600&display=swap"
      />
      <Gallery look={look} locale={locale} messages={messages} />
    </>
  );
}
