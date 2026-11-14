# References: every outside resource we use

For the "References" field of the NASA submission. **Add a row the first time a resource is used**, in the same commit. Research sources behind the conversion method are listed in [`conversion-plan.md`](conversion-plan.md), section 10.

## Data

| Resource | Used for | Link | Licence or terms |
|---|---|---|---|
| NASA FIRMS yearly country files: MODIS Collection 6.1 (Terra, Aqua), VIIRS 375 m (S-NPP, NOAA-20) | All fire detections, 2000 to 2025 | https://firms.modaps.eosdis.nasa.gov/data/country/ | NASA open data |
| NASA FIRMS active fire files, last 24 hours and 7 days (MODIS C6.1, VIIRS NOAA-20, VIIRS NOAA-21) | Recent fires layer | https://firms.modaps.eosdis.nasa.gov/data/active_fire/ | NASA open data, no key |
| Copernicus GWIS fire weather index (map service `ecmwf.fwi` and its legend) | Official fire danger layer, today to 9 days ahead | https://maps.effis.emergency.copernicus.eu/gwis | EFFIS WMS data: CC BY 4.0 for EU-owned content, subject to exceptions; GWIS endpoint-specific terms not found (D-4 below) |
| EFFIS statistics portal, estimates by country (the JSON behind the page: `statistics/v2/effis/estimatesbycountry`) | Satellite estimates of burned area and number of fires per year, 65 countries in Europe, the Middle East and North Africa | https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates | CC BY 4.0 per the EFFIS Data License page, https://forest-fire.emergency.copernicus.eu/about-effis/data-license; Copyright European Union, 1995-2025 |
| GWIS statistics portal, estimates by country (the JSON behind the page: `statistics/v2/gwis/estimatesbycountry`) | The same satellite estimates world-wide, 256 countries | https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates | CC BY 4.0 per the GWIS Data License page, https://gwis.jrc.ec.europa.eu/about-gwis/data-license; Copyright European Union, 1995-2025 |
| NIFC statistics, "Total Wildland Fires and Acres" (source the National Interagency Coordination Center) | What the USA reported: fires and acres per year, 1983 to 2025 | https://www.nifc.gov/fire-information/statistics/wildfires | Terms not stated; the site links only a disclaimer of liability, https://www.doi.gov/disclaimer |
| EFFIS annual report, Forest Fires in Europe, Middle East and North Africa 2024 (Table 1, Table 2 and annex Tables 101 to 104) | What national fire services reported, year by year: 31 countries, 1980 to 2024 | https://dx.doi.org/10.2760/0649290 | CC BY 4.0 per the report's own copyright page; Copyright European Union, 2025 |
| Executive Forest Agency of Bulgaria, annual report for 2025 | Checking Bulgaria's 2024 revision (565 fires on the same 171,164 decares) | https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf | Terms not stated on the source page |
| firms-catalog (public mirror of NASA FIRMS as GeoParquet) | Raw hotspots download | https://source.coop/portolan-mirrors/firms-catalog | Data CC0-1.0, code Apache-2.0 |
| OpenFreeMap street style (OpenMapTiles, OpenStreetMap data) | Streets base map | https://openfreemap.org | ODbL, credit OpenStreetMap contributors |
| Natural Earth admin-0 country borders | Country outlines in the preview | https://www.naturalearthdata.com/ | Public domain |
| NASA GFWED GEOS-5 fire-weather forecasts | Planned fire-weather input for next-day risk | https://data.giss.nasa.gov/impacts/gfwed/; [forecast files](https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/) | NASA open data; accessed 14 Nov 2026 |
| Natural Earth admin-1 regions | Planned regional boundaries for next-day risk | https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/ | Public domain; accessed 14 Nov 2026 |
| NASA MODIS MCD12C1 v061 | Planned land-cover shares for next-day risk | https://doi.org/10.5067/MODIS/MCD12C1.061 | NASA open data, LP DAAC; accessed 14 Nov 2026 |
| NASA MODIS MOD13C2 v061 | Planned monthly vegetation index for next-day risk | https://doi.org/10.5067/MODIS/MOD13C2.061 | NASA open data, LP DAAC; accessed 14 Nov 2026 |
| MODIS MCD12Q1 500 m global mosaic, Zenodo record 8367523 | Backup land-cover input | https://zenodo.org/records/8367523 | CC BY-SA 4.0; accessed 14 Nov 2026 |
| GFED4.1s basis regions; Global fire emissions estimates (2017), Earth System Science Data 9, 697 | Regional groups for the conversion | https://doi.org/10.5194/essd-9-697-2017; [data](https://daac.ornl.gov/VEGETATION/guides/fire_emissions_v4.html) | Paper CC BY 3.0; data terms not stated in the reference; accessed 14 Nov 2026 |
| NASA POWER daily point API | Historical daily meteorological estimates for point trends | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ | Free data; cite POWER and the service version and access date as requested in its [referencing guide](https://power.larc.nasa.gov/docs/referencing/) |
| Open-Meteo | Planned regional weather forecast | https://open-meteo.com/en/terms | Free for non-commercial use, subject to terms; accessed 14 Nov 2026 |
| NASA challenge page | Challenge text | https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ | Public |

## Fire-danger map reuse (D-4)

- The [EFFIS data and services page](https://forest-fire.emergency.copernicus.eu/applications/data-and-services) lists fire-danger forecasts and links to its licence. Its [download instructions](https://forest-fire.emergency.copernicus.eu/downloads-instructions) explicitly describe the EFFIS WMS and refer users to that licence `[V]`.
- The [EFFIS data licence](https://forest-fire.emergency.copernicus.eu/about-effis/data-license) says EU-owned website content is CC BY 4.0 unless otherwise indicated: "reuse is allowed, provided appropriate credit is given and changes are indicated" `[V]`. Third-party rights may require separate permission. The [GWIS data licence](https://gwis.jrc.ec.europa.eu/about-gwis/data-license) states the same condition for EU-owned website content `[V]`.
- The [CEMS citation guidelines](https://mapping.emergency.copernicus.eu/about/citation-guidelines/) describe open access and source attribution for CEMS information and maps `[V]`. The [JRC CEMS brochure legal notice](https://emergency.copernicus.eu/documents/1/CEMS_Brochure_2024.pdf) applies CC BY 4.0 to that document unless otherwise noted, with exceptions for third-party material `[V]`.
- These pages do not explicitly state a licence for the specific GWIS `/gwis` fire-danger WMS endpoint or its ECMWF layer. The EFFIS WMS instructions link the EFFIS data to its licence, but applying that statement to the GWIS endpoint is an inference `[U]`. Confirm any layer-specific third-party terms before treating CC BY 4.0 as settled for that endpoint. Sources accessed 14 Nov 2026.

**Proposed credit text for the app:** Copernicus Emergency Management Service, GWIS fire danger (© European Union). Source: https://gwis.jrc.ec.europa.eu/; changes, if any, are indicated.

## Software

| Resource | Used for | Link | Licence |
|---|---|---|---|
| DuckDB | Pipeline: cleaning and counting | https://duckdb.org | MIT |
| Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy, pytest | Pipeline: models, scoring, tests | https://www.python.org | BSD / MIT / Apache-2.0 / PSF |
| Poppler `pdftotext` | Reading the two national tables out of the EFFIS annual report | https://poppler.freedesktop.org | GPL-2.0 |
| MapLibre GL JS | Map and globe in the preview and the app | https://maplibre.org | BSD-3-Clause |
| Next.js | The app in `web/`: App Router, TypeScript, build and hosting | https://nextjs.org | MIT |
| React with React DOM | The app's interface | https://react.dev | MIT |
| TypeScript | Types across the app | https://www.typescriptlang.org | Apache-2.0 |
| Tailwind CSS | Styling in the app | https://tailwindcss.com | MIT |
| next-intl | English and Bulgarian text in the app | https://next-intl.dev | MIT |
| react-map-gl | React wrapper around MapLibre | https://visgl.github.io/react-map-gl/ | MIT |
| deck.gl (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`) | Fire cells, points and selection drawn over the map | https://deck.gl | MIT |
| Turf.js | Distance and point-in-polygon for area selection | https://turfjs.org | MIT |
| Terra Draw with its MapLibre adapter | Drawing an area on the map | https://terradraw.io | MIT |
| d3-scale | Scales for the custom SVG calendar and charts | https://d3js.org/d3-scale | ISC |
| Vitest | Unit tests | https://vitest.dev | MIT |
| Playwright | End to end tests | https://playwright.dev | Apache-2.0 |
| hyparquet with hyparquet-compressors | Reading the public hotspot files by area in the download route | https://github.com/hyparam/hyparquet | MIT |
| NASA GIBS imagery services | Base maps: Blue Marble and Black Marble | https://nasa-gibs.github.io/gibs-api-docs/ | NASA open data |
| Syne Bold (Google Fonts) | The "emerge" wordmark in the logo, converted to outlines, so the app loads no font file for it | https://fonts.google.com/specimen/Syne | SIL Open Font License 1.1 |

## Licence text

| Resource | Used for | Link |
|---|---|---|
| Apache License 2.0 | This repo's `LICENSE` | https://www.apache.org/licenses/LICENSE-2.0 |
