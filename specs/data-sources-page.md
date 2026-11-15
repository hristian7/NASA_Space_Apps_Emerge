# Spec: Data sources page (`/data-sources`)

Written Sun 15 Nov 2026, 22:00. For whoever builds it. It is short on purpose: the data already exists in the app.

## 1. Goal

A public page at **https://emergefire.app/data-sources** that lists every outside resource Emerge uses. It is split exactly like NASA's submission form:

1. **NASA Data:** every NASA dataset or resource. NASA requires these for a Global Award.
2. **Space Agency Partner & Other Data:** everything else: partner-agency data, other data, code, fonts, video and AI tools.

Each row shows a **Link Text** (the resource name) and a **full URL** (starting `https://`), as NASA's form asks. A judge can check our sources in one place, and a teammate can copy them into the form.

## 2. Reuse what exists (don't duplicate the list)

- **Data:** `web/src/lib/ui/sources.ts` already holds every resource (`sourceGroups`, about 60 rows with `id`, `name`, `url`, `licence`, `provider`, `roles`). It mirrors `docs/references.md`. Build the page from this file only.
- **Frame:** `web/src/components/explain/info-page.tsx` is the shared header, tab row and footer for `/how-it-works`, `/proof` and `/about`. Use it.
- **Look:** copy the card style from `web/src/app/about/about.css` (`.ab-card`) or import it. No new colours: use the tokens in `web/src/styles/themes.css`.

## 3. Changes to make

| # | File | Change |
|---|---|---|
| 1 | `web/src/lib/ui/sources.ts` | Add `section: "nasa" \| "partner" \| "other"` to `Source`, and set it on every row using the table in section 5. Add a helper `formRows(section)` that returns `{ linkText, url }[]`, skipping rows with role `planned`. The tool rows (software, fonts, video, AI) stay `"other"`. |
| 2 | `web/src/app/data-sources/page.tsx` (new) | Server component inside `<InfoPage current="sources">`. It renders the sections in section 4, with `generateMetadata` like `about/page.tsx`. |
| 3 | `web/src/app/data-sources/data-sources.css` (new) | Layout only; reuse the card look. |
| 4 | `web/src/components/explain/info-page.tsx` | Add `"sources"` to `InfoTab` and a fourth tab `{ id: "sources", href: "/data-sources", label: "sourcesTab" }`. |
| 5 | `web/src/components/shell/top-menus.tsx` | Add a "Data sources" item next to About, How it works and Proof (around line 100). |
| 6 | `web/messages/info.en.json`, `info.bg.json` | Add `sourcesTab`: "Data sources" / "Източници на данни". |
| 7 | `web/messages/sources.en.json`, `sources.bg.json` (new) | Page text (section 4). Resource names and URLs are never translated. |
| 8 | `web/tests/explain/data-sources.test.ts` (new, Vitest) | The tests in section 6. |
| 9 | `docs/references.md` | No change, but a new resource must be added both there and in `sources.ts`, as today. |

## 4. Page layout

1. **Title:** "Data sources". **Lead line:** "Everything Emerge is built on. NASA data first, then partner agencies and other sources. All links are public."
2. **Count line**, computed: "{n} NASA resources · {m} partner and other resources".
3. **Section "NASA Data":**
   - Short note: "NASA data is the core of Emerge: the fire record, fire weather, rain, soil moisture, greenness, land cover and base maps."
   - One card per row: provider (small), **Link Text** as a link to the URL (new tab), the full URL shown under it in small mono text, and the "used for" sentence. The sentence comes from the existing `about` messages, `used.<id>`, so it isn't written twice.
4. **Section "Space Agency Partner & Other Data"**, with sub-headings in this order:
   - **Partner agencies (Copernicus / ESA)**
   - **Other data**
   - **Software and code**
   - **Fonts, video and AI tools**
