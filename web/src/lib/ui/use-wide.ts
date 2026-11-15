"use client";

import { useSyncExternalStore } from "react";

/** Wide enough for the layer dock to stay open beside the report. */
const query = "(min-width: 1024px)";

function subscribe(change: () => void) {
  const list = window.matchMedia(query);
  list.addEventListener("change", change);
  return () => list.removeEventListener("change", change);
}

/** False on the server and on phones and narrow tablets. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
