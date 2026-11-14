# Harmonization pipeline plan: MODIS-to-VIIRS upscaling

Written 14 Nov 2026. Implementation plan for feature **M1** (harmonized fire history 2000–today). The methodology this implements is described in [`harmonization-plan.md`](harmonization-plan.md); the proof strategy is in [`verification-plan.md`](verification-plan.md).

## What "upscaling" means here

MODIS has ~1 km pixels; VIIRS has 375 m pixels, and detects **3–6× more fires** `[D]`. We cannot recover where the missed small fires were (that information was never measured). We **can** produce VIIRS-equivalent **counts** for 2000–2011 — how many fires VIIRS would have seen in a given area and period — with an error range on every number. This is statistical count scaling, not image sharpening.

---

## Step 1 — Ingest and clean raw FIRMS CSV files

**File to create:** `pipeline/01_ingest.py`

Download yearly FIRMS country files for MODIS (2000–2025) and VIIRS S-NPP (2012–2025) and NOAA-20 (2018–2025) via the no-login URL pattern documented in [`../docs/firms-data.md`](firms-data.md):

```
https://firms.modaps.eosdis.nasa.gov/data/country/<folder>/<year>/<folder>_<year>_<Country>.csv
```

Folders: `modis`, `viirs-snpp`, `viirs-jpss1`.

Apply cleaning rules per `firms-data.md`:

| Rule | MODIS | VIIRS |
|---|---|---|
| Fire type | Keep `type == 0` (vegetation fires) | Same |
| Confidence | Keep `confidence >= 30` (numeric 0–100) | Keep `confidence in ['n', 'h']` (letter scale, incompatible with MODIS) |
| FRP | Hard limit: FRP ≥ 0 (method M32) | Same |

Output: `data/clean/modis.parquet`, `data/clean/viirs.parquet`.

---

## Step 2 — Grid both sensors to a common spatial unit

**File to create:** `pipeline/02_grid.py`

- Assign every detection to a **~0.1° grid cell** (≈ 10 km at mid-latitudes) plus a calendar day. Also compute a 0.25° version for cross-checking against GFED5.
- Count **fire cell-days**: a cell counts once per day if it had any detection. This is the agreed display unit (interview answer E3) and removes most of the raw pixel-size bias before the statistical correction.
- Record per (cell, day, sensor): fire-cell-day count, mean FRP, day/night share, land-cover class (static ESA CCI LC lookup at 0.25°, CC BY).
- Keep **afternoon overpasses only** for the training pairs (Aqua MODIS and VIIRS S-NPP both pass in the early afternoon — matching the same moment reduces overpass-time bias, interview answer D3 option 5). Terra MODIS morning passes are excluded from training but included in the final harmonized output.

Output: `data/gridded/modis_celldays.parquet`, `data/gridded/viirs_celldays.parquet`.

---

## Step 3 — Build training pairs from the overlap period (2012–2025)

**File to create:** `pipeline/03_training_pairs.py`

For each (grid cell, month) in the 2012–2025 overlap, pair the afternoon-pass MODIS cell-day count with the VIIRS cell-day count for the same overpass window.

Attach features:
- Region code: continent (7) × land-cover class (4: forest, cropland, savanna/grassland, shrubland) — 28 strata total
- Month-of-year
- Mean FRP
- Day/night ratio

Output: `data/training/pairs.parquet`.

---

## Step 4 — Fit three conversion models (pre-register split before running)

**File to create:** `pipeline/04_fit_models.py`

Pre-register the train/test split in `data/models/model_selection.json` **before looking at test results** (method M58, anti-leakage M62):

- **Train:** 2012–2018
- **Test (held out):** 2019–2025

Fit three models per stratum:

| Model | Method | Strength |
|---|---|---|
| **A. Ratio** | `k = mean(VIIRS) / mean(MODIS)` per stratum; borrow from parent region where n < 20 cell-days | Simple, explainable baseline |
| **B. Regression** | Poisson GLM (scikit-learn): features are MODIS count, mean FRP, month, land-cover index, day/night ratio | Captures "small fires missed" more precisely |
| **C. Missed-fire term** | Extends B with a zero-inflation term: predict P(MODIS=0 but VIIRS>0) from stratum base rate; add expected VIIRS detections for those zero-MODIS cell-days | Best for regions where MODIS misses fires entirely |

Output: coefficients, per-stratum ratios, test-year predictions → `data/models/`.

---

## Step 5 — Evaluate on held-out test years and select the best model

**File to create:** `pipeline/05_evaluate.py`

For each model on the 2019–2025 test set:

