"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { getValidation } from "@/lib/data/api";
import reportStyles from "@/components/report/styles";
import { formatRatio, type ReportLocale } from "@/components/report/lib/format";

/**
 * How well this one country's conversion came out of the test, read from
 * validation.json by its code. Nothing is computed here: the figures are the
 * file's own, and the reading in words is a plain threshold on the typical
 * error, stated in the sentence the card prints.
 */
interface CountryScore {
  n: number | null;
  nrmse: number | null;
  bias_pct: number | null;
  coverage_pct: number | null;
  scorable: boolean;
}

type ValidationWithCountries = {
  countries?: Record<string, Record<string, CountryScore>>;
};

/** Under this typical error a country's months track the reference closely. */
const GOOD = 0.4;
/** Above this the country's own figures are a rough guide only. */
const FAIR = 0.8;

export default function CountryTest({
  iso3,
  locale,
}: {
  iso3: string;
  locale: ReportLocale;
}) {
  const t = useTranslations("app");
  const [score, setScore] = useState<CountryScore | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setScore(undefined);
    getValidation().then(
      (file) => {
        if (!live) return;
        const held = (file as ValidationWithCountries).countries?.[iso3];
        if (held === undefined) {
          setScore(null);
          return;
        }
        // The first test the file holds a scored row for.
        const best =
          Object.values(held).find((row) => row.nrmse !== null) ?? null;
        setScore(best);
      },
      () => {
        if (live) setScore(null);
      },
    );
    return () => {
      live = false;
    };
  }, [iso3]);

  if (score === undefined) return null;

  const reading =
    score === null || score.nrmse === null
      ? null
      : score.nrmse <= GOOD
        ? t("countryTestGood")
        : score.nrmse <= FAIR
          ? t("countryTestFair")
          : t("countryTestWeak");

  return (
    <section className={reportStyles.card} data-testid="country-test">
      <h2 className={reportStyles.heading}>{t("countryTestHeading")}</h2>
      <p className={reportStyles.cardLine}>
        {score === null || score.nrmse === null || !score.scorable
          ? t("countryTestNone")
          : t("countryTestLine", {
              nrmse: formatRatio(score.nrmse, locale),
              bias: formatRatio(score.bias_pct, locale),
              coverage: formatRatio(score.coverage_pct, locale),
              reading: reading ?? "",
            })}
      </p>
      <p className={reportStyles.sub}>
        <Link href="/proof">{t("countryTestLink")}</Link>
      </p>
    </section>
  );
}
