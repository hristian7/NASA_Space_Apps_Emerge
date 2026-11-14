"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { parseLatLon } from "@/lib/ui/latlon";
import { radiusRange } from "@/lib/ui/selection-url";
import { useCountries } from "@/lib/ui/use-countries";

type Props = {
  selection: Selection | null;
  radiusKm: number;
  drawing: boolean;
  onRadiusChange: (km: number) => void;
  onPoint: (lat: number, lon: number) => void;
  onCountry: (iso3: string) => void;
  onDrawToggle: () => void;
  onClear: () => void;
};

export default function SelectionTools({
  selection,
  radiusKm,
  drawing,
  onRadiusChange,
  onPoint,
  onCountry,
  onDrawToggle,
  onClear,
}: Props) {
  const t = useTranslations("selection");
  const names = useTranslations("country");
  const { entries, iso3, fromData } = useCountries();

  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // The index carries an English name per country; a translated one wins
  // where the message files have it.
  const indexName = new Map(entries.map((entry) => [entry.iso3, entry.name]));

  const countryName = (code: string) => {
    try {
      return names(code);
    } catch {
      return indexName.get(code) ?? code;
    }
  };

  const matches = iso3.filter((code) => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return true;
    return (
      code.toLowerCase().startsWith(needle) ||
      countryName(code).toLowerCase().includes(needle) ||
      (indexName.get(code) ?? "").toLowerCase().includes(needle)
    );
  });

  const submitCoords = (event: React.FormEvent) => {
    event.preventDefault();
    const result = parseLatLon(lat, lon);
    if (!result.ok) {
      const keys = { empty: "errorEmpty", number: "errorNumber", lat: "errorLat", lon: "errorLon" };
      setError(t(keys[result.error]));
      return;
    }
    setError(null);
    onPoint(result.lat, result.lon);
  };

  return (
    <>
      <section>
        <h2>{t("heading")}</h2>
        <p className="hint">{t("tapHint")}</p>
      </section>

      <section>
        <label className="label" htmlFor="radius">
          {t("radiusLabel")}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            id="radius"
            type="range"
            min={radiusRange[0]}
            max={radiusRange[1]}
            step={5}
            value={radiusKm}
            onChange={(event) => onRadiusChange(Number(event.target.value))}
            style={{ flex: 1, minWidth: 0, accentColor: "var(--accent)" }}
          />
          <output className="num" htmlFor="radius" style={{ minWidth: 62, textAlign: "right" }}>
            {radiusKm} {t("radiusUnit")}
          </output>
        </div>
        <p className="hint">{t("radiusHint")}</p>
      </section>

      <section>
        <form onSubmit={submitCoords} className="stack" noValidate>
          <h2>{t("coordsHeading")}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <label className="label" htmlFor="lat">
                {t("latLabel")}
              </label>
              <input
                id="lat"
                className="field num"
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("latPlaceholder")}
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                aria-invalid={error !== null}
                aria-describedby="coords-message"
              />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <label className="label" htmlFor="lon">
                {t("lonLabel")}
              </label>
              <input
                id="lon"
                className="field num"
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("lonPlaceholder")}
                value={lon}
                onChange={(event) => setLon(event.target.value)}
                aria-invalid={error !== null}
                aria-describedby="coords-message"
              />
            </span>
          </div>
          <p id="coords-message" className={error === null ? "hint" : "error"} role="status">
            {error ?? t("coordsHint")}
          </p>
          <button type="submit" className="btn">
            {t("coordsApply")}
          </button>
        </form>
      </section>

      <section>
        <h2>{t("drawHeading")}</h2>
        <button type="button" className="btn" aria-pressed={drawing} onClick={onDrawToggle}>
          {drawing ? t("drawStop") : t("drawStart")}
        </button>
        {drawing ? <p className="hint">{t("drawHint")}</p> : null}
      </section>

      <section>
        <label className="label" htmlFor="country">
          {t("countryHeading")}
        </label>
        <input
          id="country"
          className="field"
          type="search"
          autoComplete="off"
          placeholder={t("countryPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          {matches.map((code) => (
            <button
              key={code}
              type="button"
              className="chip"
              aria-pressed={selection?.kind === "country" && selection.iso3 === code}
              onClick={() => onCountry(code)}
            >
              {countryName(code)}
            </button>
          ))}
        </div>
        {matches.length === 0 ? <p className="hint">{t("countryNoMatch")}</p> : null}
        {!fromData ? <p className="hint">{t("countryFallbackNote")}</p> : null}
      </section>

      {selection !== null ? (
        <button type="button" className="btn" onClick={onClear}>
          {t("clear")}
        </button>
      ) : null}
    </>
  );
}
