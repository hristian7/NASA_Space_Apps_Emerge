# Daily fire outlook for Bulgaria: where to put a team 1–3 days ahead

Code: `engine/daily/`. Results: `docs/engine-results/daily/`.

**Superseded by [version 2](daily-outlook-v2.md)** (14 Nov, late): NASA GEOS-5 weather, land cover, terrain, a climatology leak fixed, and the team's plan-2 protocol. One spot per municipality now hits 59.5% (version 1: 48%), three spots 82%.

## The question, as a firefighter put it

> Which regions have the highest chance of fire, so a team can be sent there in advance?

He answered four follow-up questions:

1. **Region size** depends on how big the fire is.
2. **Lead time** is 1–3 days, so teams can be positioned.
3. **Budget**: one municipal station covers one high-risk region per day. If more than one region is at risk, reinforcements are called in.
4. **Which fires**: all of them, but fires that endanger lives and infrastructure take priority.

That gives two decisions to score.

- **Decision A, the station's daily spot.** Each municipality gets one ranked 5 km cell per day. A hit means a fire is detected in that cell (exact) or in the 3×3 block around it (about 15 km, the reach of a pre-positioned team).
- **Decision B, reinforcements.** Rank all 265 municipalities by their chance of any fire that day, and send N national teams to the top N.

Both are scored on all fires and on large fires. A large fire is a cell-day with at least 4 VIIRS detections, used as a proxy for "big enough to matter".

## Data

- **Fires.** VIIRS S-NPP 375 m detections from the FIRMS archive, 2012–2025, kept to presumed vegetation fires (type 0) at nominal or high confidence. NOAA-20 is used to flag days when S-NPP was missing, so that an outage is never counted as "no fire". Live runs use the NOAA-20 near-real-time file for the last 7 days.
- **Weather.** NASA POWER daily data at 55 points (about 0.5°). From it the full Canadian Fire Weather Index chain is computed: FFMC, DMC, DC, ISI, BUI and FWI. The chain uses xclim and is unit-tested against Van Wagner & Pickett (1985). Live runs use the MET Norway forecast.
- **Grid.** 0.05° cells (about 5 km), each assigned to its geoBoundaries ADM2 municipality.

## Features: the firefighter's five factors, measured

| His factor | What the model sees |
|---|---|
| Temperature | daily max temperature, vapour-pressure deficit |
| Wind | 2 m wind speed, Initial Spread Index (wind × fine-fuel dryness) |
| Vegetation | not yet (gap, see below); the cell's own fire history stands in for fuel and land use |
| Soil and plant dryness | FFMC (litter, hours), DMC (duff, weeks), DC (deep layer, months), GWETTOP/GWETROOT soil wetness |
| Last rain | days since rain over 1 mm, rain in the last 7 and 30 days |

On top of these come fire history (this cell and its neighbours over the last 1–365 days, and the same weeks one year earlier), monthly climatology and season.

## Protocol

The split was fixed before any model was scored:

- **Train:** 2013–2020.
- **Validate:** 2021, used for early stopping and for every setting choice.
- **Test:** 2022–2025, scored once.

Each model is a gradient-boosted tree model (XGBoost). It is trained on all fire cell-days plus 10 random non-fire cell-days per fire. The predicted probabilities are then corrected back to the true base rate.

Every lead is run two ways:

- **With forecast weather**, using the observed weather of the target day. This is a perfect-forecast upper bound.
- **Without it**, using only what is known at issue time. This is a lower bound.

The live models drop the 30- and 365-day history, because the near-real-time feed only covers 7 days. Their scores are reported separately.

The test period has 4,587 municipality-days with a fire and 465 with a large fire.

## Results, test 2022–2025

### Decision A: one spot per municipality per day (capture within 15 km)

| | Lead 1, forecast | Lead 1, no forecast | Lead 2, forecast | Lead 3, forecast | Lead 3, no forecast |
|---|---|---|---|---|---|
| **Model** | **48.1%** | 47.7% | 45.4% | 45.5% | 45.8% |
| Last week's fires | 47.6% | 47.6% | 45.5% | 44.9% | 44.9% |
| Usual hot spot (climatology) | 45.9% | 45.9% | 45.9% | 45.9% | 45.9% |
| Highest FWI cell | 40.4% | 40.5% | 40.4% | 40.4% | 40.9% |
| Random cell | 32.9% | 32.9% | 32.9% | 32.9% | 32.9% |

If the station may cover more spots, capture rises (lead 1, with forecast):

| Spots per municipality | 1 | 2 | 3 | 5 |
|---|---|---|---|---|
| Model | 48% | 66% | 76% | 86% |
| Last week | 48% | 64% | 75% | 84% |
| Usual hot spot | 46% | 64% | 75% | 86% |

Random placement with 5 spots already reaches about 82%. Most municipalities are only a few 15 km blocks across, so 5 spots cover most of the area.

**What this means.** Inside one municipality the model is no better than the two simple rules a station already uses: "where it usually burns" and "where it burned last week". The weather input is at 55 km resolution, so it is the same for every cell in a municipality and can't tell one valley from the next. The within-municipality ranking therefore falls back on history.

