/**
 * Every outside resource the project uses, grouped by role for the About page.
 * This mirrors docs/references.md: a resource added there gets a row here,
 * and its "used for" sentence in messages/about.<locale>.json under `used.<id>`.
 * Names, links and licence wording stay in the resource's own words.
 */
export type Role = "model" | "record" | "map" | "app" | "compare" | "planned" | "experimental";
/** Where a row goes on NASA's submission form: NASA data, or space agency partner and other data. */
export type Section = "nasa" | "partner" | "other";
export type Source = {
  id: string;
  name: string;
  url: string;
  licence: string;
  provider?: string;
  roles?: Role[];
  section: Section;
  /** Shorter name for the form's Link Text, when `name` is too long. */
  linkText?: string;
  /** Public page for the form, when `url` is a data folder or terms page a browser cannot open usefully. */
  formUrl?: string;
  /** Listed on the data sources page only, not on About. */
  formOnly?: boolean;
};
/** `aliases` keep earlier section anchors such as /about#imagery working. */
export type SourceGroup = { id: string; aliases?: string[]; rows: Source[] };

const NASA = "NASA open data";
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";
const OFL = "SIL Open Font License 1.1";

export const sourceGroups: SourceGroup[] = [
  {
    id: "satellite",
    rows: [
      {
        id: "firmsCountry", section: "nasa", linkText: "NASA FIRMS archive: MODIS C6.1 and VIIRS 375 m fire detections", formUrl: "https://firms.modaps.eosdis.nasa.gov/country/",
        name: "NASA FIRMS yearly country files: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20)",
        url: "https://firms.modaps.eosdis.nasa.gov/data/country/",
        licence: NASA,
        provider: "NASA FIRMS",
        roles: ["record"],
      },
      {
        id: "firmsActive", section: "nasa", linkText: "NASA FIRMS active fires, last 24 hours and 7 days", formUrl: "https://firms.modaps.eosdis.nasa.gov/active_fire/",
        name: "NASA FIRMS active fire files, last 24 hours and 7 days (MODIS C6.1, VIIRS NOAA-20, VIIRS NOAA-21)",
        url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/",
        licence: "NASA open data, no key",
        provider: "NASA FIRMS",
        roles: ["map"],
      },
      {
        id: "firmsNoaa20", section: "nasa", linkText: "NASA FIRMS VIIRS NOAA-20 detections",
        name: "NASA FIRMS VIIRS NOAA-20 detections",
        url: "https://firms.modaps.eosdis.nasa.gov/",
        licence: NASA,
        provider: "NASA FIRMS",
        roles: ["model", "record"],
      },
      {
        id: "firmsCatalog", section: "nasa", linkText: "firms-catalog, public mirror of NASA FIRMS",
        name: "firms-catalog, a public mirror of NASA FIRMS as GeoParquet, on Source Cooperative",
        url: "https://source.coop/portolan-mirrors/firms-catalog",
        licence: "Data CC0-1.0, code Apache-2.0",
        provider: "Source Cooperative",
        roles: ["app"],
      },
    ],
  },
  {
    id: "weather",
    rows: [
      {
        id: "gfwed", section: "nasa", linkText: "NASA GFWED GEOS-5 fire-weather forecasts", formUrl: "https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/",
        name: "NASA GFWED GEOS-5 fire-weather forecasts",
        url: "https://data.giss.nasa.gov/impacts/gfwed/",
        licence: NASA,
        provider: "NASA GISS",
        roles: ["model", "compare"],
      },
      {
        id: "gwisFwi", section: "partner", linkText: "Copernicus GWIS fire weather index (ECMWF)", formUrl: "https://maps.effis.emergency.copernicus.eu/gwis",
        name: "Copernicus Emergency Management Service, GWIS fire danger (map service ecmwf.fwi), © European Union",
        url: "https://gwis.jrc.ec.europa.eu/",
        licence: "EFFIS data CC BY 4.0 for EU-owned content; terms for this map service still being checked",
        provider: "Copernicus EMS",
        roles: ["map"],
      },
      {
        id: "openMeteo", section: "other", linkText: "Open-Meteo weather forecasts", formUrl: "https://open-meteo.com",
        name: "Open-Meteo forecast API",
        url: "https://open-meteo.com/en/terms",
        licence: "Free for non-commercial use, attribution required",
        provider: "Open-Meteo",
        roles: ["map", "app"],
      },
      {
        id: "nasaPower", section: "nasa", linkText: "NASA POWER daily weather API",
        name: "NASA POWER daily point API, NASA Langley Research Center",
        url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
        licence: "Free data; cite POWER with its version and access date",
        provider: "NASA Langley",
        roles: ["app"],
      },
      {
        id: "imerg", section: "nasa", linkText: "NASA GPM IMERG precipitation via GIBS",
        name: "NASA GPM IMERG precipitation rate, via NASA GIBS",
        url: GIBS,
        licence: NASA,
        provider: "NASA GIBS",
        roles: ["map"],
      },
    ],
  },
  {
    id: "land",
    aliases: ["planned"],
    rows: [
      {
        id: "smap", section: "nasa", linkText: "NASA SMAP soil moisture via GIBS",
        name: "NASA SMAP soil moisture, via NASA GIBS",
        url: GIBS,
        licence: NASA,
        provider: "NASA GIBS",
        roles: ["map"],
      },
      {
        id: "ndvi", section: "nasa", linkText: "NOAA-20 VIIRS NDVI (greenness) via NASA GIBS",
        name: "NOAA-20 VIIRS NDVI (plant greenness), via NASA GIBS",
        url: GIBS,
        licence: NASA,
        provider: "NASA GIBS",
        roles: ["map"],
      },
      {
        id: "landCoverGibs", section: "nasa", linkText: "NASA MODIS land cover (IGBP) via GIBS",
        name: "NASA MODIS annual IGBP land cover, via NASA GIBS",
        url: GIBS,
        licence: NASA,
        provider: "NASA GIBS",
        roles: ["map"],
      },
      {
        id: "mcd12q1", section: "nasa", linkText: "NASA MODIS MCD12Q1 land cover, 500 m mosaic",
        name: "MODIS MCD12Q1 500 m global land-cover mosaic, Zenodo record 8367523",
        url: "https://zenodo.org/records/8367523",
        licence: "CC BY-SA 4.0",
        provider: "Zenodo",
        roles: ["model"],
      },
      {
        id: "mcd12c1", section: "nasa",
        name: "NASA MODIS MCD12C1 v061 land-cover shares",
        url: "https://doi.org/10.5067/MODIS/MCD12C1.061",
        licence: "NASA open data, LP DAAC",
        provider: "NASA LP DAAC",
        roles: ["planned"],
      },
      {
        id: "mod13c2", section: "nasa",
        name: "NASA MODIS MOD13C2 v061 monthly vegetation index",
        url: "https://doi.org/10.5067/MODIS/MOD13C2.061",
        licence: "NASA open data, LP DAAC",
        provider: "NASA LP DAAC",
        roles: ["planned"],
      },
    ],
  },
  {
    id: "maps",
    aliases: ["imagery", "boundaries"],
    rows: [
      {
        id: "gibsBase", section: "nasa", linkText: "NASA GIBS Blue Marble and Black Marble base maps",
        name: "NASA GIBS imagery services: Blue Marble and Black Marble",
        url: "https://nasa-gibs.github.io/gibs-api-docs/",
        licence: NASA,
        provider: "NASA GIBS",
        roles: ["map"],
      },
      {
        id: "openFreeMap", section: "other", linkText: "OpenFreeMap street map (OpenStreetMap data)",
        name: "OpenFreeMap street style, OpenMapTiles schema, OpenStreetMap data",
        url: "https://openfreemap.org",
        licence: "ODbL, © OpenStreetMap contributors",
        provider: "OpenFreeMap",
        roles: ["map"],
      },
      {
        id: "photon", section: "other", linkText: "Photon place search (OpenStreetMap data)",
        name: "Photon place search, with OpenStreetMap data",
        url: "https://photon.komoot.io",
        licence: "Data ODbL, © OpenStreetMap contributors",
        provider: "komoot",
        roles: ["app"],
      },
      {
        id: "admin0", section: "other", linkText: "Natural Earth country borders",
        name: "Natural Earth admin-0 country borders",
        url: "https://www.naturalearthdata.com/",
        licence: "Public domain",
        provider: "Natural Earth",
        roles: ["map"],
      },
      {
        id: "admin1", section: "other", linkText: "Natural Earth regions (admin-1)",
        name: "Natural Earth admin-1 states and provinces",
        url: "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/",
        licence: "Public domain",
        provider: "Natural Earth",
        roles: ["model"],
      },
      {
        id: "gfed", section: "other", linkText: "GFED4.1s fire regions (Earth System Science Data, 2017)",
        name: "GFED4.1s basis regions, from Global fire emissions estimates (2017), Earth System Science Data 9, 697",
        url: "https://doi.org/10.5194/essd-9-697-2017",
        licence: "Paper CC BY 3.0; data terms not stated",
        provider: "GFED",
        roles: ["record"],
      },
    ],
  },
  {
    id: "reported",
    rows: [
      {
        id: "effisStats", section: "partner", linkText: "Copernicus EFFIS statistics: burned-area estimates by country",
        name: "EFFIS statistics portal, estimates by country",
        url: "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates",
        licence: "CC BY 4.0, © European Union 1995-2025",
        provider: "EFFIS",
        roles: ["compare"],
      },
      {
        id: "gwisStats", section: "partner", linkText: "Copernicus GWIS statistics: estimates by country",
        name: "GWIS statistics portal, estimates by country",
        url: "https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates",
        licence: "CC BY 4.0, © European Union 1995-2025",
        provider: "GWIS",
        roles: ["compare"],
      },
      {
        id: "effisReport", section: "partner", linkText: "EFFIS annual report: Forest Fires in Europe, Middle East and North Africa 2024", formUrl: "https://doi.org/10.2760/0649290",
        name: "EFFIS annual report: Forest Fires in Europe, Middle East and North Africa 2024",
        url: "https://dx.doi.org/10.2760/0649290",
        licence: "CC BY 4.0, © European Union 2025",
        provider: "EFFIS",
        roles: ["compare"],
      },
      {
        id: "nifc", section: "other", linkText: "NIFC wildfire statistics, USA",
        name: "NIFC statistics: Total Wildland Fires and Acres (National Interagency Coordination Center)",
        url: "https://www.nifc.gov/fire-information/statistics/wildfires",
        licence: "Terms not stated; United States government",
        provider: "NIFC",
        roles: ["compare"],
      },
      {
        id: "iag", section: "other", linkText: "Executive Forest Agency of Bulgaria, 2025 annual report",
        name: "Executive Forest Agency of Bulgaria, annual report for 2025",
        url: "https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf",
        licence: "Terms not stated",
        provider: "Executive Forest Agency",
        roles: ["compare"],
      },
    ],
  },
  {
    id: "software",
    rows: [
      { id: "nextjs", section: "other", linkText: "Next.js", name: "Next.js", url: "https://nextjs.org", licence: "MIT" },
      { id: "react", section: "other", linkText: "React", name: "React and React DOM", url: "https://react.dev", licence: "MIT" },
      { id: "typescript", section: "other", linkText: "TypeScript", name: "TypeScript", url: "https://www.typescriptlang.org", licence: "Apache-2.0" },
      { id: "tailwind", section: "other", linkText: "Tailwind CSS", name: "Tailwind CSS", url: "https://tailwindcss.com", licence: "MIT" },
      { id: "nextIntl", section: "other", linkText: "next-intl", name: "next-intl", url: "https://next-intl.dev", licence: "MIT" },
      { id: "maplibre", section: "other", linkText: "MapLibre GL JS", name: "MapLibre GL JS", url: "https://maplibre.org", licence: "BSD-3-Clause" },
      { id: "reactMapGl", section: "other", linkText: "react-map-gl", name: "react-map-gl", url: "https://visgl.github.io/react-map-gl/", licence: "MIT" },
      { id: "deckgl", section: "other", linkText: "deck.gl", name: "deck.gl", url: "https://deck.gl", licence: "MIT" },
      { id: "turf", section: "other", linkText: "Turf.js", name: "Turf.js", url: "https://turfjs.org", licence: "MIT" },
      { id: "terraDraw", section: "other", linkText: "Terra Draw", name: "Terra Draw with its MapLibre adapter", url: "https://terradraw.io", licence: "MIT" },
      { id: "d3scale", section: "other", linkText: "d3-scale", name: "d3-scale", url: "https://d3js.org/d3-scale", licence: "ISC" },
      {
        id: "hyparquet", section: "other", linkText: "hyparquet",
        name: "hyparquet with hyparquet-compressors",
        url: "https://github.com/hyparam/hyparquet",
        licence: "MIT",
      },
      { id: "duckdb", section: "other", linkText: "DuckDB", name: "DuckDB", url: "https://duckdb.org", licence: "MIT" },
      {
        id: "python", section: "other", linkText: "Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy and pytest",
        name: "Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy and pytest",
        url: "https://www.python.org",
        licence: "BSD, MIT, Apache-2.0 and PSF",
      },
      { id: "poppler", section: "other", linkText: "Poppler pdftotext", name: "Poppler pdftotext", url: "https://poppler.freedesktop.org", licence: "GPL-2.0" },
      { id: "vitest", section: "other", linkText: "Vitest", name: "Vitest", url: "https://vitest.dev", licence: "MIT" },
      { id: "playwright", section: "other", linkText: "Playwright", name: "Playwright", url: "https://playwright.dev", licence: "Apache-2.0" },
    ],
  },
  {
    id: "fonts",
    rows: [
      {
        id: "appFonts", section: "other", linkText: "Google Fonts: Familjen Grotesk, Public Sans, Newsreader, IBM Plex", formUrl: "https://fonts.google.com",
        name: "Familjen Grotesk, Public Sans, Newsreader, IBM Plex Sans Condensed and IBM Plex Mono, served by Google Fonts",
        url: "https://fonts.google.com/",
        licence: OFL,
        provider: "Google Fonts",
      },
      {
        id: "syne", section: "other", linkText: "Syne Bold (logo wordmark)",
        name: "Syne Bold",
        url: "https://fonts.google.com/specimen/Syne",
        licence: OFL,
        provider: "Google Fonts",
      },
    ],
  },
  {
    id: "experimental",
    rows: [
      {
        id: "worldCover", section: "partner", linkText: "ESA WorldCover (experimental engine)",
        name: "ESA WorldCover",
        url: "https://esa-worldcover.org",
        licence: "CC BY 4.0, © ESA WorldCover, modified Copernicus Sentinel data",
        provider: "ESA",
        roles: ["experimental"],
      },
      {
        id: "copernicusDem", section: "partner", linkText: "Copernicus DEM (experimental engine)",
        name: "Copernicus DEM",
        url: "https://registry.opendata.aws/copernicus-dem/",
        licence: "Free licence with attribution",
        provider: "Copernicus",
        roles: ["experimental"],
      },
      {
        id: "geoBoundaries", section: "other", linkText: "geoBoundaries gbOpen (experimental engine)",
        name: "geoBoundaries gbOpen",
        url: "https://www.geoboundaries.org",
        licence: "CC BY 4.0",
        provider: "geoBoundaries",
        roles: ["experimental"],
      },
      {
        id: "metNorway", section: "other", linkText: "MET Norway Locationforecast (experimental engine)",
        name: "MET Norway Locationforecast",
        url: "https://api.met.no/weatherapi/locationforecast/2.0/documentation",
        licence: "CC BY 4.0 and NLOD 2.0, © MET Norway",
        provider: "MET Norway",
        roles: ["experimental"],
      },
      {
        id: "noaaIndices", section: "other", linkText: "NOAA climate indices (experimental engine)", formUrl: "https://www.cpc.ncep.noaa.gov/",
        name: "NOAA climate indices",
        url: "https://psl.noaa.gov/data/timeseries/month/",
        licence: "United States government data",
        provider: "NOAA",
        roles: ["experimental"],
      },
      {
        id: "experimentalSoftware", section: "other", linkText: "xclim, XGBoost, PyTorch, rasterio and Shapely (experimental engine)", formUrl: "https://xgboost.ai/",
        name: "xclim, XGBoost, PyTorch, rasterio and Shapely",
        url: "https://xclim.readthedocs.io/",
        licence: "Apache-2.0 or BSD-3-Clause",
        provider: "Open source",
        roles: ["experimental"],
      },
    ],
  },
  {
    id: "video",
    rows: [
      {
        id: "remotion", section: "other", linkText: "Remotion (demo video)",
        name: "Remotion",
        url: "https://www.remotion.dev",
        licence: "Remotion licence, free for individuals and small teams",
        provider: "Remotion",
      },
      {
        id: "elevenlabs", section: "other", linkText: "ElevenLabs voice and music (demo video)",
        name: "ElevenLabs voice and music",
        url: "https://elevenlabs.io",
        licence: "Paid plan, commercial use allowed",
        provider: "ElevenLabs",
      },
      {
        id: "videoFonts", section: "other", linkText: "Google Fonts: Familjen Grotesk and IBM Plex Mono (demo video)",
        name: "Familjen Grotesk and IBM Plex Mono, Google Fonts",
        url: "https://fonts.google.com",
        licence: OFL,
        provider: "Google Fonts",
      },
    ],
  },
  {
    id: "project",
    rows: [
      {
        id: "challenge", section: "nasa", linkText: "NASA Space Apps 2026 challenge: Harmonization of MODIS and VIIRS Hot Spots",
        name: "NASA Space Apps Challenge 2026: Harmonization of MODIS and VIIRS Hot Spots",
        url: "https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/",
        licence: "Public",
        provider: "NASA Space Apps",
      },
      {
        id: "aiAssistants", section: "other", formOnly: true, linkText: "Claude Code, AI coding assistant (see our AI-usage note)",
        name: "Claude Code, an AI coding assistant, used to write and test code (see the AI-usage note)",
        url: "https://www.anthropic.com/claude-code",
        licence: "Anthropic terms of service",
        provider: "Anthropic",
      },
      {
        id: "repoLicence", section: "other", linkText: "Emerge source code (Apache 2.0)", formUrl: "https://github.com/hristian7/NASA_Space_Apps_Emerge",
        name: "This project's code",
        url: "https://www.apache.org/licenses/LICENSE-2.0",
        licence: "Apache License 2.0",
        provider: "Apache Software Foundation",
      },
    ],
  },
];

