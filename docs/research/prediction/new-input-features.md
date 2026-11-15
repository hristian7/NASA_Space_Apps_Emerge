# New input features — detailed research notes

Researched 2026-11-15 by reading all 23 sources. Tags: `[V]` confirmed at source · `[D]` directional · `[U]` our inference.

This note describes the four new input features the research supports adding to our prediction model, where each comes from, how to compute it, and which sources confirm it. See [`sources-overview.md`](sources-overview.md) for the full source ranking.

## Why these four

Our existing spec already has the strongest inputs (FWI parts, NDVI, land cover, fire history). The research repeatedly points to the same gaps. Four features appear across multiple independent sources and are available from free, no-login data:

| Feature | Confirmed by (independent sources) | Data source | Login? |
|---|---|---|---|
| `road_distance_km` | SIMERF #5, BC #13, eimirjihad #15, Mesogeos #2 | OpenStreetMap | No |
| `slope_deg` + `terrain_risk` | Mesogeos #2, BEYOND #4, WestCoast #17, Athens #9 | SRTM on AWS | No |
| `lightning_density` | PNNL #14, BC #13, GlobalLightning #18, Open-Meteo #12 | Open-Meteo API | No |
| raw weather (t_max, rh_min, wind) | Open-Meteo #12, BC #13, ECMWF #11 | Open-Meteo API | No |

---

## 1. Human proximity — `road_distance_km`

### Why it is the biggest missing input

Most wildfires are human-caused. Every source that models human-caused ignition finds that proximity to human activity is the dominant predictor after weather:

