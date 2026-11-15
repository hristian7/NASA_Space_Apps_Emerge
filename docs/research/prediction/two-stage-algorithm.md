# Two-stage prediction algorithm — detailed design note

Researched and designed 2026-11-15. Tags: `[V]` confirmed at a source · `[D]` directional · `[U]` our inference.

This note describes the improved one-day-ahead fire prediction algorithm. It is NOT a neural network. It combines a fast rule-based screener (Stage 1) with a logistic-regression scorer (Stage 2), following the pattern used by the operational systems in our research — SIMERF (#5), BEYOND (#4), and the BC model (#13). See [`sources-overview.md`](sources-overview.md), [`bc-fire-prediction-model.md`](bc-fire-prediction-model.md), [`new-input-features.md`](new-input-features.md), and [`csiro-evaluation-methodology.md`](csiro-evaluation-methodology.md).

## The user's question, answered

> "a way we can better predict potential fire outbreak zones that isn't based on training a
> neural network ... create an algorithm to identify dangerous locations, and have the AI
> determine whether a specific dangerous spot is likely to catch fire."

This is exactly the two-stage design below:
- **Stage 1 (the algorithm that identifies dangerous locations):** rule-based filter, no model.
- **Stage 2 (the AI that scores each dangerous spot):** logistic regression, not a neural net.

Our current spec's Version 1 is **already** logistic regression, so we are not switching
away from a neural network — we never had one. The improvement is the explicit two-stage
structure plus the four new inputs.

## Why two stages

| Benefit | Explanation |
|---|---|
| **Speed** | Scoring 60,000 world cells × 365 days is slow. Filtering to ~10–30% candidates first cuts the model's work by 3–10× `[U]`. |
| **Explainability** | A spot that passed Stage 1 has a concrete reason ("dry forest + nearby fire") before the model even runs. Supports M34 "why this spot". |
| **Honest zeros** | Spots that fail every Stage 1 condition get `p = null`, not `p = 0`. The app can show "conditions not met" rather than a false precise zero. Matches the "zero is not missing" rule in `docs/data-contract.md`. |
| **Matches operational practice** | SIMERF, BEYOND and BC all screen then score. |

## Stage 1 — Rule-based candidate filter

A spot is a candidate for day D if **at least one** of these holds. (Relaxed from the earlier
"at least two" draft: a lightning strike alone is enough — lightning fires start in otherwise
unremarkable weather.)

| # | Condition | Threshold | Rationale / source |
|---|---|---|---|
| F1 | Tomorrow's FWI ≥ region×month 75th percentile | per-cell, from 2021–2023 | BC #13, SIMERF #5 |
| F2 | FFMC ≥ 85 | fixed | fine fuel critically dry `[D]` |
| F3 | NDVI below this-month normal by > 0.05 | fixed | Mesogeos #2, Athens #9 |
| F4 | Fire within 50 km in last 7 days | fixed | operational standard |
| F5 | forest ≥ 0.30 AND DC ≥ 300 | fixed | BEYOND #4, BC #13 |
| F6 | lightning within 50 km in last 24 h (density > 0.01) | fixed | PNNL #14, BC OLCF #13 |

All thresholds are **pre-registered** in `pipeline/risk/PROTOCOL.md` before any test run, so
they cannot be tuned to the 2025 test year (V-M58, pre-registration). The F1 per-cell
percentiles are computed from training years only.

Output: a daily candidate table. Non-candidates get `p = null`, `filter_reason =
"conditions_not_met"`.

## Stage 2 — Logistic regression scorer

Unchanged in type from the spec (Version 1 = logistic regression). Changes:

1. **Expanded feature set** — ~18 inputs, adding `road_distance_km`, `slope_deg`,
   `terrain_risk`, `lightning_density`, and the promoted raw-weather fields. See
   [`new-input-features.md`](new-input-features.md).
2. **Lasso (L1) regularisation** — following BC #13, let L1 drop uninformative features
   automatically. `LogisticRegression(penalty="l1", solver="liblinear", C=…)`, with `C`
   chosen on the 2024 validation year.
3. **Bootstrap ensemble (optional, 500 balanced fits)** — BC #13's technique for calibrated
   probabilities on rare events. Each fit uses all fires + an equal random sample of
   non-fires; the final `p` is the mean of 500 predictions. Adds minutes to training; worth
   it for calibration. If build time is tight, a single fit with `class_weight="balanced"` is
   the fallback.

Output per candidate spot: `p` (0–1), `level` (1–5 from `p` bands), and a `why` list built
from the top contributing inputs (the sign and magnitude of `coefficient × (value − mean)`).

## The `why` explanations

Logistic regression makes "why" exact: each input's contribution to the log-odds is
`coefficient × (standardised value)`. The top 3–4 positive contributors become the `why`
keys. New keys added by this design:

| Key | Triggered when |
|---|---|
| `near_roads` | `road_distance_km` is a top positive contributor (short distance) |
| `steep_slope` | `terrain_risk` is a top positive contributor |
| `lightning_risk` | `lightning_density` is a top positive contributor |

Existing keys (`very_hot`, `strong_wind`, `very_dry`, `mostly_forest`, `history`) are
unchanged. The app renders them in EN and BG (no app-side code change beyond the three new
translation strings).

## Training / validation / test (unchanged from spec, with CSIRO corrections)

- Train 2021–2023, choose `C` on 2024, test **once** on 2025.
- Data cutoff: inputs for day D observed only up to end of D−2 (GFWED lag).
- Labels: NOAA-20 only, neighbour rule (no detection in spot or 8 neighbours on D−1/D−2).
- **Test set keeps natural class balance** — never oversampled (CSIRO #16).
- **Primary metric: AUC-PR**; secondary: top-5 capture rate, Brier skill, AUC-ROC.
- Secondary **spatial-block** cross-validation as a robustness check (CSIRO #16).

See [`csiro-evaluation-methodology.md`](csiro-evaluation-methodology.md) for why AUC-PR
replaces AUC-ROC as the headline.

## Baselines (the model must beat these to ship)

1. FWI rank (the GWIS `nasa_geos5.fwi` layer, ranked)
2. History-only (`hist_p`, ranked)
3. Random (sanity floor)

Claim rule (from spec section 6, kept): "more accurate than X" is stated only if AUC-PR beats
baseline X on 2025 AND the gap survives a bootstrap over whole 7-day blocks.

## Expected performance `[U]`

With 3 training years and the expanded inputs, a realistic v1 target is **AUC-PR 0.3–0.5**
and **AUC-ROC 0.75–0.85** on the natural-balance 2025 test set. The BC model's >0.90 AUC-ROC
is a ceiling (28 training years, three specialised sub-models), not an expectation for a
weekend build. If v1 does not beat the FWI baseline on AUC-PR, the engine stays behind the
`engine_ready: false` placeholder and we ship Version 2 (LightGBM) only if it passes.

## Data flow

```
build_grid.py      (once)  -> grid.parquet: cells + region + landcover
                                 + road_distance_km + slope_deg + terrain_risk
build_labels.py    (once)  -> labels.parquet: new/continuing fire per cell-day (NOAA-20)
build_inputs.py    (daily) -> inputs.parquet: FWI + NDVI + history + Open-Meteo weather
                                 + lightning_density, joined to grid
filter_candidates.py       -> candidates.parquet: Stage 1 pass/fail + filter_reason
train.py           (once)  -> model.pkl: lasso-LR (+ optional 500-bootstrap)
backtest.py        (once)  -> scorecard.json: AUC-PR vs baselines, calibration, slices
predict_daily.py   (daily) -> latest.json.gz: top-10 per region, today + tomorrow
```

Only `build_inputs.py`, `filter_candidates.py`, and `predict_daily.py` run daily; the rest are
one-time. This matches the plug-in interface in `docs/plans/build-plan.md` section 8.5 — a
teammate's model can replace Stage 2 by producing the same `(grid_g, spot_id, day, p)` file.

## What is NOT changing

- Model family: logistic regression (v1), LightGBM (v2). No neural network.
- App contract: `web/src/types/risk.ts` `RiskSpot` shape unchanged; new inputs are optional
  nullable fields in `inputs`.
- Grid formula, `spot_id`, `cell_id`, label rule, train/val/test split.
- `engine_ready` gate and the placeholder screen.
