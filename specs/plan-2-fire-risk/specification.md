# Emerge plan 2: next-day fire risk, build specification (long version)

Written Sat 14 Nov 2026, 21:00 EET. The one-page version is [`overview.md`](overview.md). This file is what the build follows for plan 2: scope, data, engine, proof, screens, file contract, tests, order of work and open decisions.

**Authorities:**
- **Feature priority:** [`../features-moscow.md`](../features-moscow.md), section "Plan 2". Only Musts M30–M35 and Shoulds S12–S15 are built here.
- **Why these features:** [`../../docs/research/firefighter-interview.md`](../../docs/research/firefighter-interview.md).
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
| M35 | **One screen instead of 10 websites** | One page holds tomorrow's spots, the official fire-danger layer (plan 1 S3), fires in the last 24 h (plan 1 S5), a link to the spot's fire history (plan 1 area report), and links to EFFIS, NASA FIRMS, Google's wildfire information and the national fire service |

### Shoulds (build order)

| # | Feature | Done when |
|---|---|---|
| S15 | **Fire type label** | Every listed spot and every recent fire shows "forest", "farmland" or "grass and shrubs", from the land-cover map |
| S14 | **Crew suggestion** (builds on plan 1 S8) | Spot 1 of each region carries a rule-based line, such as "Consider a standby team near here tomorrow", with the disclaimer |
| S13 | **Wind on the map** | Arrows show wind speed and direction for today and tomorrow over the selected region |
| S12 | **Week outlook** | Days 2–7 are scored with the same engine where forecast inputs exist, shown with a "less certain" label, and scored separately in the scorecard by lead day |

### Later (recorded, not built here)

- **Could:** C11 model that improves each season · C12 sharper 1–2 km spots · C13 printable daily brief · C15 method sheet for fire chiefs.
- **Won't for now:** W9 fire-station locations · W10 firebreak planning · W11 web cameras · W12 live response coordination. Dropped: a fire-spread hint.

### How plan 2 uses plan 1

| Plan 1 part | Use in plan 2 |
|---|---|
| FIRMS pipeline and its 461 million cleaned detections `[V]` | Fire history and the training labels |
| M13 chance of fire this month | One input to the engine |
| M18, M29 points-only data | Every risk spot is a point with a `precision_radius_km` |
| S3 official fire danger (GWIS layer), S5 recent fires | Parts of the one screen (M35) |
| Stack, Vercel project, Blob store `emerge-data`, languages, wording rules | Reused as they are |

---

## 3. Key definitions

