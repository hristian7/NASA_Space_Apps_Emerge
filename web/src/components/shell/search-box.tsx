"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ISO3_TO_ISO2, localizedCountryName } from "@/components/app/country-codes";
import { useCountries } from "@/lib/ui/use-countries";
import { parseCoordsQuery, searchPlaces, type PlaceHit } from "@/lib/ui/place-search";

type Props = {
  onCountry: (iso3: string) => void;
  onPoint: (lat: number, lon: number) => void;
  /** Moves focus into the field, for when a phone unfolds it. */
  autoFocus?: boolean;
};

const iso2ToIso3 = new Map(Object.entries(ISO3_TO_ISO2).map(([three, two]) => [two, three]));
const pauseMs = 350;

/** One field for a country, a city or any named place, or a latitude and longitude. */
export default function SearchBox({ onCountry, onPoint, autoFocus = false }: Props) {
  const t = useTranslations("search");
  const locale = useLocale();
  const listId = useId();
  const { entries, iso3 } = useCountries();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const box = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  const known = useMemo(() => new Set(iso3), [iso3]);
  const englishName = useMemo(() => new Map(entries.map((entry) => [entry.iso3, entry.name])), [entries]);
  const nameOf = (code: string) => localizedCountryName(code, locale) ?? englishName.get(code) ?? code;

  const needle = query.trim().toLowerCase();
  const coords = parseCoordsQuery(query);
  const countries: PlaceHit[] =
    needle.length < 2 || coords !== null
      ? []
      : iso3
          .filter((code) => {
            const name = nameOf(code).toLowerCase();
            return (
              code.toLowerCase() === needle ||
              name.startsWith(needle) ||
              name.includes(` ${needle}`) ||
              (englishName.get(code) ?? "").toLowerCase().startsWith(needle)
            );
          })
          .slice(0, 4)
          .map((code) => ({ kind: "country" as const, iso3: code, name: nameOf(code) }));

  useEffect(() => {
    if (needle.length < 3 || coords !== null) {
      setPlaces([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(() => {
      searchPlaces(query.trim(), locale, controller.signal)
        .then((hits) => {
          setPlaces(hits.filter((hit) => !(hit.kind === "place" && hit.isCountry)).slice(0, 5));
          setStatus("idle");
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name === "AbortError") return;
          setPlaces([]);
          setStatus("failed");
        });
    }, pauseMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `coords` is derived from `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle, query, locale]);

  const hits: PlaceHit[] = [
    ...(coords !== null ? [{ kind: "coords" as const, ...coords }] : []),
    ...countries,
    ...places,
  ];

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  const choose = (hit: PlaceHit) => {
    if (hit.kind === "coords") {
      onPoint(hit.lat, hit.lon);
      setQuery(`${hit.lat}, ${hit.lon}`);
    } else if (hit.kind === "country") {
      onCountry(hit.iso3);
      setQuery(hit.name);
    } else {
      const three = hit.countryIso2 ? iso2ToIso3.get(hit.countryIso2) : undefined;
      if (hit.isCountry && three && known.has(three)) onCountry(three);
      else onPoint(Number(hit.lat.toFixed(4)), Number(hit.lon.toFixed(4)));
      setQuery(hit.name);
    }
    setOpen(false);
  };

  const label = (hit: PlaceHit) =>
    hit.kind === "coords"
      ? t("coords", { lat: hit.lat, lon: hit.lon })
      : hit.kind === "country"
        ? hit.name
        : hit.name;

  const detail = (hit: PlaceHit) =>
    hit.kind === "coords" ? t("kindPoint") : hit.kind === "country" ? t("kindCountry") : hit.detail;

  const showList = open && needle.length > 0;

  return (
    <div className="search glass" ref={box}>
      <svg className="search-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={field}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        aria-label={t("label")}
        placeholder={t("placeholder")}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(hits.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter") {
            const hit = hits[active];
            if (hit) {
              event.preventDefault();
              choose(hit);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul className="search-list glass" id={listId} role="listbox" aria-label={t("results")}>
          {hits.map((hit, index) => (
            <li
              key={`${hit.kind}-${index}-${label(hit)}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerEnter={() => setActive(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                choose(hit);
              }}
            >
              <span className="search-name">{label(hit)}</span>
              <span className="search-detail">{detail(hit)}</span>
            </li>
          ))}
          {hits.length === 0 ? (
            <li className="search-state" role="presentation">
              {status === "loading" ? t("searching") : status === "failed" ? t("failed") : needle.length < 3 ? t("keepTyping") : t("none")}
            </li>
          ) : status === "loading" ? (
            <li className="search-state" role="presentation">
              {t("searching")}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
