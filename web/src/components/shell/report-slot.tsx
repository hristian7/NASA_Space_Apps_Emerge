"use client";

import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { cornerCount } from "@/lib/ui/geo";
import ReportView from "@/components/app/report-view";
import reportStyles from "@/components/report/styles";

type Props = { selection: Selection | null };

/**
 * The place the fire report is rendered into: the selection in words, then the
 * report itself. With nothing selected the wording comes from the shell,
 * because there is no record to describe yet.
 */
export default function ReportSlot({ selection }: Props) {
  const t = useTranslations("selection");
  const names = useTranslations("country");

  if (selection === null) {
    return <p className="hint">{t("none")}</p>;
  }

  const degrees = (value: number) => value.toFixed(3);

  let kind = t("kindPoint");
  let what = "";

  if (selection.kind === "country") {
    kind = t("kindCountry");
    try {
      what = names(selection.iso3);
    } catch {
      what = selection.iso3;
    }
  } else if (selection.kind === "point") {
    what =
      selection.radiusKm > 0
        ? t("pointWithin", {
            lat: degrees(selection.lat),
            lon: degrees(selection.lon),
            km: selection.radiusKm,
          })
        : t("pointExact", { lat: degrees(selection.lat), lon: degrees(selection.lon) });
  } else {
    kind = t("kindArea");
    what = t("area", { corners: cornerCount(selection) });
  }

  return (
    <>
      <dl className="summary">
        <dt>{kind}</dt>
        <dd>{what}</dd>
      </dl>
      <div className={reportStyles.report}>
        <ReportView selection={selection} />
      </div>
    </>
  );
}
