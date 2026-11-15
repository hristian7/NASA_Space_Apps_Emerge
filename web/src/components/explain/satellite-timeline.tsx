import { getTranslations } from "next-intl/server";
import "./satellite-timeline.css";

const START = 2000;
const END = 2027;
const at = (year: number) => `${((year - START) / (END - START)) * 100}%`;

/**
 * Start months follow `src_periods` in web/public/data/meta.json and
 * docs/firms-data.md; S-NPP stopped producing new fire data about 2 Nov 2026.
 */
export const satelliteLanes = [
  { id: "terra", from: 2000 + 10 / 12, to: END, family: "modis" },
  { id: "aqua", from: 2002 + 6 / 12, to: END, family: "modis" },
  { id: "snpp", from: 2012, to: 2026 + 10 / 12, family: "viirs" },
  { id: "noaa20", from: 2018, to: END, family: "viirs" },
  { id: "noaa21", from: 2026 + 10 / 12 - 7 / 365, to: END, family: "recent" },
] as const;

export default async function SatelliteTimeline() {
  const t = await getTranslations("how");
  return (
    <div className="st-timeline">
      {satelliteLanes.map((lane) => (
        <div key={lane.id} className="st-lane">
          <div className="st-lane-label">
            <strong>{t(`sources.${lane.id}`)}</strong>
            <span>{t(`sources.${lane.id}Note`)}</span>
          </div>
          <div className="st-track">
            <span
              className="st-span"
              data-family={lane.family}
              style={{ left: at(lane.from), width: `calc(${at(lane.to)} - ${at(lane.from)})` }}
            />
          </div>
        </div>
      ))}
      <div className="st-axis" aria-hidden="true">
        {[2000, 2005, 2010, 2015, 2020, 2025].map((year) => (
          <span key={year} style={{ left: at(year) }}>
            {year}
          </span>
        ))}
      </div>
    </div>
  );
}
