"use client";

import { useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { downloadSvgAsPng, pngFilename } from "@/lib/export/png";
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
}: DownloadsMenuProps) {
  const t = useTranslations("report");
  const [problem, setProblem] = useState<string | null>(null);

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
        <button
          type="button"
          className={styles.btn}
          onClick={onHotspotsCsv}
          disabled={busy}
        >
          {t("downloads.hotspotsCsv")}
        </button>
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
