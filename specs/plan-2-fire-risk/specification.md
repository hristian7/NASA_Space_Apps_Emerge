# Emerge plan 2: next-day fire risk, build specification (long version)

Written Sat 14 Nov 2026, 21:00 EET; revised 21:45: added M36–M39 and S16–S17 from the competitor research, the prediction placeholder and section 12 (shortcuts); revised 22:00 after a double-check (one label satellite, no leakage from history or plant normals, lead +3, monthly plant greenness, week-outlook horizon, scheduled-job keep-alive, D-17 and account steps, checkpoints matched to the build plan). The one-page version is [`overview.md`](overview.md). This file is what the build follows for plan 2: scope, data, engine, proof, screens, file contract, tests, order of work, shortcuts and open decisions.

**Authorities:**
- **Feature priority:** [`../features-moscow.md`](../features-moscow.md), section "Plan 2". Built here: Musts M30–M39 and Shoulds S12–S17.
- **Why these features:** the firefighter interview ([`../../docs/research/firefighter-interview.md`](../../docs/research/firefighter-interview.md)) for M30–M35 and S12–S15; the competitor research ([`../../docs/research/feature-map.md`](../../docs/research/feature-map.md), [`../../docs/research/competitors.md`](../../docs/research/competitors.md)) for M36–M39 and S16–S17.
- **Every data source and its status:** [`../../docs/data-sources-master.md`](../../docs/data-sources-master.md).
- **Shared parts** (stack, hosting, languages, points-only data, wording rules, tracking): plan 1's [`../specification.md`](../specification.md). This file says only where plan 2 differs or adds.
- **Earlier forecasting research:** [`../../docs/research/forecast-options.md`](../../docs/research/forecast-options.md).

**Tags:** `[V]` verified at a primary source · `[D]` directional · `[U]` our inference.

---

## 1. Goal and users

**Goal:** for every region in the world, rank the spots most likely to have a **new** vegetation fire tomorrow (and today), explain each spot in plain words, and publish how accurate the ranking was.

**Users:**
- regional fire services, which decide one day ahead where to place teams;
- forest agencies and volunteers;
- the Sofia and NASA judges.

**Success measure, fixed before testing:** on fire seasons the engine never saw, our top 5 spots per region catch more of the next day's new fires than (a) the official fire-danger index (FWI) ranked the same way and (b) fire history alone. Section 6 gives the exact metric.

**Not an official warning service.** It is a research prototype; every screen links to official services and the emergency number.

---

## 2. Scope: what is built

### Musts

| # | Feature | Done when |
|---|---|---|
| M30 | **Top risk spots per region** | For any region (province or state) in any country, the app lists the top 10 spots for today and tomorrow, ranked, and shows them on the map. Picking a region takes ≤ 2 taps, or 1 tap on the map |
| M31 | **Next-day risk engine** | A trained model scores every land spot for tomorrow (section 5), runs daily without a person, and writes the files in section 8 |
| M32 | **All the data that drives fire** | Every input in section 4.1 is downloaded for the training years and for each new day, on one grid, with "no data" kept apart from zero |
| M33 | **Scorecard** | The proof page shows the hold-out test results against the baselines (section 6), and a daily log: yesterday's top spots vs NASA detections, for us and for the official index |
| M34 | **"Why this spot"** | Each listed spot shows its 2–4 strongest reasons in plain words, from the actual input values (section 5.4) |
| M35 | **One screen instead of 10 websites** | One page holds tomorrow's spots, the official fire-danger layer (plan 1 S3), fires in the last 24 h (plan 1 S5), a link to the spot's fire history (plan 1 area report), and links to EFFIS, NASA FIRMS, Google's wildfire information and the national fire service. The area report also gets a **"Tomorrow's risk here"** card |

**Prediction placeholder (part of M30 and M35):** until the engine passes its hold-out test (section 6), the fire-risk screen and the "Tomorrow's risk here" card show a clear placeholder: "Tomorrow's fire risk: being built and tested. Here is what it will show." Both are built and tested on the example files (section 8). Switching to real answers is a data change only, with no new app code.

**Musts from the competitor research** (fixes to the history report and proof page). Exact files and scope: [`feature-map.md`](../../docs/research/feature-map.md), "Shortlist before the Sunday 08:00 freeze", ranks 1–4.

| # | Feature | Done when |
|---|---|---|
| M36 | **Real official fire numbers** (fixes M28) | The "detected vs reported" card shows **national reported** numbers, labelled apart from **satellite-mapped** estimates: Bulgaria from the Executive Forest Agency (2021–2025 `[V]`), EU countries from the EFFIS spreadsheet (1980–2024 `[V]`), the USA from NIFC (1983–2025 `[V]`). Each shows its source, date fetched and scope (for example "forest fires only"). A second agent checks every transcribed row against the source |
| M37 | **Date and source on every number** | The first result in a report says which period it covers ("data to 14 Nov 2026"), and history, reported numbers and live layers each show their own date, so they never look like the same moment |
| M38 | **Name the comparison years** | "Is this unusual?" lists the exact past years it used and how many, taken from the same data as the calculation. Its "above/below normal" sentence is generated from the numbers and covered by a test, never typed by hand |
| M39 | **Plain verdict on the proof page** | Above the test tables, 2–3 plain lines say what was tested, at what scale, what passed, what failed (for example the Bulgaria world-gate check) and what is not measured yet. Read from the existing validation file; no new scores |

