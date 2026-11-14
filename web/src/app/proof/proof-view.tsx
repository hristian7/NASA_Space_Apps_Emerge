"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ValidationFile } from "@/types/data";
import { getValidation } from "@/lib/data/api";
import ProofTables from "./tables";
import RiskScorecardSection from "./risk-scorecard";

/**
 * Reads the committed validation file and hands it to the tables. The file is
 * read through the data layer's own loader, so this page and the rest of the
 * app see the same bytes.
 */
export default function ProofView() {
  const t = useTranslations("proof");
  const app = useTranslations("app");
  const [validation, setValidation] = useState<ValidationFile | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getValidation().then(
      (file) => {
        if (live) setValidation(file);
      },
      (error: unknown) => {
        if (live) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (failure !== null) {
    return (
      <p role="alert" data-testid="proof-failed">
        {app("failedDetail", { reason: failure })}
      </p>
    );
  }

  if (validation === null) {
    return <p data-testid="proof-loading">{app("loading")}</p>;
  }

  return (
    <>
      {validation.example ? (
        <p className="box" role="status" data-testid="proof-example">
          {t("exampleBanner")}
        </p>
      ) : null}
      <p>{t("builtOn", { date: validation.built })}</p>
      <RiskScorecardSection />
      <ProofTables validation={validation} t={t} />
    </>
  );
}
