# Plan 3, steps 0 to 3: first results for model v3

15 Nov 2026. Branch `model-v3`. The served model `lightgbm-v2` and its files are untouched; v3 code and outputs are separate (`pipeline/risk/*v3*`, `data/derived/risk/v3/`).

## In short

- **Calendar and people inputs barely change the ranking.** On the 2025 settings year the best change is +0.06 points of top-5 capture, on a base of 20.5% [V, measured here]. That is about 160 more fires found out of 258,807 [V].
- **By the draft rule, calendar is dropped and people is kept** (calendar alone: -0.03 points; people alone: +0.03 points). Neither result is clearly above zero.
- **Plants and soil:** soil moisture and greenness downloads are running. Greenness comes from NASA VIIRS (decided 15 Nov, below).
- **Raw weather:** NASA does not publish a GEOS-5 forecast archive for 2021 to 2026. NOAA's GFS forecast archive does, on our exact grid, free of restrictions; its 2021 to 2025 download is running.
- **The 2026 test is not scored yet.** The test rules are approved and frozen; 2026 is scored once, after the model is frozen.

## Result on the 2025 settings year

Top-5 capture: the share of new fires that were in the five spots a region's ranking puts first that day. Forest and wildland, worldwide, 106,994 region-days with a new fire, 258,807 new fires [V].

| Model | Capture | Change vs v2 refit | 95% range of the change |
|---|---|---|---|
| v2 as served (trained 2021 to 2023) | 20.45% | -0.04 | -0.08 to +0.01 |
| **v2 refit** (same inputs, trained 2021 to 2024) | **20.48%** | reference | |
| + calendar (day of week, weekend) | 20.45% | -0.03 | -0.08 to +0.02 |
| + people (population, roads, built-up) | 20.51% | +0.03 | -0.05 to +0.11 |
| + calendar and people | 20.55% | +0.06 | 0.00 to +0.13 |
| History only (baseline) | 16.71% | -3.77 | |
| NASA fire-weather index (baseline) | 11.24% | -9.24 | |

All numbers [V], measured by `pipeline/risk/v3_select.py`. Its scorer reproduces the published v2 2025 scorecard exactly (v2 20.45%, history 16.71%, NASA index 11.24%, random 10.55%), so the numbers sit on the same footing as the proof page. Ranges are the plan 2 weekly bootstrap (2,000 draws, seed 20261114).

### Per continent (change in points vs v2 refit)

| Continent | New fires | v2 refit | + calendar | + people | + both |
|---|---|---|---|---|---|
| Africa | 71,587 | 22.05% | -0.03 | -0.03 | +0.02 |
| South America | 63,376 | 14.57% | -0.09 | +0.03 | +0.05 |
| Asia | 46,581 | 29.13% | -0.06 | -0.07 | -0.08 |
| North America | 39,796 | 15.78% | +0.07 | **+0.16** | **+0.15** |
| Europe | 19,831 | 31.10% | -0.10 | +0.24 | **+0.24** |
| Oceania | 17,483 | 10.92% | +0.15 | +0.05 | **+0.23** |

Bold: the 95% range is above zero [V]. People data helps most where it was expected to, Europe and North America [D], and is flat to slightly negative in Africa and Asia [D].

### Why so small

The model already knows where fires usually happen (fire history and nearby fires carry most of its skill). Population and roads mostly say the same thing again [U]. In the fitted models the people inputs get under 2.2% of the splitting gain, the calendar under 0.5% [V].

## What was built

| Item | File | State |
|---|---|---|
| Test rules for v3 | `pipeline/risk/PROTOCOL.md`, section "Plan 3" | Approved and frozen 15 Nov |
| v3 input groups | `pipeline/risk/features_v3.py` | Calendar and people done; plants and soil named, not built |
| People map | `pipeline/risk/v3_people.py` | Built: 342,924 spots [V] |
| Selection run on 2025 | `pipeline/risk/v3_select.py` | Done; result `data/derived/risk/v3/select_2025.json` |
| Plants and soil downloads | `pipeline/risk/v3_plants_soil.py` | SMAP 2021 to 2025 and VIIRS greenness 2013 to 2025 downloading |
| Tests | `pipeline/risk/tests/test_v3.py` | 42 of 42 pass with the existing tests [V] |

Sanity check of the people map against known values: Netherlands 517 people per km², Bulgaria 74, Canada 3 [V, GPW cells averaged; national figures are about 520, 63 and 4 [D]].

## Licences checked

