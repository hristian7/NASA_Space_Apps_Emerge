# References: every outside resource we use

For the "References" field of the NASA submission. **Add a row the first time a resource is used**, in the same commit. Research sources behind the conversion method are listed in [`conversion-plan.md`](conversion-plan.md), section 10.

## Data

| Resource | Used for | Link | Licence or terms |
|---|---|---|---|
| NASA FIRMS yearly country files: MODIS Collection 6.1 (Terra, Aqua), VIIRS 375 m (S-NPP, NOAA-20) | All fire detections, 2000 to 2025 | https://firms.modaps.eosdis.nasa.gov/data/country/ | NASA open data |
| NASA FIRMS active fire files, last 24 hours and 7 days (MODIS C6.1, VIIRS NOAA-20, VIIRS NOAA-21) | Recent fires layer | https://firms.modaps.eosdis.nasa.gov/data/active_fire/ | NASA open data, no key |
| Copernicus GWIS fire weather index (map service `ecmwf.fwi` and its legend) | Official fire danger layer, today to 9 days ahead | https://maps.effis.emergency.copernicus.eu/gwis | Copernicus GWIS (EFFIS); licence under review (decision D-4) |
| firms-catalog (public mirror of NASA FIRMS as GeoParquet) | Raw hotspots download | https://source.coop/portolan-mirrors/firms-catalog | Data CC0-1.0, code Apache-2.0 |
| OpenFreeMap street style (OpenMapTiles, OpenStreetMap data) | Streets base map | https://openfreemap.org | ODbL, credit OpenStreetMap contributors |
| Natural Earth admin-0 country borders | Country outlines in the preview | https://www.naturalearthdata.com/ | Public domain |
| NASA challenge page | Challenge text | https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ | Public |

## Software

| Resource | Used for | Link | Licence |
|---|---|---|---|
| DuckDB | Pipeline: cleaning and counting | https://duckdb.org | MIT |
| Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy, pytest | Pipeline: models, scoring, tests | https://www.python.org | BSD / MIT / Apache-2.0 / PSF |
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

## Licence text

| Resource | Used for | Link |
|---|---|---|
| Apache License 2.0 | This repo's `LICENSE` | https://www.apache.org/licenses/LICENSE-2.0 |
