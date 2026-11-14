// Lists the components and the tests share. No React, no styles, so a test
// can read them without a browser environment.

import type { UnitMode } from "../types";

/**
 * Fire days first, because the hotspot conversion did not pass its accuracy
 * test. Hotspots stay available and labelled, so the brief's own unit is never
 * hidden.
 */
export const UNIT_MODES: UnitMode[] = ["cd", "hot", "sat", "anomaly"];

export const DEFAULT_UNIT_MODE: UnitMode = "cd";

export const GLOSSARY_TERMS = [
  "hotspot",
  "fireDay",
  "anomaly",
  "frp",
  "harmonized",
  "estimated",
  "noData",
  "searchDistance",
] as const;

export type GlossaryTermId = (typeof GLOSSARY_TERMS)[number];
