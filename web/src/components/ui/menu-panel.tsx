"use client";

import { useEffect, useRef } from "react";

type Props = {
  id: string;
  title: string;
  closeLabel: string;
  side?: "left" | "right";
  onClose: () => void;
  children: React.ReactNode;
};

/** A small panel opened from the top bar. Escape closes it; focus moves into it. */
export default function MenuPanel({ id, title, closeLabel, side = "left", onClose, children }: Props) {
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    box.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      id={id}
      ref={box}
      tabIndex={-1}
      role="group"
      aria-label={title}
      className={side === "right" ? "popover glass right" : "popover glass"}
    >
      {children}
      <button type="button" className="btn" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}
