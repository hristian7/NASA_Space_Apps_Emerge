"use client";

import { useTranslations } from "next-intl";
import { officialServices } from "@/lib/ui/credits";

/**
 * Specification section 9: every view that shows risk carries this line and
 * the links to the official services. It is pinned, not scrolled away.
 */
export default function Disclaimer() {
  const t = useTranslations("shell");

  return (
    <div className="disclaim">
      <p>{t("disclaimerShort")}</p>
      <p className="links">
        <span>{t("officialServices")}:</span>
        {officialServices.map((service) => (
          <a key={service.key} href={service.url} target="_blank" rel="noreferrer noopener">
            {t(service.key)}
          </a>
        ))}
      </p>
    </div>
  );
}
