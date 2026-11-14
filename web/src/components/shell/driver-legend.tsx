"use client";

import { useLocale, useTranslations } from "next-intl";

/*
 * Keys for the driver layers, drawn in the app's own style instead of the
 * providers' legend pictures. The colours are read from those pictures (GIBS
 * legend files for soil moisture, NDVI, land cover and AIRS temperature; the
 * GWIS legend for the NASA fire-weather index), so a colour here must match
 * the colour on the map tile. Change one only together with the tile source.
 */

type Ramp = {
  stops: string[];
  /** Tick values, placed at their share of the bar. */
  ticks: { at: number; value: number; edge?: "below" | "above" }[];
  unitKey: string;
  digits: number;
};

const ramps: Record<string, Ramp> = {
  "soil-moisture": {
    stops: ["#ffa500", "#ffd700", "#f9fc00", "#7dbe00", "#008206", "#00c489", "#00fdff", "#0082ff", "#0006ff", "#0000b3", "#000068", "#28285a", "#505050"],
    ticks: [
      { at: 0, value: 0 },
      { at: 0.5, value: 0.3 },
      { at: 1, value: 0.6, edge: "above" },
    ],
    unitKey: "unitSoil",
    digits: 1,
  },
  greenness: {
    stops: ["#f1ecec", "#ddd5cb", "#d7c4b4", "#b4a596", "#ac8d74", "#965a46", "#96ba20", "#64a600", "#4e9401", "#2e8001", "#0a6901", "#005400", "#001801"],
    ticks: [
      { at: 0, value: 0 },
      { at: 0.5, value: 0.5 },
      { at: 1, value: 1 },
    ],
    unitKey: "unitNdvi",
    digits: 1,
  },
  "air-temperature": {
    // The provider's scale runs from 200 K to 340 K; ticks are in °C.
    stops: ["#9172a0", "#554f89", "#254585", "#19669d", "#309eb8", "#6cdcc8", "#cefabe", "#fbe172", "#f89330", "#cb441b", "#8c0c17", "#6a082b", "#de2b78"],
    ticks: [
      { at: 0, value: -73, edge: "below" },
      { at: (273.15 - 200) / 140, value: 0 },
      { at: 1, value: 67, edge: "above" },
    ],
    unitKey: "unitCelsius",
    digits: 0,
  },
};

/** NASA fire-weather index bands as numbers only; the provider's class names are its own, not ours. */
const fwiBands: { color: string; from: number | null; to: number | null }[] = [
  { color: "#9cffc0", from: null, to: 11.2 },
  { color: "#cde24e", from: 11.2, to: 21.3 },
  { color: "#e6ac00", from: 21.3, to: 38 },
  { color: "#d97010", from: 38, to: 50 },
  { color: "#ad060e", from: 50, to: 70 },
  { color: "#3a0015", from: 70, to: null },
];

/** IGBP land cover colours, grouped the way the fire model reads fuel. */
const landGroups: { key: string; colors: string[] }[] = [
  { key: "landForest", colors: ["#218a21", "#31cc31", "#98cc31", "#96fa96", "#8dba8d"] },
  { key: "landShrubGrass", colors: ["#ba8d8d", "#f5deb3", "#daeb9d", "#ffd500", "#f0b967"] },
  { key: "landFarmland", colors: ["#faef73", "#999356"] },
  { key: "landOther", colors: ["#4783b5", "#ff0000", "#ffffff", "#bfbfbd", "#86cae3"] },
];

export default function DriverLegend({ id }: { id: string }) {
  const t = useTranslations("legend");
  const locale = useLocale();
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: Math.max(digits, 1),
    }).format(value);

  const ramp = ramps[id];
  if (ramp !== undefined) {
    return (
      <div className="ramp-key">
        <div
          className="ramp-bar"
          aria-hidden="true"
          style={{ background: `linear-gradient(to right, ${ramp.stops.join(", ")})` }}
        />
        <div className="ramp-ticks num">
          {ramp.ticks.map((tick) => (
            <span
              key={tick.at}
              style={{ left: `${tick.at * 100}%` }}
              data-edge={tick.at === 0 ? "start" : tick.at === 1 ? "end" : undefined}
            >
              {tick.edge === "below" ? "≤ " : tick.edge === "above" ? "≥ " : ""}
              {number(tick.value, ramp.digits)}
            </span>
          ))}
        </div>
        <p className="ramp-unit">{t(ramp.unitKey)}</p>
      </div>
    );
  }

  if (id === "nasa-fwi") {
    return (
      <ul className="legend">
        {fwiBands.map((band) => (
          <li key={band.color}>
            <span className="swatch" style={{ background: band.color }} aria-hidden="true" />
            <span className="num">
              {band.from === null
                ? t("below", { value: number(band.to ?? 0, 1) })
                : band.to === null
                  ? t("orMore", { value: number(band.from, 0) })
                  : t("range", { from: number(band.from, 1), to: number(band.to, 1) })}
            </span>
          </li>
        ))}
        <li className="legend-note">{t("fwiNote")}</li>
      </ul>
    );
  }

  if (id === "land-type") {
    return (
      <ul className="legend">
        {landGroups.map((group) => (
          <li key={group.key}>
            <span className="swatch-run" aria-hidden="true">
              {group.colors.map((color) => (
                <span key={color} className="swatch" style={{ background: color }} />
              ))}
            </span>
            <span>{t(group.key)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (id === "wind") {
    return (
      <ul className="legend">
        <li>
          <span className="wind-key" aria-hidden="true">
            ➤
          </span>
          <span>{t("windArrow")}</span>
        </li>
      </ul>
    );
  }

  return null;
}
