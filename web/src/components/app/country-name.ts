"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { loadCountryIndex } from "@/lib/data/api";
import { localizedCountryName } from "./country-codes";

/**
 * The name of a country in the reader's language.
 *
 * The browser already knows every country's name in both languages, so it is
 * asked first and nothing is translated by hand. A code it has no name for
 * falls back to the English name in the data set's country index, which is a
 * real name rather than a three letter code.
 */
export function useCountryName(iso3: string | null): string {
  const locale = useLocale();
  const fromBrowser =
    iso3 === null ? null : localizedCountryName(iso3, locale);
  const [fallback, setFallback] = useState<string | null>(null);

  useEffect(() => {
    if (iso3 === null || fromBrowser !== null) {
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
  }, [iso3, fromBrowser]);

  if (iso3 === null) return "";
  return fromBrowser ?? fallback ?? iso3;
}