| Data | Licence | Use |
|---|---|---|
| NASA SEDAC GPW v4.11 population density 2020 | CC BY 4.0 [V] | Used |
| GRIP4 road density (PBL Netherlands) | CC0 [V] | Used |
| GHSL built-up surface 2020, R2023A (EU JRC) | CC BY 4.0 [V] | Used; released 2023, so it postdates 2021 to 2022 training days; all 2025 and 2026 scoring days are after its release [V] |
| NASA VIIRS VNP13C1, SMAP | NASA open data, no restrictions [U] | Downloading |
| NOAA GFS forecasts | NOAA open data, no restrictions [U] | Downloading |

All three people sources need a line in the References field.

## Publication-date rule for plants and soil

NASA reprocessed both archives, so the catalogue dates for 2021 to 2025 are re-release dates, not when the data first appeared [V]. The script therefore uses a fixed delay measured on recent files:

| Product | Measured delay, last 12 months | Rule used |
|---|---|---|
| VIIRS VNP13C1 greenness, 16-day composite, a new one every 8 days | median 18 days, max 37 days after the window starts [V] | Composite usable if its start + 37 days is by D-2 |
| SMAP L3 soil moisture, daily | usually the next day (14 Nov 2026 appeared 15 Nov) [V] | Days up to D-3, newest of the last 3 days with data |

Download size: SMAP uses NASA's subsetting service and takes only the two soil-moisture layers, about 4 MB a day instead of 560 MB [V]; 2021 to 2025 is about 8 GB [D]. The SMAP grid placement was checked: 96% of cells land on land spots and values agree with the file's own coordinates (r = 0.97) [V]. A gap of about 46 days in 2022 is a known SMAP outage window [U]; those days stay missing.

## Needs a decision

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | ~~Approve the v3 test rules~~ **Approved 15 Nov by the owner's instruction** | The code author finalized and froze them in `PROTOCOL.md` before any 2026 score exists; the departure from the independent-author rule is recorded there | Done |
| 2 | ~~Greenness file format~~ **Decided 15 Nov: NASA VIIRS VNP13C1.** MODIS MOD13C1 comes as HDF4, which nothing installed here reads [V] | VIIRS: same worldwide coverage, readable with the installed GDAL, no new dependency, and the satellite series continues while MODIS Terra nears its end [U] | Its delay is longer (median 18 vs 18 days from window start for MODIS, worst case 37 vs 27) [V], so the newest usable greenness is 5 to 6 weeks old |
| 3 | **Raw weather source. Decided 15 Nov: NOAA GFS, download started** | A: GEOS-5 forecast archive. NASA's public portal keeps only a rolling window (back to 29 Oct 2026) [V], so no 2021 to 2026 history · B: NASA MERRA-2 (what really happened). Easy, but trains on perfect weather · C: NOAA GFS forecast archive on AWS, from 1 Jan 2021, 0.25 degrees like our grid; upload times are recorded, but runs before the AWS feed began were backfilled in 2024 [V] | **C**. About 22 MB a day for the fields needed (temperature, humidity, wind, rain to D+3), about 48 GB for 2021 to 2026 [D], gridded and discarded as it goes. GDAL here reads GRIB2 [V]. Downloading 2021 to 2025 only; 2026 waits for the approved test rules |
| 4 | Holidays | A ready-made holiday library (new dependency) or a hand-made table | Low priority: the calendar group did not help on 2025 |
| 5 | Keep people inputs? | By the draft rule yes (+0.03 points); the gain is within noise | Keep for now, decide again with plants and soil, which may carry the same signal better |

## What each next step needs

| Step | Needs | Effort |
|---|---|---|
| Plants and soil: soil moisture | SMAP download to finish (running, about 4 hours [D]), then `v3_plants_soil.py grid-smap`, then the feature SQL and a rerun of `v3_select.py` | 0.5 day |
| Plants and soil: greenness | Download running: each 150 MB file is gridded and deleted, about 300 files [D]; then `ndvi-normal`, the feature SQL and a rerun of `v3_select.py` | 0.5 day |
| Raw weather | Download running (`pipeline/risk/v3_weather.py`, about 17 MB a run fetched, 12 seconds a run, about 6 hours for 2021 to 2025 [D]); runs start 1 Jan 2021, the first in the archive [V]. Then the feature SQL (dry spell from earlier runs) and a rerun of `v3_select.py` | 1.5 days |
| Final test on Jan to Oct 2026 | Decision 1; NASA fire-weather files for 2026 downloaded and converted; one frozen v3 model | 1 day |

## Notes

- 2026 is never read by these scripts; the download script refuses 2026 until the rules are approved.
- The comparison ranks spots only; v3 probabilities are not calibrated yet. Calibration on 2025 comes with the frozen model.
- Weekends are Saturday and Sunday in UTC everywhere; countries with a Friday-Saturday weekend are treated wrongly [U]. This does not change the conclusion above.
