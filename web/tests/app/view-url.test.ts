import { describe, expect, it } from "vitest";
import {
  decodeMonth,
  decodeUnit,
  decodeView,
  defaultView,
  encodeMonth,
  viewSearch,
  type ViewState,
} from "../../src/lib/ui/view-url";
import { selectionSearch, selectionFromSearch } from "../../src/lib/ui/selection-url";
import type { Selection } from "../../src/types/ui";

const views: ViewState[] = [
  defaultView,
  { unit: "hot", month: { y: 2024, m: 8 }, from: null, to: null },
  { unit: "anomaly", month: { y: 2000, m: 11 }, from: { y: 2012, m: 2 }, to: { y: 2025, m: 12 } },
  { unit: "sat", month: null, from: { y: 2001, m: 1 }, to: { y: 2001, m: 12 } },
  { unit: "cd", month: { y: 2025, m: 12 }, from: { y: 2000, m: 11 }, to: { y: 2025, m: 12 } },
];

describe("the view in the address bar", () => {
  it.each(views.map((view, at) => [at, view] as const))(
    "survives a round trip, case %i",
    (_at, view) => {
      expect(decodeView(viewSearch("", view))).toEqual(view);
    },
  );

  it("keeps the selection and the look beside it", () => {
    const selection: Selection = { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 };
    let search = "?d=ops";
    search = selectionSearch(search, selection);
    search = viewSearch(search, {
      unit: "hot",
      month: { y: 2024, m: 8 },
      from: { y: 2012, m: 2 },
      to: { y: 2024, m: 12 },
    });

    expect(new URLSearchParams(search).get("d")).toBe("ops");
    expect(selectionFromSearch(search)).toEqual(selection);
    expect(decodeView(search)).toEqual({
      unit: "hot",
      month: { y: 2024, m: 8 },
      from: { y: 2012, m: 2 },
      to: { y: 2024, m: 12 },
    });
  });

  it("writes nothing for a view that is the default", () => {
    expect(viewSearch("", defaultView)).toBe("");
  });

  it("replaces a value rather than repeating it", () => {
    const once = viewSearch("", { ...defaultView, month: { y: 2024, m: 8 } });
    const twice = viewSearch(once, { ...defaultView, month: { y: 2025, m: 1 } });
    expect(twice).toBe("?mo=2025-01");
  });

  it("reads a hand-edited link without throwing", () => {
    expect(decodeView("?u=nonsense&mo=2024-13&from=&to=x")).toEqual(defaultView);
    expect(decodeMonth("2024-8")).toEqual({ y: 2024, m: 8 });
    expect(decodeMonth("2024-00")).toBeNull();
    expect(decodeUnit("anomaly")).toBe("anomaly");
    expect(decodeUnit("Anomaly")).toBeNull();
  });

  it("writes a month with two digits", () => {
    expect(encodeMonth({ y: 2000, m: 11 })).toBe("2000-11");
    expect(encodeMonth({ y: 2024, m: 8 })).toBe("2024-08");
  });
});
