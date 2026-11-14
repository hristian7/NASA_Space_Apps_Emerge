# Prediction engine: which factors drive fire, where, and how far ahead

Built and run 14 Nov 2026 with an AI assistant (log this for the SI usage note). Code: [`../engine/`](../engine/). Results: [`engine-results/`](engine-results/). It answers features **M13** (chance of fire), **S3** (risk outlook) and **C2** (our own forecast model).

Tags: `[V]` computed today from NASA or NOAA data with the code in `engine/` · `[D]` secondary source or recalled · `[U]` our inference.

## The answer in five lines

1. **Dryness of soil and air is the main short-range factor.** Issued at the start of a month, it earns weight in **33%** of fire units, against **5%** by chance `[V]`. Its value fades with lead time (21% one month ahead, 13% three months ahead): moisture has a memory of weeks.
2. **The ocean state (El Niño and relatives) is the long-range factor, and only in the tropics.** It earns weight in **37%** of humid tropical units but no more than chance (**5–6%**) outside the tropics `[V]`. Its share grows with lead time instead of fading.
3. **Fuel growth matters only where fuel is scarce.** Last year's rain earns weight in about **20–23%** of arid and semi-arid units but **1–4%** of humid ones. Its sign flips as expected: in arid places more rain last year means **more** fire this year (positive in **83%** of arid units, **54%** of humid ones) `[V]`.
4. **People set the level.** A long-term trend earns weight in about **25%** of units, most often in humid tropics (**45%**), where land-use change and policy move fire up or down `[V]`.
5. **Some places can't be forecast from weather, and Bulgaria is one of them.** Its summer and autumn hot spots are mostly farm burning; no weather or ocean factor beats history there `[V]`. The engine says so, rather than inventing skill.

![Which factor carries weight by lead time](engine-results/fig_weights_by_lead.png)
![Which factor carries weight by climate](engine-results/fig_weights_by_climate.png)

## 1. The physics

Fire needs **fuel**, **dry fuel** and a **spark** at the same time. Expected fire activity in a place and month is modelled as a product:

```
fire = normal(place, month) × dryness factor × fuel factor × ocean-steered rain factor × trend
```

Taking logs turns it into a sum, which is a regression with the normal level as a fixed offset:

```
log(1 + fire cell-days) = normal(month) + β·dryness + β·fuel + β·ocean + β·trend
```

Each β has a physical meaning, for example "one standard deviation drier soil multiplies fire by ×1.3". Each factor has a different memory, which is why each matters at a different lead:

| Factor group | Inputs | Physical memory | Sign expected |
|---|---|---|---|
| **Dryness now** (diagnostic only) | Same-month VPD, root-zone soil wetness, rain | Hours to days | Drier → more fire |
| **Dryness memory** | Latest known month's soil wetness and VPD; rain in the 3 months before | Weeks (deep soil, duff, peat) | Drier → more fire |
| **Fuel growth** | Rain in the 12 months ending 5 months before the target | A season to a year (grass growth) | Arid: wetter → more fire. Humid: none or negative |
| **Ocean** | Three indices per climate zone (tropics: Niño 3.4, IOD, tropical N. Atlantic; north: Niño 3.4, NAO, PDO; south: Niño 3.4, IOD, SAM) | Months | Region-specific |
| **Trend** | Year | Years (people, land use, policy) | Either |

VPD (vapour pressure deficit) is how strongly the air pulls water from fuel, from temperature and humidity.

## 2. Data

| What | Source | Access |
|---|---|---|
| Fire | FIRMS MODIS yearly country files, **Aqua only**, 2003–2021: one sensor, one overpass time, stable orbit. Vegetation fires, confidence ≥ 30, fire cell-days on a 0.01° grid. 26 countries, 2.3 GB `[V]` | No login |
| Weather and soil moisture | **NASA POWER** monthly (T max, humidity, rain, root-zone soil wetness from MERRA-2), sampled at the 1° cells holding most of each unit's fire, weighted by fire | No login |
| Ocean and atmosphere | NOAA PSL Niño 3.4 and TNA; NOAA CPC DMI (ERSSTv6), NAO, AO, SAM; NOAA NCEI PDO. All current to Aug–Oct 2026 | No login |

