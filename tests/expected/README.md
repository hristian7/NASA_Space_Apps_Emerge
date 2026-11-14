# Expected answers (oracle)

Written on 14 Nov 2026 by a separate agent, before the code under test existed. The agent never read the pipeline code. Results of the code are checked against these files, never the other way round.

| File | What it holds | How it was computed |
|---|---|---|
| `cell_id.json` | 34 cases of the 0.25 degree cell rule (spec 4.3): `lat, lon, row, col, cell_id, center_lat, center_lon`. Covers Sofia, a California point, equator and prime meridian, both poles, lon 180 and -180, points on and just beside cell edges, southern and western hemispheres. | Exact rational arithmetic in the Python standard library. Longitude is wrapped into [-180, 180) first. Latitude 90 gives row 0. Latitude -90 is clamped to row 719. |
| `bakeoff/truth_samples.json` | Independent S-NPP truth for 5 country-months (Bulgaria Mar 2014, Aug 2020, Jul 2022; United States Sep 2020, Aug 2022): totals, busiest q25 cells, top 3 cells, rows dropped per rule. Jul 2022 and Aug 2022 contain S-NPP gap days, so they test the gap rule. | Raw NASA CSV files read with the `csv` module only. No dataframe library and not the parquet file. Rules: `type` 0, confidence `n` or `h`, `frp` >= 0, valid coordinates, gap days dropped. `cd` = distinct (0.01 degree cell, day) pairs, `cy = floor(lat * 100)`, `cx = floor(lon * 100)`. `hot` = kept rows. |
| `make_expected.py` | Regenerates both files. | Standard library only. |

`pipeline/bakeoff/score.py` compares its parquet-based truth with `truth_samples.json` and stops on any difference.

Facts found while writing the samples:
- `rows_where_float_and_decimal_floor_differ` counts rows where `floor(lat * 100)` in double arithmetic differs from the exact decimal floor [V]. It is 25 for United States Sep 2020 and 0 elsewhere. It does not change the totals [V].
- The busiest cell is the one with the highest `cd`. Ties go to the lower cell id.
