# Emerge: build specification (long version)

Written Sat 14 Nov 2026, 16:00 EET; revised 16:30 after a double-check (fixes: unfinished-month comparison, 8-day windows, data-size gate D-9, national reported totals, chance of fire in MODIS years, recent-data industrial mask, re-timed checkpoints; added sections 7–8 on parallel work and shortcuts). The one-page version is [`overview.md`](overview.md). This file is what the build follows: the scope, data, design, tests, order of work and open decisions.

**Authorities:**
- **Feature priority:** [`features-moscow.md`](features-moscow.md).
- **Conversion method:** [`../docs/conversion-plan.md`](../docs/conversion-plan.md). The two method docs conflict on some points; see section 11.
- **Proof methods:** [`../docs/verification-plan.md`](../docs/verification-plan.md).
- **Research behind each choice:** `docs/research/*-summary.md`.

**Tags:** `[V]` verified at a primary source · `[D]` directional · `[U]` our inference.

---

## 1. Goal and users

**Goal:** one fair record of satellite-detected fires, from Nov 2000 to today, for any place on Earth. It is shown as a fire calendar in an installable web app, and answers the NASA challenge "Harmonization of MODIS and VIIRS Hot Spots" ([`../docs/challenge-brief.md`](../docs/challenge-brief.md)).

**Users:**
- Firefighters (professional and volunteer);
- people protecting property in fire-prone areas;
- the general public;
- the NASA and Sofia judges.

Every term is explained in plain language, in **English and Bulgarian**.

**Demo focus:** Bulgaria and the USA, inside a whole-world app.

**Not an official warning service.** Every risk screen links to the official services and shows 112 (EU) or 911 (USA).

---

## 2. Scope: what is built

All Musts and Shoulds from [`features-moscow.md`](features-moscow.md), plus S11 push alerts. Suggestion 2 is merged (M16–M26). Won't-haves: accounts, official warnings, app-store apps, image sharpening, burned-area mapping.

### Musts: data, selection, map and layers (from suggestion 2)

| # | Feature | Required behaviour | Done when (completion evidence) |
|---|---|---|---|
| M18 | Point + radius, or an area | **Point + radius:** radius slider from 0 to 500 km `[U]`. Raw points are kept if their geodesic (great-circle) distance is ≤ the radius. Grid cells are kept if their centre is within the radius. Radius 0 means the one cell containing the point. **Area:** a drawn polygon, or a ready-made one (country); a cell is kept if its centre is inside | Oracle-written tests: distance cases (equator, high latitude, crossing the 180° line), radius 0, polygon inside and outside, country |
| M19 | No data vs zero | `0` = satellites looked and saw no fire; `null` = no measurement. Shown differently in the calendar (empty pattern vs lightest colour), in tables ("no data" vs 0) and in exports (empty vs 0) | Unit tests on all three outputs; Nov 2000 shows data, Oct 2000 shows "no data" |
| M20 | Data type on point or area | Every layer declares `kind: point` or `kind: area`. A selection can show several layers at once | Registry test: each layer has a kind, and the area report lists every active layer |
| M21 | Get simple data | Date-range picker (from Nov 2000 to today); view one layer as raw rows, a table or on the map | End-to-end test: Bulgaria, Aug 2024, switching between the three views gives the same totals |
| M22 | Get combined data | Same as M21 for several layers in one table: harmonized fire, per-satellite counts, FRP and fire danger (where available), joined on place and date | Combined table for Bulgaria matches the single-layer tables |
| M16 | Several base maps | Switcher between NASA GIBS (Blue Marble day, Black Marble night) and OpenStreetMap, in 2D and 3D | Each base map loads on globe and 2D; attribution shown |
| M25 | Room for more base maps | Base maps listed in one config file `web/src/config/basemaps.ts` (id, name, tiles or style, attribution) | Adding a test entry needs no other code change |
| M17 | Several data layers | Layers: harmonized history, MODIS, VIIRS, recent fires, fire danger (and USA outlook) | Each layer toggles on and off; legend and explanation shown |
| M26 | Room for more data layers | Layers listed in one registry `web/src/config/layers.ts` (id, name keys, kind, units, time step, source, credit, loader) | Adding a test layer needs no other code change |

### Musts: what users see and do