5. **"Copy for the NASA form" button** on each section. It copies the section as plain text, one row per line: `Link Text<TAB>URL`. It shows "Copied" for 2 s. If the clipboard is blocked, it opens the same text in a `<textarea>`.
6. **Planned resources** (role `planned`: MCD12C1, MOD13C2) are **not listed**. They aren't used yet.
7. **Experimental resources** (role `experimental`) are listed under "Other data" or "Software", with the existing small "experimental" tag.
8. **Footer:** the standard InfoPage footer, plus one line: "Full list with licences: docs/references.md on GitHub" (link https://github.com/hristian7/NASA_Space_Apps_Emerge/blob/main/docs/references.md).

Must work on a phone (one column under 640 px), in English and Bulgarian, keyboard-accessible, with visible link focus.

## 5. Which section each row goes in (and the form-ready list)

The **Link Text** below is what the form should get. Where it is shorter than the `name` in `sources.ts`, add an optional `linkText` field there. **Every URL must be full and public.**

### NASA Data (`section: "nasa"`)

| `id` | Link Text | URL |
|---|---|---|
| firmsCountry | NASA FIRMS archive: MODIS C6.1 and VIIRS 375 m fire detections | https://firms.modaps.eosdis.nasa.gov/country/ |
| firmsActive | NASA FIRMS active fires, last 24 hours and 7 days | https://firms.modaps.eosdis.nasa.gov/active_fire/ |
| firmsNoaa20 | NASA FIRMS VIIRS NOAA-20 detections | https://firms.modaps.eosdis.nasa.gov/ |
| firmsCatalog | firms-catalog, public mirror of NASA FIRMS | https://source.coop/portolan-mirrors/firms-catalog |
| gfwed | NASA GFWED GEOS-5 fire-weather forecasts | https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/ |
| nasaPower | NASA POWER daily weather API | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |
| imerg | NASA GPM IMERG precipitation via GIBS | https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml |
| smap | NASA SMAP soil moisture via GIBS | https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml |
| ndvi | NOAA-20 VIIRS NDVI (greenness) via NASA GIBS | https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml |
| landCoverGibs | NASA MODIS land cover (IGBP) via GIBS | https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml |
| mcd12q1 | NASA MODIS MCD12Q1 land cover, 500 m mosaic | https://zenodo.org/records/8367523 |
| gibsBase | NASA GIBS Blue Marble and Black Marble base maps | https://nasa-gibs.github.io/gibs-api-docs/ |
| challenge | NASA Space Apps 2026 challenge: Harmonization of MODIS and VIIRS Hot Spots | https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ |

Not listed (planned, not used): mcd12c1, mod13c2.

**URL notes (checked 15 Nov, 22:05):**
- The FIRMS data-folder links in `sources.ts` (`/data/country/`, `/data/active_fire/`) return 404 in a browser. Use the page links above, which load.
- The GFWED home page (data.giss.nasa.gov) didn't answer, so the form uses the NASA NCCS forecast folder, which loads. Keep both in `sources.ts` if you like.
- Every other URL loaded (200). Zenodo, Natural Earth and MET Norway refuse scripted requests but open in a browser.

### Space Agency Partner & Other Data

**Partner agencies (`section: "partner"`)**

| `id` | Link Text | URL |
|---|---|---|
| gwisFwi | Copernicus GWIS fire weather index (ECMWF) | https://maps.effis.emergency.copernicus.eu/gwis |
| effisStats | Copernicus EFFIS statistics: burned-area estimates by country | https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates |
| gwisStats | Copernicus GWIS statistics: estimates by country | https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates |
| effisReport | EFFIS annual report: Forest Fires in Europe, Middle East and North Africa 2024 | https://doi.org/10.2760/0649290 |
| worldCover | ESA WorldCover (experimental engine) | https://esa-worldcover.org |
| copernicusDem | Copernicus DEM (experimental engine) | https://registry.opendata.aws/copernicus-dem/ |

**Other data (`section: "other"`)**

| `id` | Link Text | URL |
|---|---|---|
| nifc | NIFC wildfire statistics, USA | https://www.nifc.gov/fire-information/statistics/wildfires |
| iag | Executive Forest Agency of Bulgaria, 2025 annual report | https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf |
| openMeteo | Open-Meteo weather forecasts | https://open-meteo.com |
| admin0 | Natural Earth country borders | https://www.naturalearthdata.com/ |
| admin1 | Natural Earth regions (admin-1) | https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/ |
| gfed | GFED4.1s fire regions (Earth System Science Data, 2017) | https://doi.org/10.5194/essd-9-697-2017 |
| openFreeMap | OpenFreeMap street map (OpenStreetMap data) | https://openfreemap.org |
| photon | Photon place search (OpenStreetMap data) | https://photon.komoot.io |
| geoBoundaries | geoBoundaries gbOpen (experimental engine) | https://www.geoboundaries.org |
| metNorway | MET Norway Locationforecast (experimental engine) | https://api.met.no/weatherapi/locationforecast/2.0/documentation |
| noaaIndices | NOAA climate indices (experimental engine) | https://www.cpc.ncep.noaa.gov/ |

**Software and code (`section: "other"`)**

| `id` | Link Text | URL |
|---|---|---|
| nextjs | Next.js | https://nextjs.org |
| react | React | https://react.dev |
| typescript | TypeScript | https://www.typescriptlang.org |
| tailwind | Tailwind CSS | https://tailwindcss.com |
| nextIntl | next-intl | https://next-intl.dev |
| maplibre | MapLibre GL JS | https://maplibre.org |
| reactMapGl | react-map-gl | https://visgl.github.io/react-map-gl/ |
| deckgl | deck.gl | https://deck.gl |
| turf | Turf.js | https://turfjs.org |
| terraDraw | Terra Draw | https://terradraw.io |
| d3scale | d3-scale | https://d3js.org/d3-scale |
| hyparquet | hyparquet | https://github.com/hyparam/hyparquet |
| duckdb | DuckDB | https://duckdb.org |
| python | Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy and pytest | https://www.python.org |
| poppler | Poppler pdftotext | https://poppler.freedesktop.org |
| vitest | Vitest | https://vitest.dev |
| playwright | Playwright | https://playwright.dev |
| experimentalSoftware | xclim, XGBoost, PyTorch, rasterio and Shapely (experimental engine) | https://xgboost.ai/ |

**Fonts, video and AI tools (`section: "other"`)**

| `id` | Link Text | URL |
|---|---|---|
| appFonts | Google Fonts: Familjen Grotesk, Public Sans, Newsreader, IBM Plex | https://fonts.google.com |
| syne | Syne Bold (logo wordmark) | https://fonts.google.com/specimen/Syne |
| remotion | Remotion (demo video) | https://www.remotion.dev |
| elevenlabs | ElevenLabs voice and music (demo video) | https://elevenlabs.io |
| aiAssistants (new row) | Claude Code, AI coding assistant (see our AI-usage note) | https://www.anthropic.com/claude-code |
| repoLicence | Emerge source code (Apache 2.0) | https://github.com/hristian7/NASA_Space_Apps_Emerge |

`aiAssistants` is a new row: add it to `sources.ts`, to `docs/references.md` and to the `about` messages (`used.aiAssistants`). The repo's commits are co-authored by Claude, and NASA's form asks for every tool used.

## 6. Tests (Vitest, `web/tests/explain/data-sources.test.ts`)

1. Every row in `sourceGroups` has a `section`.
2. Every URL starts with `https://` and parses with `new URL()`.
3. `formRows("nasa")` contains `firmsCountry`, `gfwed`, `imerg`, `smap` and `challenge`, and contains no `planned` row.
4. No row appears in both NASA and the other sections.
5. The copied text for a section has exactly one `Link Text<TAB>URL` line per row.
6. The page renders in `en` and `bg` without missing message keys (same pattern as the existing explain tests).

## 7. Done when

- `https://emergefire.app/data-sources` loads, with the Data sources tab active and reachable from the top menu and the info-page tabs.
- The NASA section shows 13 rows; the other section shows the rest, with planned rows hidden.
- Each "Copy for the NASA form" button pastes cleanly into the form, one link per line.
- `npm run build`, `npm test` and the Playwright smoke tests pass. Works at 375 px wide and in Bulgarian.
- No new colours or fonts, and no keys or personal data.

## 8. Out of scope

- Licence text per row: it stays on `/about` and in `docs/references.md`.
- Usage counts, live status checks of each source, logos of agencies. Agency logos need permission, so don't add them.

## 9. Deadline note

NASA submission closes **Sun 15 Nov, 23:59 Sofia time**. The form doesn't need this page: **the tables in section 5 can be pasted into the form now.** Build the page after submission if time is short.
