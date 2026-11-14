/**
 * Base map registry. One entry per map the globe and the 2D map can show.
 * A new base map is one new entry here, nothing else.
 *
 * `tiles` holds raster tile URL templates for a MapLibre raster source.
 * `style` holds a full MapLibre style URL instead, for vector base maps.
 * Exactly one of the two is set.
 *
 * `verified: true` means the tile template was requested and answered with
 * the expected image. `verified: false` means it still has to be checked.
 */

export type RasterBasemap = {
  id: string;
  /** Key in the message files, under the `basemaps` namespace. */
  nameKey: string;
  tiles: string[];
  tileSize: number;
  minzoom: number;
  maxzoom: number;
  attribution: string;
  verified: boolean;
  style?: never;
};

export type VectorBasemap = {
  id: string;
  nameKey: string;
  style: string;
  attribution: string;
  verified: boolean;
  tiles?: never;
};

export type Basemap = RasterBasemap | VectorBasemap;

/**
 * NASA Global Imagery Browse Services (GIBS) serves these templates openly,
 * with no key and no account. Documentation:
 * https://nasa-gibs.github.io/gibs-api-docs/access-basics/
 */
export const basemaps: Basemap[] = [
  {
    id: "gibs-blue-marble",
    nameKey: "blueMarble",
    tiles: [
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    ],
    tileSize: 256,
    minzoom: 0,
    maxzoom: 8,
    attribution:
      "Imagery from NASA Global Imagery Browse Services (GIBS), part of NASA ESDIS",
    verified: true,
  },
  {
    id: "gibs-black-marble",
    nameKey: "blackMarble",
    tiles: [
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
    ],
    tileSize: 256,
    minzoom: 0,
    maxzoom: 8,
    attribution:
      "Imagery from NASA Global Imagery Browse Services (GIBS), part of NASA ESDIS",
    verified: true,
  },
  {
    // Vector street map, tested on the globe in risk spike (c). The globe
    // view has to be set again after this style loads.
    id: "openfreemap-liberty",
    nameKey: "streets",
    style: "https://tiles.openfreemap.org/styles/liberty",
    attribution:
      "Tiles by OpenFreeMap, schema by OpenMapTiles, data from OpenStreetMap contributors (ODbL)",
    verified: true,
  },
];

export const defaultBasemapId = basemaps[0].id;

export function getBasemap(id: string): Basemap | undefined {
  return basemaps.find((basemap) => basemap.id === id);
}
