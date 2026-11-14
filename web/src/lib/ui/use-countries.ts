"use client";

import { useEffect, useState } from "react";
import { loadCountryIndex } from "@/lib/data/api";
import type { CountryIndexEntry } from "@/types/data";

/**
 * The country list comes from the data set's own `countries/index.json`,
 * which also carries each country's box, so the map can frame it. If that
 * file is missing, `meta.json` still names the country files; these two are
 * the demo countries and are used only when neither can be read.
 */
export const exampleCountryIso3 = ["BGR", "USA"];

type Meta = { countries?: unknown };

export type CountryList = {
  /** Full entries when the index was read, empty when it was not. */
  entries: CountryIndexEntry[];
  iso3: string[];
  fromData: boolean;
};

/** One read per visit, shared by the picker and the map. */
let pending: Promise<CountryIndexEntry[]> | null = null;

function readIndex(): Promise<CountryIndexEntry[]> {
  if (pending === null) {
    pending = loadCountryIndex()
      .then((file) => (file === null ? [] : file.countries))
      .catch(() => []);
  }
  return pending;
}

async function readMetaCodes(): Promise<string[]> {
  try {
    const response = await fetch("/data/meta.json", { cache: "force-cache" });
    if (!response.ok) return [];
    const meta = (await response.json()) as Meta;
    return Array.isArray(meta.countries)
      ? meta.countries.filter((code): code is string => typeof code === "string")
      : [];
  } catch {
    return [];
  }
}

export function useCountries(): CountryList {
  const [list, setList] = useState<CountryList>({
    entries: [],
    iso3: exampleCountryIso3,
    fromData: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const entries = await readIndex();
      if (cancelled) return;
      if (entries.length > 0) {
        setList({ entries, iso3: entries.map((entry) => entry.iso3), fromData: true });
        return;
      }
      const codes = await readMetaCodes();
      if (cancelled || codes.length === 0) return;
      setList({ entries: [], iso3: codes, fromData: true });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return list;
}

/** The country boxes alone, for framing the map. Empty until the file lands. */
export function useCountryBoxes(): Map<string, CountryIndexEntry> {
  const [boxes, setBoxes] = useState<Map<string, CountryIndexEntry>>(new Map());

  useEffect(() => {
    let cancelled = false;
    readIndex().then((entries) => {
      if (cancelled || entries.length === 0) return;
      setBoxes(new Map(entries.map((entry) => [entry.iso3, entry])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return boxes;
}
