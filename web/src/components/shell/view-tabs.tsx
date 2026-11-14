"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type AppView = "history" | "forecast";

/** The shell keeps both views on one page; the view travels in the address bar as `v=f`. */
export const viewParam = "v";

/**
 * Switches between the past (fire history) and the next days (forecast).
 * Inside the shell it switches in place; on another page it links back into
 * the shell, carrying the address bar so the place and settings survive.
 */
export default function ViewTabs({
  current,
  onChange,
}: {
  current: AppView;
  onChange?: (view: AppView) => void;
}) {
  const t = useTranslations("shell");

  return (
    <div className="chip-group glass view-tabs" role="group" aria-label={t("viewTabs")}>
      {(["history", "forecast"] as const).map((view) => {
        const label = t(view === "history" ? "historyTab" : "forecastTab");
        if (onChange) {
          return (
            <button
              key={view}
              type="button"
              className="chip"
              aria-pressed={view === current}
              onClick={() => onChange(view)}
            >
              {label}
            </button>
          );
        }
        return (
          <Link
            key={view}
            className="chip"
            href={view === "history" ? "/" : `/?${viewParam}=f`}
            aria-current={view === current ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