**Why Aqua only, and why that is safe:** the engine learns **anomalies**, this year against the same place's normal. A constant MODIS-to-VIIRS factor cancels out of an anomaly. So the weights learned on one stable sensor apply to the harmonized record (feature M1), which then provides the normal level in VIIRS units `[U]`.

**An ENSO dashboard** the team uses as a reference shows the El Niño state as a variable to account for. The engine reads the same NOAA files directly, and the page's typical-impact list serves as an outside check (section 6).

## 3. Units: tiles × fire kind × season

- **Tiles of 5°** (about 500 km), within each country. Conditions are local: a country-wide average failed for Canada, where 12 weather points can't represent fire spread over 10 million km².
- **Two fire kinds**, told apart by a physical signature, since a land-cover map needs a NASA login:
  - **recurrent:** a ~5 km cell that burned in 10 or more of the 19 years. Fuel that regrows within a year: farmland, pasture, savanna.
  - **episodic:** burned in fewer years. Fuel that takes years to recover: forest, shrubland, peat.
  - No ground truth here; **MCD12C1 land cover is the upgrade** (the conversion plan already lists it).
- **Seasons:** the months holding the fire, split when they aren't contiguous (for example spring and autumn burning).
- **Result:** 499 units (316 episodic, 183 recurrent) in 26 countries, each modelled at four leads.

## 4. How the weights are decided

**Lead L:** the forecast is issued at the start of the month L months before the target, using data up to the month before issue. "diag" uses same-month weather and is not a forecast; it shows the physics.

**Held-out skill:** leave one year out over 2003–2021. Skill = 1 − error ÷ error of the normal alone. 0 means no better than history.

**Weights = exact Shapley values of held-out skill.** With 5 factor groups there are 32 combinations. A group's weight is its average gain in held-out skill over all of them, and the weights add up to the full model's skill. This is a fair way to split credit when factors overlap. Dryness and ocean overlap, because El Niño acts through rain.

**Gate against chance (method M123):** with about 2,000 unit-leads, some factors look useful by luck. So the whole engine is rerun three times with the **years of weather and ocean data shuffled**, keeping the real fire record. A factor may be used in a unit only if its weight beats the **95th percentile** of the shuffled weights. The shuffle can't test the trend, so the trend gets a fixed bar of +0.05 skill.

**Pass rates against chance** `[V]`:

| Factor | Start of month | 1 month ahead | 3 months ahead | Expected by chance |
|---|---|---|---|---|
| Dryness memory | **33%** | 21% | 13% | 5% |
| Ocean | 14% | **19%** | 16% | 5% |
| Fuel growth | 14% | 15% | **17%** | 5% |
| Trend (fixed bar) | 26% | 26% | 25% | not testable |
| Dryness now (diagnostic) | **75%** | — | — | 5% |

## 5. Which factor in which conditions

Units grouped by climate, forecast issued at the start of the month `[V]`:

| Conditions | Units | Dryness | Ocean | Fuel | Trend | Reading |
|---|---|---|---|---|---|---|
| Outside tropics, arid (< 500 mm/yr) | 74 | 18% | 5% | **23%** | 18% | Fuel-limited: a wet year grows the grass that burns next year |
| Outside tropics, semi-arid (500–1000) | 151 | **37%** | 5% | 20% | 17% | Dryness-limited, with some fuel limit |
| Outside tropics, sub-humid (1000–1600) | 50 | 20% | 6% | 2% | 16% | Weak predictability |
| Tropics, semi-arid (500–1000) | 43 | 26% | 21% | 21% | 26% | All factors matter: savanna |
| Tropics, sub-humid (1000–1600) | 82 | **41%** | 17% | 4% | 37% | Dryness, plus people |
| Tropics, humid (> 1600) | 83 | **42%** | **37%** | 1% | **45%** | Forest and peat: dryness, El Niño and land use |

