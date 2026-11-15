# Emerge plan 2: prediction model implementation spec

Written Sun 15 Nov 2026. This is the build-ready specification for the fire-risk **engine** (M31). It takes the design in [`specification.md`](specification.md) and turns it into exact module contracts, drawing on the research gathered on 15 Nov in [`../../docs/research/prediction/`](../../docs/research/prediction/).

**Relationship to the other specs:**
- [`specification.md`](specification.md) is the authority for scope, screens, the file contract (section 8), the proof protocol (section 6) and the order of work. This file does **not** repeat those; it implements section 5 (the engine) and section 4.2 (the pipeline).
- Where this file and `specification.md` differ, the differences are listed in section 9 below and must be reflected back into `specification.md` before the build starts.

**Research backing** (read these before implementing):
- [`sources-overview.md`](../../docs/research/prediction/sources-overview.md) — all 23 sources ranked
- [`two-stage-algorithm.md`](../../docs/research/prediction/two-stage-algorithm.md) — the algorithm design
- [`bc-fire-prediction-model.md`](../../docs/research/prediction/bc-fire-prediction-model.md) — the model template (#13)
- [`new-input-features.md`](../../docs/research/prediction/new-input-features.md) — the four new inputs
- [`open-meteo-api.md`](../../docs/research/prediction/open-meteo-api.md) — the free weather/lightning source
- [`csiro-evaluation-methodology.md`](../../docs/research/prediction/csiro-evaluation-methodology.md) — the metric change

**Tags:** `[V]` verified at a primary source · `[D]` directional · `[U]` our inference.

---

## 1. What this engine is (and is not)

**Is:** a two-stage, non-neural pipeline:
1. **Stage 1** — a rule-based filter that narrows every land spot to a small candidate set, using fixed thresholds. No training.
2. **Stage 2** — a logistic regression that scores each candidate with a probability (0–1), the same model family already in `specification.md` section 5.1.

**Is not:** a neural network. Every high-accuracy non-NN source we read (BC #13 lasso-logistic >0.90 AUC, SIMERF #5 77.5% ROC-AUC, West Coast XGBoost #17 0.785) confirms this family is the right choice for a weekend build with limited training data. See [`two-stage-algorithm.md`](../../docs/research/prediction/two-stage-algorithm.md), "The user's question, answered".

**Why two stages** (from the research):
- Fewer spots to score → the daily job runs in minutes.
- Each candidate already has a concrete reason before the model runs → supports M34 "why this spot".
- Non-candidates get `p = null`, not `p = 0` → matches the "zero is not missing" rule in `docs/data-contract.md`.
- Matches operational systems (SIMERF #5, BEYOND #4, BC #13 all screen then score).

---

## 2. The grid and the spot (unchanged from specification.md section 3)

No change. `spot_id = row × (360/g) + col`, `row = floor((90 − lat)/g)`, `col = floor((lon + 180)/g)`. Develop at `g = 0.25`, ship at `g = 0.1`. Region = Natural Earth admin-1. Oracle answers for this formula already exist in `tests/expected/risk/spot_id.json`.

---

## 3. Stage 1 — the candidate filter

### 3.1 Rule

A spot is a **candidate** for day D if **at least one** of these holds. (The research justifies relaxing the earlier "at least two" draft: a lightning strike alone starts fires in otherwise unremarkable weather — BC's OLCF model #13.)

| ID | Condition | Threshold | Source |
|---|---|---|---|
| F1 | tomorrow's FWI ≥ this spot's region×month 75th percentile | per-cell, from training years only | BC #13, SIMERF #5 |
| F2 | FFMC ≥ 85 | fixed | fine-fuel dryness `[D]` |
| F3 | NDVI below this-month normal by more than 0.05 | fixed | Mesogeos #2, Athens #9 |
| F4 | a fire seen within 50 km in the last 7 days | fixed | operational standard |
| F5 | forest share ≥ 0.30 **and** DC ≥ 300 | fixed | BEYOND #4, BC #13 |
| F6 | lightning within 50 km in the last 24 h (`lightning_density` > 0.01) | fixed | PNNL #14, BC OLCF #13 |

### 3.2 Pre-registration

Every threshold above, and the F1 per-cell percentiles, are **frozen in `pipeline/risk/PROTOCOL.md` before any test run** (V-M58). The F1 percentiles are computed from 2021–2023 only, never from 2024 (validation) or 2025 (test).

### 3.3 Output

A daily candidate table with one row per land spot:

| Column | Type | Meaning |
|---|---|---|
| `spot_id` | int | the spot |
| `day` | date | the target day D |
| `is_candidate` | bool | passed ≥ 1 condition |
| `filter_reason` | string | `"conditions_not_met"` for non-candidates; else comma-joined passed IDs, e.g. `"F1,F5"` |

Non-candidates are carried through to the final output with `p = null` and are never ranked.

---

## 4. Stage 2 — the logistic regression scorer

### 4.1 Feature list

Full input list for `build_inputs.py`. The four new features (bold) come from [`new-input-features.md`](../../docs/research/prediction/new-input-features.md).

| Feature | Static / daily | Source | In specification.md? |
|---|---|---|---|
| `fwi`, `ffmc`, `dmc`, `dc`, `isi`, `bui` | daily | GFWED | yes |
| `ndvi_diff` | monthly | MOD13C2 | yes |
| `forest`, `grass_shrub`, `farm` | static | MCD12C1 | yes |
| `hist_p` | static (per month) | plan 1 cell_days | yes |
| `fire_near_3d`, `days_since_last_fire` | daily | plan 1 cell_days | yes |
| `month_sin`, `month_cos`, `lat_band` | static/daily | derived | yes |
| `fwi_x_forest` (interaction) | daily | derived | yes |
| **`road_distance_km`** (0–50, clipped) | static | OpenStreetMap | **new** |
| **`slope_deg`** (0–90), **`terrain_risk`** (0–1) | static | SRTM on AWS | **new** |
| **`lightning_density`** (flashes/km²/day) | daily, live only | Open-Meteo | **new** |
| `t_max_c`, `rh_min`, `wind_max_kmh`, `wind_dir_deg` | daily | Open-Meteo | promoted from display-only |

~18 features (up from ~14). All from free, no-login sources.

**Lightning caveat** (important): ERA5-Land historical has no lightning, so the training years (2021–2023) have null `lightning_density`. The model is therefore trained **without** it; lightning enters live only via the Stage 1 F6 filter. Document this in `PROTOCOL.md`. (A later version can use the NOAA GLM archive for consistent training — see [`open-meteo-api.md`](../../docs/research/prediction/open-meteo-api.md), "Limitations".)

### 4.2 Model

- **Logistic regression with L1 (lasso) penalty**, following BC #13. L1 drops uninformative features automatically from the ~18 candidates.
  ```python
  from sklearn.linear_model import LogisticRegression
  model = LogisticRegression(penalty="l1", solver="liblinear", C=C, max_iter=1000)
  ```
- **`C` (inverse regularisation)** chosen on the 2024 validation year by scanning `C ∈ {0.01, 0.05, 0.1, 0.5, 1.0, 5.0}` and picking the best validation AUC-PR.
- **Bootstrap ensemble (500 balanced fits)** for calibrated probabilities on rare events (BC #13). Each fit uses all fire rows + an equal random sample of non-fire rows; the final `p` is the mean of the 500 predictions.
  - **Fallback if build time is tight:** a single fit with `class_weight="balanced"`, then an isotonic/Platt calibration on the validation year. Note the fallback in the run log.
- **One model for the whole world** (unchanged). Season and place enter through `month_sin/cos`, `lat_band`, `hist_p`.
- **Version 2 (if time):** LightGBM, adopted only if it beats v1 AUC-PR on 2024. No app change.

### 4.3 Cause split (approximation of BC's three models)

BC #13 runs separate human-caused and lightning-caused models. For v1 (one model, overnight) we approximate this with two composite features the model weights itself:
- `cause_human_risk = clip(1 − road_distance_km/50, 0, 1)` — short road distance → high human-ignition risk
- `cause_lightning_risk = lightning_density × forest_share` — lightning in forest → high lightning-ignition risk

v2 may train separate models per cause using FPA-FOD / NIFC cause labels (#10, #23).

### 4.4 Output per candidate

`p` (0–1), `level` (1–5 from fixed probability bands chosen on 2024), and a `why` list (section 5).

---

## 5. "Why this spot" (M34)

Logistic regression makes the reason exact: each feature's contribution to the log-odds is `coefficient × standardised_value`. The top 3–4 positive contributors become `why` keys (unchanged mechanism from `specification.md` section 5.4). New keys added by the new features:

| Key | Fires when |
|---|---|
| `near_roads` | `road_distance_km` is a top positive contributor (short distance) |
| `steep_slope` | `terrain_risk` is a top positive contributor |
| `lightning_risk` | `lightning_density` / `cause_lightning_risk` is a top positive contributor |

Existing keys (`very_hot`, `strong_wind`, `very_dry`, `mostly_forest`, `history`, …) are unchanged. The app needs only three new translation strings in `en.json` and `bg.json`; no component change.

---

## 6. Pipeline modules (`pipeline/risk/`, does not yet exist)

Replaces the 7-step table in `specification.md` section 4.2 with explicit module contracts. Each is plain Python + DuckDB; each writes a Parquet or JSON file and nothing else.

| # | Module | Reads | Writes | When |
|---|---|---|---|---|
| 1 | `build_grid.py --grid g` | Natural Earth admin-1; MCD12C1; SRTM (AWS); OSM roads (Geofabrik) | `grid_<g>.parquet`: `spot_id, lat, lon, region_id, precision_radius_km, forest, grass_shrub, farm, slope_deg, aspect_deg, terrain_risk, road_distance_km, static_mask` | once |
| 2 | `build_labels.py` | plan 1 `cell_days.parquet` (NOAA-20) | `labels_<g>.parquet`: `spot_id, day, new_fire, continuing_fire` (neighbour rule D−1/D−2) | once |
| 3 | `build_inputs.py` | GFWED; MOD13C2; `grid`; `labels`; Open-Meteo (live) | `inputs_<g>.parquet`: all section 4.1 features per spot-day, history capped at D−2 | daily + training backfill |
| 4 | `filter_candidates.py` | `inputs`; `grid` (F1 percentiles) | `candidates_<g>.parquet` (section 3.3) | daily |
| 5 | `train.py` | `inputs` + `labels` (candidates only, training years) | `model_<g>.pkl` + `train_report.json` (chosen `C`, feature weights, validation AUC-PR) | once |
| 6 | `backtest.py` | `model`; 2025 `inputs`+`labels`; baselines | `scorecard.json` (section 7) | once |
| 7 | `predict_daily.py` | `model`; today's `candidates` | `latest.json.gz` (contract in `specification.md` section 8) | daily |
| 8 | `score_daily.py` | yesterday's `latest`; FIRMS NRT | appends the daily log to `scorecard.json` | daily |

**Training table size** (unchanged reasoning from `specification.md` section 4.2): keep every new-fire spot-day plus a sampled fraction of non-fire spot-days. **New constraint from CSIRO #16:** the sampling applies to *training only*. The **backtest (module 6) scores every candidate spot for every 2025 day at the natural class balance** — never sub-sampled. See [`csiro-evaluation-methodology.md`](../../docs/research/prediction/csiro-evaluation-methodology.md).

**Plug-in compatibility:** modules 5–7 honour the teammate-model interface in `docs/plans/build-plan.md` section 8.5 — a replacement model need only emit `(grid_g, spot_id, day, p)` and `backtest.py` scores it unchanged.

---

## 7. Proof and metrics (revises specification.md section 6)

The CSIRO methodology (#16) requires one change to the headline metric. Fires are ~0.5% of spot-days; AUC-ROC overstates skill on such rare events.

| | Before (`specification.md` §6) | After (this spec) |
|---|---|---|
| **Primary deciding metric** | top-5 capture rate | **AUC-PR** (average precision) |
| Secondary | hit rate, Brier skill, reliability | + top-5 capture rate, + AUC-ROC (to compare with published models, most of which report ROC) |
| Test-set balance | (unstated) | **natural balance, never oversampled** |
| Cross-validation | temporal split | temporal (primary) **+ spatial-block (secondary robustness check)** |
| Calibration | reliability chart (kept) | kept — confirmed correct by CSIRO |

Everything else in `specification.md` section 6 stays: the three baselines (FWI rank, history rank, random), the pooled capture rate, the lift-over-random, the small-region rule, the 7-day-block bootstrap, the slice-by-slice reporting, and the pre-registration in `PROTOCOL.md`. `backtest.py` computes AUC-PR with `sklearn.metrics.average_precision_score`.

**`PROTOCOL.md` must list, before any test run:** the six Stage 1 conditions and thresholds; the F1 percentile source (2021–2023 only); AUC-PR as primary; the three baselines; the train/validate/test years; the slices; the forecast-vs-reanalysis lightning caveat.

---

## 8. Data sources to wire in

New rows for `docs/data-sources-master.md` (currently these are "Future"):

| Source | Use | Access | Licence |
|---|---|---|---|
| OpenStreetMap roads (Geofabrik `.osm.pbf`) | `road_distance_km` | free, no login | ODbL — attribute OSM, share-alike on the derived grid column |
| SRTM 30 m / 90 m (AWS `elevation-tiles-prod`) | `slope_deg`, `terrain_risk` | free, no login `[V]` | public domain (NASA/USGS) |
| Open-Meteo ECMWF API (`/v1/ecmwf`, `/v1/archive`) | `lightning_density`, raw weather | free (non-commercial), no key `[V]` | AGPLv3 code; data CC-BY-4.0 `[V]` |

Open-Meteo replaces the "optional raw weather" line in `specification.md` section 4.1 — it is now a confirmed source, not a maybe. See [`open-meteo-api.md`](../../docs/research/prediction/open-meteo-api.md) for the endpoints, the 10,000-request/day free-tier limit (so batch world queries use the 0.25° model endpoint; per-spot queries are for demo regions only), and the forecast-vs-reanalysis caveat.

---

## 9. Differences from specification.md to reconcile

Before the build begins, fold these into `specification.md` so the two specs agree:

1. **Section 5 (engine):** add the Stage 1 filter (this spec section 3) ahead of the model.
2. **Section 5.2 (inputs):** add `road_distance_km`, `slope_deg`, `terrain_risk`, `lightning_density`; promote `t_max_c`, `rh_min`, `wind_max_kmh`, `wind_dir_deg` from display-only to model inputs.
3. **Section 5.1 (model):** state L1 (lasso) penalty and the 500-fit bootstrap ensemble, with the single-fit-plus-calibration fallback.
4. **Section 6 (proof):** primary metric becomes AUC-PR; add the natural-balance rule and the spatial-block secondary check.
5. **Section 4.1 (data):** Open-Meteo moves from "optional / maybe" to a confirmed source; add OSM and SRTM.
6. **Section 4.2 (pipeline):** the 7-step table becomes the 8-module table (this spec section 6), adding `filter_candidates.py`.

The app-side contract (`web/src/types/risk.ts`, `RiskSpot`) is **unchanged**: the new features are optional nullable fields inside `inputs`, and the three new `why` keys are additive. The `engine_ready` gate, grid formula, label rule, and train/validate/test split are all unchanged.

---

## 10. Verification

1. `build_grid.py --grid 0.25` on Bulgaria: `slope_deg ∈ [0,45]`, `road_distance_km ∈ [0,50]`, `terrain_risk ∈ [0,1]`, no nulls in static columns.
2. `filter_candidates.py` on one July 2024 day: 10–30% of Bulgarian spots pass; F6 fires only where Open-Meteo `lightning_density > 0.01`.
3. `train.py` on 2021–2023: lasso converges; `road_distance_km` and `slope_deg` appear among the non-zero weights; chosen `C` recorded in `train_report.json`.
4. `backtest.py` on 2025: **AUC-PR beats the FWI-only baseline AUC-PR**, scored at natural class balance. If not, keep `engine_ready: false` and try Version 2.
5. Oracle tests in `tests/expected/risk/` pass — `make_risk_expected.py` already covers spot_id, labels, ranking, scores, leakage, model-file validation.
6. App shows `near_roads`, `steep_slope`, `lightning_risk` in EN and BG for spots where those inputs dominate.
7. Live Open-Meteo call in `build_inputs.py` returns a non-null `lightning_density` for Sofia on a recent date.
8. Spatial-block check: hold out whole regions; the model still beats the FWI baseline (robustness, not headline).

---

## 11. Build order (fits specification.md section 11 checkpoints)

1. Commit `PROTOCOL.md` with the six Stage 1 conditions, AUC-PR, baselines, years (R0, Sat 23:30 — already in `specification.md`).
2. `build_grid.py` with the three new static columns (OSM + SRTM) — can run in parallel with GFWED downloads.
3. `build_labels.py` + `build_inputs.py` (GFWED + NDVI + history first; Open-Meteo weather added once the grid is up).
4. `filter_candidates.py` → confirm candidate counts are sane (verification 2).
5. Baselines scored end to end at 0.25°, Europe first (R0.5) — unchanged from `specification.md`.
6. `train.py` → `backtest.py` with AUC-PR, Europe then world (R1).
7. `predict_daily.py` + `score_daily.py` → Blob (R2); set `engine_ready` only if verification 4 passes.

**First to cut if late:** `lightning_density` and the F6 filter condition (keep F1–F5); then the 500-fit bootstrap (use the single-fit fallback); then the spatial-block check; then Version 2. **Never cut:** the Stage 1 filter itself, AUC-PR scoring against the FWI baseline, and `null`-not-zero for non-candidates.
