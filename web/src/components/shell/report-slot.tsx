"use client";

import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { cornerCount } from "@/lib/ui/geo";

type Props = { selection: Selection | null };

/**
 * The place the fire report is rendered into. Until that part of the team
 * fills it, it states the selection in words and nothing more: the wording
 * for an empty record belongs with the report, not with the shell.
 */
export default function ReportSlot({ selection }: Props) {
  const t = useTranslations("selection");
  const names = useTranslations("country");
  const shell = useTranslations("shell");

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
      <p className="hint">{shell("reportPlaceholder")}</p>
    </>
  );
}
