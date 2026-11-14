# Daily fire outlook for Bulgaria, version 2: NASA weather model, land cover, terrain, 10-epoch neural network

Code: `engine/daily/v2/`. Results: `docs/engine-results/daily-v2/` (one JSON per run, `summary_tables.txt`, the live outlook). Version 1 is in [`daily-outlook.md`](daily-outlook.md). Written 14 Nov 2026.

## What changed and why

Version 1 hit about 48% with one spot per municipality, no better than "where it burned last week". Version 2 does four things.

1. **It follows the team's plan-2 protocol** ([`../specs/plan-2-fire-risk/specification.md`](../specs/plan-2-fire-risk/specification.md)).
   - Labels come from NOAA-20 only, starting 1 Apr 2018.
   - "New fire" means no detection in the same cell on the two days before (decision D-15).
   - The split is train 2019–2023, validate 2024 and test 2025, scored once.
   - The main score is the top 5 spots per province (region). The baselines are the official index and history, and a claim of "better" needs a bootstrap interval above zero.
2. **It uses a weather model instead of point weather.** The fire-weather input is NASA's GEOS-5 model through GFWED (decision D-11). We kept the same operational lag as the live system (below).
3. **It adds the highest-value inputs from the [data-sources master list](data-sources-master.md) that need no login.**
   - Land cover from ESA WorldCover 10 m (value 4 in the list).
   - Terrain from the Copernicus DEM (value 3).
   - Distance to settlements, from WorldCover built-up areas.
   - MODIS land cover and NDVI need the Earthdata login, so they are still to come.
4. **It fixes a leak in version 1's climatology.** Version 1 computed "how often this cell burns in this month" from the training years and then trained on those same years. Each training row's own fire was therefore inside its own feature. Version 2 leaves the row's own year out. Fixing this alone raised one-spot hits from 53.9% to 57.7% on the test year and from 51.3% to 53.9% on validation.

## The weather model

**Which model.** We use NASA's **GEOS-5** global atmospheric model, through the Global Fire Weather Database (GFWED). GFWED publishes two kinds of fields at 0.25° × 0.3125° (about 28 × 25 km over Bulgaria), with no login:

- the Canadian fire-weather index fields (FFMC, DMC, DC, ISI, BUI, FWI, DSR) computed from GEOS-5's daily analysis, back to May 2014;
- the same fields from every forecast run since 29 Nov 2017, out to +8 days.

**Why this model.**

- It is the system the team already chose for the live app (D-11).
- Training on archived forecasts means the model learns from forecasts exactly as good or bad as the ones it will get live. Training on observed weather would quietly assume a perfect forecast.
- It is NASA data.

**How we got it.** Downloading every file whole would be 4,575 analysis files plus 15,798 forecast files, at 17 MB each (about 340 GB). The files are NetCDF-3, so each Bulgaria row sits at a fixed byte offset. `gfwed.py` therefore asks for only those bytes, in one multipart HTTP request per file, about 10 KB each.

- The first test file matched a full download exactly (difference 0.0).
- Every slab is range-checked. A slab that fails the check is downloaded whole and read properly.
- Total: about 20 minutes.

**Operational lag, as on the live evening.** On 14 Nov 2026 the newest analysis and the newest run were both dated 12 Nov. So a forecast issued at the end of day t uses:

