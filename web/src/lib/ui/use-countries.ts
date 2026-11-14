"use client";

import { useEffect, useState } from "react";

/**
 * The country list comes from the data set's own `meta.json`, which lists the
 * country files that exist. These two are the demo countries named in the
 * specification and are used only if that file cannot be read.
 */
export const exampleCountryIso3 = ["BGR", "USA"];

type Meta = { countries?: unknown };

export function useCountries(): { iso3: string[]; fromData: boolean } {
  const [iso3, setIso3] = useState<string[]>(exampleCountryIso3);
  const [fromData, setFromData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/meta.json", { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((meta: Meta | null) => {
        if (cancelled || meta === null) return;
        const list = Array.isArray(meta.countries)
          ? meta.countries.filter((code): code is string => typeof code === "string")
          : [];
        if (list.length > 0) {
          setIso3(list);
          setFromData(true);
        }
      })
      .catch(() => {
        // The fallback list above stays in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { iso3, fromData };
}
