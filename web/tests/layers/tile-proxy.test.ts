import { describe, expect, it } from "vitest";
import { LAYERS, layerUrl } from "../../src/config/layers";
import { gibsOrigin, gibsUpstream, proxiedGibsLayers, proxyTileUrl, tileProxyPath } from "../../src/lib/layers/tile-proxy";

const rain = LAYERS.find((entry) => entry.id === "rain")!;
const fwi = LAYERS.find((entry) => entry.id === "nasa-fwi")!;

describe("GIBS tile route", () => {
  it("covers every GIBS data layer in the registry", () => {
    expect([...proxiedGibsLayers].sort()).toEqual([
      "IMERG_Precipitation_Rate",
      "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual",
      "OMPS_NOAA20_NadirMapper_AerosolIndex_380",
      "SMAP_L3_Passive_Enhanced_Day_Soil_Moisture",
      "VIIRS_NOAA20_NDVI_8Day",
    ]);
  });

  it("sends a data layer's template through the route, keeping layer, date and tile placeholders", () => {
    const template = layerUrl(rain.source, "2026-11-13")!;
    expect(proxyTileUrl(template)).toBe(
      `${tileProxyPath}IMERG_Precipitation_Rate/default/2026-11-13/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
    );
  });

  it("leaves other hosts and the base map alone", () => {
    const effis = layerUrl(fwi.source, "2026-11-15")!;
    expect(proxyTileUrl(effis)).toBe(effis);
    const base = `${gibsOrigin}BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`;
    expect(proxyTileUrl(base)).toBe(base);
  });

  it("maps a requested tile back to the exact GIBS address", () => {
    expect(gibsUpstream(["IMERG_Precipitation_Rate", "default", "2026-11-13", "GoogleMapsCompatible_Level6", "3", "2", "5.png"])).toBe(
      `${gibsOrigin}IMERG_Precipitation_Rate/default/2026-11-13/GoogleMapsCompatible_Level6/3/2/5.png`,
    );
  });

  it("refuses layers and paths that are not ours", () => {
    expect(gibsUpstream(["BlueMarble_ShadedRelief_Bathymetry", "default", "default", "GoogleMapsCompatible_Level8", "1", "0", "0.jpeg"])).toBeNull();
    expect(gibsUpstream(["IMERG_Precipitation_Rate", "default", "2026-11-13", "GoogleMapsCompatible_Level6", "..", "..", "x.png"])).toBeNull();
    expect(gibsUpstream(["IMERG_Precipitation_Rate", "default", "2026-11-13", "GoogleMapsCompatible_Level6", "{z}", "{y}", "{x}.png"])).toBeNull();
    expect(gibsUpstream(["IMERG_Precipitation_Rate"])).toBeNull();
    expect(gibsUpstream([])).toBeNull();
  });
});
