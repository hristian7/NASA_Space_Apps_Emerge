/**
 * Sources and credits shown on the About page, taken from docs/references.md.
 * Names, links and licence names are not translated: they are the resources'
 * own wording. A new resource is one new row here and one row there.
 */
export type Credit = { name: string; url: string; licence: string };

export const dataCredits: Credit[] = [
  {
    name: "NASA FIRMS fire detections: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20, NOAA-21)",
    url: "https://firms.modaps.eosdis.nasa.gov/",
    licence: "NASA open data",
  },
  {
    name: "firms-catalog hotspot archive on Source Cooperative",
    url: "https://source.coop/",
    licence: "Data CC0-1.0, catalogue code Apache-2.0",
  },
  {
    name: "NASA GIBS imagery services: Blue Marble and Black Marble base maps",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    licence: "NASA open data",
  },
  {
    name: "OpenFreeMap tiles, OpenMapTiles schema, OpenStreetMap data",
    url: "https://openfreemap.org/",
    licence: "ODbL, credit OpenStreetMap contributors",
  },
  {
    name: "Copernicus GWIS fire weather index service",
    url: "https://gwis.jrc.ec.europa.eu/",
    licence: "Copernicus terms, licence point still being checked",
  },
  {
    name: "EFFIS reported fires and burned area, European countries",
    url: "https://forest-fire.emergency.copernicus.eu/",
    licence: "Copernicus terms",
  },
  {
    name: "NIFC fire statistics and outlooks, United States",
    url: "https://www.nifc.gov/",
    licence: "United States government, public domain",
  },
  {
    name: "Natural Earth admin-0 country borders",
    url: "https://www.naturalearthdata.com/",
    licence: "Public domain",
  },
  {
    name: "NASA Space Apps challenge page: harmonization of MODIS and VIIRS hot spots",
    url: "https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/",
    licence: "Public",
  },
];

export const softwareCredits: Credit[] = [
  { name: "Next.js", url: "https://nextjs.org", licence: "MIT" },
  { name: "React and React DOM", url: "https://react.dev", licence: "MIT" },
  { name: "TypeScript", url: "https://www.typescriptlang.org", licence: "Apache-2.0" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", licence: "MIT" },
  { name: "next-intl", url: "https://next-intl.dev", licence: "MIT" },
  { name: "MapLibre GL JS", url: "https://maplibre.org", licence: "BSD-3-Clause" },
  { name: "Terra Draw with its MapLibre adapter", url: "https://terradraw.io", licence: "MIT" },
  { name: "deck.gl", url: "https://deck.gl", licence: "MIT" },
  { name: "Turf.js", url: "https://turfjs.org", licence: "MIT" },
  { name: "d3-scale", url: "https://d3js.org/d3-scale", licence: "ISC" },
  { name: "hyparquet with hyparquet-compressors", url: "https://github.com/hyparam/hyparquet", licence: "MIT" },
  { name: "DuckDB", url: "https://duckdb.org", licence: "MIT" },
  {
    name: "Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy and pytest",
    url: "https://www.python.org",
    licence: "BSD, MIT, Apache-2.0 and PSF",
  },
  { name: "Vitest", url: "https://vitest.dev", licence: "MIT" },
  { name: "Playwright", url: "https://playwright.dev", licence: "Apache-2.0" },
  {
    name: "Familjen Grotesk, Public Sans, Newsreader, IBM Plex Sans Condensed and IBM Plex Mono, served by Google Fonts",
    url: "https://fonts.google.com/",
    licence: "SIL Open Font License 1.1",
  },
];

/** Official services, shown with the disclaimer wherever risk is on screen. */
export const officialServices: { key: string; url: string }[] = [
  {
    key: "linkEffis",
    url: "https://forest-fire.emergency.copernicus.eu/apps/effis.current.situation/",
  },
  { key: "linkGwis", url: "https://gwis.jrc.ec.europa.eu/apps/gwis.current.situation/" },
  { key: "linkNifc", url: "https://www.nifc.gov/nicc/predictive-services/outlooks" },
  { key: "linkNimh", url: "https://meteo.bg/" },
];
