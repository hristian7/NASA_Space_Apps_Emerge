// A stand-in for next-intl's `t` built from the real message files, so the
// sentence builders are tested against the words that ship. The report
// messages use only simple {name} placeholders, which is all this replaces.

import type { Translate } from "../../src/components/report/types";
import reportBg from "../../messages/report.bg.json";
import reportEn from "../../messages/report.en.json";

const BUNDLES = {
  en: reportEn.report as unknown as Record<string, unknown>,
  bg: reportBg.report as unknown as Record<string, unknown>,
};

export type TestLocale = keyof typeof BUNDLES;

export function translateFor(locale: TestLocale): Translate {
  const bundle = BUNDLES[locale];
  return (key, values) => {
    const text = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node === undefined || node === null
            ? undefined
            : (node as Record<string, unknown>)[part],
        bundle,
      );
    if (typeof text !== "string") {
      throw new Error(`No ${locale} message for ${key}`);
    }
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = values?.[name];
      return value === undefined ? whole : String(value);
    });
  };
}
