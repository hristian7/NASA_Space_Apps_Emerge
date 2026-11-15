"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Series } from "@/types/ui";
import { downloadSvgAsPng, pngFilename } from "@/lib/export/png";
import { cumulativeSeason } from "./lib/aggregate";
import { formatCount, monthShort, type ReportLocale } from "./lib/format";
import styles from "./styles";
import { useChartDraw } from "@/lib/ui/motion";

export default function CumulativeChart({ series, year, lastDataDay, locale, place }: { series: Series; year: number; lastDataDay: string; locale: ReportLocale; place: string }) {
  const t = useTranslations("report");
  const ref = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);
  const points = cumulativeSeason(series, year, lastDataDay);
  const top = Math.max(1, ...points.flatMap((p) => [p.current ?? 0, p.median ?? 0]));
  const x = (month: number) => 34 + (month - 1) / 11 * 346;
  const y = (value: number) => 8 + (1 - value / top) * 110;
  const unit = t(`unit.${series.unit}.short`);
  const summary = t("cumulative.summary", { year, unit });
  useChartDraw(ref, `${year}:${points.map((p) => `${p.current}/${p.median}`).join(",")}`);
  async function save() {
    if (!ref.current) return;
    try {
      await downloadSvgAsPng(ref.current, pngFilename(["emerge", "season", String(year)]), { caption: { title: summary, place, dates: String(year) }, legend: [{ kind: "text", text: t("cumulative.exportKey", { year }) }] });
      setFailed(false);
    } catch { setFailed(true); }
  }
  return <section className={styles.section} aria-labelledby="report-cumulative" data-testid="cumulative-chart">
    <h2 className={styles.heading} id="report-cumulative">{t("cumulative.heading")}</h2>
    <p className={styles.sub}>{summary}</p>
    <svg ref={ref} className={styles.chart} viewBox="0 0 386 136" role="img" aria-label={summary}>
      <title>{summary}</title>
      <line className={styles.axis} x1="34" y1="118" x2="380" y2="118" />
      <line className={styles.axis} x1="34" y1="8" x2="34" y2="118" />
      <text x="30" y="12" textAnchor="end">{formatCount(top, locale)}</text>
      <text x="30" y="118" textAnchor="end">0</text>
      {points.map((point, i) => <g key={point.month}>
        {(["median", "current"] as const).map((key) => {
          const value = point[key];
          const previous = points[i - 1]?.[key];
          if (value === null) return null;
          return <g key={key}>
            {previous != null && <line className={key === "current" ? styles.line : styles.lineEstimated} x1={x(point.month - 1)} y1={y(previous)} x2={x(point.month)} y2={y(value)} />}
            <circle className={key === "current" ? styles.dot : styles.estimatedMark} cx={x(point.month)} cy={y(value)} r="2"><title>{`${monthShort(point.month, locale)}: ${formatCount(value, locale)} ${unit}`}</title></circle>
          </g>;
        })}
      </g>)}
      {[1, 4, 7, 10, 12].map((month) => <text key={month} x={x(month)} y="130" textAnchor={month === 1 ? "start" : month === 12 ? "end" : "middle"}>{monthShort(month, locale)}</text>)}
    </svg>
    <p className={styles.sub}>{t("cumulative.key", { year })}</p>
    <button type="button" className={styles.btn} onClick={save}>{t("cumulative.download")}</button>
    {failed && <p role="alert">{t("downloads.pngFailed")}</p>}
  </section>;
}
