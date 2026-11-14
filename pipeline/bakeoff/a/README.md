# Pipeline A, tier T1: MODIS to S-NPP VIIRS level

Tier T1 of [`../../../docs/conversion-plan.md`](../../../docs/conversion-plan.md) under the
frozen rules in [`../PROTOCOL.md`](../PROTOCOL.md): grid `q25`, monthly, units `cd` and
`hot`, tests `t1`, `t2`, `t3`. For each test and unit it pairs the Aqua value with the
measured S-NPP value per `q25` cell and month inside that test's fit years (plan step 5),
then fits two numbers per group and time term: a ratio of sums where Aqua saw fire, and a
base rate where Aqua saw nothing. Both are pulled toward the group, country and global
value by empirical-Bayes shrinkage. The 90% range is a Poisson-weight bootstrap of the
pairs times an empirical residual spread. A Terra model for Nov 2000 to Jun 2002 is fitted
and reported in the manifest only. S-NPP rows from a test's prediction years are never read
for that test: assertions in `run.py` check it, and the written years match each test's
window exactly `[V]`.

## Variant A2

Same model, three changes. The time term is chosen per country on an inner split (the last
two fit years): month-of-year, 3-month seasons, no term, or month-of-year with 8x stronger
pooling. The bootstrap is moment-matched, so its cost is strata x draws, not rows x draws
(3.93 s to 0.18 s a call, same spread) `[V]`. Fit and predict take a table and return a
table, so a world script can call `run_conversion` with its own windows and satellite.

## How to run

`python3 pipeline/bakeoff/a/run.py --data data`. Needs duckdb, pandas, numpy and pyarrow.
112 s on two countries for both variants; writes `pred.parquet` (7,512,776 rows, A and A2)
and `manifest.json` into `data/derived/bakeoff/A/` `[V]`.

## Choices the plan left open

| Choice | What we did |
|---|---|
| Group | Region x 5 degree latitude band, region = country (protocol rule 5). 13 groups. Alaska (bands 10 to 14) and Hawaii (bands 3 and 4) are already apart from the lower 48 (bands 5 to 9), so no longitude split `[V]` |
| Latitude band | `floor(lat / 5)` of the `q25` cell centre. 0.25 divides 5, so no cell straddles an edge `[V]` |
| Shrinkage | Ratio: the parent gets the weight of 25 Aqua cell-days of exposure, scaled to the unit (A2 also tries 8x that). Zero term: 50 candidate cell-months. Cascade: group x time term, then group, then country, then both countries `[U]` |
| Zero term | Mean S-NPP over cell-months in the group with Aqua at 0. The L2-optimal constant for that stratum `[U]` |
| Range | 200 bootstrap draws, residuals pooled by group and Aqua exposure bin (edges 2, 3, 5, 9, 17, 33, 65), falling back to country then global below 100 residuals. Residuals are in-sample, so the band is slightly optimistic `[U]` |
| Universe | Cells with a Terra or Aqua row in 2012-02 to 2022-12, plus cells with an S-NPP row in the fit years. Protocol section 5 would use S-NPP across all of 2012 to 2022, which rule 4 forbids; rule 4 wins. Covers 14095 of 14374 US and 242 of 242 Bulgarian protocol cells `[V]` |
| Not done | Plan steps 1, 2 and 4 (the protocol fixes the input; no scan, track or MCD14CMQ data), day/night and FRP features, NOAA-20 gap filling, drift correction for t3. Listed in `manifest.json` |
