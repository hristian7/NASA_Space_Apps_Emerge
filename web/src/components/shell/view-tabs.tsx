"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export type AppView = "history" | "forecast";

const paths: Record<AppView, string> = { history: "/", forecast: "/risk" };

/**
 * Switches between the past (the fire history map) and the next days (the
 * risk outlook). The address bar travels with the switch, so the look, the
 * chosen place and the example-data switch survive the round trip; each page
 * ignores the parts it does not read. The query is read at click time because
 * the shell rewrites it with replaceState, which React never hears about.
 */
export default function ViewTabs({ current }: { current: AppView }) {
  const t = useTranslations("shell");
  const router = useRouter();

  return (
    <nav className="chip-group glass view-tabs" aria-label={t("viewTabs")}>
      {(["history", "forecast"] as const).map((view) => (
        <Link
          key={view}
          className="chip"
          href={paths[view]}
          aria-current={view === current ? "page" : undefined}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (view === current) return;
            router.push(`${paths[view]}${window.location.search}`);
          }}
        >
          {t(view === "history" ? "historyTab" : "forecastTab")}
        </Link>
      ))}
    </nav>
  );
}
