"use client";

import { useTranslations } from "next-intl";
import { basemaps } from "@/config/basemaps";
import type { Projection } from "./map-view";
import LookSwitch from "@/components/shell/look-switch";

type Props = {
  basemapId: string;
  projection: Projection;
  onBasemapChange: (id: string) => void;
  onProjectionChange: (projection: Projection) => void;
};

export default function ViewSettings({
  basemapId,
  projection,
  onBasemapChange,
  onProjectionChange,
}: Props) {
  const t = useTranslations("map");

  return (
    <>
      <section>
        <h2>{t("basemapHeading")}</h2>
        <div className="row">
          {basemaps.map((basemap) => (
            <button
              key={basemap.id}
              type="button"
              className="chip"
              aria-pressed={basemap.id === basemapId}
              onClick={() => onBasemapChange(basemap.id)}
            >
              {t(basemap.nameKey)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>{t("viewHeading")}</h2>
        <div className="row">
          <button
            type="button"
            className="chip"
            aria-pressed={projection === "globe"}
            onClick={() => onProjectionChange("globe")}
          >
            {t("globe")}
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={projection === "mercator"}
            onClick={() => onProjectionChange("mercator")}
          >
            {t("flat")}
          </button>
        </div>
      </section>

      <LookSwitch />
    </>
  );
}