- **Spot:** one square of the risk grid (D-10; default 0.1°, about 11 km on a side at the equator `[U]`). Stored as a point at the square's centre with `precision_radius_km` = half its diagonal.
- **Spot id:** `row = floor((90 − lat) / 0.1)`, `col = floor((lon + 180) / 0.1)`, `spot_id = row × 3600 + col`. This is the same rule as plan 1's cell id, at 0.1°.
- **Region:** a first-level area inside a country (province, state, oblast), from Natural Earth admin-1. Each spot belongs to the region that holds its centre. Spots at sea are dropped.
- **Day:** a UTC date, the same as FIRMS's `acq_date` `[V]`. The app shows local dates.
- **New fire on day D (the label):** at least one VIIRS 375 m detection on day D in the spot (cleaning rules as in plan 1: confidence `n` or `h`, outside the static-source mask), and **none in that spot on D−1 and D−2** (D-15). Fires that are still burning are labelled "continuing" and scored separately, because counting them would make any forecast look good.
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
| **Plant dryness from satellites** | How green or dry the plants are compared with normal for this time of year | NASA MODIS **MOD13C1** v061 vegetation index (NDVI), 16-day `[V]` | Latest MOD13C1 composite (16–31 Oct 2026 on 14 Nov, so about 2 weeks behind `[V]`). After MODIS ends: VIIRS **VJ213C1** (NOAA-21) `[V]`. Not VNP13C1: its satellite stopped on 2 Nov 2026 `[V]` | 0.05° `[V]` | LP DAAC, free Earthdata login `[D]` |
| **Forest, farmland or grass** | Share of each land-cover type in the spot | NASA MODIS **MCD12C1** v061: percent of each class in each cell, yearly, latest 2025 `[V]` | Same map | 0.05° `[V]` | LP DAAC, free Earthdata login `[D]` |
| **Fire history** | How often this spot burned in this month across 25 years; fires last year in this month; days since the last fire; fire nearby in the last 3 days | Plan 1 pipeline (FIRMS record) | Same, plus FIRMS near-real-time | 0.1° | Have it `[V]` |
| **Regions** | Which province or state each spot is in | **Natural Earth admin-1**, public domain, over 4,500 regions `[V]` | Same | Shapes | [Terms](https://www.naturalearthdata.com/about/terms-of-use/) |
| **What really happened** | New fires, for labels and the scorecard | FIRMS VIIRS archive (has the `type` field: 0 vegetation, 1 volcano, 2 other static source, 3 offshore `[V]`) | FIRMS near-real-time, within 3 hours of the pass `[V]`, **without** `type` `[V]`, so the static-source mask is needed | Points | Have it `[V]` |

**Vegetation dryness is never cut:** the weather-based dryness parts (FFMC, DMC, DC) stay in every version; satellite greenness adds to them.

**Data risks found on 14 Nov:**
- **GFWED runs are 1–2 days behind** `[V]` (the 12 Nov run was posted on 13 Nov). So "tomorrow" may come from a 2- or 3-day-old forecast, which is less accurate. The files record the run date; the scorecard reports the lead time used, and training uses the same lead times.
- **Copernicus point values (`ecmwf.query`) came back empty for 13–20 Nov** `[V]`; the NASA layer `nasa_geos5.query` returned numbers. Plan 1's fire-danger card (S3) should use the NASA layer as a fallback.
- **Earthdata login:** MOD13C1 and MCD12C1 need a free NASA Earthdata account `[D]`. The owner creates it; the login goes into the git-ignored `.env` and GitHub Actions secrets, never into git.

### 4.2 Pipeline (`pipeline/risk/`, Python + DuckDB)

| Step | Script | Output |
|---|---|---|
| 1 | `build_grid.py` | Land spots at 0.1°, with region id, land-cover shares and the static-source mask |
| 2 | `build_labels.py` | New and continuing fires per spot and day, 2012–2025 (VIIRS) |
| 3 | `build_inputs.py` | Fire weather, NDVI difference from normal and history features per spot and day, for the training days |
| 4 | `train.py` | The model and its validation report (section 5) |
| 5 | `backtest.py` | Test-year results against the baselines (section 6) → `scorecard.json` |
| 6 | `predict_daily.py` | Tomorrow's (and today's) scores for every land spot → top spots per region → files in section 8 |
| 7 | `score_daily.py` | Yesterday's predictions vs FIRMS → adds a line to the daily log |

**Training size:** about 2 million land spots at 0.1° (ice sheets dropped) `[U]` × 365 days a year is too much to store. So the training table keeps **every spot-day with a new fire plus a random sample of spot-days without** (about 1 in 20 `[U]`), with weights so the probabilities stay correct.

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
- **History:** the chance of fire this month (M13 at the spot); fires in the same month last year; days since the last fire; a fire within 10 km in the last 3 days `[U]`.
- **Season and place:** month (as a cycle), latitude band.
- **Weather where fuel exists:** FWI × forest share, so hot, dry wind counts most where there is forest.

### 5.3 Training, validation and test years (D-12)

- **Proposed:** train on 2021–2023, choose settings on 2024, test once on 2025. The split is by time only, never random, so the model never sees the future.
- **Download size:** one GFWED forecast file a day at the lead time the live job will use, about 16 MiB each `[V]`, so about 30 GB for 2021–2025 `[U]`. Earlier years (the archive starts Dec 2017 `[V]`) come later, with C11.
- The 2026 season so far is used for the live demo and the daily log, not for training.

### 5.4 "Why this spot" (M34)

For each listed spot, the 2–4 inputs that raise its score the most compared with the region's average, turned into words from a fixed phrase list (English and Bulgarian):

| Input | Example phrase |
|---|---|
| Maximum temperature (from the raw forecast; FFMC if missing) | "very hot (34 °C)" |
| Wind (raw forecast; ISI if missing) | "strong wind (45 km/h)" |
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
1. **Official index:** rank spots by tomorrow's FWI;
2. **History:** rank by the chance of fire this month (M13);
3. **Random** (a sanity floor).

**Slices:** by world region, month, forest vs other land, and new vs continuing fires. Weak slices are shown, not hidden.

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
| **Scorecard** (part of "How we know it's right") | Hold-out results vs baselines with charts; weak slices; daily log for the last 7 and 30 days |
| **About** | Data sources with licences, method in plain words, limits, disclaimer |

Phone first: the list is a bottom sheet over the map.

---

## 8. The contract between pipeline and app