export const roleOrder: Role[] = ["model", "record", "map", "app", "compare", "planned", "experimental"];

/** The data sources page's sub-headings, in page order. */
export type FormGroup = "nasa" | "partner" | "data" | "software" | "tools";
export const formGroupOrder: FormGroup[] = ["nasa", "partner", "data", "software", "tools"];
export type FormRow = { id: string; linkText: string; url: string; provider?: string; group: FormGroup; experimental: boolean };

const toolGroups = new Set(["fonts", "video", "project"]);

function groupOf(row: Source, groupId: string): FormGroup {
  if (row.section === "nasa") return "nasa";
  if (row.section === "partner") return "partner";
  if (groupId === "software" || row.id === "experimentalSoftware") return "software";
  if (toolGroups.has(groupId)) return "tools";
  return "data";
}

/** Every used resource as the form wants it, in register order. Planned resources are left out. */
export const allFormRows: FormRow[] = sourceGroups.flatMap((group) =>
  group.rows
    .filter((row) => !row.roles?.includes("planned"))
    .map((row) => ({
      id: row.id,
      linkText: row.linkText ?? row.name,
      url: row.formUrl ?? row.url,
      provider: row.provider,
      group: groupOf(row, group.id),
      experimental: row.roles?.includes("experimental") ?? false,
    })),
);

/** One section of the form: NASA data, or partner and other data together when `section` is "other". */
export function formRows(section: Section): FormRow[] {
  return allFormRows
    .filter((row) => (section === "nasa" ? row.group === "nasa" : section === "partner" ? row.group === "partner" : row.group !== "nasa"))
    .sort((a, b) => formGroupOrder.indexOf(a.group) - formGroupOrder.indexOf(b.group));
}

/** What the copy button puts on the clipboard: one `Link Text<TAB>URL` line per row. */
export function formText(rows: readonly FormRow[]): string {
  return rows.map((row) => `${row.linkText}\t${row.url}`).join("\n");
}
