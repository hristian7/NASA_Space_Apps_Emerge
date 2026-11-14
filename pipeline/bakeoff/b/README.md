# Pipeline B, model A: the stratum ratio

Turns MODIS fire counts into the level S-NPP would have seen, on the 0.1 degree grid, monthly.
Implements [`../../../docs/harmonization-pipeline-plan.md`](../../../docs/harmonization-pipeline-plan.md)
steps 2 to 6, model A, under the frozen rules in [`../PROTOCOL.md`](../PROTOCOL.md).

## How to run

```bash
python3 pipeline/bakeoff/b/run.py --data /path/to/data
```

One command. Reads `derived/bg_us/cell_days.parquet`, writes `derived/bakeoff/B/pred.parquet`,
`manifest.json` and `ratios.csv`. About 5 seconds for Bulgaria and the USA, the fit itself 1 second
per window `[V]`. It prints the control total, the row counts, the grid-total check, the schema
check and the in-sample diagnostics.

## What it does

1. Rolls the shared cell-days up to 0.1 degree cell x month per satellite, keeping which 0.25 degree
   cell each piece falls in (a 0.1 degree cell can straddle two of them).
2. Pairs afternoon-pass MODIS (Aqua) with S-NPP per cell-month in the fit years.
3. Per stratum, `k = S-NPP total / MODIS total`, which is the plan's `mean(VIIRS) / mean(MODIS)`.
4. Applies `k` to MODIS counts in the prediction years, then adds the same pieces up on both grids.
   The plan's `n < 20 cell-days` threshold lets thin strata keep extreme ratios: latitude band 3
   gets `k = 22` on 515 cell-days, band 11 `k = 7.6` on 175 `[V]`. Left as the plan says.

## Choices the plan left open

| Question | Choice |
|---|---|
| Does `k` vary by month? | No. The pipeline plan lists month as a feature of model B and words model A as one `k` per stratum. |
| How does Terra enter? | Kept out of the training pairs. It predicts only in 0.1 degree cell-months where Aqua saw nothing, through its own ratio, so nothing is counted twice. |
| S-NPP that no MODIS satellite saw | A ratio cannot place it. Its mass is shared between the Aqua and Terra paths in proportion to their MODIS mass, so the stratum total is reproduced in sample. |
| Which cell-months count as pairs | Does not matter: `mean / mean` over a stratum equals the ratio of totals, so empty cell-months cancel. |
| Support `n` for borrowing | Counted in cell-days for both units, as the plan words it. Chain: continent x band, then continent, then global. |
| The 80 percent range | 200 bootstrap resamples of the stratum's training pairs, in MODIS size bins; the range is the 10th to 90th percentile of the per-pair ratio, averaged over the resamples. Parameter uncertainty alone would be far too narrow to be honest. |
| How the ranges were combined for 0.25 degree | `lo` and `hi` are summed from the same pieces as `pred`, so the ratio error is treated as perfectly correlated inside a stratum. That is the wider, safer choice. |
| Continent | Assigned from NASA's country label (Bulgaria is Europe, the USA is North America). No continent map is available. |