**Rules the engine uses where local data is thin** `[U]`, from the table above:
- **Arid:** fuel growth first, dryness second.
- **Semi-arid and sub-humid:** dryness first. Ocean only in the tropics.
- **Humid tropics:** dryness and ocean together. Watch the trend.
- **Outside the tropics:** ignore ocean indices for forecasts; they don't beat chance there.
- **Every lead:** dryness memory for the next 1–2 months; ocean and fuel beyond that.

**Where the ocean term works at 3 months:** Indonesia (21 units), Venezuela (13), Bolivia (8), Colombia (7), the USA (5), Thailand (5) `[V]`. **Where fuel growth works:** Australia (32 units), South Africa (11), the USA (6) `[V]`.

**Fire kind matters less than climate.** Episodic and recurrent fire show similar weights (dryness 35% vs 27%, fuel 16% vs 10%). Climate zone separates the factors much more sharply.

## 6. Proof

| Check | Result |
|---|---|
| **Calibration (M112):** when the engine says "X% chance of above normal", how often does it happen? | Forecast 12% → observed 11%; 27% → 26%; 41% → 42%; 58% → 58%; **79% → 73%** (slightly overconfident at the top) `[V]` |
| **Held-out Brier skill vs history**, units with a gated factor | 0.14 / 0.13 / 0.12 at leads 0 / 1 / 3 `[V]`. Flattered, because the gates were chosen on the same years |
| **Forward test (M44): gates and fit on 2003–2021 only, scored on 2022–2025** | **Brier skill vs history +10% / +8% / +7%**; correlation of forecast and outcome **0.41 / 0.38 / 0.35** `[V]`. This is the honest number. Aqua's orbit drift after 2021 affects engine and baseline alike |
| **Outside check (M38):** the live outlook against NOAA and IRI typical El Niño impacts (as summarized on the ENSO dashboard) | Above normal in mainland Southeast Asia, Venezuela's llanos, southern New Guinea and eastern Australia; below normal on the US Gulf coast in December. All match the typical El Niño pattern `[V]` for the outlook, `[D]` for the impact maps |

**Leakage rules (M62):** features use only data published before the issue date. The normal is computed inside each held-out fold. The trend is never extrapolated past 2021 in the live outlook. Index values are today's versions, not those first published (revisions are small `[D]`).

## 7. Live outlook (time-stamped, method M45 + M127)

Issued **15 Nov 2026**, latest complete month **October 2026**: [`engine-results/outlook_2026-11-15.csv`](engine-results/outlook_2026-11-15.csv). Only units whose gated model beats history on held-out years appear (116 units).

| Region (5° tile) | Month | Expected vs normal | Chance above normal | Main driver |
|---|---|---|---|---|
| Southern New Guinea (Indonesia, −10° 135–140°) | Dec 2026 | ×10 to ×24 (90% range ×1.4 to ×190) | 90–99% | Ocean (El Niño), dryness |
| Eastern Australia (−25° 150°) | Dec 2026 | ×7.5 (×1.5 to ×38) | 95% | Ocean |
| Cambodia (10° 105°) | Dec 2026 – Feb 2027 | ×2.1 to ×2.9 | 78–89% | Ocean |
| Western Thailand and Myanmar border (10–15° 95°) | Jan – Feb 2027 | ×2.5 to ×2.7 | 81–87% | Ocean |
| Venezuela's llanos (0° −70 to −65°) | Dec 2026 – Feb 2027 | ×2.0 to ×3.6 | 79–86% | Ocean |
| US Gulf coast (25° −95°) | Dec 2026 | ×0.2 | 1% (94% below normal) | Ocean (wet El Niño winter) |
| Southern Nigeria (5° 0–10°) | Dec 2026 – Feb 2027 | ×0.3 to ×0.7 | 0–6% | Trend (declining burning) |