| Metric | Purpose | Method |
|---|---|---|
| MAPE per year, month, region, land-cover class | Catch hidden bad slices (M124) | Compute then report |
| Residual bias | Systematic over/under-estimate | Compute then report |
| 80% bootstrap CI coverage | Honest uncertainty (M114) | Re-sample training data 200 times |

Select the best model per stratum by lowest test-year MAPE. Record winners in `data/models/model_selection.json`.

Required cross-checks:

| Check | Method | Acceptance criterion |
|---|---|---|
| S-NPP vs NOAA-20 VIIRS agree over 2018–2025 | M21 | < 10% difference `[D]` |
| Per-stratum ratios in published ranges | M38 | Bulgaria 2.7–3.9× `[D]`; Punjab 4.8–6.5× `[D]`; NE Asia forest miss rate 65–83% `[D]` |
| Daily totals → monthly totals → raw row counts | M125 | All sums match exactly |

---

## Step 6 — Apply conversion to MODIS-only years (2000–2011)

**File to create:** `pipeline/06_apply.py`

For each MODIS cell-day in 2000–2011:
- Look up the winning model for the cell's stratum
- Apply the conversion → estimated VIIRS-equivalent count
- Compute 80% bootstrap confidence interval

Append 2012–2025 measured VIIRS data (unchanged, no conversion needed).

Output schema for `data/output/harmonized.parquet`:

| Column | Values |
|---|---|
| `cell_id` | Grid cell identifier |
| `date` | Calendar date |
| `viirs_equiv` | Estimated or measured VIIRS-equivalent fire cell-day count |
| `ci_low`, `ci_high` | 80% bootstrap confidence interval |
| `source` | `estimated_from_modis` (2000–2011) or `measured_viirs` (2012–now) |
| `sensor_label` | Human-readable label for the app toggle |

---

## Step 7 — Pre-compute daily and monthly summaries for the app

**File to create:** `pipeline/07_summarize.py`

Roll up `harmonized.parquet` to daily and monthly totals per grid cell. These small files go to the app; the full harmonized file stays on the server.

Output: `data/output/daily_summary.parquet`, `data/output/monthly_summary.parquet`.

---

## Files created by this pipeline

| Path | Purpose |
|---|---|
| `pipeline/01_ingest.py` | Download and clean raw FIRMS CSVs |
| `pipeline/02_grid.py` | Grid detections; count fire cell-days |
| `pipeline/03_training_pairs.py` | Build MODIS↔VIIRS overlap pairs |
| `pipeline/04_fit_models.py` | Fit ratio, regression, missed-fire models |
| `pipeline/05_evaluate.py` | Hold-out backtest; select best model per stratum |
| `pipeline/06_apply.py` | Apply conversion to 2000–2011 |
| `pipeline/07_summarize.py` | Pre-compute daily/monthly summaries |
| `data/models/model_selection.json` | Which model won per stratum (committed before test) |
| `docs/research/harmonization-results.md` | Back-test numbers, ratio cross-checks, CI widths |

---

## Verification sequence (end-to-end)

Run the full pipeline on **Bulgaria first** (files are small: 5.3 MB MODIS, 7.4 MB VIIRS — fast to iterate):

1. **M32:** confirm all counts ≥ 0, all coordinates valid, all FRP ≥ 0.
2. **M125:** confirm daily totals → monthly totals → filtered row counts all reconcile.
3. **M21:** compare S-NPP and NOAA-20 VIIRS for Bulgaria 2018–2025; expect < 10% difference.
4. **M38:** confirm the fitted Bulgaria ratio is between 2.7–3.9× `[D]`.
5. **M44:** run the hold-out backtest; report MAPE per year for Bulgaria.
6. After Bulgaria passes, run the USA (second priority per [`harmonization-plan.md`](harmonization-plan.md)), then the rest of the world overnight on the server.

---

## Known risks and mitigations

| Risk | Mitigation |
|---|---|
| MODIS orbit drift biases 2019–2025 test years | Check Terra/Aqua overpass times before relying on test results; the afternoon-only pairing partially protects against it |
| High conversion error in some regions | Show measured counts per sensor there, flag "not harmonized", keep the validation page |
| Too few fires in a small area | Show "low confidence" label instead of a converted number |
| Global processing too slow for the demo | Process Bulgaria and USA first; the rest of the world runs overnight |

---

## Open questions (not blocking)

- **E1/E2** (team decision): unit choice confirmed as fire cell-days — label clearly in the app.
- **MODIS orbit drift** (noted in `data-sources-fire.md`): investigate after fitting but does not block pipeline design.
