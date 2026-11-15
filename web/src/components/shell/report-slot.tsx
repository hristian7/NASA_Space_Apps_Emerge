"use client";

import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import ReportView, { type MapMonth } from "@/components/app/report-view";
import reportStyles from "@/components/report/styles";

type Props = { selection: Selection | null; mapMonth?: MapMonth; onMapMonth?: (month: MapMonth) => void };

/**
 * The place the fire report is rendered into. The panel's heading names the
 * place, so this holds the report alone.
 */
export default function ReportSlot({ selection, mapMonth = null, onMapMonth }: Props) {
  const t = useTranslations("selection");

  if (selection === null) {
    return <p className="hint">{t("none")}</p>;
  }

  return (
    <div className={reportStyles.report}>
      <ReportView selection={selection} mapMonth={mapMonth} onMapMonth={onMapMonth} />
    </div>
  );
}