### Shoulds (build order)

| # | Feature | Done when |
|---|---|---|
| S15 | **Fire type label** | Every listed spot and every recent fire shows "forest", "farmland" or "grass and shrubs", from the land-cover map |
| S14 | **Crew suggestion** (builds on plan 1 S8) | Spot 1 of each region carries a rule-based line, such as "Consider a standby team near here tomorrow", with the disclaimer |
| S13 | **Wind on the map** | Arrows show wind speed and direction for today and tomorrow over the selected region |
| S12 | **Week outlook** | The following days, as far as the newest GFWED run reaches (it gives +1 to +8 from a run 1–2 days old `[V]`, so usually up to 5–6 days ahead), scored with the same engine, shown with a "less certain" label, and scored separately by lead day |
| S16 | **Fire heat in "this fire vs past fires"** (feature map rank 5) | The card shows the fire heat (FRP) it already receives, with units, next to the same days in past years; missing heat shows as "no data" |
| S17 | **Season-so-far chart** (feature map rank 7) | A line adds up this year's fires month by month against the median of past years, for completed months only; gaps stay gaps |

### Later (recorded, not built here)

- **Could:** C11 model that improves each season · C12 sharper 1–2 km spots · C13 printable daily brief · C15 method sheet for fire chiefs.
- **Won't for now:** W9 fire-station locations · W10 firebreak planning · W11 web cameras · W12 live response coordination. Dropped: a fire-spread hint, and a label explaining "history chance vs weather forecast" (the placeholder above replaces it).
- **Later from the competitor research** (C16 in the feature list): the "later" items in [`feature-map.md`](../../docs/research/feature-map.md), such as satellite switches, saved places, monthly reported charts, causes and costs, land-cover and population overlays, smoke and air quality, time-lapse and fire-season length.

### How plan 2 uses plan 1

| Plan 1 part | Use in plan 2 |
|---|---|
| FIRMS pipeline and its 461 million cleaned detections `[V]` | Fire history |
| Plan 1's cell-day table `cell_days.parquet` (324,312,197 cell-days `[V]`, same cleaning rules) | The training labels, with one DuckDB query (shortcut 2) |
| Area report, proof page, layer registry, `/api/recent` route | Patterns and parts reused for the risk card, scorecard, GFWED layer and `/api/risk` |
| M13 chance of fire this month | One input to the engine |
| M18, M29 points-only data | Every risk spot is a point with a `precision_radius_km` |
| S3 official fire danger (GWIS layer), S5 recent fires | Parts of the one screen (M35) |
| Stack, Vercel project, Blob store `emerge-data`, languages, wording rules | Reused as they are |

---

## 3. Key definitions

- **Spot:** one square of the risk grid of size `g` degrees (D-10: develop at `g = 0.25`, ship at `g = 0.1`, about 11 km on a side at the equator `[U]`). Stored as a point at the square's centre with `precision_radius_km` = half its diagonal.
- **Spot id:** `row = floor((90 − lat) / g)`, `col = floor((lon + 180) / g)`, `spot_id = row × (360 / g) + col`. At `g = 0.25` this is exactly plan 1's cell id (1,440 columns); at `g = 0.1` it has 3,600 columns. Every file records `g`, so ids from different grids are never mixed.
- **Region:** a first-level area inside a country (province, state, oblast), from Natural Earth admin-1. Each spot belongs to the region that holds its centre. Spots at sea are dropped.
- **Day:** a UTC date, the same as FIRMS's `acq_date` `[V]`. The app shows local dates.
- **New fire on day D (the label):** at least one **NOAA-20** VIIRS 375 m detection on day D in the spot (cleaning rules as in plan 1: confidence `n` or `h`, outside the static-source mask), and **none in that spot on D−1 and D−2** (D-15). Fires that are still burning are labelled "continuing" and scored separately, because counting them would make any forecast look good.
- **Why NOAA-20 only:** the same satellite exists for every training year (from 1 Apr 2018 `[V]`) and live. S-NPP stopped on 2 Nov 2026 `[V]`, and adding NOAA-21 live would catch more fires than in training, which would make the live score look better or worse for the wrong reason. NOAA-21 and S-NPP stay in the map layers, not in the labels.
- **Forest fire:** a new fire in a spot whose forest share is at least 30% `[U]` (D-13).
- **Risk score:** the engine's probability (0–1) of a new fire in the spot on day D, made on day D−1.
- **Level:** 1 (lowest) to 5 (highest), from fixed probability limits chosen on the validation year. We never use the official class names (section 10).

---

## 4. Data (M32)

### 4.1 Inputs

Checked at the official sources on 14 Nov 2026 unless tagged otherwise.

