# Model v3: result of the 2026 test

16 Nov 2026. Branch `model-v3`. The app still serves `lightgbm-v2`; nothing is deployed.

## In short

**v3 beats v2 on data it has never seen, on all three registered checks** [V]. Test period 1 January to 31 October 2026, scored once, after the model was frozen (commit e36b8ff, model hashes in `pipeline/risk/v3_frozen.json`).

| Check (forest and wildland, worldwide) | v2 as served | v3 | Difference, 95% range | Passed |
|---|---|---|---|---|
| New fires in the top 5 of their region | 20.89% | **21.39%** | +0.50 points, +0.40 to +0.61 | Yes |
| Alarm precision: share of the top 1,000 spots a day with a new fire | 6.27% | **7.04%** | +0.78 points, +0.64 to +0.92 | Yes |
| Brier score, all scored spot-days (lower is better) | 0.005790 | **0.005772** | -0.000018, -0.000022 to -0.000015 | Yes |

All numbers [V], from `pipeline/risk/v3_test.py` (`test_2026_result.json` in this folder). 224,867 new fires on 92,620 region-days. In plain terms: for the same number of alarms, v3's alarms are real fires about 12% more often, and it finds about 2.4% more fires in the top 5.

## What v3 is

v2's inputs plus two groups that passed the 2025 selection: **people** (population, roads, built-up land) and **weather** from the NOAA GFS forecast issued two days earlier (highest temperature, lowest humidity, wind, gusts, rain on the day and the next three days, days since rain). Greenness, soil moisture and the calendar were tested and dropped: they did not improve the 2025 settings year [V]. Settings: 400 trees, up to 63 leaves, learning rate 0.03, chosen from 24 tried on 2025 [V].

## Everywhere, not only on average

| Continent | New fires | v2 | v3 | Difference, 95% range |
|---|---|---|---|---|
| Africa | 63,502 | 21.50% | 21.78% | +0.28, +0.07 to +0.52 |
| South America | 53,444 | 14.64% | 15.13% | +0.49, +0.29 to +0.69 |
| Asia | 40,091 | 29.34% | 29.93% | +0.59, +0.34 to +0.84 |
| North America | 33,922 | 16.38% | 16.79% | +0.40, +0.18 to +0.63 |
| Europe | 19,786 | 32.55% | 33.78% | **+1.22**, +0.86 to +1.57 |
| Oceania | 13,980 | 11.90% | 12.38% | +0.49, +0.14 to +0.86 |

v3 is ahead on every continent, with the range above zero on all six [V]. All vegetation including farmland: 20.50% to 20.95% [V]. Against the baselines v3 is ahead by 4.2 points over fire history, 9.9 over the NASA fire-weather index and 10.5 over random [V].

## What users would see differently

The app shows chance bands. With v3, more places reach the 5% band, and the ones shown are slightly more often right [V]:

| Shown band | Spots a day, v2 | Spots a day, v3 | Share that had a new fire, v2 / v3 | Share of all new fires inside, v2 / v3 |
|---|---|---|---|---|
| 2% or more | 8,920 | 8,884 | 3.4% / 3.7% | 43.7% / 47.0% |
| 5% or more | 1,009 | 1,456 | 6.4% / 6.7% | 9.3% / 14.0% |
| 10% or more | 68 | 99 | 9.7% / 10.7% | 1.0% / 1.5% |

So the map would show about 45% more spots in the 5% band, each a little more reliable, catching half again as many fires [V].

## Honest limits

- One test period of ten months; 2025 was used to choose inputs and settings, so 2025 numbers are not independent [V].
- Two weather days are missing (NOAA archive faults, 2021 and 2022); missing stays missing [V].
- The weekend calendar, holidays, greenness and soil moisture are not in v3 [V].
- The test rules were approved by the code author on the owner's instruction, without an independent reviewer; the safeguard was freezing them and the model before any test score (`PROTOCOL.md`, plan 3) [V].

## To switch the app to v3 (needs the owner's go-ahead)

| Step | What | Effort |
|---|---|---|
| 1 | Daily run fetches the newest 00 UTC GFS run (about 17 MB) and builds the weather inputs | 0.5 day |
| 2 | Daily run uses `model_v3.json` and the people map; keeps v2 as fallback when GFS is late | 0.5 day |
| 3 | Update the "why this spot" reasons and the proof page with these results | 0.5 day |
| 4 | Run v3 and v2 side by side for a few days before switching what the map shows | a few days of waiting |