- **Ranges are wide on purpose.** This El Niño (Niño 3.4 +2.3 °C in October `[V]`) is near the edge of what the training years contain.
- **Anyone can score this against FIRMS** after February 2027. That is the point of committing it now.

## 8. Limits

- **Fire record:** Aqua MODIS only. The harmonized record (M1) should replace it as the normal level and as the training target once it exists.
- **Fire kind:** from a recurrence rule, not land cover.
- **Weather:** NASA POWER at up to 6 points per unit; coarse (MERRA-2, about 50 km).
- **Not used yet:** the Copernicus fire weather index (FWI) and its forecasts, and drought and vegetation indices. FWI is the natural next input for the 1–10 day range, where the GWIS map layers are already shown (S3).
- **Coverage:** 26 countries, chosen across fire regimes. The team's world download can run the same code everywhere (section 9).
- **Skill is modest:** +7–10% Brier skill over history on unseen years. That is typical for seasonal fire forecasting `[D]`. Present it as an outlook with stated reliability, never as a warning.

## 9. How it plugs into the app

| App feature (spec) | What the engine provides |
|---|---|
| **M13** chance of fire this month | The engine's baseline: with no gated factor, the outlook *is* the historical chance. Same numbers, one code path |
| **C2** our own forecast model | This engine. The spec's condition is "only if it beats M13's historical chance": it does on unseen years (+7–10% Brier skill, section 6), so propose moving C2 up |
| **S3** official fire danger | Unchanged: GWIS covers 1–9 days. The engine covers 1–3 months, where GWIS has nothing. Show both, clearly labelled |
| **M18** points-only data model | Each outlook row becomes a point at the tile centre (lat + 2.5, lon + 2.5) with `precision_radius_km` about 280, plus `factor`, `factor_lo`, `factor_hi`, `p_above`, `p_below`, main driver, held-out skill |
| **M6** "How we know it's right" | The two figures, the calibration table and the forward test (section 6) |
| **S11** push alerts | Trigger only from official danger levels, or from outlook units with held-out skill, never from the trend alone |

**Wording** (spec section on alerts): "Risk outlook (unofficial)", the chance in words ("8 in 10 chance of more fire than usual"), the main driver ("strong El Niño"), and how reliable it was on past years.

## 10. How to run

```bash
cd engine
python3 run_all.py Bulgaria Indonesia ...     # fire units, weather, Shapley weights -> results.csv
python3 null_model.py 1 11 null_0.csv          # shuffled-years null (repeat with seeds 21, 31)
python3 analyze.py                             # gates, regimes, calibration, forward test -> report.json
python3 charts.py                              # the two figures
python3 outlook.py                             # live outlook -> outlook_<date>.csv
```

The fire stage reads the team's yearly files from `data/raw/modis/<year>/` (from `pipeline/download_firms.py`).

## References

- **NASA FIRMS** MODIS Collection 6.1 yearly country files (MCD14ML): https://firms.modaps.eosdis.nasa.gov/ (doi:10.5067/FIRMS/MODIS/MCD14ML)
- **NASA POWER** monthly and daily point API (MERRA-2 based): https://power.larc.nasa.gov/
- **NOAA PSL** Niño 3.4 and TNA: https://psl.noaa.gov/data/correlation/
- **NOAA CPC** DMI (ERSSTv6), NAO, AO, SAM: https://www.cpc.ncep.noaa.gov/
- **NOAA NCEI** PDO (ERSSTv5): https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/
- **NOAA CPC** RONI: https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt
- Shapley values for attributing model skill: L. S. Shapley 1953, "A value for n-person games" `[D]`
- Van Wagner 1987, Canadian Forest Fire Weather Index System (moisture-code time lags) `[D]`
- Software: Python, DuckDB (MIT), pandas (BSD-3), NumPy (BSD-3), SciPy (BSD-3), Matplotlib (PSF-based)