- the run of day t−2: lead +3 for tomorrow (the team spec's choice), +4 and +5 for days 2 and 3;
- the analysis of day t−2.

A test wipes every fire, analysis and run after what is known on the issue evening and confirms that no feature changes (`tests/test_v2.py`).

**Why we did not run our own simulation (WRF or similar).** A 3 km WRF run over Bulgaria for 2,500+ training days would take on the order of thousands of CPU-hours. WRF is CPU/MPI software, so a rented GPU doesn't speed it up. And its boundary conditions would come from the same global models anyway. The measurement below is the reason not to start there: the 28 km GEOS-5 forecast adds almost nothing to picking spots. A km-scale simulation is a bet worth testing on one fire season first, not before.

## How many epochs

Two kinds of model were trained.

- **Gradient-boosted trees (XGBoost).** These have no epochs. They add trees one at a time, and we stop when the 2024 validation score has not improved for 150 trees. That gave 176–340 trees per run, depending on lead and label. Version 1 stopped at 29–113 trees for the same reason.
- **A neural network** (3 layers: 256, 256, 128; AdamW, one-cycle learning rate, batch 2,048). It was trained for **exactly 10 epochs**, as asked.

What 10 epochs gives, on the lead-1, all-fires model:

- **Validation curve (precision-recall AUC on 2024), epochs 1 to 10:** 0.402, 0.508, 0.504, 0.508, 0.506, 0.510, 0.510, 0.509, 0.511, 0.510. Learning is done by epoch 2.
- **Check with 30 epochs:** validation 0.513, and one-spot hits on the 2025 test of 58.9% against 59.0% at 10 epochs. More epochs do not help.

The final forecast averages the trees and the 10-epoch network, which was decided on validation.

## Results on the test year 2025 (never seen in training or tuning)

The test year had 361 days, 1,071 fire cell-days and 958 municipality-days with a fire.

### Firefighter's question: k spots per municipality, hit if the fire is within about 15 km

Lead 1 (tomorrow), all fires:

| Spots per municipality | 1 | 2 | 3 | 5 |
|---|---|---|---|---|
| **Version 2 (ensemble)** | **59.5%** | **74.1%** | **82.2%** | **91.1%** |
| Last week's fires | 49.9% | 64.4% | 74.1% | 84.2% |
| Usual hot spot (history) | 46.2% | 63.9% | 77.0% | 88.9% |
| Random | 33.5% | 54.3% | 67.8% | 83.3% |

- **Large fires** (at least 4 detections): with one spot, 67.0%, against 58.3% for last week and 29.4% for random.
- **Days 2 and 3:** one spot gives 54.8% and 53.2%; three spots give 80.1% and 79.0%.
- **Version 1** gave 48% for one spot, level with last week's fires. Version 2 is about 10 points above the best simple rule.

**Against the 80–90% target: three spots per municipality reach 82% for tomorrow and 79–80% for days 2–3, and five spots reach 91%. One spot reaches 59.5%.**

### Team protocol: top 5 spots per province (28 provinces), share of fires caught

| | Model, 5 km spots | Model, 11 km spots (shipping grid) | History, 11 km | Official index (FWI), 11 km | Random, 11 km |
|---|---|---|---|---|---|
| All fires, lead 1 | 27.5% | **41.2%** | 26.9% | 12.7% | 10.6% |
| All fires, lead 2 | 22.7% | 36.2% | 26.9% | 13.2% | 10.6% |
| All fires, lead 3 | 20.8% | 35.4% | 26.9% | 12.1% | 10.6% |
| New fires, lead 1 | 21.6% | **34.4%** | 27.4% | 12.8% | 10.7% |
| New fires, lead 2 | 19.6% | 33.7% | 27.4% | 12.6% | 10.7% |
| New fires, lead 3 | 19.6% | 34.2% | 27.4% | 11.5% | 10.7% |

**The claim rule is met.** At every lead and for both labels, the 95% bootstrap interval of "model minus baseline" is above zero for each baseline. For example, new fires at lead 1 and 11 km:

| Baseline | 95% interval of the gain |
|---|---|
| History | +4.3 to +10.2 points |
| Official index | +17 to +26 points |
| Last week | +6 to +12 points |

The official index ranks spots badly inside a province. Most Bulgarian detections are farm burns, while the FWI peaks wherever it is driest, which is not where people burn stubble.

### Reinforcements: which municipalities will burn

| Lead 1, all fires | Ranking AUC, any fire | Ranking AUC, large fire | 28 national teams catch, any fire | 28 teams catch, large fire |
|---|---|---|---|---|
| **Model** | **0.851** | **0.903** | **40.6%** | **50.4%** |
| Last week | 0.783 | 0.852 | — | — |
| History | 0.750 | 0.734 | 29.7% | 21.7% |
| FWI | 0.730 | 0.855 | 18.1% | 16.5% |

AUC runs from 0.5 (a coin flip) to 1.0 (perfect).

**Calibration.** In 2025 the model's probabilities run about 1.5× too high in the 0.3–3% range and slightly low above 10%. The reliability table is in each result file. The Brier skill against scaled climatology is small (+0.016), as expected for events this rare. The ranking is the useful part.

## Which data carries the weight (measured)

The data-sources master list ranks every source 1–5 by judgement, and says the ranks are to be checked "by removing it and checking how much the capture rate drops". We did this for the lead-1, all-fires tree model on the test year 2025. A single test year moves by about ±2 points from noise alone.

| Removed | Capture, 5 km (full model 26.8%) | One spot per municipality (full model 57.7%) | Municipality AUC (full model 0.846) | Reading |
|---|---|---|---|---|
| **Recent fires** (last 1–30 days, cell and 15 km block, days since last fire) | **18.0%** | **49.9%** | 0.826 | The strongest input by far |
| Leave-own-year-out climatology (the leak fix, not a removal) | 22.3% | 53.9% | 0.839 | Second biggest effect |
| **Land cover (fuel)** | 25.4% | 54.5% | 0.841 | Real but modest |
| Calendar history (same weeks last year, climatology) | 25.6% | 57.3% | 0.837 | Small (recent fires carry most of it) |
| Terrain | 26.3% | 56.0% | 0.847 | Small |
| Season | 26.5% | 57.8% | 0.847 | None (history carries it) |
| **GEOS-5 forecast and analysis together** | 26.7% | 58.5% | 0.840 | **No measurable gain for spots**; small for municipalities |

**Comparison with version 1's point weather.** Version 1 used NASA POWER point weather at 0.5°. Swapped in for GEOS-5, with the *observed* target-day weather standing in for a perfect forecast, it gives a municipality AUC of 0.867. The comparable GEOS-5 model scores 0.840. Its spot scores are about the same (25.2% capture, 56.6% one-spot).

**What these tests show.**

- **Weather decides *when* and roughly *where nationally*.** A perfect forecast adds about 0.03 AUC to the municipality ranking.
- **The real limit is forecast skill.** A forecast 3–5 days from its run loses most of that.
- **Weather does not pick the spot inside a municipality.** The spot comes from where people burned recently, what grows there and what the land is like.

**Suggested updates to the master list**, for the team to decide:

- **FIRMS history:** keep at 5 (confirmed).
- **GFWED:** keep at 5 for the live app and the official comparison. As a spot-picking input in Bulgaria the measured value is 1–2 at the current lag.
- **Land cover:** 3–4.
- **Terrain:** 2.

## Check on 2026 so far (run 15 Nov 2026, 00:40)

This is an out-of-sample check on **4 Jan to 11 Nov 2026** (296 days, 747 fire cell-days, 688 of them new fires `[V]`). None of these days were used for training, settings or the 2025 test. The inputs are the ones the live outlook uses: the committed models, the GEOS-5 run and analysis of t−2, and NOAA-20 fires from the firms-catalog mirror. Seven NOAA-20 outage days are skipped. Script: `engine/daily/v2/test2026.py`; results: `docs/engine-results/daily-v2/res2026_*.json`.

| All fires | Lead 1 | Lead 2 | Lead 3 | 2025 test, lead 1 |
|---|---|---|---|---|
| 1 spot per municipality, within 15 km | **54.0%** | 50.9% | 52.4% | 59.5% |
| Last week's fires, 1 spot | 45.4% | 43.5% | 43.1% | 49.9% |
| Random, 1 spot | 32.9% | 32.9% | 32.9% | 33.5% |
| 3 spots per municipality | **80.0%** | 78.8% | 78.2% | 82.2% |
| Top 5 per province, 11 km | **38.8%** | 36.0% | 34.3% | 41.2% |
| History, same ranking | 27.0% | 27.0% | 27.0% | 26.9% |
| Model minus history, 95% interval | +8.3 to +15.5 points | +5.5 to +12.8 | +3.8 to +10.6 | +10.3 to +18.1 |
| Municipality ranking AUC (official FWI) | 0.844 (0.760) | 0.837 (0.756) | 0.836 (0.751) | 0.851 (0.730) |

All numbers in this table are `[V]`: measured by the script.

| New fires only (team protocol) `[V]` | Lead 1 | Lead 2 | Lead 3 | 2025 test, lead 1 |
|---|---|---|---|---|
| Top 5 per province, 11 km | **31.9%** | 31.4% | 32.0% | 34.4% |
| History, same ranking | 25.0% | 25.0% | 25.0% | 27.4% |
| Official FWI, same ranking | 14.4% | 13.5% | 12.0% | 12.8% |
| Model minus history, 95% interval | +3.5 to +10.0 points | +3.2 to +9.6 | +3.6 to +10.5 | +4.3 to +10.2 |
| 1 spot per municipality, within 15 km | 50.8% | 50.3% | 50.5% | 54.8% |
| 3 spots per municipality | 77.7% | 78.7% | 77.4% | 80.4% |

**Lead 1 detail** `[V]`:

- **Large fires, 1 spot:** 51.4% (last week 44.3%, random 29.9%).
- **28 national teams catch:** 42.2% of fire municipality-days and 57.1% of large-fire ones.

**Reading.** 2026 scores a few points below 2025, but the ordering holds on a year the models never saw: the model beats every baseline by a margin that clears the bootstrap rule. Three spots per municipality still reach about 80% for tomorrow.

## Live outlook issued 14 Nov 2026 for 15–17 Nov

Files: `outlook2_bg_2026-11-14.csv` and `.geojson`, plus `_provinces.csv` with the team protocol's top 5 per province.

Inputs:

- **Weather:** the GEOS-5 run and analysis of 12 Nov.
- **Recent fires:** NOAA-20 for 2026 from the public firms-catalog mirror, up to 14 Nov. 465 detections in cells that were mostly industrial heat in the archive are masked.

Risk is low, as is usual in late autumn. The expected number of municipalities with a detected fire is 0.6, 0.9 and 1.1 for the three days. The top spots are cropland in Rodopi, Byala Slatina, Montana, Dolna Mitropoliya and Tundzha, with the reasons "recent fires nearby, burns at this time of year".

## Limits

- **One test year.** The 2025 test has 959 new fires, so the bootstrap intervals are a few points wide. The 2024 validation year shows the same ordering.
- **Spots are satellite cells, not ignition points.** A hit means a VIIRS detection in or near the spot. Small, short and cloud-hidden fires are missed, and farm burns dominate the detections.
- **Not yet in the model:**
  - roads and population (the OSM extract was not reachable from here);
  - MODIS NDVI and land cover (they need the Earthdata login);
  - Forest Agency incident records.
- **Forest-first ranking (D-13).** The data supports it (land-cover shares are inputs and outputs), but it isn't a separate model yet.

## Reproduce

```
cd engine/daily/v2
bash run_all.sh               # downloads, builds, trains all leads, group weights, live outlook, tests
python3 summarize.py test2025 # the tables above
python3 test2026.py           # the 2026 check (about 10 minutes per lead and label on 2 CPU cores)
```

Each run of `train2.py` is deterministic (fixed seeds). The lead-1 runs reproduced byte-identical scores when trained a second time.
