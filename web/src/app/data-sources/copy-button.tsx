"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Copies one section of the source list for NASA's form, one `Link Text<TAB>URL`
 * line per row. Where the clipboard is blocked the same text is shown in a box
 * to copy by hand.
 */
export default function CopyButton({
  text,
  label,
  done,
  fallback,
}: {
  text: string;
  label: string;
  done: string;
  fallback: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const box = useRef<HTMLTextAreaElement | null>(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (state === "manual") box.current?.select();
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("manual");
    }
  };

  return (
    <div className="ds-copy">
      <button type="button" className="btn" onClick={copy} data-state={state}>
        {state === "copied" ? done : label}
      </button>
      <span className="ds-status" role="status" aria-live="polite">
        {state === "copied" ? done : ""}
      </span>
      {state === "manual" ? (
        <label className="ds-manual">
          <span>{fallback}</span>
          <textarea ref={box} readOnly value={text} rows={Math.min(12, text.split("\n").length + 1)} />
        </label>
      ) : null}
    </div>
  );
}
