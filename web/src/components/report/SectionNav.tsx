"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export const reportParts = ["overview", "charts", "data", "sources"] as const;
export type ReportPart = (typeof reportParts)[number];

export const partId = (part: ReportPart) => `rp-part-${part}`;

/**
 * Mini tabs over the report. Every part stays on the page (so links, tests
 * and screen readers find everything); a tab scrolls its part into view and
 * the tab of the part in view is marked.
 */
export default function SectionNav() {
  const t = useTranslations("report");
  const [current, setCurrent] = useState<ReportPart>("overview");

  useEffect(() => {
    const nodes = reportParts
      .map((part) => document.getElementById(partId(part)))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCurrent(visible.target.id.replace("rp-part-", "") as ReportPart);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="rp-jump" aria-label={t("parts.label")}>
      {reportParts.map((part) => (
        <button
          key={part}
          type="button"
          aria-current={part === current ? "true" : undefined}
          onClick={() => {
            setCurrent(part);
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            document.getElementById(partId(part))?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
          }}
        >
          {t(`parts.${part}`)}
        </button>
      ))}
    </nav>
  );
}
