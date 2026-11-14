# Pipeline A, tier T1: MODIS to S-NPP VIIRS level

Tier T1 of [`../../../docs/conversion-plan.md`](../../../docs/conversion-plan.md) under the
frozen rules in [`../PROTOCOL.md`](../PROTOCOL.md): grid `q25`, monthly, units `cd` and
`hot`, tests `t1`, `t2`, `t3`.

## What it does

For each test and unit it pairs the Aqua value with the measured S-NPP value per `q25`
cell and month inside that test's fit years (plan step 5), then fits two numbers per
group and month-of-year: a ratio of sums where Aqua saw fire, and a base rate where Aqua
saw nothing. Both are pulled toward the group, country and global value by empirical-Bayes
shrinkage. The 90% range comes from a Poisson-weight bootstrap of the calibration pairs
times an empirical residual spread. A separate Terra model is fitted for Nov 2000 to
Jun 2002 and reported in the manifest only.

S-NPP rows from a test's prediction years are never read for that test: two assertions
in `run.py` check it, and the written years match each test's window exactly `[V]`.

## How to run

```bash
python3 pipeline/bakeoff/a/run.py --data data
```

Needs duckdb, pandas, numpy and pyarrow. Takes 50 s on two countries, 31 s of it in the fit.
Writes `data/derived/bakeoff/A/pred.parquet` (3,756,388 rows, 2.6 MB) and `manifest.json` `[V]`.

## Choices the plan left open

| Choice | What we did |
|---|---|
| Group | Region x 5 degree latitude band, region = country (protocol rule 5). 13 groups. Alaska (bands 10 to 14) and Hawaii (bands 3 and 4) are already apart from the lower 48 (bands 5 to 9), so no longitude split `[V]` |
| Latitude band | `floor(lat / 5)` of the `q25` cell centre. 0.25 divides 5, so no cell straddles an edge `[V]` |
| Shrinkage strength | Ratio: the parent gets the weight of 25 Aqua cell-days of exposure, scaled to the unit. Zero term: 50 candidate cell-months `[U]` |
| Shrinkage cascade | group x month-of-year, then group, then country, then both countries |
| Zero term | Mean S-NPP over cell-months in the group with Aqua at 0. The L2-optimal constant for that stratum `[U]` |
| Range | 200 bootstrap draws, residuals pooled by group and Aqua exposure bin (edges 2, 3, 5, 9, 17, 33, 65), falling back to country then global below 100 residuals. Residuals are in-sample, so the band is slightly optimistic `[U]` |
| Universe | Cells with a Terra or Aqua row in 2012-02 to 2022-12, plus cells with an S-NPP row in the fit years. Protocol section 5 would use S-NPP across all of 2012 to 2022, which rule 4 forbids; rule 4 wins. Covers 14095 of 14374 US and 242 of 242 Bulgarian protocol cells `[V]` |
| Not done | Plan steps 1, 2 and 4 (the protocol fixes the input; no scan, track or MCD14CMQ data), day/night and FRP features, NOAA-20 gap filling, drift correction for t3. Listed in `manifest.json` |
