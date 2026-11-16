import { describe, expect, it } from "vitest";
import { pickLocale } from "../../src/i18n/locales";

describe("pickLocale", () => {
  it("keeps a choice made with the language switch", () => {
    expect(pickLocale({ stored: "en", acceptLanguage: "bg-BG,bg;q=0.9", country: "BG" })).toBe("en");
    expect(pickLocale({ stored: "bg", acceptLanguage: "en-US", country: "US" })).toBe("bg");
  });

  it("follows a Bulgarian browser", () => {
    expect(pickLocale({ acceptLanguage: "bg-BG,bg;q=0.9,en;q=0.8" })).toBe("bg");
    expect(pickLocale({ acceptLanguage: "bg" })).toBe("bg");
  });

  it("follows the browser's first language the site speaks, by weight", () => {
    expect(pickLocale({ acceptLanguage: "de-DE,bg;q=0.8,en;q=0.5" })).toBe("bg");
    expect(pickLocale({ acceptLanguage: "en;q=0.4,bg;q=0.9" })).toBe("bg");
    expect(pickLocale({ acceptLanguage: "en-GB,en;q=0.9,bg;q=0.8" })).toBe("en");
  });

  it("uses Bulgarian for a visitor in Bulgaria, whatever the browser's language", () => {
    expect(pickLocale({ acceptLanguage: "de-DE,fr;q=0.8", country: "BG" })).toBe("bg");
    expect(pickLocale({ acceptLanguage: "en-GB,en;q=0.9", country: "BG" })).toBe("bg");
    expect(pickLocale({ country: "bg" })).toBe("bg");
  });

  it("uses English otherwise", () => {
    expect(pickLocale({})).toBe("en");
    expect(pickLocale({ acceptLanguage: "de-DE", country: "DE" })).toBe("en");
    expect(pickLocale({ stored: "xx", acceptLanguage: "", country: null })).toBe("en");
  });
});
