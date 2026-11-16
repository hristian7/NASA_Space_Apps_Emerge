# Plan 2 test rules

These rules are registered before any baseline or model score is computed. The development grid is 0.25 degrees [U]; repeat the test on the shipped grid before declaring the engine ready.

## Data and eligible predictions

The validation year is 2024 [U] and the held-out test year is 2025 [U]. Train on days before 2024, choose settings on 2024, and use 2025 once for the final test [U]. A prediction for UTC day D may use observations through the end of D-2 only [U]. Earlier-year history excludes the prediction year. NOAA-20 vegetation detections outside the static-source mask are the label [V]. A fire is new if there is no detection in its spot or its eight neighbours on D-1 or D-2 [U]; otherwise it is continuing. Longitude wraps at the antimeridian. Report continuing fires separately.

For the recent-fire feature, the intended 10 km becomes the spot or its eight neighbours at 0.25 degrees [U]. Use detections on D-4 through D-2 inclusive [U]. History is the share of eligible earlier years since April 2018 with a detection in the same spot and calendar month [U]; a year is eligible for a month only when that month is covered. Missing history is missing, not zero.

The forest-first default includes forest and shrub/grass spots [U]. All vegetation also includes farmland [U]. Until MCD12C1 is available, these are fallback majority IGBP classes from the 2021 land-class table: forest 1-5, shrub/grass 6-10, farmland 12 and 14 [V]. They are classes, not shares. Other or missing classes are excluded from these vegetation rankings. This fallback does not establish the specified 30% forest share.

## Ranking and measures

Rank within each region and day, separately for each vegetation selection. Show the top 10 and score the top 5 [U]. Rank descending by score, breaking ties by earlier-years history, then by the fixed seeded ordering with seed 20261114 [U]. Null scores are unavailable, not zero. Report coverage and do not silently treat missing scores as zero. Compare models and baselines on the same available region-days and candidate spots; report excluded data.

Evaluate region-days with at least one new fire among eligible spots [U]. Main measure: pooled capture rate, the sum of new fires in the top 5 divided by all eligible new fires across those region-days [U]. Hit rate is the share of such region-days with at least one captured fire [U]. For each region report capture rate and lift over random, capture divided by min(5, N)/N, where N is the number of eligible scored spots [U]. Report regions with fewer than 20 spots separately [U]. Report month, region and vegetation slices and the new/continuing split [U].

For calibrated probability predictions, report the Brier score and Brier skill, 1 minus model Brier divided by the history-only Brier, over the same scored spot-days [U]. A zero reference Brier makes skill undefined. Raw FWI and random ranking values are not probabilities and receive no Brier skill. Reliability uses ten equal-width probability bins [U].

## Baselines and claim

The baselines use the same ranking and candidate rules: NASA GFWED lead +3 FWI, earlier-year history, and seeded random ordering [U]. The NASA index is experimental [V]; call it the NASA fire-weather index as shown in GWIS. A forecast file's valid date must be three days after its run date [U].

For a model versus each baseline separately, resample non-overlapping seven-day calendar blocks of the test year, with all regions in each block kept together, for 2,000 draws using seed 20261114 [U]. For each draw recompute the pooled capture difference. Report the observed difference and the percentile 95% interval; a claim that the model is more accurate than that baseline is allowed only if its test-year capture is higher and the interval's lower bound is above zero, on the shipped grid [U]. Otherwise show where it wins and loses, without that claim.

## Plug-in file

A prediction run is one CSV or Parquet file with `grid_g`, `spot_id`, `day`, and `p`. `grid_g` is the grid size in degrees, `spot_id` follows spec section 3, `day` is a UTC date, and `p` is a probability from 0 to 1 or null for no data [U]. Optional input-contribution columns may accompany it. A valid run has at most one row per spot and day and covers all land spots for each intended day. Supply one run for the held-out year and one for the demo day [U].

## Deviations, 2026-11-14

