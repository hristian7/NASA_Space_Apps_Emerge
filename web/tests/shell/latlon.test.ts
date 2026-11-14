import { describe, expect, it } from "vitest";
import { parseLatLon } from "../../src/lib/ui/latlon";

describe("typed latitude and longitude", () => {
  it("accepts a plain pair", () => {
    expect(parseLatLon("42.7", "23.3")).toEqual({ ok: true, lat: 42.7, lon: 23.3 });
  });

  it("accepts negative values, a leading plus and surrounding spaces", () => {
    expect(parseLatLon(" -33.9 ", "+18.4")).toEqual({ ok: true, lat: -33.9, lon: 18.4 });
  });

  it("accepts the limits themselves", () => {
    expect(parseLatLon("90", "180")).toEqual({ ok: true, lat: 90, lon: 180 });
    expect(parseLatLon("-90", "-180")).toEqual({ ok: true, lat: -90, lon: -180 });
  });

  it("accepts a pair pasted into the first box", () => {
    expect(parseLatLon("42.7, 23.3", "")).toEqual({ ok: true, lat: 42.7, lon: 23.3 });
    expect(parseLatLon("42.7 23.3", "")).toEqual({ ok: true, lat: 42.7, lon: 23.3 });
  });

  it("accepts a zero point", () => {
    expect(parseLatLon("0", "0")).toEqual({ ok: true, lat: 0, lon: 0 });
  });

  it("refuses a latitude outside its range", () => {
    expect(parseLatLon("95", "10")).toEqual({ ok: false, error: "lat" });
    expect(parseLatLon("-90.0001", "10")).toEqual({ ok: false, error: "lat" });
  });

  it("refuses a longitude outside its range", () => {
    expect(parseLatLon("42", "181")).toEqual({ ok: false, error: "lon" });
    expect(parseLatLon("42", "-200")).toEqual({ ok: false, error: "lon" });
  });

  it("refuses text that is not a number", () => {
    expect(parseLatLon("north", "23.3")).toEqual({ ok: false, error: "number" });
    expect(parseLatLon("42.7N", "23.3E")).toEqual({ ok: false, error: "number" });
    expect(parseLatLon("1e2", "3")).toEqual({ ok: false, error: "number" });
  });

  it("never reads a comma as a decimal point", () => {
    expect(parseLatLon("42,7", "23,3")).toEqual({ ok: false, error: "number" });
  });

  it("refuses an empty box", () => {
    expect(parseLatLon("", "")).toEqual({ ok: false, error: "empty" });
    expect(parseLatLon("42.7", "   ")).toEqual({ ok: false, error: "empty" });
  });

  it("checks the latitude before the longitude, so the first message is the first problem", () => {
    expect(parseLatLon("95", "200")).toEqual({ ok: false, error: "lat" });
  });
});
