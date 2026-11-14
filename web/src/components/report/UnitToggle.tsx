"use client";

import { useTranslations } from "next-intl";
import type { UnitMode } from "./types";
import { DEFAULT_UNIT_MODE, UNIT_MODES } from "./lib/constants";
import styles from "./styles";

export { DEFAULT_UNIT_MODE, UNIT_MODES };

export interface UnitToggleProps {
  value: UnitMode;
  onChange: (mode: UnitMode) => void;
  /** Modes the current selection cannot offer, for example per satellite. */
  disabled?: UnitMode[];
}

export default function UnitToggle({
  value,
  onChange,
  disabled = [],
}: UnitToggleProps) {
  const t = useTranslations("report");

  return (
    <div className={styles.toggle} role="group" aria-label={t("unitToggle")}>
      {UNIT_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={styles.chip}
          aria-pressed={value === mode}
          disabled={disabled.includes(mode)}
          onClick={() => onChange(mode)}
        >
          {t(`unit.${mode}.label`)}
        </button>
      ))}
    </div>
  );
}
