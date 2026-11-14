"use client";

import { useTranslations } from "next-intl";
import { GLOSSARY_TERMS } from "./lib/constants";
import styles from "./report.module.css";

/** Every term the report uses, explained in one line each. */
export default function Glossary() {
  const t = useTranslations("report");

  return (
    <section className={styles.section} aria-labelledby="report-glossary">
      <h2 className={styles.heading} id="report-glossary">
        {t("glossary.heading")}
      </h2>
      <dl className={styles.glossary}>
        {GLOSSARY_TERMS.map((term) => (
          <div key={term} className={styles.glossaryRow}>
            <dt className={styles.glossaryTerm} title={t(`glossary.${term}.text`)}>
              {t(`glossary.${term}.term`)}
            </dt>
            <dd className={styles.glossaryText}>{t(`glossary.${term}.text`)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