- **SIMERF (#5):** road / agricultural boundary / recreation-area distance is the top feature for human-caused fires predicted 1–4 days ahead `[D]`
- **BC model (#13):** the HCF (human-caused fire) sub-model retains road density and WUI distance after lasso selection `[V]`
- **eimirjihad (#15):** utility-corridor proximity (HIFLD transmission lines) is among top SHAP features `[V]`
- **Mesogeos (#2):** "human factors" is one of the four confirmed feature domains `[V]`

### How to compute

For each land cell centre, find the great-circle distance to the nearest OpenStreetMap road (any `highway=*` way). Clip to [0, 50] km — beyond 50 km, human ignition risk is effectively floor.

```python
# One-time, at grid build. Pseudo-code.
# 1. Download OSM roads for the region (Geofabrik extracts, .osm.pbf, ODbL)
# 2. Extract highway ways with osmium or pyrosm
# 3. Build a spatial index (scipy.spatial.cKDTree on road vertices)
# 4. For each cell centre, query nearest road vertex distance
road_distance_km = min(50.0, nearest_road_distance_km(cell_lat, cell_lon))
```

Store `road_distance_km` as a static column in the grid file (does not change day to day).

### Settlements variant

BC and SIMERF also use settlement/population proximity. OSM `place=town|city|village` nodes
give settlement centroids. Optionally add `settlement_distance_km` the same way. For v1, road
distance alone captures most of the signal (roads lead to settlements). Add settlements in v2.

### Licence

OpenStreetMap data is ODbL. The derived `road_distance_km` column is a produced work; under
ODbL we must attribute OSM and, if we distribute the derived database, share it under ODbL.
Since the column is baked into our grid file served to the app, add OSM attribution to the
app's credits and note the ODbL share-alike on the derived grid in `data-sources-master.md`.

---

## 2. Terrain — `slope_deg` and `terrain_risk`

### Why

Slope accelerates fire spread (fire runs uphill); aspect controls how fast fuel dries (south-
facing slopes in the northern hemisphere get more sun). Confirmed across operational systems:

- **Mesogeos (#2):** slope × aspect × FWI interaction is the strongest non-weather feature `[V]`
- **BEYOND Greece (#4):** "ground morphology" is a listed input in the operational daily system `[V]`
- **West Coast XGBoost (#17):** elevation, slope, aspect from SRTM in the 11-channel input `[V]`
- **Athens (#9):** topography in the confirmed feature list `[D]`

### How to compute

From SRTM 30 m (SRTMGL1) or 90 m (SRTMGL3) elevation, available on AWS open data
(`s3://elevation-tiles-prod/`, no login `[V]`):

```python
# One-time, at grid build.
# 1. For each 0.25 deg cell, read the SRTM tile covering it
# 2. Compute slope and aspect per 30m pixel (Horn's method / numpy gradient)
# 3. Aggregate to the cell:
slope_deg = mean(pixel_slopes)         # 0..90
aspect_deg = circular_mean(pixel_aspects)  # 0..360, 0 = north

# 4. Derive a single risk-oriented feature:
import math
south_factor = 1.0 if 90 <= aspect_deg <= 270 else 0.5   # northern hemisphere
terrain_risk = math.sin(math.radians(slope_deg)) * south_factor  # 0..1
```

For the southern hemisphere, flip the south_factor (north-facing slopes dry faster there).
Store `slope_deg`, `aspect_deg` and `terrain_risk` as static columns.

### Licence

SRTM is public domain (NASA/USGS). No attribution required, but credit is good practice.

---

## 3. Lightning — `lightning_density`

### Why

Lightning is a distinct ignition cause with different predictors than human fires. Modelling
it separately raises accuracy:

- **BC model (#13):** separate OLCF/PLCF (lightning) models hit >0.90 AUC; a combined
  human+lightning model scores lower `[V]`
- **PNNL (#14):** lightning-specific model ~82% accuracy `[D]`
- **Global lightning XGBoost (#18):** 91.6% for lightning-to-ignition (paywall) `[D]`

### How to get it (free, no login)

**Open-Meteo** (#12) exposes `lightning_density` (flashes/km²/day) in its ECMWF IFS forecast
API — see [`open-meteo-api.md`](open-meteo-api.md). This is the only free daily global source
we found that needs no login. **NOAA GLM** (#20) is an alternative for the Americas with a
real-time feed but requires NOAA CLASS or an AWS bucket for the historical archive.

### How to use it (two ways)

1. **Stage 1 filter trigger (F6):** if `lightning_density > 0.01` within 50 km in the last
   24 h, flag the spot as a candidate regardless of FWI. This catches remote forest
   lightning fires that a weather-threshold filter would miss.
2. **Stage 2 model feature:** include raw `lightning_density`. Caveat: historical ERA5-Land
   has no lightning, so the training years (2021–2023) will have null lightning. The model is
   therefore trained *without* it; lightning enters only at prediction time via the Stage 1
   filter. Document this in `PROTOCOL.md`. (In v2, use GLM archive for consistent training.)

---

## 4. Raw weather — `t_max_c`, `rh_min`, `wind_max_kmh`, `wind_dir_deg`

### Why

The spec listed these as "optional, if a free source is found." Open-Meteo (#12) is that
source. Raw weather in physical units lets the model and the `why` explanations say "34 °C,
18% humidity, 45 km/h wind" rather than only an abstract FWI number — far more legible to
fire crews (M34 "why this spot").

- **BC model (#13):** uses raw temperature, humidity, wind at forest-floor level `[V]`
- **Open-Meteo (#12):** all four available via one REST call, no key `[V]`

### How

See [`open-meteo-api.md`](open-meteo-api.md) for the exact endpoint and variable names. Compute
daily aggregates (`temperature_2m_max`, `relative_humidity_2m_min`, `wind_speed_10m_max`,
`wind_direction_10m_dominant`) from the hourly series.

These already have slots in the spec's spot record `inputs` object (`t_max_c`, `rh_min`,
`wind_max_kmh`, `wind_dir_deg`) — they were display-only before, now they are also model
inputs and filter inputs.

---

## Combined feature list for `build_inputs.py`

| Feature | Static or daily | Source | In spec v1? |
|---|---|---|---|
| fwi, ffmc, dmc, dc, isi, bui | daily | GFWED | yes |
| ndvi_diff | monthly | MOD13C2 | yes |
| forest, grass_shrub, farm | static | MCD12C1 | yes |
| hist_p, fire_near_3d, days_since_last_fire | daily | Plan 1 cell_days | yes |
| month_sin, month_cos, lat_band | static/daily | — | yes |
| fwi × forest (interaction) | daily | derived | yes |
| **road_distance_km** | static | OSM | **new** |
| **slope_deg, terrain_risk** | static | SRTM | **new** |
| **lightning_density** | daily (live only) | Open-Meteo | **new** |
| **t_max_c, rh_min, wind_max_kmh, wind_dir_deg** | daily | Open-Meteo | promoted |

~18 features total, up from ~14. All from free, no-login sources.

## Features we considered but are NOT adding for v1

- **KBDI (Keetch-Byram Drought Index)** — West Coast #17 uses it. Our DC (Drought Code) from
  FWI already captures long-term drought; KBDI would be redundant for v1. Possible v2 addition.
- **Haines Index / K-Index** — BC #13 uses these atmospheric stability indices. Not in GFWED;
  computable from ERA5 temperature profiles but adds pipeline complexity. v2.
- **LANDFIRE fuel models** — #19, far richer fuel description but USA-only. v2 for US regions.
- **Utility-corridor proximity** — eimirjihad #15. HIFLD is USA-only; OSM `power=line` is
  global but sparse. Road distance is a good enough human-proximity proxy for v1.
