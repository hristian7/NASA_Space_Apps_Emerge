"use client";

import Link from "next/link";
import { useRef } from "react";
import { useSlidingPill } from "@/lib/ui/motion";
import { useTranslations } from "next-intl";

import { viewParam, type AppView } from "@/lib/ui/app-view";

export type { AppView };

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
  const group = useRef<HTMLDivElement | null>(null);
  useSlidingPill(group, '[aria-pressed="true"], [aria-current="page"]', [current]);

  return (
    <div ref={group} className="chip-group glass view-tabs" role="group" aria-label={t("viewTabs")}>
      <span className="pill" aria-hidden="true" />
      {(["forecast", "history"] as const).map((view) => {
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
            href={`/?${viewParam}=${view === "history" ? "h" : "f"}`}
            aria-current={view === current ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
