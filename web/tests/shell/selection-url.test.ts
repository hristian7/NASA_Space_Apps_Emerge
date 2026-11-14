import { describe, expect, it } from "vitest";
import type { Selection } from "../../src/types/ui";
import {
  decodeSelection,
  encodeSelection,
  selectionFromSearch,
  selectionSearch,
} from "../../src/lib/ui/selection-url";

const point: Selection = { kind: "point", lat: 42.7, lon: 23.3, radiusKm: 50 };
const country: Selection = { kind: "country", iso3: "BGR" };
const area: Selection = {
  kind: "polygon",
  ring: [
    [23.1, 42.5],
    [23.9, 42.5],
    [23.9, 43.1],
    [23.1, 43.1],
    [23.1, 42.5],
  ],
};

describe("the selection in the address bar", () => {
  it("writes a point as latitude, longitude and search distance", () => {
    expect(encodeSelection(point)).toBe("p:42.7,23.3,50");
  });

  it("writes a country as its three-letter code", () => {
    expect(encodeSelection(country)).toBe("c:BGR");
  });

  it("writes an area without repeating the closing corner", () => {
    expect(encodeSelection(area)).toBe("a:42.5,23.1;42.5,23.9;43.1,23.9;43.1,23.1");
  });

  it.each([
    ["point", point],
    ["country", country],
    ["area", area],
    ["point with no distance", { kind: "point", lat: 0, lon: 0, radiusKm: 0 } as Selection],
    [
      "point in the far south west",
      { kind: "point", lat: -41.2865, lon: -174.7762, radiusKm: 500 } as Selection,
    ],
  ])("comes back unchanged for a %s", (_name, selection) => {
    expect(decodeSelection(encodeSelection(selection as Selection))).toEqual(selection);
  });

  it("holds four decimal places, about ten metres", () => {
    const decoded = decodeSelection(
      encodeSelection({ kind: "point", lat: 42.123456, lon: 23.987654, radiusKm: 10 }),
    );
    expect(decoded).toEqual({ kind: "point", lat: 42.1235, lon: 23.9877, radiusKm: 10 });
  });

  it("keeps the search distance inside its limits", () => {
    expect(decodeSelection("p:42,23,900")).toEqual({
      kind: "point",
      lat: 42,
      lon: 23,
      radiusKm: 500,
    });
    expect(decodeSelection("p:42,23,-5")).toEqual({
      kind: "point",
      lat: 42,
      lon: 23,
      radiusKm: 0,
    });
  });

  it("closes a ring that arrives open", () => {
    const decoded = decodeSelection("a:42.5,23.1;42.5,23.9;43.1,23.9");
    expect(decoded).toEqual({
      kind: "polygon",
      ring: [
        [23.1, 42.5],
        [23.9, 42.5],
        [23.9, 43.1],
        [23.1, 42.5],
      ],
    });
  });

  it.each([
    ["nothing", null],
    ["an empty value", ""],
    ["an unknown kind", "x:42,23"],
    ["a point out of range", "p:95,23,50"],
    ["a longitude out of range", "p:42,181,50"],
    ["a point with a missing field", "p:42,23"],
    ["text instead of numbers", "p:north,east,50"],
    ["a two-letter country code", "c:BG"],
    ["an area with too few corners", "a:42.5,23.1;42.9,23.4"],
    ["an area with a broken corner", "a:42.5,23.1;42.9;43.1,23.9"],
  ])("refuses %s", (_name, value) => {
    expect(decodeSelection(value)).toBeNull();
  });

  it("keeps the other parameters and stays readable", () => {
    expect(selectionSearch("?d=ops", point)).toBe("?d=ops&sel=p:42.7,23.3,50");
    expect(selectionSearch("?sel=c:USA&d=field", point)).toBe("?d=field&sel=p:42.7,23.3,50");
    expect(selectionSearch("?sel=c:USA", null)).toBe("");
    expect(selectionSearch("", country)).toBe("?sel=c:BGR");
  });

  it("reads the selection back out of a query string", () => {
    expect(selectionFromSearch("?d=ember&sel=p:42.7,23.3,50")).toEqual(point);
    expect(selectionFromSearch("?sel=a:42.5,23.1;42.5,23.9;43.1,23.9;43.1,23.1")).toEqual(area);
    expect(selectionFromSearch("?d=ember")).toBeNull();
  });

  it("reads a link whose separators arrived percent-encoded", () => {
    expect(selectionFromSearch("?sel=p%3A42.7%2C23.3%2C50")).toEqual(point);
  });
});