**An 80–90% hit rate with one spot per day is not reachable with this data**, and we are not aware of any published system that reaches it at this granularity. About 86% is reachable with 5 spots per municipality, but random placement gets close to that.

### Decision B: which municipalities need reinforcements

This is where the model adds real value.

| | AUC, any fire | AUC, large fire | 28 teams catch, any fire | 28 teams catch, large fire |
|---|---|---|---|---|
| **Model, lead 1, forecast** | **0.84** | **0.86** | **37.9%** | **39.4%** |
| Model, lead 1, no forecast | 0.82 | 0.84 | 37.8% | 37.8% |
| Model, lead 3, forecast | 0.84 | 0.85 | 36.2% | 34.8% |
| Model, lead 3, no forecast | 0.80 | 0.81 | 35.8% | 34.4% |
| Usual hot spot | 0.78 | 0.78 | 35.2% | 35.3% |
| FWI | 0.73 | 0.83 | 17.8% | 21.5% |
| Random | 0.50 | 0.50 | 9.7% | 10.1% |

28 teams equals one per province. The live models (no 30/365-day history) score within 0.01 AUC of the full ones.

**What this means.** Each day, the model separates municipalities that will burn from those that won't far better than chance (AUC 0.84–0.86). It also beats the fire-weather index alone and climatology alone. The advantage holds out to day 3, and forecast weather adds about 0.02–0.04 AUC.

### Which factors carry weight

Gain-ranked features, lead 1 with forecast:

1. **Season and place** (monthly climatology).
2. **FFMC**, the dryness of the fine dead fuel.
3. **Fires in neighbouring cells** in the last 7–30 days.
4. Rain on the day.
5. **ISI**, wind times fine-fuel dryness.
6. Relative humidity.

Temperature on its own is not in the top 12. Its effect arrives through FFMC and vapour-pressure deficit, because heat matters by drying fuel. This partly contradicts the firefighter's ranking, which put temperature first. When the model has no forecast, "days since rain", 7- and 30-day rain and the Drought Code move up, which matches his "when did it last rain".

Most detected fires in Bulgaria are agricultural and stubble burns. That is why "usual hot spot, season" dominates the explanations for November.

## Live outlook issued 2026-11-14

Files: `outlook_bg_2026-11-14.csv` and `.geojson`. There is one row per municipality and day (15–17 November), giving:

- the 5 km spot and its fire chance;
- the municipality's chance of any fire;
- its national rank;
- the main reasons.

Late-autumn risk is low. The expected number of municipalities with a detected fire is about 6.8, 5.4 and 1.1 for the three days. The top ranks go to Dobrich-area farmland (General Toshevo, Dobrichka), Tundzha and Rodopi.

To reproduce, from `engine/daily/`:

```
python3 grid.py && python3 weather.py && python3 features.py   # inputs, about 10 min (gpu_run.sh downloads the fire CSVs)
python3 live.py 2026-11-14                                     # uses the committed model_L{1,2,3}_fc_live.json
python3 train_eval.py 1 forecast                               # retrain and rescore one lead
python3 -m pytest tests -q
```

## What would move the numbers

In order of expected gain:

1. **Weather at about 9 km instead of 55 km** (ERA5-Land, or ECMWF/ICON forecasts). Without this, weather can't help pick the spot inside a municipality.
2. **Fuel and land cover.** Options are ESA WorldCover 10 m, Copernicus HRL forest type, and MODIS/VIIRS NDVI for greenness. This is the firefighter's "vegetation" factor, and it is still missing.
3. **Human ignition layers**: distance to roads, villages and cropland, and harvest calendars. Most Bulgarian fires are started by people.
4. **Settlements and infrastructure** (OSM buildings, roads, power lines). The "lives and infrastructure first" rule needs these. With them, the ranking can weight each spot by fire chance × exposure, instead of fire chance alone.
5. **Better labels.** Use burned-area products (MCD64, EFFIS) or fire-service incident records alongside satellite detections. The satellite misses small, short or cloud-covered fires.

## Training on a rented GPU

**Is the GPU the bottleneck?** Not at this data size. One model trains in under a minute on two CPU cores. A GPU helps in three cases:

- a wide hyperparameter search;
- more data (all of the Balkans, ERA5-Land at 9 km, 2012–2025);
- deep spatial models (ConvLSTM or U-Net over daily weather and fuel grids), the approach of, for example, Kondylatos et al. (2022, *Geophysical Research Letters*) for daily fire danger in Greece.

**How to run it:**

```
# On a RunPod / Vast.ai RTX 4090 box (about $0.3–0.7 per hour), with the repo cloned:
cd engine/daily
bash gpu_run.sh 200
```

The script does five things:

1. Rebuilds every input from open data; no key is needed.
2. Searches 200 settings per lead, judged on 2021 only.
3. Tests the best settings once on 2022–2025.
4. Trains the live models.
5. Puts everything in `results/`.

XGBoost switches to CUDA automatically when `nvidia-smi` is present.

**Rules that keep the result honest:**

- Never pick settings or features by looking at 2022–2025.
- Report the run once, even if it is worse.
- Compare against the baselines above, not against zero.
- Copy `results/` off the box before stopping it; rented disks are wiped.
- Rent by the hour and stop the box after the run.