The original FIRMS point latitude is no longer available in the aggregated 0.01-degree cell-day table [V]. At an exact 0.25-degree latitude boundary, that table cannot distinguish a point on the boundary from points just north of it. The label pipeline assigns that 0.01-degree cell to the northern risk spot, while the section 3 point formula assigns the exact boundary to the southern spot [V]. The number of affected detections has not been measured [U]. This limitation remains in the 0.25-degree hold-out and live history; no result should be described as an exact point-level reproduction at those boundaries [U].

The independent oracle's probability fixture includes no-fire region-days, while this scorer calculates Brier and reliability on fire-positive region-days [V]. The oracle's seeded tie example also uses a different seed and hash rule from the rule above [V]. These disagreements remain open for independent review [U].

The scorecard additionally reports probability metrics over all scored days, including no-fire days, under `probability_all_scored_days` [U]. This is supplementary and does not replace the registered fire-positive-day result or change the claim rule [U]. Its Brier calculations match the independent oracle's pooled and three region fixtures [V].

## Deviations, 2026-11-15

After the test, the displayed levels were changed from validation-quantile cutoffs to fixed daily chance bands of 0.01, 0.02, 0.05 and 0.10 [U]. This is a presentation change only; probabilities, ranking and scorecard results are unchanged [V].

The week outlook method is selected after scoring on 2025 [V]. For each lead, the worldwide forest and wildland comparison chooses the model only when its capture exceeds history and the weekly bootstrap interval for model minus history is entirely above zero on the shipped grid; otherwise it chooses history [U]. Therefore 2025 is not an untouched test of this method selection, and an independent later period is needed to evaluate the resulting outlook [U].

For this week experiment, forecasts at lead k use fire observations through the end of D-k, including the three-day nearby-fire window ending on that cutoff [U]. This is stricter than the D-2 cutoff registered above when k exceeds two. The model was trained with lead-three weather and D-2 history; applying it with the earlier cutoff and longer-lead weather is a post-registration experiment [V].

# Plan 3 (model v3) test rules

**Status: approved and frozen on 2026-11-15.** Drafted by the AI assistant that writes the v3 code; the project owner, with no independent reviewer available, asked it to finalize and approve the rules. This departs from the project rule that test rules come from someone other than the code author [V]. The safeguard kept is timing: this section is frozen by its commit before any v3 score on the test period exists [V]. Any later change is added as a dated deviation below and may not follow any look at test-period results.

## Why new periods

2025 was the plan 2 held-out test year and has been scored once [V]. It cannot serve as an untouched test again. For v3, 2025 becomes the settings year and a new period is held out.

## Periods

| Use | Period | Rule |
|---|---|---|
| Training | 1 Jan 2021 to 31 Dec 2024 | Fit only on these days [U] |
| Settings | 1 Jan to 31 Dec 2025 | Choose settings, input groups and calibration here only [U] |
| Test | 1 Jan to 31 Oct 2026 | Scored once, with every setting frozen [U] |

The record of fire detections reaches 14 November 2026 [V]; November 2026 stays out of the test so the period is fixed before any score is seen [U]. The NASA fire-weather files for 2026 must be downloaded and converted with the same scripts before the test [U].

## What stays the same as plan 2

Labels, the D-2 observation cutoff, the lead +3 weather, the 0.25 degree grid, candidate spots, vegetation selections, ranking and tie rules, the top 5 capture measure, hit rate, lift, the three baselines and the 2,000-draw seven-day block bootstrap with seed 20261114 all follow the plan 2 rules above [U]. The 2025 test of `lightgbm-v2` stands as published and is not rescored [U].

## Inputs and publication dates

Every new input for prediction day D must have been **published** by the end of D-2 UTC, not only measured by then [U]. For each source the record keeps the rule used to date publication:

