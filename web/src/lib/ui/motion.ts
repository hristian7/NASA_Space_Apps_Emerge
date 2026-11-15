"use client";

import { useEffect, useLayoutEffect, useRef, useState, type Ref, type RefObject } from "react";

/** Motion timings, in milliseconds. The CSS twins live in `styles/motion.css`. */
export const motionMs = { fast: 160, base: 240, slow: 320, draw: 640 } as const;

/** Ease-out with a long, soft tail: settles like a light spring without overshoot. */
export const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fills a ref the caller passed in, whichever kind it is. */
export function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps a closing element mounted for its exit animation. Returns whether to
 * render and the state to put on `data-state` ("open" or "closing"). With
 * reduced motion the element unmounts at once.
 */
export function usePresence(open: boolean, exitMs: number = motionMs.base): { mounted: boolean; state: "open" | "closing" } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    if (reducedMotion()) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, exitMs]);
  return { mounted: open || mounted, state: open ? "open" : "closing" };
}

/**
 * Keeps the last non-null value while a panel closes, so its content stays on
 * screen during the exit instead of vanishing first.
 */
export function useLastValue<T>(value: T | null): T | null {
  const last = useRef<T | null>(value);
  if (value !== null) last.current = value;
  return value ?? last.current;
}

/**
 * A pill that slides under the active button of a group: the shared movement
 * between tabs. The group renders `<span className="pill" />` as its first
 * child; `selector` picks the active button. The pill rests at its real size
 * and only its transform is animated (from the old box to the new one).
 */
