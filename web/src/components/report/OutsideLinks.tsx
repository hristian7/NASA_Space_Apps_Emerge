"use client";

import { useTranslations } from "next-intl";
import type { Selection } from "@/types/ui";
import { outsideLinks, EFFIS_FIRST_YEAR, type Box } from "./lib/outside-links";
import styles from "./styles";

export interface OutsideLinksProps {
  selection: Selection;
  /** The country the selection is in, when known. */
  countryIso3: string | null;
  /** The selected country's box, for country selections. */
  countryBox: Box | null;
  /** The year the statistics pages open on. */
  year: number;
}

/** Opens the same place in the official services Emerge builds on. */
export default function OutsideLinks({
  selection,
  countryIso3,
  countryBox,
  year,
}: OutsideLinksProps) {
  const t = useTranslations("report");
  const links = outsideLinks({ selection, countryIso3, countryBox, year });

  return (
    <section className={styles.card} aria-labelledby="report-outside">
      <h2 className={styles.heading} id="report-outside">
        {t("outside.heading")}
      </h2>
      <p className={styles.sub}>{t("outside.intro")}</p>
      <ul className={styles.outsideList}>
        {links.map((link) => (
          <li key={link.id}>
            <a
              className={styles.outsideLink}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`outside-${link.id}`}
            >
              {t(`outside.${link.id}`, {
                year,
                from: EFFIS_FIRST_YEAR,
                to: year - 1,
              })}
              <span className={styles.outsideNote}>{t("outside.newTab")}</span>
            </a>
            {link.scope === "country" ? (
              <span className={styles.outsideNote}>{t("outside.wholeCountry")}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
