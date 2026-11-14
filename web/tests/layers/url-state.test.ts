import { describe, expect, it } from "vitest";
import {
  defaultLayerState,
  layerStateFromSearch,
  layerStateSearch,
  panelLayers,
} from "../../src/lib/layers/url-state";

const lastMonth = "2025-12";

function roundTrip(search: string): string {
  const state = layerStateFromSearch(search, lastMonth);
  return layerStateSearch(search, state, lastMonth);
}

describe("layers in the address bar", () => {
  it("starts from the registry's own defaults when nothing is in the address", () => {
    const state = layerStateFromSearch("", lastMonth);
    expect(state).toEqual(defaultLayerState(lastMonth));
    expect(state.on).toEqual(["harmonized-history"]);
  });

  it("comes back the same after a round trip", () => {
    const search = "?lay=h,r,d&hy=2019&rw=7d&dd=4";
    const state = layerStateFromSearch(search, lastMonth);
    expect(state).toEqual({
      on: ["harmonized-history", "recent-fires", "fire-danger"],
      historyYear: 2019,
      recentWindow: "7d",
      dangerDay: 4,
    });
    expect(layerStateFromSearch(roundTrip(search), lastMonth)).toEqual(state);
  });

  it("reads an empty list as every layer off, which an absent list is not", () => {
    expect(layerStateFromSearch("?lay=", lastMonth).on).toEqual([]);
    expect(layerStateFromSearch("", lastMonth).on).not.toEqual([]);
  });

  it("leaves the selection and every other parameter exactly as typed", () => {
    const search = "?sel=p:42.7,23.3,50&d=ember&lay=h&hy=2024";
    const next = roundTrip(search);
    expect(next.includes("sel=p:42.7,23.3,50")).toBe(true);
    expect(next.includes("d=ember")).toBe(true);
  });

  it("drops a setting whose layer is switched off", () => {
    const next = layerStateSearch(
      "?lay=h,r,d&hy=2024&rw=7d&dd=3",
      { on: ["harmonized-history"], historyYear: 2024, recentWindow: "7d", dangerDay: 3 },
      lastMonth,
    );
    expect(next.includes("hy=2024")).toBe(true);
    expect(next.includes("rw=")).toBe(false);
    expect(next.includes("dd=")).toBe(false);
  });

  it("writes the layer keys in the registry's order, whatever order they arrive in", () => {
    const next = layerStateSearch(
      "",
      {
        on: ["fire-danger", "harmonized-history"],
        historyYear: 2024,
        recentWindow: "24h",
        dangerDay: 0,
      },
      lastMonth,
    );
    expect(next.includes("lay=h,d")).toBe(true);
  });

  it("ignores a layer key nobody knows and a hand-edited setting", () => {
    const state = layerStateFromSearch("?lay=h,zzz&hy=1750&dd=99&rw=year", lastMonth);
    expect(state.on).toEqual(["harmonized-history"]);
    expect(state.historyYear).toBe(2001);
    expect(state.dangerDay).toBe(9);
    expect(state.recentWindow).toBe("24h");
  });

  it("uses a short key for every listed layer and never repeats one", () => {
    const keys = panelLayers().map((entry) => entry.panel?.urlKey ?? "");
    expect(keys.every((key) => key.length <= 2 && key.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