export function useSlidingPill(group: RefObject<HTMLElement | null>, selector: string, deps: unknown[]) {
  const last = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useIsoLayoutEffect(() => {
    const root = group.current;
    const pill = root?.querySelector<HTMLElement>(":scope > .pill") ?? null;
    if (root === null || pill === null) return;
    const place = (animate: boolean) => {
      const active = root.querySelector<HTMLElement>(selector);
      if (active === null) {
        root.removeAttribute("data-pill");
        last.current = null;
        return;
      }
      const box = root.getBoundingClientRect();
      const target = active.getBoundingClientRect();
      const next = {
        x: target.left - box.left - root.clientLeft,
        y: target.top - box.top - root.clientTop,
        w: target.width,
        h: target.height,
      };
      const prev = last.current;
      last.current = next;
      pill.style.width = `${next.w}px`;
      pill.style.height = `${next.h}px`;
      pill.style.transform = `translate(${next.x}px, ${next.y}px)`;
      root.setAttribute("data-pill", "");
      if (!animate || prev === null || reducedMotion() || typeof pill.animate !== "function") return;
      if (prev.x === next.x && prev.y === next.y && prev.w === next.w) return;
      pill.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${prev.x}px, ${prev.y}px) scale(${prev.w / next.w}, ${prev.h / next.h})` },
          { transformOrigin: "0 0", transform: `translate(${next.x}px, ${next.y}px)` },
        ],
        { duration: motionMs.slow, easing: easeOut },
      );
    };
    place(true);
    const resize = new ResizeObserver(() => place(false));
    resize.observe(root);
    return () => resize.disconnect();
    // The caller names what moves the active button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

type DrawOptions = { duration?: number; update?: boolean };

/**
 * Draws a chart in: lines trace from left to right, dots and bars grow in the
 * order they sit along the x axis, fills fade. Runs on first show and again,
 * quicker, when `key` changes, so a new selection moves instead of swapping.
 * Only transform, opacity and stroke-dashoffset are animated, through the Web
 * Animations API, so nothing is written into the SVG itself (exports stay clean).
 */
export function useChartDraw(svg: RefObject<SVGSVGElement | null>, key: string | number | null, options: DrawOptions = {}) {
  const seen = useRef(false);
  useEffect(() => {
    const root = svg.current;
    if (root === null || key === null) return;
    if (reducedMotion() || typeof root.animate !== "function") {
      seen.current = true;
      return;
    }
    if (seen.current) return draw(root, true);
    // A chart below the fold draws when it first scrolls into view.
    let undo: (() => void) | undefined;
    const watch = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watch.disconnect();
      seen.current = true;
      undo = draw(root, false);
    });
    watch.observe(root);
    return () => {
      watch.disconnect();
      undo?.();
    };
    // `key` alone says when the drawing changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function draw(root: SVGSVGElement, update: boolean) {
    const total = update ? motionMs.slow : (options.duration ?? motionMs.draw);
    const piece = update ? 260 : 420;
    const spread = Math.max(0, total - piece);
    const view = root.viewBox.baseVal;
    const left = view && view.width > 0 ? view.x : 0;
    const width = view && view.width > 0 ? view.width : root.getBoundingClientRect().width || 1;
    const along = (node: SVGGraphicsElement) => {
      try {
        const box = node.getBBox();
        return Math.min(1, Math.max(0, (box.x - left) / width));
      } catch {
        return 0;
      }
    };
    const running: Animation[] = [];
    const nodes = root.querySelectorAll<SVGGraphicsElement>("polyline, path, line, circle, rect, polygon");
    nodes.forEach((node) => {
      if (node.closest("defs, pattern, title") !== null || node.hasAttribute("data-static")) return;
      const cls = node.getAttribute("class") ?? "";
      if (/axis|track|sep|grid/i.test(cls)) return;
      const delay = along(node) * spread;
      const timing: KeyframeAnimationOptions = { duration: piece, delay, easing: easeOut, fill: "backwards" };
      const tag = node.tagName.toLowerCase();
      const style = getComputedStyle(node);
      if (tag === "polyline" || tag === "path" || tag === "line") {
        const dashed = style.strokeDasharray !== "none" && style.strokeDasharray !== "";
        const geometry = node as unknown as SVGGeometryElement;
        if (!dashed && typeof geometry.getTotalLength === "function" && style.stroke !== "none") {
          const length = geometry.getTotalLength();
          if (length > 0) {
            const from = update ? length * 0.35 : length;
            running.push(
              node.animate(
                [
                  { strokeDasharray: `${length} ${length}`, strokeDashoffset: `${from}` },
                  { strokeDasharray: `${length} ${length}`, strokeDashoffset: "0" },
                ],
                timing,
              ),
            );
            return;
          }
        }
        running.push(node.animate([{ opacity: update ? 0.35 : 0 }, { opacity: 1 }], timing));
        return;
      }
      if (tag === "circle") {
        running.push(
          node.animate(
            [
              { transform: `scale(${update ? 0.6 : 0})`, transformBox: "fill-box", transformOrigin: "center", opacity: 0 },
              { transform: "scale(1)", transformBox: "fill-box", transformOrigin: "center", opacity: 1 },
            ],
            timing,
          ),
        );
        return;
      }
      if (tag === "rect") {
        // A bar grows from its base; a flat-wide rect (a total bar) grows from its left.
        const box = node.getBBox();
        const wide = box.width > box.height * 1.6;
        const scale = update ? 0.55 : 0;
        running.push(
          node.animate(
            [
              { transform: wide ? `scaleX(${scale})` : `scaleY(${scale})`, transformBox: "fill-box", transformOrigin: wide ? "0 50%" : "50% 100%" },
              { transform: "scale(1)", transformBox: "fill-box", transformOrigin: wide ? "0 50%" : "50% 100%" },
            ],
            timing,
          ),
        );
        return;
      }
      running.push(node.animate([{ opacity: update ? 0.3 : 0 }, { opacity: 1 }], { ...timing, delay: 0, duration: total }));
    });
    return () => running.forEach((animation) => animation.cancel());
  }
}

/**
 * Replays a CSS entrance: removes `className`, forces one style flush, adds it
 * back. Used where React keeps the element but its content changed.
 */
export function useReplay(target: RefObject<Element | null>, key: unknown, className: string, ms: number) {
  useIsoLayoutEffect(() => {
    const node = target.current;
    if (node === null || key === null || reducedMotion()) return;
    node.classList.remove(className);
    void (node as HTMLElement).offsetWidth;
    node.classList.add(className);
    const timer = window.setTimeout(() => node.classList.remove(className), ms);
    return () => {
      window.clearTimeout(timer);
      node.classList.remove(className);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
