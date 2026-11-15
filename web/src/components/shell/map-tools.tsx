"use client";

import { useTranslations } from "next-intl";
import { radiusRange } from "@/lib/ui/selection-url";

type Props = {
  drawing: boolean;
  radiusOn: boolean;
  radiusKm: number;
  layersOpen: boolean;
  onDraw: () => void;
  onRadius: () => void;
  onRadiusKm: (km: number) => void;
  onLayers: () => void;
  /** False where the layer dock is always open, so no button is needed. */
  showLayers?: boolean;
};

const zoom = (step: number) => window.dispatchEvent(new CustomEvent("emerge-zoom", { detail: step }));

/** One column of same-sized tools in the map's lower left corner, like a drawing program's. */
export default function MapTools({
  drawing,
  radiusOn,
  radiusKm,
  layersOpen,
  onDraw,
  onRadius,
  onRadiusKm,
  onLayers,
  showLayers = true,
}: Props) {
  const t = useTranslations("shell");
  const s = useTranslations("selection");

  return (
    <div className="tools" role="toolbar" aria-label={t("toolsLabel")} aria-orientation="vertical">
      <div className="tool-group glass">
        <button type="button" className="tool" aria-pressed={drawing} title={drawing ? t("toolDrawStop") : t("toolDraw")} aria-label={drawing ? t("toolDrawStop") : t("toolDraw")} onClick={onDraw}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 15.5 6.5 5l8 2.5-2 8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <circle cx="4" cy="15.5" r="1.6" fill="currentColor" />
            <circle cx="6.5" cy="5" r="1.6" fill="currentColor" />
            <circle cx="14.5" cy="7.5" r="1.6" fill="currentColor" />
            <circle cx="12.5" cy="15.5" r="1.6" fill="currentColor" />
          </svg>
        </button>
        <button type="button" className="tool" aria-pressed={radiusOn} title={radiusOn ? t("toolRadiusOff") : t("toolRadius")} aria-label={radiusOn ? t("toolRadiusOff") : t("toolRadius")} onClick={onRadius}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2" />
            <circle cx="10" cy="10" r="1.7" fill="currentColor" />
            <path d="M10 10h6.8" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
      </div>

      {showLayers ? <div className="tool-group glass">
        <button type="button" className="tool" aria-pressed={layersOpen} title={t("layersTool")} aria-label={t("layersTool")} onClick={onLayers}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m10 3.5 7 3.6-7 3.6-7-3.6z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="m3 10.4 7 3.6 7-3.6M3 13.6l7 3.6 7-3.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
      </div> : null}

      <div className="tool-group glass">
        <button type="button" className="tool" title={t("zoomIn")} aria-label={t("zoomIn")} onClick={() => zoom(1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="tool" title={t("zoomOut")} aria-label={t("zoomOut")} onClick={() => zoom(-1)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4.5 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {drawing ? (
        <p className="tool-tip glass" role="status">
          {t("toolDrawHint")}
        </p>
      ) : radiusOn ? (
        <div className="tool-tip glass">
          <label className="label" htmlFor="tool-radius">
            {s("radiusLabel")}
          </label>
          <div className="tool-radius">
            <input
              id="tool-radius"
              type="range"
              min={radiusRange[0]}
              max={radiusRange[1]}
              step={5}
              value={radiusKm}
              onChange={(event) => onRadiusKm(Number(event.target.value))}
            />
            <output className="num" htmlFor="tool-radius">
              {radiusKm} {s("radiusUnit")}
            </output>
          </div>
          <p className="hint">{t("toolRadiusHint")}</p>
        </div>
      ) : null}
    </div>
  );
}
