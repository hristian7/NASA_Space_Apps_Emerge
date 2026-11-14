# Bake-off protocol: pipeline A vs pipeline B on Bulgaria and the USA

Fixed on Sat 14 Nov 2026, **before any pipeline produced output** (pre-registration, V-M58). Nobody changes this file after the first score exists; corrections go in a dated note at the bottom.

- **Pipeline A** follows [`../../docs/conversion-plan.md`](../../docs/conversion-plan.md) (0.25 degree, monthly).
- **Pipeline B** follows [`../../docs/harmonization-pipeline-plan.md`](../../docs/harmonization-pipeline-plan.md) (0.1 degree).
- A separate **scorer** writes `score.py` and the hand-computed answers. It never reads the pipelines' code.

Thresholds marked `[U]` are our own choice.

## 1. Shared input

`data/derived/bg_us/cell_days.parquet` (built by `pipeline/build_cells.py`, git-ignored). One row = one satellite seeing fire in one 0.01 degree cell on one day.

| Column | Meaning |
|---|---|
| `sat` | `Terra`, `Aqua`, `SNPP`, `NOAA20` |
| `country` | `Bulgaria` or `United_States` (NASA's own assignment) |
| `day` | date |
| `cy`, `cx` | `floor(lat * 100)`, `floor(lon * 100)` |
| `detections` | hotspots in that cell that day |
| `frp` | summed fire radiative power |
| `seen_day`, `seen_night` | any daytime / night-time detection |

Rules that both pipelines and the scorer apply:
1. Drop every day listed in [`snpp_gap_days.csv`](snpp_gap_days.csv) (34 days when S-NPP was down), for **all** satellites.
2. Drop January 2012 (S-NPP starts on 20 Jan 2012).
3. Use `Terra`, `Aqua` and `SNPP` rows only. `NOAA20` is not used here.
4. **Truth is measured S-NPP.** A pipeline must never read S-NPP rows from a test's prediction years while fitting or predicting that test. MODIS rows from the prediction years are the input to predict from.
5. Both plans group by land type, and no land-type map is available yet. Both replace "land type" with a **5 degree latitude band**, `floor(lat / 5)`.

## 2. Units and grids

| Name | Definition |
|---|---|
| Unit `cd` (fire cell-days) | number of rows |
| Unit `hot` (hotspots) | sum of `detections` |
| Cell centre | `lat = (cy + 0.5) / 100`, `lon = (cx + 0.5) / 100` |
| Grid `q25` (0.25 degree) | `row = floor((90 - lat) / 0.25)`, `col = floor((lon + 180) / 0.25)`, `cell = row * 1440 + col` |
| Grid `d10` (0.1 degree) | `gy = floor(cy / 10)`, `gx = floor(cx / 10)` (floor, also for negatives), `cell = (gy + 900) * 3600 + (gx + 1800)` |

## 3. Tests

| Test | Fit on | Predict | Counts for the winner |
|---|---|---|---|
| `t1` | Feb 2012 to Dec 2018 | 2019 to 2022 | Yes |
| `t2` | 2016 to 2022 | Feb 2012 to Dec 2015 | Yes |
| `t3` | Feb 2012 to Dec 2018 | 2023 to 2025 | No, shown apart (MODIS drift years) |

## 4. What each pipeline writes

Folder `data/derived/bakeoff/A/` or `data/derived/bakeoff/B/`:

**`pred.parquet`**

| Column | Type | Values |
|---|---|---|
| `pipeline` | text | `A` or `B` (a second model, if time allows: `A2`, `B2`) |
| `test` | text | `t1`, `t2`, `t3` |
| `unit` | text | `cd`, `hot` |
| `country` | text | `Bulgaria`, `United_States` |
| `grid` | text | `q25` or `d10` |
| `cell` | bigint | per section 2 |
| `year`, `month` | int | prediction month |
| `pred` | double | predicted S-NPP-level value |
| `lo`, `hi` | double | error range |

- A writes `q25` rows. B writes `d10` rows **and** `q25` rows (its `d10` values added up; B says how it combined the ranges).
- A row may be left out when `pred` is 0. A missing row is scored as 0 with range 0 to 0.
- A prediction can exist for a cell-month where MODIS saw nothing.

**`manifest.json`**: `band` (0.9 for A, 0.8 for B, as each plan says), groups used, model in one sentence, seconds to fit, row counts, anything left out.

## 5. Scoring

**Cells scored:** per country, every `q25` cell with at least one Terra, Aqua or S-NPP row between Feb 2012 and Dec 2022 (after rules 1 and 2), for every month of the test.

| Level | Rows | Truth | Prediction |
|---|---|---|---|
| (a) | country x month | S-NPP total | sum of `q25` rows |
| (b) | `q25` cell x month | S-NPP in the cell | the `q25` row |
| (c) | 20 circles of 50 km x month (`circles.csv`, fixed by the scorer before any output) | S-NPP in 0.01 degree cells whose centre is within 50 km | A: `q25` cells whose centre is within 50 km. B: `d10` cells whose centre is within 50 km |
| (d), for information | `d10` cell x month | S-NPP in the cell | B's `d10` row |

**Measures, per level, test, country and unit:**
- `nRMSE` = root mean squared error / mean of truth;
- `MAE`; `bias` = (sum predicted - sum truth) / sum truth;
- Pearson `r`; `slope` of truth on prediction;
- `coverage` = share of rows with `lo <= truth <= hi`, next to the pipeline's `band`;
- `MAPE` on rows with truth > 0, for information only.

## 6. Decision rules

1. **Winner (decides the method):** 12 contests on unit `cd`: levels (a), (b), (c) x tests `t1`, `t2` x 2 countries. Lower `nRMSE` wins a contest. Most contests wins. 6 to 6 goes to A (smaller files, NASA's grid).
2. **Default unit (D-7):** hotspots are the calendar default only if the winner's `nRMSE` on `hot` is at most 1.25 times its `nRMSE` on `cd` in at least 8 of the 12 contests `[U]`. Otherwise fire days are the default.
3. **Gate to the whole world** (all must hold for the winner, both countries, `t1` and `t2`, unit `cd`):
   - level (a) `nRMSE` at or under 0.30 `[U]`;
   - level (a) `bias` within plus or minus 0.10 `[U]`;
   - level (b) `coverage` between 0.80 and 0.97 for a 0.9 band (0.70 to 0.90 for a 0.8 band) `[U]`;
   - control totals match (V-M125) and the scorer's hand-computed truth samples match.
   A miss is reported with the scores; the team decides.

## 7. Time box

75 minutes per pipeline. The first model (the ratio) must be scored before anything else is tried.
