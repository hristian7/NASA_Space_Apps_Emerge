"use client";

import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import Disclaimer from "./disclaimer";
import ReportSlot from "./report-slot";

type Props = {
  selection: Selection | null;
  onCycleHeight: () => void;
};

/** A side panel on wide screens, a bottom sheet on phones. */
export default function ReportPanel({ selection, onCycleHeight }: Props) {
  const t = useTranslations("shell");

  return (
    <aside className="report glass" id="report" aria-label={t("reportTitle")}>
      <button type="button" className="handle" aria-label={t("sheetHandle")} onClick={onCycleHeight} />
      <div className="report-scroll">
        <h1>{t("reportTitle")}</h1>
        <div aria-live="polite" className="stack">
          <ReportSlot selection={selection} />
        </div>
      </div>
      <Disclaimer />
    </aside>
  );
}
