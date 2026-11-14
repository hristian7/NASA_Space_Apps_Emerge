"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./report.module.css";

import { GLOSSARY_TERMS, type GlossaryTermId } from "./lib/constants";

export { GLOSSARY_TERMS };
export type { GlossaryTermId };

export interface TermTipProps {
  term: GlossaryTermId;
  /** The words to underline. The term's own name when left out. */
  children?: React.ReactNode;
}

/** An inline word with its one-line explanation on hover or on focus. */
export default function TermTip({ term, children }: TermTipProps) {
  const t = useTranslations("report");
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={styles.termWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.term}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((was) => !was)}
      >
        {children ?? t(`glossary.${term}.term`)}
      </button>
      <span id={id} className={open ? styles.termTip : styles.srOnly}>
        {t(`glossary.${term}.text`)}
      </span>
    </span>
  );
}
