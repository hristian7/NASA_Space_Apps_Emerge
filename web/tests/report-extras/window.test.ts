import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import messages from "../../messages/report.en.json";
import WindowCard from "../../src/components/report/WindowCard";
import { rankWindow } from "../../src/lib/stats/window";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values: Record<string, string | number> = {}) => {
    let value: unknown = messages.report;
    for (const part of key.split(".")) value = (value as Record<string, unknown>)[part];
    return String(value).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
  },
}));

describe("window heat", () => {
  it("shows missing heat independently from counts and labels raw sensor periods", () => {
    const comparison = rankWindow(8, "2026-11-14", { year: 2026, hot: 50, frp: null, estimated: false }, [
      { year: 2011, hot: 10, frp: 20, estimated: false },
      { year: 2024, hot: 0, frp: 0, estimated: false },
    ]);
    const html = renderToStaticMarkup(React.createElement(WindowCard, { comparison, locale: "en" }));
    expect(html).toContain("Heat: no data");
    expect(html).toContain("20 MW");
    expect(html).toContain("0 MW");
    expect(html).toContain("raw");
    expect(html).toContain("Nov 14, 2026");
  });
});
