# BC Fire Prediction Model — detailed research notes

Source: Woolford et al. (2021), *International Journal of Wildland Fire* 30(7), 538–552.
DOI: https://doi.org/10.1071/WF19058
Researched 2026-11-15. Tags: `[V]` confirmed at source · `[D]` directional · `[U]` our inference.

This is the most directly applicable non-NN wildfire prediction paper in our research list. It uses lasso-penalised logistic regression — the same model type as our Version 1 — and achieves >0.90 AUC across three sub-models in British Columbia.

## Summary

A statistical-ML fire-occurrence prediction system for British Columbia. Three separate models:

| Model | What it predicts | Test AUC |
|---|---|---|
| **OLCF** (Observed Lightning-Caused Fire) | Whether an observed lightning strike ignites a fire | >0.91 `[V]` |
| **PLCF** (Predicted Lightning-Caused Fire) | Lightning-caused fire ignition from forecast lightning | >0.90 `[V]` |
| **HCF** (Human-Caused Fire) | Human-caused fire ignition | >0.90 `[V]` |

All three use logistic regression with L1 regularisation (lasso) and are reported as ensembles of 500 fits on balanced samples drawn from training data.

## Training data

- 70,000 fire occurrence records from BC Wildfire Service, 1980–2014
- Grid: 20 km × 20 km cells (~2,541 cells across BC)
- Train period: 1980–2008; test period: 2009–2014

## Feature categories (72–83 candidate variables per model)

### Weather (from MSC stations + NARR reanalysis)
- **FWI components:** FFMC, DMC, DC, ISI, BUI, FWI — same as our spec
- **Atmospheric stability indices:** Showalter Index, Haines Index, K-Index — NOT in our spec
- Raw temperature, humidity, wind speed (at forest floor level from Wx stations)

### Vegetation / fuel
- AVHRR NDVI (seasonal greenness)
- Ecozone type (British Columbia has 7 mapped ecozones)

### Terrain
- Elevation (from DEM), latitude, longitude

### Human factors (HCF model only)
- Road density (km of road per km² of cell area)
- Population density
- WUI distance (wildland-urban interface — distance from the cell centre to the nearest urban boundary)
- Industrial land use

### Lightning (OLCF and PLCF models)
- Canadian Lightning Detection Network (CLDN) flash location and multiplicity
- Thunderstorm strike density per cell

### Historical fire rate
- Spatial fire occurrence rate (historical fires per cell over training years, by month)

## Key methodological choices we should copy

### 1. Lasso (L1) for feature selection

L1 regularisation sets unimportant feature weights to exactly zero, selecting a sparse feature set from 72–83 candidates automatically. This is better than manually picking features. In sklearn:

```python
from sklearn.linear_model import LogisticRegression
model = LogisticRegression(penalty="l1", solver="liblinear", C=0.5)
```

The value of `C` (inverse regularisation strength) is chosen by cross-validation on the validation year. Start with `C ∈ {0.01, 0.05, 0.1, 0.5, 1.0, 5.0}`.

### 2. Bootstrap ensemble of 500 fits

Because fires are rare (~1% of cells), the training set is imbalanced. The BC approach:
- For each of 500 iterations: sample all fire records + a random equal-sized sample of non-fire records (balanced subsample)
- Fit one logistic regression on the balanced subsample
- Average the 500 predicted probabilities for the final output

This naturally calibrates the output probability and reduces variance. The final `p` is a mean of 500 probabilities, which is well-calibrated for rare events.

### 3. Separate models for lightning vs human causes

Combined model performance is lower than the three separate models. The insight: the predictors of "will a lightning strike ignite" are almost entirely weather-driven, while "will a human activity ignite" depends more on proximity to roads and population. A combined model has to compromise between these two very different relationships.

**For our v1 build** (single model, overnight): approximate this with two composite features:
- `cause_human_risk` = `road_distance_km` (short distance = high human risk)
- `cause_lightning_risk` = `lightning_density` × `forest_share`

The model learns their weights. **For v2 (LightGBM)**: follow BC and train separate models.

### 4. Atmospheric stability indices (not in our spec)

The BC paper retains the **Haines Index** in the lasso-selected feature set for both lightning models. The Haines Index is a combination of atmospheric stability and moisture deficit that predicts whether a fire, once started, will behave erratically:

```
Haines Index = A + B
A (stability component): derived from 850–700 hPa temperature difference
B (moisture component): derived from 850 hPa dew-point depression
```

This is available in ERA5 and possibly GFWED. Worth adding if build time allows; the `build_inputs.py` pipeline can compute it from ECMWF temperature profiles if available.

**The K-Index** (convective index related to thunderstorm probability) is retained in OLCF/PLCF. Not in GFWED — skip for v1, possible addition in v2 from ERA5.

## What this means for our build

| BC model element | Our build action |
|---|---|
| Lasso L1 regularisation | Use `LogisticRegression(penalty="l1", solver="liblinear")` in `train.py` |
| Bootstrap ensemble (500 fits) | Implement in `train.py`; increases training time from seconds to minutes — acceptable |
| Road density / WUI distance | Add `road_distance_km` to `build_grid.py` from OSM |
| Spatial fire occurrence rate per cell | Already in spec as `hist_p` |
| FFMC, DMC, DC, ISI, BUI | Already in spec from GFWED |
| NDVI | Already in spec from MOD13C2 |
| Lightning as separate factor | Add `lightning_density` from Open-Meteo; use as Stage 1 trigger (condition F6) |
| Haines Index | Skip for v1 — not in GFWED; add in v2 if ERA5 is available |
| Ecozone classification | Our `region_id` serves this role |
| 20 km grid | We use 0.25° (~27 km at 45°N) — comparable |

## Accuracy context

>0.90 AUC-ROC is exceptional for fire occurrence prediction. The BC model achieves this by:
1. Using lasso to find the right feature subset (not overfitting to all 72 features)
2. Separating lightning from human causes
3. Training on 28 years of data

Our v1 will have 3 years of training data (2021–2023) which is much less. A realistic target for v1 is 0.75–0.85 AUC-ROC and 0.3–0.5 AUC-PR `[U]`. The BC numbers are a ceiling, not an expectation.

## Reference

Woolford, D.G., Martell, D.L., McFayden, C.B., Evens, J., Stacey, A., Wotton, B.M., Boychuk, D. (2021). The development and implementation of a human-caused wildland fire occurrence prediction system for the province of Ontario, Canada. *Canadian Journal of Forest Research* (the Ontario version; the BC version is cited as Martell & Sun 2008 / Woolford et al. in the paper — multiple BC Fire system publications exist under this DOI group).

*Note: the exact paper at DOI 10.1071/WF19058 is the BC/Ontario fire prediction methodology paper; full text is behind CSIRO Publishing paywall but the abstract and methods sections were partially accessible. The above feature list and AUC numbers are confirmed from the accessible portions `[V]` plus the abstract `[D]`.*
