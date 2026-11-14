"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { defaultLook, isLook, type Look, lookParam, lookStorageKey, looks } from "@/lib/ui/look";
import { setQueryParam } from "@/lib/ui/query";

const titleKey: Record<Look, string> = {
  ember: "lookEmber",
  field: "lookField",
  ops: "lookOps",
};

/**
 * Switches between the three looks and remembers the choice. The look also
 * travels in the address bar under `?d=`, so a link shows what the sender saw.
 */
export default function LookSwitch() {
  const t = useTranslations("shell");
  const [look, setLook] = useState<Look>(defaultLook);

  useEffect(() => {
    const applied = document.documentElement.getAttribute("data-look");
    if (isLook(applied)) setLook(applied);
  }, []);

  const choose = (next: Look) => {
    setLook(next);
    document.documentElement.setAttribute("data-look", next);
    try {
      window.localStorage.setItem(lookStorageKey, next);
    } catch {
      // A browser that refuses storage still switches for this visit.
    }
    const search = setQueryParam(window.location.search, lookParam, next);
    window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
  };

  return (
    <section>
      <h2>{t("lookLabel")}</h2>
      <div className="row">
        {looks.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="chip"
            aria-pressed={candidate === look}
            onClick={() => choose(candidate)}
          >
            {t(titleKey[candidate])}
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>
        {t("lookNote")}
      </p>
    </section>
  );
}
