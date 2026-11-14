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

## `logic/`: expected answers for the app's number logic

Written on 14 Nov 2026 from `docs/number-logic.md`, `web/src/types/ui.ts` and `docs/data-contract.md`, before the logic code existed. The author never read `web/src/lib` or `web/src/components`. Plain Python with numpy and scipy (`scipy.stats.beta` for the Jeffreys range, `numpy.polyfit` as a cross-check of an exact-fraction least-squares fit). The example files under `web/public/data` are read with `json` and `gzip` only. `logic/make_logic_expected.py` regenerates every file and is deterministic.

| File | Section | What it pins |
|---|---|---|
| `selection_weights.json` | 1 | Cell ids and overlap weights (sub-cell counts out of 625, and the weight to 6 decimals), total weight, `lowConfidence`, for points, polygons, the 180 degree line, the equator, 65 N, cell edges and the small-selection rule |
| `series_cases.json` | 2 | Monthly series from the example tiles for three selections plus one small selection, and three Bulgaria country months. Exact integers (`value_x625`) sit next to the rounded values |
| `daily_cases.json` | 4, 6 | 8 day window totals per year, rank, month to date with each past year, and the window date mapping |
| `unusual_cases.json` | 3, 4 | Status, median, mean, ratios, `higherThan`, `years`, `no_history`, `too_early` |
| `chance_cases.json` | 5 | Chance of fire and its Jeffreys range |
| `window_cases.json` | 6 | Ranking, ties, null years, the `estimated` flag |
| `trend_extremes_cases.json` | 7 | Slope, share per decade, worst month, worst year |
| `csv_cases.json` | 8 | Body rows of the monthly CSV, rounding, quoting, line ends |

Numbers are rounded to 6 decimals; compare with a tolerance of 1e-6. Every case has exactly one expected answer; the points the rules left open were ruled in section 9 of `docs/number-logic.md` and are pinned to those rulings.
