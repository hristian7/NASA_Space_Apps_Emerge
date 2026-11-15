import { describe, expect, it } from "vitest";
import { viewFromSearch, viewValue } from "../../src/lib/ui/app-view";

describe("viewFromSearch", () => {
  it("opens Forecast on a bare link", () => {
    expect(viewFromSearch("")).toBe("forecast");
    expect(viewFromSearch("?lay=d")).toBe("forecast");
    expect(viewFromSearch("?risk=example")).toBe("forecast");
  });

  it("follows an explicit v", () => {
    expect(viewFromSearch("?v=f")).toBe("forecast");
    expect(viewFromSearch("?v=h")).toBe("history");
    expect(viewFromSearch("?v=f&sel=c:BGR")).toBe("forecast");
    expect(viewFromSearch("?sel=c:BGR&v=h")).toBe("history");
  });

  it("keeps an old place link without v on History, as it meant then", () => {
    expect(viewFromSearch("?sel=c:BGR")).toBe("history");
    expect(viewFromSearch("?sel=p:42.6,23.5,50&u=hot")).toBe("history");
  });

  it("falls back to the default rules for an unknown v", () => {
    expect(viewFromSearch("?v=x")).toBe("forecast");
    expect(viewFromSearch("?v=x&sel=c:BGR")).toBe("history");
  });
});

describe("viewValue", () => {
  it("writes f and h", () => {
    expect(viewValue("forecast")).toBe("f");
    expect(viewValue("history")).toBe("h");
  });
});
