"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "@/lib/ui/motion";

type Token = { start: number; end: number; value: number; decimals: number; decimal: string; group: string };

const numberPattern = /\d{1,3}(?:[,.   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

function readToken(raw: string, start: number): Token {
  let group = "";
  let decimal = ".";
  let body = raw;
  const spaced = raw.match(/[   ]/);
  if (spaced) {
    group = spaced[0];
    body = body.split(group).join("");
  }
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    decimal = lastDot > lastComma ? "." : ",";
    group = group || (decimal === "." ? "," : ".");
    body = body.split(group).join("");
  } else if (lastComma >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(body) && !spaced) {
      group = ",";
      body = body.split(",").join("");
    } else decimal = ",";
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3}){2,}$/.test(body)) {
    group = ".";
    body = body.split(".").join("");
  }
  const point = body.indexOf(decimal);
  const decimals = point >= 0 ? body.length - point - 1 : 0;
  const value = Number(body.replace(decimal, "."));
  return { start, end: start + raw.length, value, decimals, decimal, group };
}

function tokens(text: string): Token[] {
  return [...text.matchAll(numberPattern)].map((match) => readToken(match[0], match.index ?? 0));
}

function write(token: Token, value: number): string {
  const fixed = value.toFixed(token.decimals);
  const [whole, part] = fixed.split(".");
  const grouped = token.group ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, token.group) : whole;
  return part === undefined ? grouped : `${grouped}${token.decimal}${part}`;
}

function frame(text: string, targets: Token[], from: number[], progress: number): string {
  let out = "";
  let cursor = 0;
  targets.forEach((token, index) => {
    out += text.slice(cursor, token.start) + write(token, from[index] + (token.value - from[index]) * progress);
    cursor = token.end;
  });
  return out + text.slice(cursor);
}

/**
 * A figure that settles in: on first show it counts up from zero, on a change
 * it counts from the old figure. The real text is always in the DOM (readers,
 * copy, tests and the live region see only the final value); the counting
 * frames are painted from an attribute over it, so nothing is announced twice
 * and nothing reflows.
 */
export default function Roll({ value, className, ms = 520 }: { value: string | number; className?: string; ms?: number }) {
  const text = String(value);
  const node = useRef<HTMLSpanElement | null>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const el = node.current;
    const before = previous.current;
    previous.current = text;
    if (el === null || reducedMotion()) return;
    const targets = tokens(text);
    if (targets.length === 0) return;
    const old = before === null ? null : tokens(before);
    const from = old !== null && old.length === targets.length ? old.map((token) => token.value) : targets.map(() => 0);
    if (from.every((start, index) => start === targets[index].value)) return;
    const begin = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - begin) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      if (t >= 1) {
        el.removeAttribute("data-roll");
        return;
      }
      el.setAttribute("data-roll", frame(text, targets, from, eased));
      raf = requestAnimationFrame(step);
    };
    el.setAttribute("data-roll", frame(text, targets, from, 0));
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el.removeAttribute("data-roll");
    };
  }, [text, ms]);

  return (
    <span ref={node} className={className ? `roll ${className}` : "roll"}>
      {text}
    </span>
  );
}
