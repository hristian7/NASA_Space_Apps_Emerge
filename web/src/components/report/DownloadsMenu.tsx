"use client";

import { useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { downloadSvgAsPng, pngFilename, type PngLegendItem } from "@/lib/export/png";
import type { UnitMode } from "./types";
import styles from "./styles";

export interface DownloadsMenuProps {
  /** The three CSV files are built by the caller. */
  onHotspotsCsv: () => void;
  onMonthlyCsv: () => void;
  onSummaryCsv: () => void;
  calendarRef: RefObject<SVGSVGElement | null>;
  chartRef: RefObject<SVGSVGElement | null>;
  /** Drawn into both images, as M11 asks. */
  place: string;
  dates: string;
  /** True while a CSV is being fetched, so the buttons can say so. */
  busy?: boolean;
  /** The hotspots file is a plain address, so it can be opened in a new tab. */
  hotspotsHref?: string;
  hotspotsLabel?: string;
  /** Which colour steps the exported calendar legend has to carry. */
  legendMode?: UnitMode;
}

export default function DownloadsMenu({
  onHotspotsCsv,
  onMonthlyCsv,
  onSummaryCsv,
  calendarRef,
  chartRef,
  place,
  dates,
  busy = false,
  hotspotsHref,
  hotspotsLabel,
  legendMode = "cd",
}: DownloadsMenuProps) {
  const t = useTranslations("report");
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * The calendar's legend lives in HTML beside the picture, so it would be
   * missing from the PNG. It is handed to the exporter as data instead, with
   * the colours read off the live element so the look travels with it.
   */
  function calendarLegend(svg: SVGSVGElement): PngLegendItem[] {
    const style = window.getComputedStyle(svg);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const steps =
      legendMode === "anomaly"
        ? ["--anom-0", "--anom-1", "--anom-2", "--anom-3", "--anom-4", "--anom-5"]
        : ["--ramp-0", "--ramp-1", "--ramp-2", "--ramp-3"];
    const items: PngLegendItem[] = [
      {
        kind: "text",
        text: legendMode === "anomaly" ? t("legend.below") : t("legend.less"),
      },
      ...steps.map((name) => ({ kind: "swatch" as const, colour: token(name) })),
      {
        kind: "text",
        text: legendMode === "anomaly" ? t("legend.above") : t("legend.more"),
      },
      { kind: "key", colour: token("--empty"), text: t("legend.zero") },
      { kind: "key", colour: null, text: t("legend.noData") },
      {
        kind: "key",
        colour: token("--empty"),
        pattern: "stripes",
        text: t("legend.estimated"),
      },
    ];
    return items;
  }

  async function savePng(
    target: RefObject<SVGSVGElement | null>,
    titleKey: "downloads.calendarPng" | "downloads.chartPng",
    stem: string,
  ) {
    const svg = target.current;
    if (svg === null) {
      setProblem(t("downloads.pngMissing"));
      return;
    }
    setProblem(null);
    try {
      await downloadSvgAsPng(svg, pngFilename(["emerge", stem, place]), {
        caption: { title: t(titleKey), place, dates },
        legend: stem === "calendar" ? calendarLegend(svg) : undefined,
      });
    } catch {
      setProblem(t("downloads.pngFailed"));
    }
  }

  return (
    <section className={styles.section} aria-labelledby="report-downloads">
      <h2 className={styles.heading} id="report-downloads">
        {t("downloads.heading")}
      </h2>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onMonthlyCsv}
          disabled={busy}
        >
          {t("downloads.monthlyCsv")}
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={onSummaryCsv}
          disabled={busy}
        >
          {t("downloads.summaryCsv")}
        </button>
        {hotspotsHref === undefined ? (
          <button
            type="button"
            className={styles.btn}
            onClick={onHotspotsCsv}
            disabled={busy}
          >
            {t("downloads.hotspotsCsv")}
          </button>
        ) : (
          <a
            className={styles.btn}
            href={hotspotsHref}
            target="_blank"
            rel="noreferrer"
            download
          >
            {hotspotsLabel ?? t("downloads.hotspotsCsv")}
          </a>
        )}
        <button
          type="button"
          className={styles.btn}
          onClick={() => savePng(calendarRef, "downloads.calendarPng", "calendar")}
        >
          {t("downloads.calendarPng")}
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => savePng(chartRef, "downloads.chartPng", "trend")}
        >
          {t("downloads.chartPng")}
        </button>
      </div>
      <p className={styles.sub}>{t("downloads.note")}</p>
      {problem === null ? null : (
        <p className={styles.cardLine} role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
