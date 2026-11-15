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
