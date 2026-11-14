// Dev harness class names. Global stylesheet, prefixed names: see
// src/components/report/styles.ts for why.

import "./dev.css";

const styles = {
  columns: "dv-columns",
  divider: "dv-divider",
  page: "dv-page",
  panel: "dv-panel",
  panelSub: "dv-panelSub",
  panelTitle: "dv-panelTitle",
  state: "dv-state",
  switch: "dv-switch",
  switchOn: "dv-switchOn",
  switches: "dv-switches",
  title: "dv-title",
  top: "dv-top",
} as const;

export default styles;