The app reads only these files. The pipeline writes them; the oracle agent checks samples.

| File | Where | Contents | Size `[U]` |
|---|---|---|---|
| `risk/meta.json` | Blob | Model version, when made, the dates each file is valid for, input dates and sources | < 5 KB |
| `risk/latest.json.gz` | Blob | For every region: the top 10 spots for today and tomorrow, with their inputs | about 35 MB raw, 6 MB gzipped |
| `risk/week.json.gz` | Blob | Days 2–7, top 10 per region (S12) | about 3 times `latest` |
| `risk/archive/<date>.json.gz` | Blob | Each day's top 10 per region, with only `spot_id`, `rank` and `p`, for the scorecard | about 1 MB each |
| `risk/scorecard.json` | Blob | Hold-out results, slices and the daily log | < 1 MB |
| `risk/wind.json.gz` | Blob | Wind arrows on a 1° grid for today and tomorrow (S13) | about 1 MB |
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
- `null` inputs giving `null` scores, never 0.

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
2. **Freeze the contract** (section 8) with example files; the app builds against them.
3. **Labels and training table → version 1 model → hold-out test,** Europe first, then the world.
4. **Daily job** (predict and score) uploading to Blob.
5. **App screens** on the example files, in parallel with 3–4.
6. **Scorecard page** with the real test results.

### 11.2 Lanes (same computer and rules as plan 1, section 7.2)

| Lane | Builds | Owns folders |
|---|---|---|
| **A. Design and app** | Fire-risk screen, list, map layers, wind arrows, scorecard page, texts | `web/src/app/risk/`, `web/src/components/risk/`, `web/messages/` (risk keys) |
| **B. Data and logic** | Contract types, file loading, ranking display logic, phrases | `web/src/lib/risk/`, `web/src/types/risk.ts` |
| **Pipeline-risk** | Spikes, steps 1–7, daily job | `pipeline/risk/`, `.github/workflows/risk-daily.yml` |
| **Oracle** | Expected answers | `tests/expected/risk/` |

### 11.3 Time and checkpoints `[U]`

**Honest size:** plan 2's Musts are about 20–30 hours of agent work, and its Shoulds about 5–8, on top of plan 1, which is already tight. **Plan 1 stays the NASA challenge core.** Plan 2 runs in its own lanes.

| When (Sofia time) | Evidence that must exist |
|---|---|
| **Sat 23:30 · R0** | Spikes answered; D-10 to D-15 decided; contract and example files committed; oracle tests written and failing |
| **Sun 03:30 · R1** | Version 1 trained; hold-out test for Europe in `scorecard.json` |
| **Sun 06:00 · R2** | World predictions for tomorrow on Blob; the fire-risk screen live on the public URL |
| **Sun 08:00 · R3** | Freeze, together with plan 1's CP4; the video shows the fire-risk screen and the scorecard |

**First to cut if late, in order:**
1. S12 week outlook;
2. S13 wind arrows;
3. version 2 (LightGBM);
4. the world hold-out test, limited to Europe and the USA (world predictions stay).

**Never cut:** vegetation dryness, forest share, the scorecard against the official index, and "no data" kept apart from zero.

---

## 12. Open decisions (owner and deadline)

| # | Decision | Options | Proposed | Deadline |
|---|---|---|---|---|
| D-10 | **Spot size** | 0.05° · 0.1° · 0.25° | **0.1° (about 11 km)**: close to "a place on the mountain", and still small files. 0.25° if training is too slow | Sat 23:30 |
| D-11 | **Fire-weather source** | NASA GFWED GEOS-5 forecasts (past forecasts from Dec 2017 and live, one system, 0.25°, no login `[V]`) · Copernicus CEMS (past only; no numeric forecast `[V]`; offline from 16 Nov `[V]`) | **NASA GFWED for both.** It is the only free numeric next-day source found `[V]`, and it is NASA data | Sat 23:30 |
| D-12 | **Years** | Train, validate, test | **Train 2021–2023, validate 2024, test 2025** (about 30 GB `[U]`); earlier years later | Sat 23:30 |
| D-13 | **Default ranking** | Forest and wildland fires · all vegetation fires | **Forest and wildland by default**, with an "all fires" switch | Sat 23:30 |
| D-14 | **List size** | Top 5 scored, top 10 shown · other | **Top 5 scored, top 10 shown** | Sat 23:30 |
| D-15 | **"New fire"** | No detection in the spot on the previous 1, 2 or 3 days | **2 days** | Sat 23:30 |
