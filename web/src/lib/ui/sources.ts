/**
 * Every outside resource the project uses, grouped for the About page.
 * This mirrors docs/references.md: a resource added there gets a row here,
 * and its "used for" sentence in messages/about.<locale>.json under `used.<id>`.
 * Names, links and licence wording stay in the resource's own words.
 */
export type Source = { id: string; name: string; url: string; licence: string };
export type SourceGroup = { id: string; rows: Source[] };

const NASA = "NASA open data";
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";
const OFL = "SIL Open Font License 1.1";

export const sourceGroups: SourceGroup[] = [
  {
    id: "satellite",
    rows: [
      {
        id: "firmsCountry",
        name: "NASA FIRMS yearly country files: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20)",
        url: "https://firms.modaps.eosdis.nasa.gov/data/country/",
        licence: NASA,
      },
      {
        id: "firmsActive",
        name: "NASA FIRMS active fire files, last 24 hours and 7 days (MODIS C6.1, VIIRS NOAA-20, VIIRS NOAA-21)",
        url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/",
        licence: "NASA open data, no key",
      },
      {
        id: "firmsNoaa20",
        name: "NASA FIRMS VIIRS NOAA-20 detections",
        url: "https://firms.modaps.eosdis.nasa.gov/",
        licence: NASA,
      },
      {
        id: "firmsCatalog",
        name: "firms-catalog, a public mirror of NASA FIRMS as GeoParquet, on Source Cooperative",
        url: "https://source.coop/portolan-mirrors/firms-catalog",
        licence: "Data CC0-1.0, code Apache-2.0",
      },
    ],
  },
  {
    id: "weather",
    rows: [
      {
        id: "gfwed",
        name: "NASA GFWED GEOS-5 fire-weather forecasts",
        url: "https://data.giss.nasa.gov/impacts/gfwed/",
        licence: NASA,
      },
      {
        id: "gwisFwi",
        name: "Copernicus Emergency Management Service, GWIS fire danger (map service ecmwf.fwi), © European Union",
        url: "https://gwis.jrc.ec.europa.eu/",
        licence: "EFFIS data CC BY 4.0 for EU-owned content; terms for this map service still being checked",
      },
      {
        id: "openMeteo",
        name: "Open-Meteo forecast API",
        url: "https://open-meteo.com/en/terms",
        licence: "Free for non-commercial use, attribution required",
      },
      {
        id: "nasaPower",
        name: "NASA POWER daily point API, NASA Langley Research Center",
        url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
        licence: "Free data; cite POWER with its version and access date",
      },
    ],
  },
  {
    id: "imagery",
    rows: [
      {
        id: "gibsBase",
        name: "NASA GIBS imagery services: Blue Marble and Black Marble",
        url: "https://nasa-gibs.github.io/gibs-api-docs/",
        licence: NASA,
      },
      { id: "imerg", name: "NASA GPM IMERG precipitation rate, via NASA GIBS", url: GIBS, licence: NASA },
      { id: "smap", name: "NASA SMAP soil moisture, via NASA GIBS", url: GIBS, licence: NASA },
      { id: "ndvi", name: "NOAA-20 VIIRS NDVI (plant greenness), via NASA GIBS", url: GIBS, licence: NASA },
      { id: "landCoverGibs", name: "NASA MODIS annual IGBP land cover, via NASA GIBS", url: GIBS, licence: NASA },
      {
        id: "mcd12q1",
        name: "MODIS MCD12Q1 500 m global land-cover mosaic, Zenodo record 8367523",
        url: "https://zenodo.org/records/8367523",
        licence: "CC BY-SA 4.0",
      },
      {
        id: "openFreeMap",
        name: "OpenFreeMap street style, OpenMapTiles schema, OpenStreetMap data",
        url: "https://openfreemap.org",
        licence: "ODbL, © OpenStreetMap contributors",
      },
      {
        id: "photon",
        name: "Photon place search, with OpenStreetMap data",
        url: "https://photon.komoot.io",
        licence: "Data ODbL, © OpenStreetMap contributors",
      },
    ],
  },
  {
    id: "boundaries",
    rows: [
      {
        id: "admin0",
        name: "Natural Earth admin-0 country borders",
        url: "https://www.naturalearthdata.com/",
        licence: "Public domain",
      },
      {
        id: "admin1",
        name: "Natural Earth admin-1 states and provinces",
        url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
        licence: "Public domain",
      },
      {
        id: "gfed",
        name: "GFED4.1s basis regions, from Global fire emissions estimates (2017), Earth System Science Data 9, 697",
        url: "https://doi.org/10.5194/essd-9-697-2017",
        licence: "Paper CC BY 3.0; data terms not stated",
      },
    ],
  },
  {
    id: "reported",
    rows: [
      {
        id: "effisStats",
        name: "EFFIS statistics portal, estimates by country",
        url: "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates",
        licence: "CC BY 4.0, © European Union 1995-2025",
      },
      {
        id: "gwisStats",
        name: "GWIS statistics portal, estimates by country",
        url: "https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates",
        licence: "CC BY 4.0, © European Union 1995-2025",
      },
      {
        id: "effisReport",
        name: "EFFIS annual report: Forest Fires in Europe, Middle East and North Africa 2024",
        url: "https://dx.doi.org/10.2760/0649290",
        licence: "CC BY 4.0, © European Union 2025",
      },
      {
        id: "nifc",
        name: "NIFC statistics: Total Wildland Fires and Acres (National Interagency Coordination Center)",
        url: "https://www.nifc.gov/fire-information/statistics/wildfires",
        licence: "Terms not stated; United States government",
      },
      {
        id: "iag",
        name: "Executive Forest Agency of Bulgaria, annual report for 2025",
        url: "https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf",
        licence: "Terms not stated",
      },
    ],
  },
  {
    id: "planned",
    rows: [
      {
        id: "mcd12c1",
        name: "NASA MODIS MCD12C1 v061 land-cover shares",
        url: "https://doi.org/10.5067/MODIS/MCD12C1.061",
        licence: "NASA open data, LP DAAC",
      },
      {
        id: "mod13c2",
        name: "NASA MODIS MOD13C2 v061 monthly vegetation index",
        url: "https://doi.org/10.5067/MODIS/MOD13C2.061",
        licence: "NASA open data, LP DAAC",
      },
    ],
  },
  {
    id: "experimental",
    rows: [
      {
        id: "worldCover",
        name: "ESA WorldCover",
        url: "https://esa-worldcover.org",
        licence: "CC BY 4.0, © ESA WorldCover, modified Copernicus Sentinel data",
      },
      {
        id: "copernicusDem",
        name: "Copernicus DEM",
        url: "https://registry.opendata.aws/copernicus-dem/",
        licence: "Free licence with attribution",
      },
      { id: "geoBoundaries", name: "geoBoundaries gbOpen", url: "https://www.geoboundaries.org", licence: "CC BY 4.0" },
      {
        id: "metNorway",
        name: "MET Norway Locationforecast",
        url: "https://api.met.no/weatherapi/locationforecast/2.0/documentation",
        licence: "CC BY 4.0 and NLOD 2.0, © MET Norway",
      },
      {
        id: "noaaIndices",
        name: "NOAA climate indices",
        url: "https://psl.noaa.gov/data/timeseries/month/",
        licence: "United States government data",
      },
      {
        id: "experimentalSoftware",
        name: "xclim, XGBoost, PyTorch, rasterio and Shapely",
        url: "https://xclim.readthedocs.io/",
        licence: "Apache-2.0 or BSD-3-Clause",
      },
    ],
  },
  {
    id: "software",
    rows: [
      { id: "nextjs", name: "Next.js", url: "https://nextjs.org", licence: "MIT" },
      { id: "react", name: "React and React DOM", url: "https://react.dev", licence: "MIT" },
      { id: "typescript", name: "TypeScript", url: "https://www.typescriptlang.org", licence: "Apache-2.0" },
      { id: "tailwind", name: "Tailwind CSS", url: "https://tailwindcss.com", licence: "MIT" },
      { id: "nextIntl", name: "next-intl", url: "https://next-intl.dev", licence: "MIT" },
      { id: "maplibre", name: "MapLibre GL JS", url: "https://maplibre.org", licence: "BSD-3-Clause" },
      { id: "reactMapGl", name: "react-map-gl", url: "https://visgl.github.io/react-map-gl/", licence: "MIT" },
      { id: "deckgl", name: "deck.gl", url: "https://deck.gl", licence: "MIT" },
      { id: "turf", name: "Turf.js", url: "https://turfjs.org", licence: "MIT" },
      { id: "terraDraw", name: "Terra Draw with its MapLibre adapter", url: "https://terradraw.io", licence: "MIT" },
      { id: "d3scale", name: "d3-scale", url: "https://d3js.org/d3-scale", licence: "ISC" },
      {
        id: "hyparquet",
        name: "hyparquet with hyparquet-compressors",
        url: "https://github.com/hyparam/hyparquet",
        licence: "MIT",
      },
      { id: "duckdb", name: "DuckDB", url: "https://duckdb.org", licence: "MIT" },
      {
        id: "python",
        name: "Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy and pytest",
        url: "https://www.python.org",
        licence: "BSD, MIT, Apache-2.0 and PSF",
      },
      { id: "poppler", name: "Poppler pdftotext", url: "https://poppler.freedesktop.org", licence: "GPL-2.0" },
      { id: "vitest", name: "Vitest", url: "https://vitest.dev", licence: "MIT" },
      { id: "playwright", name: "Playwright", url: "https://playwright.dev", licence: "Apache-2.0" },
    ],
  },
  {
    id: "fonts",
    rows: [
      {
        id: "appFonts",
        name: "Familjen Grotesk, Public Sans, Newsreader, IBM Plex Sans Condensed and IBM Plex Mono, served by Google Fonts",
        url: "https://fonts.google.com/",
        licence: OFL,
      },
      { id: "syne", name: "Syne Bold", url: "https://fonts.google.com/specimen/Syne", licence: OFL },
    ],
  },
  {
    id: "video",
    rows: [
      {
        id: "remotion",
        name: "Remotion",
        url: "https://www.remotion.dev",
        licence: "Remotion licence, free for individuals and small teams",
      },
      {
        id: "elevenlabs",
        name: "ElevenLabs voice and music",
        url: "https://elevenlabs.io",
        licence: "Paid plan, commercial use allowed",
      },
      {
        id: "videoFonts",
        name: "Familjen Grotesk and IBM Plex Mono, Google Fonts",
        url: "https://fonts.google.com",
        licence: OFL,
      },
    ],
  },
  {
    id: "project",
    rows: [
      {
        id: "challenge",
        name: "NASA Space Apps Challenge 2026: Harmonization of MODIS and VIIRS Hot Spots",
        url: "https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/",
        licence: "Public",
      },
      {
        id: "repoLicence",
        name: "This project's code",
        url: "https://www.apache.org/licenses/LICENSE-2.0",
        licence: "Apache License 2.0",
      },
    ],
  },
];
