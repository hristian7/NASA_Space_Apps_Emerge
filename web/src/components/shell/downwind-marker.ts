import type { Map as MapLibreMap, Marker, MarkerOptions } from "maplibre-gl";

/** Where the arrow starts and which way it points, as a compass bearing the wind blows to. */
export type Downwind = { lat: number; lon: number; toward: number; label: string };

// The card can decide before the map has loaded; the map picks up the last word.
let current: Downwind | null = null;

/** Called by the active-fire card: show the arrow, move it, or (null) remove it. */
export function showDownwind(next: Downwind | null): void {
  current = next;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Downwind | null>("emerge-downwind", { detail: next }));
}

/** Half the element's side: the arrow runs from its centre (the point) to its top edge. */
const half = 52;

function arrowElement(label: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "downwind-marker";
  const side = half * 2;
  box.innerHTML = `<svg viewBox="0 0 ${side} ${side}" width="${side}" height="${side}" role="img" tabindex="0"><title></title><path d="M${half} ${half} V14" class="downwind-outline"/><path d="M${half} ${half} V14" class="downwind-shaft"/><path d="M${half} 3 L${half + 8} 16 H${half - 8} Z" class="downwind-head"/></svg>`;
  setLabel(box, label);
  return box;
}

function setLabel(box: HTMLElement, label: string) {
  const svg = box.querySelector("svg");
  svg?.setAttribute("aria-label", label);
  const title = box.querySelector("title");
  if (title) title.textContent = label;
}

/**
 * One marker for the downwind guide. MapLibre writes the marker's transform
 * itself, so the direction goes through its `rotation` option, which turns
 * the element about its centre: the point.
 */
export function attachDownwindMarker(map: MapLibreMap, MarkerClass: new (options: MarkerOptions) => Marker): () => void {
  let marker: Marker | null = null;
  const apply = (next: Downwind | null) => {
    if (next === null) {
      marker?.remove();
      marker = null;
      return;
    }
    if (marker === null) {
      marker = new MarkerClass({
        element: arrowElement(next.label),
        anchor: "center",
        rotation: next.toward,
        rotationAlignment: "map",
        pitchAlignment: "map",
      })
        .setLngLat([next.lon, next.lat])
        .addTo(map);
      return;
    }
    marker.setLngLat([next.lon, next.lat]).setRotation(next.toward);
    setLabel(marker.getElement(), next.label);
  };
  const listen = (event: Event) => apply((event as CustomEvent<Downwind | null>).detail);
  window.addEventListener("emerge-downwind", listen);
  apply(current);
  return () => {
    window.removeEventListener("emerge-downwind", listen);
    marker?.remove();
    marker = null;
  };
}
