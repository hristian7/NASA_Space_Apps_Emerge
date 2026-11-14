"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { loadCountryIndex } from "@/lib/data/api";

/**
 * The name of a country in the reader's language.
 *
 * The message files carry a translated name only for the countries the team
 * has written out. The data set holds 235, so everything else falls back to
 * the English name in the country index, which is a real name rather than a
 * three letter code. Asking next-intl for a key it does not hold logs an
 * error and prints the key, so the message file is only read when it has one.
 */
export function useCountryName(iso3: string | null): string {
  const names = useTranslations("country");
  const [fallback, setFallback] = useState<string | null>(null);

  useEffect(() => {
    if (iso3 === null || names.has(iso3)) {
      setFallback(null);
      return;
    }
    let live = true;
    loadCountryIndex().then(
      (index) => {
        if (!live) return;
        const entry = index?.countries.find((row) => row.iso3 === iso3);
        setFallback(entry?.name ?? null);
      },
      () => {
        // The code itself is shown until the index can be read.
      },
    );
    return () => {
      live = false;
    };
  }, [iso3, names]);

  if (iso3 === null) return "";
  if (names.has(iso3)) return names(iso3);
  return fallback ?? iso3;
}