| # | Feature | Required behaviour | Done when (completion evidence) |
|---|---|---|---|
| M1 | Harmonized fire history | Monthly VIIRS-equivalent fire cell-days from Nov 2000 to now. Years 2000–2011 are labelled "estimated", with a lower and upper bound; 2012+ are labelled "measured" | Pipeline validation report committed; split pre-registered before scoring (M58); oracle values match for 3 hand-computed cell-months |
| M2 | Data ready in advance | Pipeline outputs exported to small static files the app loads directly; no processing in the browser | Export totals equal pipeline totals (M125); file sizes logged; under Vercel's 100 MB static limit `[V]`, or moved to Blob |
| M3 | Pick a place | Uses M18: tap a point and set a radius, **type latitude and longitude** (decimal degrees, checked: −90 to 90, −180 to 180), draw an area, or pick a country from a search box. Everything else follows the selection. A place with no fire ever shows "No fires recorded here since Nov 2000" | Unit test point → cell id (oracle-written); end-to-end tests: each selection mode updates the calendar and URL |
| M4 | Fire calendar | For a point or area: years × months grid with a colour-blind-safe ramp. **Default unit: number of hotspots, harmonized to VIIRS level** (the brief's wording); switch to fire days (cell-days) or raw counts per satellite. Hover or tap shows the value, range and label; summary statistics (worst month, worst year, trend); clicking a cell shows that month's fires on the map | Bulgaria values equal the oracle's for 3 cells; works at 375 px width |
| M5 | "Is this unusual?" | Selected month vs the **median** (Background) **and the average** (Considerations) of the same month over past years, in words, e.g. "2.1× the usual November (median); 1.8× the average; higher than 23 of 25 years". Calendar **anomaly mode**: a diverging, colour-blind-safe ramp around the median. **For the current, unfinished month, compare month-to-date with the same days in past years** (otherwise 14 days are compared with full months and always look "below normal") | Oracle cases pass: above, below, no history, median 0, average vs median differ, unfinished month |
| M6 | "How we know it's right" page | Renders the committed validation file: hold-out results, slices, satellite agreement, published ratios, error-band coverage, limits | Test confirms the numbers come from the file, not typed text |
| M7 | Plain language | Tooltip and one-line explanation for every term (hot spot, cell-day, anomaly, FRP, harmonized, estimated) | Glossary keys exist in both languages |
| M8 | English and Bulgarian | Whole interface switchable; choice remembered | No missing translation keys; a native speaker reviews the Bulgarian |
| M9 | Phones | Layout from 375 px; layer panel becomes a bottom sheet | Screenshots at 375×812 and 1440×900 |
| M10 | Public address | https://emerge-beta-ten.vercel.app | Smoke test passes against it from outside |
| M11 | Downloads | For the selection and date range: (1) **hotspots CSV**, one row per detection (from firms-catalog through the raw-points function, up to 100,000 rows `[U]`, with a notice when cut); (2) monthly numbers CSV; (3) **analytics summary** CSV (worst month and year, trend, anomaly, chance of fire, detected vs reported); (4) **calendar and charts as PNG**. Header rows explain columns, sources and "no data" | Oracle: Bulgaria Aug 2024 hotspot rows equal the raw FIRMS count after cleaning; monthly CSV matches the country file; PNG opens and shows the title, place and dates |
| M12 | Tests on hot paths | Point + radius, area, country, load calendar, convert, export, language switch | Test log with counts (M131) |
| M13 | Chance of fire this month | Share of past years with ≥ 1 fire in this place and month, with a Jeffreys interval (a standard range for a proportion). From 2012: measured VIIRS. Before 2012: a year counts as "fire" if MODIS saw one; otherwise it uses the conversion's "MODIS saw none, VIIRS would have" chance, so the MODIS years are not under-counted | Backtest at 0.25°: fit on earlier years, test on later; Brier score and reliability chart on the proof page (M112); leakage check (M62) |
| M27 | This fire vs past fires | For the selection: the **last 8 days** of hotspots and total FRP vs the **same 8 calendar days in each past year** (2001 onwards), with a rank and a small bar chart. **8 days, not 7:** NASA warns that counts over periods shorter than about 8 days are severely biased `[V]` (MODIS fire user guide, via the conversion plan). Years from 2012 are measured VIIRS; 2001–2011 are MODIS scaled by that region and month's conversion factor, marked "estimated" with wider bands. Tapping a recent fire selects its area (point + 10 km radius `[U]`) and shows the same comparison. Uses the daily window table (section 4.3) | Oracle cases: rank, ties, no past fires, window across a year end, estimated years flagged |
| M28 | Detected vs reported | Next to satellite numbers: official reported fires and burned area per year. EFFIS JSON API for EU countries (2006–2026 `[V]`), NIFC table for the USA (1983–2025 `[V]`), pre-fetched into `reported/<ISO3>.json`. Elsewhere: "No official reported numbers available". **These are national totals:** shown in full for a country selection; for a point or drawn area, shown as "country total, for context". Note shown: EFFIS maps only fires of about 30 ha or more `[D]` | Bulgaria 2024 shows 133 fires and 44,745 ha (EFFIS `[V]`); USA 2024 shows 64,897 fires (NIFC `[V]`) |
| M14 | Whole world | Any place on Earth | End-to-end test on 5 points (Bulgaria, California, Mato Grosso, Punjab, Siberia) plus an ocean point |
| M15 | Installable app | Manifest, icons, service worker, offline app shell | Lighthouse "installable"; tested on one Android and one iPhone |

### Shoulds (build order)

| # | Feature | Required behaviour | Done when |
|---|---|---|---|
| S6 | Layer navigation | Full-screen dark globe; compact layer panel: History, Recent fires, Fire danger. Each layer has a switch, legend and one-line explanation. A base-map switcher offers satellite, night and plain | Each layer toggles on and off; switcher works |
| S1 | 3D globe | MapLibre globe, with a 2D map as the fallback | Works on a mid-range phone; fallback switch works |
| S5 | Recent fires | NASA detections from the last 24 h as points | Points appear; data time shown |
| S3 | Official fire danger | GWIS fire weather index tiles, today to +9 days `[V]`, with EFFIS class colours; NIFC 4-month outlook for the USA | Tiles load in the app; source credited |
| S11 | Push alerts | "Alert me here" saves a point; a timer checks fire danger; at most one notification per point per day | End-to-end test with a forced high value sends one notification; wording reviewed |
| S10 | Shareable links | URL holds the selection, layers, language and date | Opening a copied URL restores the view |
| S9 | Fire intensity | FRP (fire heat output) shown as colour or size; FRP mode in the calendar toggle | Toggle switches the series |
| S8 | Advice panel | Rule-based: "high danger + historically active this month → consider pre-positioning", with a disclaimer | Rules unit-tested; disclaimer always shown |

### Challenge-page checklist

Every item NASA's challenge page states, and the feature that covers it. Section names refer to [`../docs/challenge-brief.md`](../docs/challenge-brief.md).

| Stated on the challenge page | Section | Covered by |
|---|---|---|
| Harmonize MODIS and VIIRS so the sensor of origin no longer matters | Objectives | M1 |
| Patterns, trends and anomalies become the focus | Objectives | M4, M5, trend chart |
| A web app that takes the harmonized data as input | Objectives | M2, section 4.3 |
| Select a region and a date range | Objectives | M3, M18, M21 |
| Download analytics and visualizations | Objectives | M11 (summary CSV, PNG images) |
| Calendar of the number of hotspots, early 2000s to today | Objectives | M4 (hotspots by default) |
| Which periods of the year and which years had more fires | Objectives | M4 statistics |
| How a current fire compares with previous ones | Objectives | M27 |
| Colour ramps showing differences across months | Objectives | M4 |
| Downloadable CSV of hotspots detected during a search | Objectives | M11 (hotspots CSV) |
| Current month vs historical median, selected area | Background | M5 |
| Monitor sensitive regions; changes vs history; forecasting and response | Background | M5, M13, S3, S11 |
| Audience: responders, scientists, land managers, firefighters | Summary, Considerations | M7, M6, M11 |
| Draw the area of interest, or enter latitude and longitude | Considerations | M18, M3 |
| Accessible colour ramps | Considerations | M4, M5 anomaly mode |
| A few key indices and figures as visualizations | Considerations | Area report cards |
| Anomalies against multi-year averages | Considerations | M5 (average and median) |
| Number of fires detected and reported | Considerations | M28 |
| Use NASA FIRMS hotspots ("you may consider") | Background | Section 4.1 |

---

## 3. Screens

| Screen | Contents |
|---|---|
| **Globe (home)** | Full-screen globe; selection tools: tap a point + radius slider, draw an area, country search; layer panel (M17); base-map switcher (M16); language switch; install hint |
| **Area report** (side panel; bottom sheet on phones) | Title, selection summary and data date; latitude/longitude box; date-range picker; fire calendar; unit and mode toggle (Hotspots / Fire days / Measured per satellite / Fire intensity / Anomaly); "This fire vs past fires" card; "Detected vs reported" card; "Is this unusual?" card; chance-of-fire card; yearly trend chart with measured vs estimated and bands; data view (raw rows / table / map) for one or several layers (M21/M22); downloads menu (hotspots CSV, monthly CSV, analytics summary, PNG images); share button; "Alert me here"; advice card |
| **How we know it's right** | Validation results with charts; limits stated plainly |
| **About and sources** | What Emerge is; glossary; every data source with licence and credit; disclaimer; official links (EFFIS/GWIS, NIFC, Bulgaria's NIMH) |

---

## 4. Data

### 4.1 Sources

| Data | Source and access | Years | Licence or terms | Used for |
|---|---|---|---|---|
| MODIS hot spots (Terra, Aqua), Collection 6.1 | NASA FIRMS yearly country files, no login `[V]` | Terra 1 Nov 2000+, Aqua 4 Jul 2002+ `[V]` | NASA open data | M1 |
| VIIRS 375 m hot spots, S-NPP | NASA FIRMS | 20 Jan 2012 – 2 Nov 2026 `[V]` | NASA open data | M1, reference series |
| VIIRS 375 m, NOAA-20 / NOAA-21 | NASA FIRMS | 1 Apr 2018+ / 1 Mar 2023+ `[V]` | NASA open data | Gap filling, 2026+ |
| 2026 detections | firms-catalog GeoParquet on Source Cooperative, data to 14 Nov 2026 `[V]` | 2000–2026 | CC0 `[V]` | 2026 months, raw points |
| Last 24 h | FIRMS no-key global CSVs (MODIS, NOAA-20, NOAA-21) `[V]` | live | NASA open data | S5, S11 |
| Fire danger | Copernicus GWIS WMS: `ecmwf.fwi` tiles, `ecmwf.query` point value `[V]` | today to +9 days | Copernicus CC BY 4.0 `[V]`; the service names the EU Data Licence, **to check** | S3, S11 |
| USA outlook | NIFC ArcGIS `Outlooks_Monthly_Extended`, layers 0–3, field `FirePotent` `[V]` | 4 months | US government | S3. **Never show the `Comments` field** (staff names) |
| Base maps | NASA GIBS Blue Marble and Black Marble, no key `[V]` | — | NASA, credit requested | M16 |
| Base map, streets | OpenStreetMap data, via a free tile service (for example OpenFreeMap, no key `[D]`), or OSM's own tiles under its usage policy `[D]` | — | ODbL, "© OpenStreetMap contributors" | M16. **To verify:** the tile service's terms |
| Country borders | Natural Earth admin-0 | — | Public domain | M3 |
| Outside checks | EFFIS Bulgaria JSON API (2006–2026) `[V]`; NIFC statistics (1983–2025) `[V]`; MODIS MCD64A1 burned area | — | Open | Proof page (M41) |

**Cleaning rules:** keep vegetation fires (`type = 0`), MODIS confidence ≥ 30, VIIRS confidence `n` or `h`.

**Trap:** firms-catalog leaves `type` empty for recent near-real-time rows `[V]`. **Fix:** build a static-source mask from history (0.01° cells where past detections were mostly `type = 2`), then drop recent rows that fall in those cells and keep the rest. Otherwise recent months either vanish or include gas flares.

### 4.2 Pipeline (teammates; status 14 Nov)

- **Done `[V]`:** all 10,095 country files downloaded (43.5 GB). 461,501,221 detections kept; 324,312,197 cell-days. Checks M125 and M32 pass. Scripts: `pipeline/download_firms.py`, `pipeline/build_cells.py`.
- **Findings `[V]`:**
  - worldwide, S-NPP sees about 2.7× MODIS cell-days, steady across years;
  - S-NPP has 34 missing days in 2022 and 2024, filled from NOAA-20, which agrees within about 1%;
  - Terra drops in 2022–2025, likely orbit drift `[U]`;
  - Terra alone sees about half of what Aqua sees.
- **Next:** training pairs, models, validation, harmonized table (see section 11 for the grid and test-year decision); also hotspot counts (D-7) and the daily window table (section 4.3).

### 4.3 The contract between pipeline and app

The app reads only these files. The pipeline team writes `pipeline/export_app.py`; the oracle agent checks its totals.

| File | Contents | Size `[U]` |
|---|---|---|
| `web/public/data/meta.json` | Data version, build date, last data date, source list | < 5 KB |
| `web/public/data/countries/<ISO3>.json` | Monthly series for the country: `y, m`, harmonized hotspots `hot, hot_lo, hot_hi`, harmonized fire days `cd, cd_lo, cd_hi`, raw per satellite `terra, aqua, snpp, noaa20, noaa21`, `frp, src, flags` | ~250 files, a few KB each |
| `web/public/data/reported/<ISO3>.json` | Official reported fires and burned area per year (EFFIS for EU countries, NIFC for the USA), with source and date fetched | A few KB each |
| `web/public/data/tiles/<lat0>_<lon0>.json` | Every fire cell in that 5° × 5° square, with its monthly series (fire months only) | ~1,000 files, 60–80 MB in total |
| `web/public/data/globe/<year>.json` | Per-cell yearly totals for the globe layer | ~0.3 MB each, gzipped |
| `web/public/data/validation.json` | Everything the proof page shows | < 1 MB |
| Daily window table | Hotspots and FRP per 0.25° cell per day, for the **latest 45 days and the same 45 days in every past year**; feeds M5 (unfinished month) and M27. Refreshed with the data | Small per tile `[U]`; measure |

**Rules for the files:**
- **Cell id (0.25° grid):** `row = floor((90 − lat) / 0.25)`, `col = floor((lon + 180) / 0.25)`, `cell_id = row × 1440 + col`. This is NASA's 1440 × 720 grid `[V]`.
- **No data vs zero (M19):** `0` means the satellites looked and saw no fire; `null` means no measurement (before Nov 2000, or a satellite gap that wasn't filled). Files store **fire months only**: a missing month inside the coverage period means 0. The no-data periods are listed once, in `meta.json`. The calendar shows the two differently.
- **Which files a selection loads:**
  - point + radius or drawn area: every tile that overlaps the selection's bounding box; cells are then filtered by centre (M18);
  - country: its `countries/<ISO3>.json`, which uses NASA's own country assignment of each detection, so border cells can differ slightly from a drawn outline (stated in the app).
- **Honest size:** harmonized numbers exist per 0.25° cell (about 28 km), so a small radius still reports the whole cell, labelled "low confidence". Raw points are filtered exactly by distance.
- **Labels:** `src` is one of `estimated_terra` (Nov 2000 – Jun 2002), `estimated_modis` (Jul 2002 – 2011), `measured`, `measured_calibrated` (NOAA-20/21), or `provisional` (near-real-time months).
- **Size: measure before choosing (decision D-9).** The 0.1° monthly grid per satellite is already 55.6 million rows, 345 MB `[V]`. A 0.25° table will be smaller but may still exceed Vercel's 100 MB static limit `[V]`, so the 60–80 MB estimate `[U]` is unreliable. If the measured size (gzipped) is over about 85 MB:
  - keep only the columns the app shows (harmonized values and ranges, as integers);
  - put per-satellite raw values behind the query function;
  - host the files on Vercel Blob, packed into a few large files read by byte range. Blob's free plan allows only 2,000 uploads a month `[V]`, so never upload one file per tile.

---

## 5. Architecture and stack

| Layer | Choice | Notes |
|---|---|---|
| Hosting | **Vercel**, project `emerge` | Linked to GitHub `main` `[V]`. Builds are paused (ignore command `exit 0`) until `web/` exists; then set Root Directory to `web` and remove the pause |
| App | **Next.js** (App Router, TypeScript) in `web/` | The map is a client-only component |
| Globe and map | **MapLibre GL JS** (globe since v5 `[V]`; current 6.x, BSD-3) with react-map-gl | Same code for globe and 2D |
| Data layers | **deck.gl** 9.x on the MapLibre globe `[V]` | Fire cells, points, selection |
| Selection | Geodesic distance (haversine) and point-in-polygon with Turf.js; drawing with Terra Draw (MapLibre adapter) | If drawing doesn't work on the globe, drawing switches to the 2D map `[U]` |
| Registries | `web/src/config/basemaps.ts` (M16/M25), `web/src/config/layers.ts` (M17/M20/M26) | New maps or layers = one new entry |
| Calendar and charts | Custom SVG with d3-scale; a colour-blind-safe sequential ramp | Accessible colours (challenge suggestion) |
| Languages | **next-intl** (made for the Next.js App Router); `en.json`, `bg.json` | Glossary keys shared |
| Image export | Calendar and charts are SVG, converted to PNG in the browser; the map snapshot is optional | No WebGL capture needed |
| Accessibility | Keyboard use, labels for screen readers, contrast checked, colour never the only signal | Matches the brief's "accessible" wish |
| Licence and credits | `LICENSE` (Apache-2.0) at the repo root; map attribution control; full credits on the About page | NASA rules: open source, list every resource |
| Installable app | Web manifest + service worker (Next.js PWA guide `[V]`) | Offline shell only |
| Push | `web-push` (MPL-2.0 `[V]`); Vercel functions `/api/subscribe`, `/api/unsubscribe`, `/api/check-alerts`; **Upstash Redis** for sign-ups; **GitHub Actions** schedule triggers the check (Vercel's free plan runs scheduled jobs only once a day `[V]`) | Places rounded to 0.1°; one push per point per day |
| Query function (D-9) | One Python Vercel function `/api/query` with DuckDB: raw hotspots from firms-catalog (`ST_Intersects`: 5 s vs 49 s `[V]`), and, if chosen, our tables on Blob. Answers cached by Vercel's CDN | **Spike first** (DuckDB's map extension inside a Vercel function is not verified). Fallback: a slim Bulgaria + USA points file |
| Tests | Vitest (units), Playwright (end to end, phone and desktop), pytest (export) | Expected answers in `tests/expected/`, written first |

**Secrets** go only in Vercel environment variables, never in git: `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, plus `FIRMS_MAP_KEY` if used. `.env*` and `.vercel/` are git-ignored.

**Speed targets `[U]`:**
- calendar ≤ 2 s after a tap;
- globe first view ≤ 4 s on a phone;
- Lighthouse performance ≥ 80 on mobile.

---

## 6. Proof and tests

**The AI is never its own oracle.**
- A separate agent writes the expected answers in `tests/expected/` before the app code, from raw FIRMS CSV samples, using plain Python (not DuckDB, the pipeline's tool).
- Those expected answers cover:
  - the point → cell id rule;
  - 3 Bulgaria cell-months;
  - the "unusual" cases;
  - the chance-of-fire cases;
  - CSV row counts.

| Method | What it checks | Priority |
|---|---|---|
| M44 hold-out backtest | Conversion predicts unseen years | Must |
| M21 differential | S-NPP vs NOAA-20 agree | Must (done: about 1% `[V]`) |
| M38 published ratios | Our ratios plausible | Must |
| M19 known-answer tests | Hot paths | Must |
| M32 hard limits | Counts ≥ 0, valid coordinates, no future dates | Must (pipeline passes `[V]`) |
| M125 control totals | Daily = monthly = raw kept rows | Must (pipeline passes `[V]`) |
| M131 trace audit | Agents' claimed test runs really ran (counts) | Must |
| M114, M124, M58, M62, M112, M20, M101, M95 | Bands, slices, pre-registration, leakage, calibration, property tests, audit sample, real-user test | Should |
| M41 triangulation | EFFIS Bulgaria, NIFC USA, MCD64A1 | Could (data feeds verified `[V]`) |

---

## 7. Order of work: what runs in parallel, what must wait

### 7.1 What must happen in order (the critical path)

1. **Freeze the data contract** (section 4.3), with example files. Everything else builds against it.
2. **Run the 4 risk spikes** (section 8, shortcut 3) and decide D-9 (where the data lives).
3. **First conversion model (T1, the simple ratio)** for Bulgaria and the USA → real files for the app.
4. **Validation report** → the proof page can show real numbers.
5. **World conversion + export** → whole world live.
6. **English text freeze** → one Bulgarian translation pass → native-speaker review.
7. **Feature freeze** → record the video from the live app.

### 7.2 What runs in parallel (6 people, each with AI agents)

| Stream | Owner (role) | Builds | Waits for |
|---|---|---|---|
| A. Pipeline and science | 2 people | T1 → validation → export → T2 and error bands; hotspot counts (D-7); daily window table | Contract (step 1) |
| B. App shell and map | 1 person | Next.js app, globe and 2D map, base-map and layer registries, layer panel, selection (point + radius, lat/lon, country, drawn area), install, languages | Contract only (uses example files) |
| C. Area report | 1 person | Calendar, unusual card, this fire vs past, chance of fire, detected vs reported, data views, downloads | Contract only (example files), then real files |
| D. Data service and alerts | 1 person | Spikes, query function, recent fires, fire-danger layer, push alerts | Spikes; Upstash and Blob set up by the account owner |
| E. Proof and quality | shared, plus a separate oracle agent | Expected answers first, tests, proof page, references and AI-usage logs | Raw CSV samples only; then the validation report |
| F. Story and pitch | 1 person | Video script, firefighter outreach for a quote, Bulgarian review, pitch | Feature freeze for recording |

### 7.3 Checkpoints (Sofia time; now Sat 16:30)

| When | Evidence that must exist |
|---|---|
| **Sat 18:00 · CP0** | Contract and example files committed; 4 spikes answered; D-1, D-2, D-7, D-9 decided; `web/` scaffold live on the public URL; oracle tests written and failing |
| **Sat 20:30 · CP1** | Globe, base maps, layers, all selection modes and the languages work on a phone, using the example files |
| **Sat 23:30 · CP2** | Bulgaria end to end with real T1 numbers on the public URL: calendar, cards, downloads |
| **Sun 03:30 · CP3** | Whole world live; proof page with real validation; recent fires and fire danger; all Must tests green with counts logged |
| 03:30–08:00 | Push alerts, share links, intensity, advice; T2 and error bands swapped in if they beat T1 (no app change needed) |
| **Sun 06:00** | Data refresh to the latest day; English text freeze; Bulgarian pass starts |
| **Sun 08:00 · CP4** | **Feature freeze for Sofia**; smoke test passes; Bulgarian reviewed |
| 10:00–12:30 | Record the 30-second video from the live app with English subtitles (fits Sofia's 30–60 s and NASA's ≤ 30 s) |
| **Sun 13:30 · CP5** | **Sofia video submitted** (due 14:00); link opens without login |
| **Sun 22:00 · CP6** | **NASA submission** (due 23:59): References, AI-usage note, all fields in English |

**Scope note:** suggestion 2 and the challenge-page items add about 15–22 hours of work `[U]`, spread across the streams.

**First cuts if late, in order:**
1. S8 advice;
2. S9 intensity;
3. M22 combined data (keep simple data);
4. globe polish (2D fallback);
5. push alerts, replaced by an in-app banner;
6. the raw-points function, replaced by Bulgaria + USA points only.

Drawn areas stay: NASA's challenge page names them.

---

## 8. How we build fast without losing quality

| # | Shortcut | Saves | Quality effect |
|---|---|---|---|
| 1 | **Contract first, with an example-file generator:** the app is built on example files of the exact format, so it never waits for the pipeline | Hours of waiting | Higher: the interface is fixed and testable |
| 2 | **Vertical slice first:** Bulgaria end to end (data → calendar → download → live), then widen to the world | Late surprises | Higher: the demo path works early |
| 3 | **Risk spikes first, 20–30 min each, run in parallel by subagents:** (a) DuckDB inside a Vercel function reading firms-catalog and a Parquet file on Blob; (b) drawing areas on the MapLibre globe; (c) GIBS, OpenStreetMap and GWIS layers on the globe; (d) calendar and chart export as PNG | Rebuilds | Higher: no dead ends |
| 4 | **Pre-compute everything that doesn't depend on the user's selection** in the pipeline: globe layers, country series, validation report, reported numbers | App code and load time | Higher: the numbers are computed once, in one tested place |
| 5 | **Ship the simple model (T1) first;** T2 and error bands replace the files later, with no app change | Waiting on modelling | Same; better once T2 wins on held-out data |
| 6 | **Features as configuration:** one registry for layers, one for base maps (M25, M26) | Code per layer | Higher: consistent legends, credits and units |
| 7 | **Use ready parts:** the deck.gl + MapLibre globe example, shadcn/ui components (accessible by default), the Vercel plugin's Next.js, functions and storage guides instead of web searches | Build time and tokens | Higher: tested building blocks |
| 8 | **One git worktree and branch per stream,** small pull requests; Vercel gives each branch its own preview link | Merge conflicts | Higher: each change checked on a live preview |
| 9 | **Oracle first:** a separate, cheaper agent writes expected answers from raw CSVs in plain Python before the code exists | Debugging time | Higher: an outside check, never the AI marking its own work |
| 10 | **One Playwright script per demo flow,** reused for tests, screenshots and recording the video | Video re-takes | Higher: the video shows the real, tested app |
| 11 | **English first, one Bulgarian pass at the text freeze,** then native review | Repeated translation | Higher: consistent terms |
| 12 | **Right-sized agents:** a cheaper, faster model for mechanical work (test boilerplate, translations, file formats); the strongest model for the method, the data service and reviews. Agents get section numbers of this spec, not pasted text | Tokens | Same |
| 13 | **Pre-warm and fall back:** load Bulgaria and California once before the demo, and bundle a small static copy of their data in the app | Demo risk | Higher: the demo works even if a service is slow |
| 14 | **Coordinate through the repo:** decisions in section 11, notes in commits; short syncs at checkpoints only | Chat time and tokens | Same |

---

## 9. Wording and safety rules

- Never use official warning words ("Warning", "Red Flag", "Code Red"). Use "Fire danger (official forecast)" and "Risk outlook (unofficial)".
- Every risk view shows: "Research prototype. Not an official warning. Follow local authorities (112 / 911)", plus links to EFFIS/GWIS, NIFC and NIMH (meteo.bg).
- Push wording in English and Bulgarian is in [`../docs/research/push-alerts.md`](../docs/research/push-alerts.md).
- No people's images, voices or likeness of anyone under 18 in the video (NASA rule).

---

## 10. Tracking for the submission

- `docs/references.md`: every dataset, library, image and tool, with link and licence, added when first used.
- `docs/si-usage.md`: how AI was used (research agents, coding agents, oracle agent, the Vercel plugin), updated at each checkpoint.

---

## 11. Open decisions (owner and deadline)

| # | Decision | Options | Proposed | Deadline |
|---|---|---|---|---|
| D-1 | **Harmonization grid** | 0.25° monthly ([`conversion-plan.md`](../docs/conversion-plan.md)) vs 0.1° ([`harmonization-pipeline-plan.md`](../docs/harmonization-pipeline-plan.md)) | **0.25°**: NASA's grid, regions reliable (nRMSE 8% vs 61% per cell `[V]`), smaller files. Keep 0.1° for display only | Sat 17:00 |
| D-2 | **Training and test years** | Train 2012–2018, test 2019–2025; or calibrate within 2012–2022 and test both ways | **Within 2012–2022, test both ways**: Terra drift shows from 2022 `[V]` | Sat 17:00 |
| D-3 | Features suggestion 2 | Merge or not | **Merged 14 Nov evening** (M16–M26 now Musts; C7 and C8 Could). Open detail: maximum radius (500 km proposed `[U]`) | Done |
| D-4 | GWIS licence | CC BY 4.0 vs EU Data Licence | Check before the demo; credit Copernicus either way | Sun 08:00 |
| D-5 | Teammates' pushes on Vercel's free plan | Whether pushes by non-owners deploy | Test on the first push | Sat 17:00 |
| D-6 | Who pitches on site (J1) | — | Team | Sun 12:00 |
| D-7 | **Calendar's default unit** | Hotspots (the brief's wording) vs fire days (fairer across sensors) | **Hotspots by default**, fire days one tap away; both harmonized with ranges. The pipeline runs the same conversion on hotspot counts as on fire days | Sat 17:00 |
| D-8 | Industrial hotspots | The brief counts farm and industrial fires as burning activity; we filter static industrial sources (`type = 2`) | Keep the filter, say so in the app, and offer the unfiltered count on the proof page | Team |
| D-9 | **Where the app's data lives** | Static files in the deployment · packed files on Vercel Blob · query function over Parquet | Decide at CP0 from the **measured** size and spike (a). Default: static for globe, countries, validation and reported numbers; tiles static if ≤ 85 MB gzipped, otherwise Blob | Sat 18:00 |

**Account steps only the account owner can do** (one-time, in the browser):
- add Upstash Redis from the Vercel Marketplace (accept its terms);
- create a Vercel Blob store if D-9 needs it;
- approve any GitHub app permission.

Keys and tokens then go into Vercel's environment settings, never into git.
