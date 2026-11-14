# The world run of the conversion

`world.py` turns the world cell-day table into the harmonized monthly record the
app reads, using the model the independent scorer scored in the bake-off as A2.

```bash
python3 pipeline/convert/world.py --data data --threads 16 --check-bakeoff
```

`--model A2` (the default) runs the model the scorer scored. `--model A3` runs
the variant whose background follows the period's own MODIS activity; the
independent scorer decides whether it replaces A2.

The model is not written again here. `world.py` imports the fit and predict
functions from `../bakeoff/a/run.py`, so the world record and the scored model
are the same code. `--check-bakeoff` refits the bake-off's t1 through those same
imports and asserts the result matches the A2 rows already in
`data/derived/bakeoff/A/pred.parquet`.

## What it does

1. One duckdb pass over the cell-day table reduces it to q25 cell-months per
   country and satellite, with the 34 S-NPP gap days kept apart.
2. It fits on Feb 2012 to Dec 2022, gap days and January 2012 dropped: a ratio
   of sums per country x 5 degree latitude band x calendar month, shrunk group
   to country to global, plus a background term for cell-months where the MODIS
   sensor saw nothing. Each country's choice between `moy` and `moy_pooled` is
   made on an inner split (fit to 2020, held out on 2021 and 2022).
3. It predicts Jul 2002 to Jan 2012 from Aqua (`estimated_modis`) and Nov 2000
   to Jun 2002 from Terra (`estimated_terra`), with 90% ranges.
4. Feb 2012 onward is measured S-NPP (`measured`), with the gap days filled from
   NOAA-20 scaled by the NOAA-20 to S-NPP ratio measured on 2018 to 2022, and
   the month flagged `snpp_gap_filled`.

## Outputs, in `data/derived/world/harmonized/`

| File | Holds |
|---|---|
| `cells_monthly.parquet` | one row per 0.25 degree cell-month that any satellite saw fire in, values added across the countries a border cell belongs to |
| `background.parquet` | the background value per group and calendar month and period, which is ruling 10 of `../../docs/number-logic.md`. It is a function of group and calendar month only, never of the cell |
| `factors.parquet` | the multiplier applied to the source sensor's raw count, per group, period and calendar month, for the app to scale raw daily counts before 2012. Where the source sensor saw fire the value is exactly raw count times this factor and nothing is added; the background applies only where it saw nothing |
| `cell_groups.parquet` | each cell's group, and the country with the most fire rows in it |
| `countries_monthly.parquet` | per country and month, the cells added up plus the background for every cell of the country's cell universe with no row, and the raw per-satellite hotspot counts |
| `manifest.json` | model, per-country picks, ratios, timings, row counts, control totals, what is left out |

The cell universe is the bake-off's: every q25 cell with at least one Terra,
Aqua or S-NPP row in the fit window, per country.
