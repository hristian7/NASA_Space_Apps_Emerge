# Emerge: build specification (long version)

Written Sat 14 Nov 2026, 16:00 EET. The one-page version is [`overview.md`](overview.md). This file is what the build follows: the scope, data, design, tests, order of work and open decisions.

**Authorities:**
- **Feature priority:** [`features-moscow.md`](features-moscow.md).
- **Conversion method:** [`../docs/conversion-plan.md`](../docs/conversion-plan.md). The two method docs conflict on some points; see section 10.
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

All Musts and Shoulds from [`features-moscow.md`](features-moscow.md), plus S11 push alerts. Won't-haves: accounts, official warnings, app-store apps, image sharpening, burned-area mapping.

### Musts

| # | Feature | Required behaviour | Done when (completion evidence) |
|---|---|---|---|
| M1 | Harmonized fire history | Monthly VIIRS-equivalent fire cell-days from Nov 2000 to now. Years 2000–2011 are labelled "estimated", with a lower and upper bound; 2012+ are labelled "measured" | Pipeline validation report committed; split pre-registered before scoring (M58); oracle values match for 3 hand-computed cell-months |
| M2 | Data ready in advance | Pipeline outputs exported to small static files the app loads directly; no processing in the browser | Export totals equal pipeline totals (M125); file sizes logged; under Vercel's 100 MB static limit `[V]`, or moved to Blob |
| M3 | Pick a country or a point | Country from a search box or a map click; or tap any point to select its grid cell. A point with no fire ever shows "No fires recorded here since Nov 2000" | Unit test point → cell id (oracle-written); end-to-end test: tap updates calendar and URL |
| M4 | Fire calendar | Years × months grid with a colour-blind-safe ramp; hover or tap shows the value, range and label; clicking a cell shows that month's fires on the map | Bulgaria values equal the oracle's for 3 cells; works at 375 px width |
| M5 | "Is this unusual?" | Selected month vs the **median** of the same month over past years (the challenge's wording), in words, e.g. "2.1× the usual November; higher than 23 of 25 years" | Oracle cases pass: above, below, no history, median 0 |
| M6 | "How we know it's right" page | Renders the committed validation file: hold-out results, slices, satellite agreement, published ratios, error-band coverage, limits | Test confirms the numbers come from the file, not typed text |
| M7 | Plain language | Tooltip and one-line explanation for every term (hot spot, cell-day, anomaly, FRP, harmonized, estimated) | Glossary keys exist in both languages |
| M8 | English and Bulgarian | Whole interface switchable; choice remembered | No missing translation keys; a native speaker reviews the Bulgarian |
| M9 | Phones | Layout from 375 px; layer panel becomes a bottom sheet | Screenshots at 375×812 and 1440×900 |
| M10 | Public address | https://emerge-beta-ten.vercel.app | Smoke test passes against it from outside |
| M11 | CSV button | Saves the monthly numbers of the current selection, built in the browser; header rows explain columns and sources | Oracle: Bulgaria CSV matches the country file row by row |
| M12 | Tests on hot paths | Select, load calendar, convert, CSV, language switch | Test log with counts (M131) |
| M13 | Chance of fire this month | Share of past years with ≥ 1 fire cell-day in this place and month, with a Jeffreys interval (a standard range for a proportion) | Backtest at 0.25°: fit on earlier years, test on later; Brier score and reliability chart on the proof page (M112); leakage check (M62) |
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

---

## 3. Screens

| Screen | Contents |
|---|---|
| **Globe (home)** | Full-screen globe; search box (country); tap to drop a point; layer panel; base-map switcher; language switch; install hint |
| **Area report** (side panel; bottom sheet on phones) | Title and data date; fire calendar; mode toggle (Harmonized / Measured per satellite / Fire intensity); "Is this unusual?" card; chance-of-fire card; yearly trend chart with measured vs estimated and bands; CSV button; share button; "Alert me here"; advice card |
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
| Base maps | NASA GIBS Blue Marble and Black Marble, no key `[V]` | — | NASA, credit requested | S6 |
| Country borders | Natural Earth admin-0 | — | Public domain | M3 |
| Outside checks | EFFIS Bulgaria JSON API (2006–2026) `[V]`; NIFC statistics (1983–2025) `[V]`; MODIS MCD64A1 burned area | — | Open | Proof page (M41) |

**Cleaning rules:** keep vegetation fires (`type = 0`), MODIS confidence ≥ 30, VIIRS confidence `n` or `h`.

**Trap:** firms-catalog leaves `type` empty for recent near-real-time rows. Treat empty as "keep unless on the static-source mask", or recent months vanish `[V]`.

### 4.2 Pipeline (teammates; status 14 Nov)

- **Done `[V]`:** all 10,095 country files downloaded (43.5 GB). 461,501,221 detections kept; 324,312,197 cell-days. Checks M125 and M32 pass. Scripts: `pipeline/download_firms.py`, `pipeline/build_cells.py`.
- **Findings `[V]`:**
  - worldwide, S-NPP sees about 2.7× MODIS cell-days, steady across years;
  - S-NPP has 34 missing days in 2022 and 2024, filled from NOAA-20, which agrees within about 1%;
  - Terra drops in 2022–2025, likely orbit drift `[U]`;
  - Terra alone sees about half of what Aqua sees.
- **Next:** training pairs, models, validation, harmonized table (see section 10 for the grid and test-year decision).

### 4.3 The contract between pipeline and app

The app reads only these files. The pipeline team writes `pipeline/export_app.py`; the oracle agent checks its totals.

| File | Contents | Size `[U]` |
|---|---|---|
| `web/public/data/meta.json` | Data version, build date, last data date, source list | < 5 KB |
| `web/public/data/countries/<ISO3>.json` | Monthly series for the country: `y, m, harm, lo, hi, terra, aqua, snpp, noaa20, noaa21, frp, src, flags` | ~250 files, a few KB each |
| `web/public/data/tiles/<lat0>_<lon0>.json` | Every fire cell in that 5° × 5° square, with its monthly series (fire months only) | ~1,000 files, 60–80 MB in total |
| `web/public/data/globe/<year>.json` | Per-cell yearly totals for the globe layer | ~0.3 MB each, gzipped |
| `web/public/data/validation.json` | Everything the proof page shows | < 1 MB |

**Rules for the files:**
- **Cell id (0.25° grid):** `row = floor((90 − lat) / 0.25)`, `col = floor((lon + 180) / 0.25)`, `cell_id = row × 1440 + col`. This is NASA's 1440 × 720 grid `[V]`.
- **No data vs zero** (from features suggestion 2): `0` means the satellites looked and saw no fire; `null` means no measurement (before Nov 2000, or a satellite gap that wasn't filled). The calendar shows them differently.
- **Labels:** `src` is one of `estimated_terra` (Nov 2000 – Jun 2002), `estimated_modis` (Jul 2002 – 2011), `measured`, `measured_calibrated` (NOAA-20/21), or `provisional` (near-real-time months).
- **Size limit:** if the total goes over about 85 MB, pack the tiles into one file on Vercel Blob and read it by byte range.

---

## 5. Architecture and stack

| Layer | Choice | Notes |
|---|---|---|
| Hosting | **Vercel**, project `emerge` | Linked to GitHub `main` `[V]`. Builds are paused (ignore command `exit 0`) until `web/` exists; then set Root Directory to `web` and remove the pause |
| App | **Next.js** (App Router, TypeScript) in `web/` | The map is a client-only component |
| Globe and map | **MapLibre GL JS** (globe since v5 `[V]`; current 6.x, BSD-3) with react-map-gl | Same code for globe and 2D |
| Data layers | **deck.gl** 9.x on the MapLibre globe `[V]` | Fire cells, points, selection |
| Calendar and charts | Custom SVG with d3-scale; a colour-blind-safe sequential ramp | Accessible colours (challenge suggestion) |
| Languages | next-intl or react-i18next; `en.json`, `bg.json` | Glossary keys shared |
| Installable app | Web manifest + service worker (Next.js PWA guide `[V]`) | Offline shell only |
| Push | `web-push` (MPL-2.0 `[V]`); Vercel functions `/api/subscribe`, `/api/unsubscribe`, `/api/check-alerts`; **Upstash Redis** for sign-ups; **GitHub Actions** schedule triggers the check (Vercel's free plan runs scheduled jobs only once a day `[V]`) | Places rounded to 0.1°; one push per point per day |
| Raw points for a cell | Vercel function querying firms-catalog with DuckDB using `ST_Intersects` (5 s vs 49 s `[V]`), cached | Fallback: a slim Bulgaria + USA points file |
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

## 7. Order of work and checkpoints (Sofia time)

| When | App stream (this repo, AI agents) | Pipeline stream (teammates) | Checkpoint evidence |
|---|---|---|---|
| Sat 16:30 | Spec OK. Scaffold `web/` (Next.js), set Vercel Root Directory, unpause builds; oracle agent starts | Training pairs; agree section 10 decisions | First page live at the public URL |
| **Sat 19:00 · CP1** | Globe, layer panel, country search, tap-to-select, languages, installable shell, on mock files in the section 4.3 format | Models fitted on Bulgaria + USA | Works on a phone; oracle tests written and failing |
| **Sat 22:00 · CP2** | Calendar, unusual card, chance of fire, CSV, wired to real Bulgaria + USA files | Validation report v1; `export_app.py` | Bulgaria end to end with real numbers, live |
| **Sun 02:00 · CP3** | World files; proof page; recent fires; fire-danger tiles | World harmonized table exported | Whole world live; all Must tests green with counts |
| 02:00–08:00 | Push alerts, share links, intensity, advice, polish | Bands, slices, outside checks | — |
| **Sun 08:00 · CP4** | **Feature freeze for Sofia**; bug fixes; Bulgarian review | — | Smoke test passes |
| 10:00–12:30 | 30-second video with English subtitles (fits Sofia's 30–60 s and NASA's ≤ 30 s) | — | — |
| **Sun 13:30 · CP5** | **Sofia video submitted** (due 14:00) | — | Link opens without login |
| **Sun 22:00 · CP6** | **NASA submission** (due 23:59): References, AI-usage note, all fields in English | — | Confirmation screen |

**First cuts if late, in order:**
1. S8 advice;
2. S9 intensity;
3. globe polish (2D fallback);
4. push alerts, replaced by an in-app banner;
5. the raw-points function, replaced by Bulgaria + USA points only.

---

## 8. Wording and safety rules

- Never use official warning words ("Warning", "Red Flag", "Code Red"). Use "Fire danger (official forecast)" and "Risk outlook (unofficial)".
- Every risk view shows: "Research prototype. Not an official warning. Follow local authorities (112 / 911)", plus links to EFFIS/GWIS, NIFC and NIMH (meteo.bg).
- Push wording in English and Bulgarian is in [`../docs/research/push-alerts.md`](../docs/research/push-alerts.md).
- No people's images, voices or likeness of anyone under 18 in the video (NASA rule).

---

## 9. Tracking for the submission

- `docs/references.md`: every dataset, library, image and tool, with link and licence, added when first used.
- `docs/si-usage.md`: how AI was used (research agents, coding agents, oracle agent, the Vercel plugin), updated at each checkpoint.

---

## 10. Open decisions (owner and deadline)

| # | Decision | Options | Proposed | Deadline |
|---|---|---|---|---|
| D-1 | **Harmonization grid** | 0.25° monthly ([`conversion-plan.md`](../docs/conversion-plan.md)) vs 0.1° ([`harmonization-pipeline-plan.md`](../docs/harmonization-pipeline-plan.md)) | **0.25°**: NASA's grid, regions reliable (nRMSE 8% vs 61% per cell `[V]`), smaller files. Keep 0.1° for display only | Sat 17:00 |
| D-2 | **Training and test years** | Train 2012–2018, test 2019–2025; or calibrate within 2012–2022 and test both ways | **Within 2012–2022, test both ways**: Terra drift shows from 2022 `[V]` | Sat 17:00 |
| D-3 | Features suggestion 2 | Point + radius, polygons, more layers, more base maps | **Adopted now:** no-data vs zero, base-map switcher, extensible layer list. **Later:** radius, drawn shapes, weather layers | Team |
| D-4 | GWIS licence | CC BY 4.0 vs EU Data Licence | Check before the demo; credit Copernicus either way | Sun 08:00 |
| D-5 | Teammates' pushes on Vercel's free plan | Whether pushes by non-owners deploy | Test on the first push | Sat 17:00 |
| D-6 | Who pitches on site (J1) | — | Team | Sun 12:00 |