| Group | Inputs | Publication rule |
|---|---|---|
| Calendar | Day of week, weekend | Known in advance; no lag [U] |
| Calendar | Public holidays | Not used in v3: the calendar group did not help on 2025 [V] |
| People | Population density (NASA SEDAC GPW v4, 2020) | One fixed map published 2018 [U], before all training days |
| People | Road density, built-up share | One fixed map each, used only if published before 1 Jan 2021 or the gap is stated [U] |
| Plants and soil | NASA VIIRS VNP13C1 greenness (NDVI) and its anomaly against a 2013 to 2020 month-by-month normal | A composite counts once its window start plus 37 days has passed D-2 [U]. 37 days is the longest delay from window start to publication among composites starting November 2025 to November 2026 (median 18) [V]. Catalogue end dates are not used: one composite was published before its stated window ended [V] |
| Plants and soil | SMAP L3 soil moisture | A day counts one day after it was measured: SMAP for 14 Nov appeared on 15 Nov [V]. Use days through D-3 at most [U] |
| Weather | Raw forecast weather from NOAA GFS (temperature, humidity, wind speed and direction, gusts, rain on D and D+1 to D+3, dry spell) | The 00 UTC GFS run of D-2, issued about four hours after it starts [V]; the same run is used live [U]. Each run's file upload time is recorded; runs uploaded later to the archive (backfill) are flagged, and their publication is taken from the operational schedule [U]. The GFS model was upgraded in March 2021 [U], so early 2021 runs come from the previous version |

A missing input stays missing; it is never filled with a value from after the cutoff [U].

## Choosing input groups

The plan 2 model inputs are the starting set. Each new group is added to that set on its own and kept only if its pooled top 5 capture on the 2025 forest and wildland selection, worldwide, is higher than the starting set refitted on 2021 to 2024 with the same settings [U]. Results are reported per continent as well as pooled, so a group that helps one area and hurts another is visible [U]. Groups that each pass are then combined and the combination is checked on 2025 once more [U]. The final input set is the combination if its 2025 capture is at least that of the best single passing group, otherwise that single group [U].

Model settings (number of trees, learning rate, leaves, minimum leaf size, feature and row sampling, negative sample rate) may be searched on 2025 only, by the same pooled capture. Every configuration tried is logged with its 2025 score [U].

## The frozen model

The tested model is trained on 2021 to 2024 with the chosen inputs and settings and calibrated on 2025 with the same logistic calibration as `lightgbm-v2` [U]. Before any test-period score is computed, the record stores the code commit, the model file and its SHA-256 hash [U]. The `lightgbm-v2` comparison uses the model as served, applied to 2026 with its own inputs [U]. The primary result is the worldwide forest and wildland selection; Europe and the per-continent results are reported alongside without changing the claim rule [U].

## Claim on the test period

The frozen v3 model is scored once on the test period against `lightgbm-v2`, fire history, the NASA fire-weather index and random ordering. The plan 2 claim rule applies, with the bootstrap over seven-day blocks of the test period [U]. v3 replaces v2 in the app only if it beats v2 under that rule and the owner approves the switch [U].

## Addition, 2026-11-15: false alarms (before any test-period score)

Added at the owner's request so that a model cannot look better by flagging more places. The top 5 capture above counts only region-days with a new fire; 89% of 2025 forest and wildland region-days had none [V], and every flag on those days is a false alarm.

**Measure.** Each day, rank every forest and wildland spot worldwide by the model and take the K highest, for K = 100, 1,000 and 5,000. Alarm precision is the share of those K spot-days that had a new fire, over all days of the period, including days without fires [U]. Every model flags the same number of spots, so higher precision means fewer false alarms at equal effort. Differences use the same seven-day block bootstrap (2,000 draws, seed 20261114) [U]. For `lightgbm-v2` on 2025 the shown chance bands flag 8,849 spot-days a day at 2% or more (3.3% had a new fire), 1,019 at 5% or more (6.1%) and 67 at 10% or more (8.5%) [V].

**Settings year.** A group, a combination or a model setting is kept only if, in addition to the capture rule, its alarm precision at K = 1,000 is not lower than the v2 refit's [U].

**Test period.** In addition to the plan 2 claim rule, v3 replaces v2 only if its alarm precision at K = 1,000 is not lower than v2's and its Brier score over all scored spot-days is not higher than v2's [U]. The precision and the share of all fires inside each shown chance band (2%, 5%, 10%) are reported for both models [U].