| Input | What it tells | Past (training) | Tomorrow (live) | Grid | Access |
|---|---|---|---|---|---|
| **Fire weather index (FWI) and its parts** | How much the weather favours fire. It is calculated from temperature, humidity, wind and rain `[D]`. Parts: FFMC (dryness of grass, litter and twigs), DMC (dryness of the upper soil layer), DC (long-term drought), ISI (spread speed), BUI (fuel available) | **NASA GFWED archived GEOS-5 forecasts, from Dec 2017** `[V]` (the same system as live) | **NASA GFWED GEOS-5 forecast:** each run gives days +1 to +8 `[V]`; FFMC, DMC, DC, ISI, BUI, FWI, DSR in the file `[V]`; labelled "experimental" `[V]` | 0.25° `[V]` | Public folder, no login, NetCDF, about 16 MiB a day `[V]`: [GFWED](https://data.giss.nasa.gov/impacts/gfwed/), [files](https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/) |
| FWI, backup | Same | Copernicus CEMS historical fire danger (ERA5), 1940–12 Nov 2026, daily, 0.25° option, CC BY 4.0 `[V]` | None: Copernicus has no numeric forecast dataset `[V]` | 0.25° `[V]` | Free ECMWF account `[D]`. **Goes offline from 16 Nov 2026** for an upgrade, possibly for days `[V]`: download now if needed |
| **Raw weather** (for "why this spot" and wind arrows) | Temperature, humidity, wind speed and direction, rain, in real units | Not needed: the model gets them through the FWI parts | A free gridded forecast (spike (a)): Open-Meteo is free for non-commercial use, no key, but **under 10,000 calls a day** `[V]`, so only per region on demand; or a global weather-model grid `[U]` | 0.25° | [Open-Meteo terms](https://open-meteo.com/en/terms) |
| **Plant dryness from satellites** | How green or dry the plants are compared with normal for this month | NASA MODIS **MOD13C2** v061 **monthly** vegetation index (NDVI), from Feb 2000, about 100 MB a month `[V]`. Normals from years **before** the test year only | The **previous complete month** of MOD13C2 (Oct 2026 was posted on 3 Nov `[V]`), the same lag as in training. Fresher option later: the 16-day MOD13C1 (about 2 weeks behind `[V]`). After MODIS ends: VIIRS **VJ213C1** (NOAA-21) `[V]`. Not VNP13C1: its satellite stopped on 2 Nov 2026 `[V]` | 0.05° `[V]` | LP DAAC, free Earthdata login `[D]` |
| **Forest, farmland or grass** | Share of each land-cover type in the spot | NASA MODIS **MCD12C1** v061: percent of each class in each cell, yearly, latest 2025 `[V]` | Same map | 0.05° `[V]` | LP DAAC, free Earthdata login `[D]` |
| **Fire history** | How often this spot burned in this month in past years; fires last year in this month; days since the last fire; fire nearby in the last 3 days | Plan 1's cell-day table (0.01° cells, one row per cell, day and satellite `[V]`), **only days before the day being predicted** | Same, plus FIRMS near-real-time | `g` | Have it `[V]` |
| **Regions** | Which province or state each spot is in | **Natural Earth admin-1**, public domain, over 4,500 regions `[V]` | Same | Shapes | [Terms](https://www.naturalearthdata.com/about/terms-of-use/) |
| **What really happened** | New fires, for labels and the scorecard | FIRMS VIIRS archive (has the `type` field: 0 vegetation, 1 volcano, 2 other static source, 3 offshore `[V]`) | FIRMS near-real-time, within 3 hours of the pass `[V]`, **without** `type` `[V]`, so the static-source mask is needed | Points | Have it `[V]` |

**Vegetation dryness is never cut:** the weather-based dryness parts (FFMC, DMC, DC) stay in every version; satellite greenness adds to them.

**Data risks found on 14 Nov:**
- **GFWED runs are 1–2 days behind** `[V]` (the 12 Nov run was posted on 13 Nov). So "tomorrow" may come from a 2- or 3-day-old forecast, which is less accurate. The files record the run date; the scorecard reports the lead time used, and training uses the same lead times.
- **Copernicus point values (`ecmwf.query`) came back empty for 13–20 Nov** `[V]`; the NASA layer `nasa_geos5.query` returned numbers. Plan 1's fire-danger card (S3) should use the NASA layer as a fallback.
- **Earthdata login:** MOD13C2 and MCD12C1 need a free NASA Earthdata account `[D]`. The owner creates it; the login goes into the git-ignored `.env` and GitHub Actions secrets, never into git.
- **Grids line up:** the GWIS point query on the NASA layer answered at longitude 23.125 `[V]`, a 0.25° cell centre, the same centres as plan 1's grid. Spike (a) confirms this on the file itself.
- **GitHub switches off scheduled jobs** in a public repo after 60 days with no repo activity `[V]`. Judging runs to 26 Jan, more than 60 days after the hackathon. The daily job therefore commits a one-line status file once a week (`pipeline/risk/last_run.txt`), which also keeps plan 1's weekly refresh alive. Each such commit triggers one Vercel deploy, which is harmless.

### 4.2 Pipeline (`pipeline/risk/`, Python + DuckDB)

| Step | Script | Output |
|---|---|---|
| 1 | `build_grid.py --grid g` | Land spots, with region id, land-cover shares and the static-source mask (reuse plan 1's mask) |
| 2 | `build_labels.py` | New and continuing fires per spot and day, 2021–2025 (NOAA-20), from plan 1's `cell_days.parquet` with one DuckDB query |
| 3 | `build_inputs.py` | Fire weather, NDVI difference from normal and history features per spot and day, for the training days; history uses only earlier days |
| 4 | `train.py` | The model and its validation report (section 5) |
| 5 | `backtest.py` | Test-year results against the baselines (section 6) → `scorecard.json` |
| 6 | `predict_daily.py` | Tomorrow's (and today's) scores for every land spot → top spots per region → files in section 8 |
| 7 | `score_daily.py` | Yesterday's predictions vs FIRMS → adds a line to the daily log |

**Training size:** about 2 million land spots at 0.1° (about 300,000 at 0.25°; ice sheets dropped) `[U]` × 365 days a year is too much to store. So the training table keeps **every spot-day with a new fire plus a random sample of spot-days without** (about 1 in 20 `[U]`, fixed random seed). The model's starting point is then corrected for that sampling, and the probabilities are re-checked on the validation year (calibration), so "1 in 8" really means about 1 in 8.

**Daily job:** a free scheduled GitHub Actions workflow (`.github/workflows/risk-daily.yml`) runs steps 6–7 once a day, after the forecast and FIRMS updates, and uploads the files to the Blob store `emerge-data`. Vercel's free plan also allows one scheduled job a day `[V]`, but the Python job needs more time and memory than a function call `[U]`. Upload keys and any data-account logins are GitHub Actions secrets, never in git.

---

## 5. The engine (M31)

### 5.1 Model

- **Version 1 (Must):** logistic regression, a simple, explainable model that turns weighted inputs into a probability. Fast to train and easy to explain to fire chiefs.
- **Version 2 (if time):** gradient boosting (LightGBM). It replaces version 1 **only if it wins on the validation year**, with no app change (plan 1's "simple model first" shortcut).
- One model for the whole world. It learns climates and seasons from its inputs (month, latitude band, local history), so four-season Bulgaria and places with fewer seasons are handled the same way. No country gets hand-made rules.

### 5.2 Inputs to the model

- **Tomorrow's fire weather:** FWI, FFMC, DMC, DC, ISI, BUI and DSR from the GFWED forecast. These carry temperature, humidity, wind and rain `[D]`, and come from the same system in training and live. Raw temperature and wind in real units are added as separate inputs only if spike (a) finds a past-and-live source from one system; otherwise they are used for display ("why this spot", wind arrows).
- **Plants:** NDVI difference from the normal for this time of year; shares of forest, shrubs and grass, and farmland.
- **History:** the share of past years with a fire in this spot and month (like M13, but recomputed from **earlier years only**, so the test year never leaks into its own inputs); fires in the same month last year; days since the last fire; a fire within 10 km in the last 3 days `[U]`.
- **Season and place:** month (as a cycle), latitude band.
- **Weather where fuel exists:** FWI × forest share, so hot, dry wind counts most where there is forest.

### 5.3 Training, validation and test years (D-12)

- **Proposed:** train on 2021–2023, choose settings on 2024, test once on 2025. The split is by time only, never random, so the model never sees the future.
- **Lead time:** GFWED runs are posted 1–2 days late `[V]`, so "tomorrow" is usually the +2 or +3 day of the newest run. Training uses **+3** (the worst usual case); live uses the freshest run available, which can only be as good or better. The scorecard records the lead used each day.
- **Download size:** one GFWED forecast file a day at lead +3, about 16 MiB each `[V]`, so about 30 GB for 2021–2025 `[U]`. Earlier years (the archive starts Dec 2017 `[V]`) come later, with C11.
- The 2026 season so far is used for the live demo and the daily log, not for training.

### 5.4 "Why this spot" (M34)

For each listed spot, the 2–4 inputs that raise its score the most compared with the region's average, turned into words from a fixed phrase list (English and Bulgarian). With logistic regression this is exact and free: each input's weight × (its value − the region's average). LightGBM gives the same per-input split built in (`pred_contrib`) `[D]`, so no extra library is needed.

The pipeline writes only `why` keys from the FWI parts, plants, forest and history. Real-unit weather ("34 °C", "45 km/h") is added only if spike (a) finds a world weather grid for the daily job; otherwise the app fetches it for the 10 listed spots of the region being viewed (10 Open-Meteo calls, cached for an hour), well inside the free limit `[U]`.

| Input | Example phrase |
|---|---|
| Heat and dryness of fine fuels (FFMC; real temperature if available) | "very hot and dry" ("34 °C") |
| Spread speed (ISI; real wind if available) | "strong wind" ("45 km/h") |
| FFMC, DC, NDVI | "very dry plants", "drier than usual for July" |
| Forest share | "mostly forest" |
| History | "burned in 6 of the last 25 Julys" |
| Recent fire nearby | "a fire was seen within 10 km in the last 3 days" |

### 5.5 Forest first (D-13)

The firefighter's priority is forest. **Proposed default:** rank by the chance of a forest or wildland fire, so farm burning doesn't fill the list; a switch shows all vegetation fires.

---

## 6. Proof: the scorecard (M33)

**The AI is never its own oracle.** NASA's satellite detections are the outside truth; the expected answers are written first by a different agent (section 9).

### 6.1 Hold-out test (before the demo)

For each region and each test-year day with at least one new fire, take the top 5 spots (D-14) and compute:

| Measure | Plain meaning |
|---|---|
| **Capture rate** (main) | Share of the region's new fires that fell in our top 5 spots |
| Hit rate | Share of region-days where at least one of the top 5 had a new fire |
| Brier skill score | How much better our probabilities are than history alone (0 = no better) |
| Reliability chart | When we say 10%, does a fire happen about 10% of the time? |

**Baselines, ranked the same way:**
1. **Official index:** rank spots by tomorrow's FWI from the same GFWED file (the index GWIS shows as `nasa_geos5.fwi`), so the comparison is like for like;
2. **History:** rank by the chance of fire this month (M13);
3. **Random** (a sanity floor).

**Slices:** by world region, month, forest vs other land, and new vs continuing fires. Weak slices are shown, not hidden.

**Both rankings are scored:** forest and wildland fires (the default, D-13) and all vegetation fires. Metrics run as DuckDB SQL with a rank per region and day, so the whole world scores in minutes, not hours `[U]`.

**Claim rule:** "more accurate than the official index" only if our capture rate beats it on the test year, and the difference holds when the days are resampled (a bootstrap, which repeats the test on random re-draws of days) `[U]`. Otherwise the app says where we win and where we don't.

**Write the rules first:** the metric, the top-5 size, the test year and the baselines are committed in `pipeline/risk/PROTOCOL.md` before anyone sees test results (pre-registration, V-M58).

### 6.2 Daily log (live)

Every day, a few hours after UTC midnight (FIRMS posts near-real-time data within 3 hours of each pass `[V]`), the job compares yesterday's top spots with the new fires seen, for us and for the official-index baseline, and adds one line per region. The proof page shows the last 7 and 30 days.

**Note:** judging runs from 3 Dec to 26 Jan. That is winter in Bulgaria, with few fires, and the fire season in the southern hemisphere. The daily log will mostly show Australia, southern Africa and South America then `[U]`.

---

## 7. Screens

| Screen | Contents |
|---|---|
| **Fire risk (one screen, M35)** | Day switch: Today / **Tomorrow** (default) / Week (S12). Region picker (country → region), or tap the map. Ranked list of spots 1–10: level, chance in words ("about 1 in 8"), "why" (M34), fire type (S15), crew suggestion on spot 1 (S14). Map: spots as points sized by level; layers for official fire danger (S3), fires in the last 24 h (S5) and wind arrows (S13). Links: EFFIS, NASA FIRMS, Google's wildfire information, the national fire service, 112. "History" button → plan 1 area report for the spot |
| **Placeholder (until the engine passes its test)** | The same screen and the "Tomorrow's risk here" card, with "Tomorrow's fire risk: being built and tested", a short list of what it will show, and the links to official services. Driven by `meta.json` (`"engine_ready": false`), so going live needs no new code |
| **Area report additions** (plan 1 screen) | "Tomorrow's risk here" card (M35); data date and source by the first result (M37); comparison years in "Is this unusual?" (M38); official reported numbers labelled apart from satellite estimates (M36); fire heat in "this fire vs past fires" (S16); season-so-far chart (S17) |
| **Scorecard** (part of "How we know it's right") | The plain verdict on top (M39); hold-out results vs baselines with charts; weak slices; daily log for the last 7 and 30 days |
| **About** | Data sources with licences, method in plain words, limits, disclaimer |

Phone first: the list is a bottom sheet over the map.

---

## 8. The contract between pipeline and app

The app reads only these files. The pipeline writes them; the oracle agent checks samples.

| File | Where | Contents | Size `[U]` |
|---|---|---|---|
| `risk/meta.json` | Blob | `engine_ready` (false until the hold-out test passes), model version, when made, the dates each file is valid for, input dates and sources | < 5 KB |
| `risk/latest.json.gz` | Blob | For every region: the top 10 spots for today and tomorrow, with their inputs | about 35 MB raw, 6 MB gzipped |
| `risk/week.json.gz` | Blob | Days 2–7, top 10 per region (S12) | about 3 times `latest` |
| `risk/archive/<date>.json.gz` | Blob | Each day's top 10 per region, with only `spot_id`, `rank` and `p`, for the scorecard | about 1 MB each |
| `risk/scorecard.json` | Blob | Hold-out results, slices and the daily log | < 1 MB |
| `risk/wind.json.gz` | Blob | Wind arrows on a 1° grid for today and tomorrow (S13), **only if spike (a) finds a free world weather grid**; otherwise the app fetches wind for the region being viewed from Open-Meteo, cached for an hour | about 1 MB |
| `data/risk/regions.json` | Static in the app | Region id, English and local name, country code, bounding box | about 1 MB |

**Phones never load the whole world file.** A small route in the app, `/api/risk?region=<id>&day=<date>`, reads `latest` or `week` from Blob, keeps it in memory, and returns one region's spots (a few KB). Vercel's network cache keeps each answer for an hour.

**One spot record (points only, M18 and M29):**

```json
{"type": "fire_risk", "spot_id": 1722834, "lat": 42.15, "lon": 23.45,
 "precision_radius_km": 6.9, "region_id": "BG-10", "day": "2026-11-15",
 "rank": 1, "p": 0.12, "level": 4, "fire_type": "forest",
 "inputs": {"fwi": 31.2, "ffmc": 91.0, "dmc": 40.1, "dc": 610, "t_max_c": 34,
            "rh_min": 18, "wind_max_kmh": 45, "wind_dir_deg": 290, "rain_3d_mm": 0,
            "ndvi_diff": -0.08, "forest": 0.72, "farm": 0.05, "grass_shrub": 0.20,
            "hist_p": 0.24, "fire_near_3d": false},
 "why": ["very_hot", "strong_wind", "very_dry", "mostly_forest", "history"]}
```

**Rules for the files:**
- **No data vs zero:** if an input is missing for a spot, its `p` is `null` and the app says "no forecast here", never "no risk".
- **Few uploads:** about 6 uploads a day, so about 180 a month, well under the Blob free plan's 2,000 `[V]`. Never one file per region.
- **Storage:** the daily archive adds about 1 MB a day, about 75 MB through the end of judging, inside the free plan's 1 GB `[V]`.
- The example record is a spot in Rila: its `spot_id` follows the rule in section 3 (row 478, column 2034).
- The `why` keys map to phrases in `en.json` and `bg.json`.

---

## 9. Tests (oracle first)

A separate, cheaper agent writes the expected answers in `tests/expected/risk/` **before** the code, from hand-made samples, in plain Python:
- the new vs continuing label on 10 hand-made FIRMS samples, including the static-source mask;
- spot id and region for known points (for example, a point in Rila and one in Strandzha);
- the top-N ranking inside a region on a toy table;
- capture rate, hit rate and Brier skill on toy predictions, computed by hand;
- the time split: no training row on or after the first validation day (a leakage check);
- `null` inputs giving `null` scores, never 0;
- for M36: every transcribed reported row matches its source table, checked by an agent that did not transcribe it;
- for M38: the listed comparison years for an early year, a year with a gap, and a changed date range;
- for M38: "above" and "below" sentences on numbers just above, equal to and just below normal (the JRC page got this wrong once `[V]`).

| Method | What it checks | Priority |
|---|---|---|
| V-M44 hold-out backtest | The engine predicts a year it never saw | Must |
| V-M58 pre-registration | Rules committed before the test results | Must |
| V-M62 leakage check | No future data in training | Must |
| V-M19 known-answer tests | The list above | Must |
| V-M112 calibration | Reliability chart | Should |
| V-M124 slices | Region, month, forest, new vs continuing | Should |
| V-M41 triangulation | Our FWI input at a known place and date vs the EFFIS viewer | Should |

---

## 10. Wording and safety

Plan 1's rules apply (section 9 there). Also:
- The list is titled **"Risk outlook (unofficial)"**. Levels are "Level 1–5", never the official class names ("high", "very high", "extreme") or warning words.
- Chances are given in words ("about 1 in 8"), with the number on tap.
- The crew suggestion always says "consider" and ends with "Decisions rest with the fire service."
- Every screen shows: "Research prototype. Not an official warning. Follow local authorities (112)."

---

## 11. Order of work

### 11.1 Critical path

1. **Five risk spikes, 30 minutes each, run in parallel by subagents:**
   - (a) download today's GFWED forecast run and read FWI for Rila on +1 day (the source is checked; this tests the reading), and find a free source of raw temperature and wind as numbers;
   - (b) download one month of archived GFWED forecasts and time it, to confirm about 30 GB is feasible overnight;
   - (c) forest share from MCD12C1 for Bulgaria (needs the Earthdata login);
   - (d) one MOD13C1 composite for Bulgaria, compared with its normal;
   - (e) the Natural Earth admin-1 regions and the 0.1° spot grid with region ids.
2. **Freeze the contract** (section 8) with example files and the placeholder; commit `PROTOCOL.md` (the test rules). The app builds against the example files.
3. **Labels → baselines scored end to end at 0.25°** (shortcut 3), Europe first.
4. **Training table → version 1 model → hold-out test,** Europe first, then the world, then the final 0.1° run.
5. **Daily job** (predict and score) uploading to Blob.
6. **App screens** on the example files, in parallel with 3–5. **Report fixes M36–M39, S16, S17** run in parallel from the start, in plan 1's lanes; they need no plan 2 data.
7. **Scorecard page** with the real test results; set `engine_ready` only if the test passed.

### 11.2 Lanes (same computer and rules as plan 1, section 7.2)

| Lane | Builds | Owns folders |
|---|---|---|
| **A. Design and app** | Fire-risk screen, list, map layers, wind arrows, scorecard page, texts | `web/src/app/risk/`, `web/src/components/risk/`, `web/messages/` (risk keys) |
| **B. Data and logic** | Contract types, file loading, ranking display logic, phrases | `web/src/lib/risk/`, `web/src/types/risk.ts` |
| **Pipeline-risk** | Spikes, steps 1–7, daily job | `pipeline/risk/`, `.github/workflows/risk-daily.yml` |
| **Oracle** | Expected answers | `tests/expected/risk/` |
| **Report fixes (plan 1 lanes A and B)** | M36–M39, S16, S17: they change plan 1's report and proof files, so plan 1's owners of those files build them (files listed in the feature map's shortlist) | `web/src/components/report/`, `web/src/app/proof/`, `pipeline/export_reported.py` |

### 11.3 Time and checkpoints `[U]`

Times match the team's current build plan ([`../../docs/plans/build-plan.md`](../../docs/plans/build-plan.md): CP2 Sun 00:30, CP3 04:00, CP4 08:00). **Honest size:** plan 2's engine Musts (M30–M35) are about 20–30 hours of agent work, the report fixes (M36–M39) about 5–8, and the Shoulds about 7–11, on top of plan 1, which is already tight. The shortcuts in section 12 cut this by roughly a third `[U]`. **Plan 1 stays the NASA challenge core.** Plan 2 runs in its own lanes.

| When (Sofia time) | Evidence that must exist |
|---|---|
| **Sat 23:30 · R0** | Spikes answered; D-10 to D-15 decided; contract, example files and the placeholder committed; protocol (`PROTOCOL.md`) committed; oracle tests written and failing |
| **Sun 01:30 · R0.5** | Baselines (official index, history) scored end to end at 0.25° for Europe: the scorecard works before the model exists. M37–M39 merged |
| **Sun 04:00 · R1** (with plan 1's CP3) | Version 1 trained; hold-out test for Europe in `scorecard.json`; M36 rows checked by the second agent |
| **Sun 06:00 · R2** | World predictions for tomorrow on Blob at the final grid; `engine_ready` set to true only if the test passed; the fire-risk screen live on the public URL |
| **Sun 08:00 · R3** | Freeze, together with plan 1's CP4; the video shows the fire-risk screen (or its placeholder) and the scorecard |

**First to cut if late, in order:**
1. S17 season-so-far chart;
2. S12 week outlook;
3. S13 wind arrows;
4. version 2 (LightGBM);
5. the final 0.1° run (ship at 0.25°, say so);
6. the world hold-out test, limited to Europe and the USA (world predictions stay).

**If the engine doesn't pass in time:** the placeholder stays, and the scorecard shows the baselines honestly. That is still a working, honest product for the video.

**Never cut:** vegetation dryness, forest share, the scorecard against the official index, and "no data" kept apart from zero.

---

## 12. Shortcuts: faster and cheaper, same or better quality

Plan 1's 14 shortcuts (its section 8) apply too. These are specific to plan 2.

| # | Shortcut | Saves `[U]` | Quality effect |
|---|---|---|---|
| 1 | **Develop at 0.25°, ship at 0.1°.** The grid size is one setting. 0.25° matches the GFWED weather grid and plan 1's cell id, and has about 6 times fewer squares, so every run during development is fast. The final run uses 0.1° with the same code | Hours of training and re-runs | Same final result; bugs are found sooner |
| 2 | **Labels from plan 1's cell-day table** (`cell_days.parquet`) with one DuckDB query, not from the 43.5 GB of CSV files | 1–2 h | Higher: the same cleaning rules as plan 1, so the two plans agree |
| 3 | **Baselines first.** Ranking by the official index and by history needs no training. Build and test the whole scorecard on them before the model exists; the model then only has to beat them | Debugging time | Higher: the scorecard is proven on simple inputs; and there is an honest fallback if the model is late |
| 4 | **Download only what the model uses.** One GFWED file a day at the live lead time, 8 downloads at once, each turned straight into a land-only Parquet of the 7 index values, then the NetCDF is deleted | Disk and download time (about 30 GB becomes a few GB) | Same |
| 5 | **Static inputs computed once.** Land cover, plant-greenness normals, regions and history per spot go into one Parquet file on Blob. The daily job then downloads only the day's GFWED file (about 16 MiB `[V]`) and the FIRMS 24-hour files | The daily run takes minutes, not hours | Higher: the daily job has fewer moving parts |
| 6 | **The pipeline writes the answers; the app only shows them.** Ranks, levels, fire type and "why" keys are computed in Python and tested there; the app maps keys to phrases | App code and app tests | Higher: one tested place for every number |
| 7 | **Reuse plan 1's parts:** area report, proof-page tables and charts, the layer registry (GFWED's `nasa_geos5.fwi` becomes one more entry), the `/api/recent` route pattern for `/api/risk`, the Blob store and the language files | New components | Higher: already tested on phones and in two languages |
| 8 | **Placeholder and example files first.** All screens are built and tested before any real prediction exists; going live is a data change (`engine_ready`) | Waiting on the pipeline | Higher: the demo always works |
| 9 | **Write the test rules first, test once** (`PROTOCOL.md`: metric, top 5, test year, baselines) | No re-runs chasing a better score | Higher: a score judges can trust |
| 10 | **Report fixes from data we already have:** M37 uses `meta.last_data_day` and each source's date; M38 the years the calculation already used; M39 the existing validation file; S16 the heat value the card already receives; S17 the monthly series already loaded | No new data or pipeline work | Same data, clearer answers |
| 11 | **Official numbers from one spreadsheet:** EFFIS's `report_2024.xlsx` holds burned area and fire counts for every member country, 1980–2024, at a fixed address with no login `[V]`; Bulgaria's burned area in it matches the Executive Forest Agency to the hectare `[V]`. One parser covers the EU; the Agency's reports add Bulgaria's ground counts, and NIFC covers the USA ([`reported-fires-bg-effis-summary.md`](../../docs/research/reported-fires-bg-effis-summary.md)) | Many manual transcriptions | Higher: one source, checked by a second agent |
| 12 | **Europe first, world by a setting:** the hold-out test runs on Europe first (the Bulgaria demo); the world is the same command with a bigger box | Early answers | Same |
| 13 | **Brief agents with section numbers and file paths, not pasted text.** The feature map's shortlist already lists the exact files for M36–M39, S16 and S17; the data register stops repeat research; each spike writes 5 lines to `docs/plans/spike-results.md` | Tokens and agent time | Same |
| 14 | **Right-sized models:** a cheaper model for fixtures, phrase lists, translations and transcription; the strongest for the engine, the leakage check and the final review. Reviews read the diff, not the whole repo | Tokens | Same |
| 15 | **Test the Copernicus addresses from the build machine first:** the research sandbox failed TLS checks on `*.copernicus.eu` `[V]`, which can look like an outage | A false dead end | Same |
| 16 | **Monthly plant greenness (MOD13C2) instead of 16-day:** 12 files a year instead of 23, about 100 MB each `[V]`, with the same lag in training and live | About half the NDVI downloads | Same or higher: training and live match exactly |
| 17 | **Train at the worst usual lead (+3):** one download per day covers training; live forecasts are fresher, never worse | Half of a two-lead download | Higher: no surprise when the live run is late |
| 18 | **Exact "why" for free:** logistic weights × (value − region average), or LightGBM's built-in per-input split | No explanation library | Higher: reasons match the score exactly |
| 19 | **Score in SQL:** rank per region and day with DuckDB window functions | Hours of Python loops | Same |
| 20 | **One label satellite (NOAA-20)** for training and live | Re-weighting work later | Higher: the live score means the same as the test score |

---

## 13. Open decisions (owner and deadline)

| # | Decision | Options | Proposed | Deadline |
|---|---|---|---|---|
| D-10 | **Spot size** | 0.05° · 0.1° · 0.25° | **Develop at 0.25°, ship at 0.1° (about 11 km)** (shortcut 1): close to "a place on the mountain", and still small files. Ship at 0.25° if the 0.1° run is late, and say so | Sat 23:30 |
| D-11 | **Fire-weather source** | NASA GFWED GEOS-5 forecasts (past forecasts from Dec 2017 and live, one system, 0.25°, no login `[V]`) · Copernicus CEMS (past only; no numeric forecast `[V]`; offline from 16 Nov `[V]`) | **NASA GFWED for both.** It is the only free numeric next-day source found `[V]`, and it is NASA data | Sat 23:30 |
| D-12 | **Years** | Train, validate, test | **Train 2021–2023, validate 2024, test 2025** (about 30 GB `[U]`); earlier years later | Sat 23:30 |
| D-13 | **Default ranking** | Forest and wildland fires · all vegetation fires | **Forest and wildland by default**, with an "all fires" switch | Sat 23:30 |
| D-14 | **List size** | Top 5 scored, top 10 shown · other | **Top 5 scored, top 10 shown** | Sat 23:30 |
| D-15 | **"New fire"** | No detection in the spot on the previous 1, 2 or 3 days | **2 days** | Sat 23:30 |
| D-16 | **Bulgaria's "reported" number (M36)** | The Executive Forest Agency's ground count (all fires reported) · EFFIS's mapped fires (about 30 ha or more) | **Show both, clearly named:** "reported by the Forest Agency" and "mapped from satellite by EFFIS". Burned area agrees between them; fire counts differ by method `[V]` | Sun 01:30 |
| D-17 | **Land-cover source** | NASA MCD12C1 (0.05°, class shares, Earthdata login `[V]`) · MODIS 500 m mosaic on Zenodo (no login, but **CC BY-SA 4.0**, so anything built from it must share alike `[V]`) | **MCD12C1:** the login takes minutes and avoids the share-alike condition | Sat 23:30 |

**Account steps only the owner can do** (one-time):
- create a free **NASA Earthdata** login (MCD12C1, MOD13C2), and put it in the git-ignored `.env`;
- add **GitHub Actions secrets** for the daily job: `BLOB_READ_WRITE_TOKEN` and the Earthdata login. Secrets are never printed or committed.
