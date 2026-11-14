import { describe, expect, it } from "vitest";
import {
  blowsToward,
  compassPoint,
  fetchWeather,
  parseWeather,
  selectionPoint,
  weatherUrl,
} from "../../src/lib/forecast/weather";

/**
 * One real Open-Meteo forecast response for 42.70, 23.32 (requested on
 * 2026-11-14 with past_days=7, forecast_days=2, timezone=auto). Daily rows are
 * kept whole; hourly soil moisture is trimmed to the two forecast days.
 */
const soil = [
  0.326, 0.327, 0.321, 0.321, 0.321, 0.321, 0.321, 0.321, 0.323, 0.327, 0.325, 0.321,
  0.319, 0.318, 0.318, 0.317, 0.317, 0.318, 0.319, 0.319, 0.32, 0.321, 0.322, 0.322,
  0.322, 0.323, 0.323, 0.323, 0.323, 0.323, 0.323, 0.323, 0.323, 0.323, 0.322, 0.32,
  0.319, 0.319, 0.318, 0.318, 0.318, 0.318, 0.318, 0.319, 0.319, 0.319, 0.32, 0.32,
];
const hours = (date: string) => Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, "0")}:00`);

function fixture() {
  return {
    latitude: 42.731186,
    longitude: 23.344542,
    utc_offset_seconds: 7200,
    timezone: "Europe/Sofia",
    daily_units: {
      time: "iso8601",
      temperature_2m_max: "°C",
      relative_humidity_2m_min: "%",
      wind_speed_10m_max: "km/h",
      wind_gusts_10m_max: "km/h",
      wind_direction_10m_dominant: "°",
      precipitation_sum: "mm",
    },
    daily: {
      time: ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"],
      temperature_2m_max: [9.4, 9.7, 8.5, 10.5, 13.3, 17.4, 21.8, 12.8, 7.3] as (number | null)[],
      relative_humidity_2m_min: [58, 52, 75, 65, 74, 59, 39, 64, 60],
      wind_speed_10m_max: [5.1, 5.4, 6.2, 5.7, 5.5, 9.7, 23.5, 23.1, 19.5],
      wind_gusts_10m_max: [10.8, 12.6, 13.7, 11.5, 13.3, 20.2, 49.7, 47.2, 39.6],
      wind_direction_10m_dominant: [52, 111, 120, 102, 111, 79, 218, 286, 104],
      precipitation_sum: [0.0, 0.0, 4.0, 0.0, 0.3, 0.0, 0.4, 0.9, 0.0] as (number | null)[],
    },
    hourly_units: { time: "iso8601", soil_moisture_0_to_1cm: "m³/m³" },
    hourly: {
      time: [...hours("2026-11-14"), ...hours("2026-11-15")],
      soil_moisture_0_to_1cm: [...soil] as (number | null)[],
    },
  };
}

describe("parseWeather", () => {
  it("reads today from the first row after the past days", () => {
    expect(parseWeather(fixture(), "today")).toEqual({
      date: "2026-11-14",
      tMax: 12.8,
      rhMin: 64,
      windMax: 23.1,
      gustMax: 47.2,
      windFrom: 286,
      rain: 0.9,
      rain7: 4.7,
      dryDays: { days: 5, atLeast: false },
      soil: 0.321,
    });
  });

  it("reads tomorrow from the next row, with its own past week", () => {
    expect(parseWeather(fixture(), "tomorrow")).toEqual({
      date: "2026-11-15",
      tMax: 7.3,
      rhMin: 60,
      windMax: 19.5,
      gustMax: 39.6,
      windFrom: 104,
      rain: 0,
      rain7: 5.6,
      dryDays: { days: 6, atLeast: false },
      soil: 0.321,
    });
  });

  it("keeps a measured zero and turns a missing value into null", () => {
    const json = fixture();
    json.daily.temperature_2m_max[7] = null;
    const today = parseWeather(json, "today");
    expect(today?.tMax).toBeNull();
    expect(parseWeather(json, "tomorrow")?.rain).toBe(0);
  });

  it("gives no past-week total when a day in it is missing", () => {
    const json = fixture();
    json.daily.precipitation_sum[3] = null;
    expect(parseWeather(json, "today")?.rain7).toBeNull();
  });

  it("counts a rainy chosen day as zero days since rain", () => {
    const json = fixture();
    json.daily.precipitation_sum[8] = 2.5;
    expect(parseWeather(json, "tomorrow")?.dryDays).toEqual({ days: 0, atLeast: false });
  });

  it("says more than a week when no rain day is in the window", () => {
    const json = fixture();
    json.daily.precipitation_sum = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(parseWeather(json, "today")?.dryDays).toEqual({ days: 7, atLeast: true });
  });

  it("returns null soil moisture when no hourly values exist for the day", () => {
    const json = fixture();
    json.hourly.soil_moisture_0_to_1cm = json.hourly.soil_moisture_0_to_1cm.map(() => null);
    expect(parseWeather(json, "today")?.soil).toBeNull();
  });

  it("returns null for a response without daily rows", () => {
    expect(parseWeather({ error: true, reason: "bad" }, "today")).toBeNull();
    expect(parseWeather(null, "today")).toBeNull();
    expect(parseWeather({ daily: { time: ["2026-11-14"] } }, "today")).toBeNull();
  });
});

describe("wind direction", () => {
  it("names the compass point the wind comes from", () => {
    expect(compassPoint(286)).toBe("W");
    expect(compassPoint(315)).toBe("NW");
    expect(compassPoint(350)).toBe("N");
    expect(compassPoint(-45)).toBe("NW");
  });

  it("points the arrow to where the wind blows", () => {
    expect(blowsToward(286)).toBe(106);
    expect(blowsToward(0)).toBe(180);
    expect(blowsToward(270)).toBe(90);
  });
});

describe("fetchWeather", () => {
  it("asks once per rounded place within an hour", async () => {
    const urls: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify(fixture()), { status: 200 });
    }) as typeof fetch;
    const now = 1_000_000;
    await fetchWeather(12.3441, 45.6789, undefined, fetcher, now);
    await fetchWeather(12.3449, 45.6791, undefined, fetcher, now + 60_000);
    expect(urls).toHaveLength(1);
    await fetchWeather(12.3441, 45.6789, undefined, fetcher, now + 3_600_001);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(weatherUrl(12.34, 45.68));
  });

  it("requests the variables the parser reads", () => {
    const url = new URL(weatherUrl(42.7, 23.32));
    expect(url.searchParams.get("daily")?.split(",")).toEqual([
      "temperature_2m_max",
      "relative_humidity_2m_min",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
      "precipitation_sum",
    ]);
    expect(url.searchParams.get("past_days")).toBe("7");
    expect(url.searchParams.get("forecast_days")).toBe("2");
  });

  it("fails on a server error instead of caching it", async () => {
    const fetcher = (async () => new Response("down", { status: 503 })) as typeof fetch;
    await expect(fetchWeather(-33.1, 151.2, undefined, fetcher)).rejects.toThrow("503");
  });
});

describe("selectionPoint", () => {
  const countries = new Map([["BGR", { lat: 42.7, lon: 25.5 }]]);

  it("uses a point as given and a country's own point", () => {
    expect(selectionPoint({ kind: "point", lat: 1, lon: 2, radiusKm: 5 }, countries)).toEqual({ lat: 1, lon: 2 });
    expect(selectionPoint({ kind: "country", iso3: "BGR" }, countries)).toEqual({ lat: 42.7, lon: 25.5 });
    expect(selectionPoint({ kind: "country", iso3: "XXX" }, countries)).toBeNull();
  });

  it("averages a polygon's corners without counting the closing corner twice", () => {
    const ring: [number, number][] = [[0, 0], [10, 0], [10, 20], [0, 20], [0, 0]];
    expect(selectionPoint({ kind: "polygon", ring }, countries)).toEqual({ lat: 10, lon: 5 });
  });
});
