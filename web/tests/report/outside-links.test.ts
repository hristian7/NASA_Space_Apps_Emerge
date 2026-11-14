import { describe, expect, it } from "vitest";
import {
  firmsUrl,
  outsideLinks,
  selectionView,
  zoomForSpan,
} from "../../src/components/report/lib/outside-links";

// Expected URLs are the forms that opened on the right place or country when
// loaded in a browser on 14 Nov 2026 (FIRMS map, GWIS and EFFIS statistics).

const BGR_BOX = { west: 22.36, south: 41.23, east: 28.61, north: 44.23 };

describe("outsideLinks", () => {
  it("gives a country selection in EFFIS coverage all four links", () => {
    const links = outsideLinks({
      selection: { kind: "country", iso3: "BGR" },
      countryIso3: "BGR",
      countryBox: BGR_BOX,
      year: 2026,
    });
    expect(links.map((l) => l.id)).toEqual(["firms", "gwisStats", "effisStats", "gwisDanger"]);
    expect(links[1].url).toBe("https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates/BGR/2026");
    expect(links[2].url).toBe(
      "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates/BGR/2026/2006/2025",
    );
    expect(links[1].scope).toBe("place");
    expect(links[3]).toEqual({
      id: "gwisDanger",
      url: "https://gwis.jrc.ec.europa.eu/apps/gwis_current_situation/",
      scope: "world",
    });
  });

  it("leaves EFFIS out for a country it does not cover", () => {
    const links = outsideLinks({
      selection: { kind: "country", iso3: "USA" },
      countryIso3: "USA",
      countryBox: { west: -125, south: 24, east: -66, north: 50 },
      year: 2026,
    });
    expect(links.map((l) => l.id)).toEqual(["firms", "gwisStats", "gwisDanger"]);
  });

  it("marks country statistics as whole-country for a point", () => {
    const links = outsideLinks({
      selection: { kind: "point", lat: 42.7, lon: 25.3, radiusKm: 25 },
      countryIso3: "BGR",
      countryBox: null,
      year: 2026,
    });
    expect(links[0]).toEqual({
      id: "firms",
      url: "https://firms.modaps.eosdis.nasa.gov/map/#d:7days;@25.30,42.70,9.0z",
      scope: "place",
    });
    expect(links.find((l) => l.id === "gwisStats")?.scope).toBe("country");
  });

  it("gives only the map links when the country is unknown", () => {
    const links = outsideLinks({
      selection: { kind: "point", lat: -3.1, lon: -60.0, radiusKm: 50 },
      countryIso3: null,
      countryBox: null,
      year: 2026,
    });
    expect(links.map((l) => l.id)).toEqual(["firms", "gwisDanger"]);
  });

  it("ignores a malformed country code", () => {
    const links = outsideLinks({
      selection: { kind: "point", lat: 42.7, lon: 25.3, radiusKm: 25 },
      countryIso3: "bg/../x",
      countryBox: null,
      year: 2026,
    });
    expect(links.map((l) => l.id)).toEqual(["firms", "gwisDanger"]);
  });

  it("skips the FIRMS link for a country with no box", () => {
    const links = outsideLinks({
      selection: { kind: "country", iso3: "BGR" },
      countryIso3: "BGR",
      countryBox: null,
      year: 2026,
    });
    expect(links[0].id).toBe("gwisStats");
  });
});

describe("selectionView", () => {
  it("centres a drawn area on its box", () => {
    const view = selectionView(
      {
        kind: "polygon",
        ring: [
          [23, 42],
          [24, 42],
          [24, 43],
          [23, 43],
          [23, 42],
        ],
      },
      null,
    );
    expect(view).toEqual({ lat: 42.5, lon: 23.5, spanDeg: 1 });
  });

  it("handles a box that crosses the 180 degree line", () => {
    const view = selectionView({ kind: "country", iso3: "FJI" }, { west: -180, south: -21, east: 180, north: -12 });
    expect(view?.lon).toBe(180);
  });
});

describe("zoomForSpan", () => {
  it("fits a country, a 25 km circle and the whole world", () => {
    expect(zoomForSpan(6.25)).toBe(6);
    expect(zoomForSpan(0.62)).toBe(9);
    expect(zoomForSpan(360)).toBe(2);
    expect(zoomForSpan(0)).toBe(12);
  });
});

describe("firmsUrl", () => {
  it("writes longitude first, as the FIRMS map expects", () => {
    expect(firmsUrl(42.7, 25.3, 7)).toBe("https://firms.modaps.eosdis.nasa.gov/map/#d:7days;@25.30,42.70,7.0z");
  });
});
