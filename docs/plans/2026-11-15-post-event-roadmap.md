# Next-day fire risk: roadmap after the event

Written Sun 15 Nov 2026, after the team's plan and source list for "AI wildfire prediction, 24 hours ahead" (15 Nov). It says what we take from that list, in what order, and what we leave out. Nothing here changes the model we submit on 15 Nov.

Tags: `[V]` checked against our files or the source · `[D]` directional, from published work · `[U]` our inference or proposal.

## 1. Where we stand

Held-out test year 2025, forest and wildland squares, 0.25 degree grid, top 5 squares per region and day (from `web/public/data/risk/scorecard.json`) `[V]`:

| Share of new fires caught | Our model | Earlier years (history) | NASA fire-weather index | Random pick |
|---|---|---|---|---|
| Europe | **53.8%** | 51.0% | 41.1% | 39.4% |
| World | **20.4%** | 16.7% | 11.2% | 10.5% |

| Share of fires already burning caught | Our model | History | NASA index | Random |
|---|---|---|---|---|
| Europe | 50.2% | **58.7%** | 49.0% | 46.6% |
| World | 10.4% | **13.7%** | 11.5% | 10.6% |

The model meets the claim rule (`pipeline/risk/PROTOCOL.md`) against both history and the NASA index, in Europe and worldwide `[V]`. For fires that are already burning, history does better than the model `[V]`.

## 2. The team plan against what is built

| Step in the plan | State |
|---|---|
| 1. Find fire-prone areas from history | Built. History is a model input and a baseline `[V]` |
| 2. Audit our datasets | This document, section 4 |
| 3. Add missing data (people, power lines, roads, lightning, dryness, weather forecasts) | Not built. Sections 4 and 6 rank them |
| 4. Study existing models | Section 6 |
| 5. Train models, new fires apart from spread | Built at 0.25 degree; new and continuing fires scored apart `[V]`. 0.1 degree run cut for time `[V]` |
| 6. Train on earlier years, test on later ones, only data known in time | Built, stricter than 24 hours: inputs end with day D-2 `[V]` |
| 7. Hits, misses, false alarms, reliability | Built: capture rate, hit rate, Brier score, reliability bins, bootstrap intervals `[V]` |
| 8. Map of tomorrow's risk | Built: the risk screen `[V]` |

## 3. Why we set no percentage target

The plan aims for 80 to 90%. We do not set a percentage goal, for three reasons.

1. **Our number depends on region size.** In a region with few squares, picking 5 at random already catches many fires: random reaches 39.4% in Europe `[V]`. Smaller regions would push every method towards 100% and mean nothing.
2. **Published 80 to 90% figures measure something else.** F1 scores of 81% (Mesogeos models) and 80.6 to 87.9% (the Athens study) come from test sets with fixed shares of fire and no-fire samples, built around large fires `[D]`. Real days are almost all no-fire, so these scores do not carry over. ROC-AUC values of 77 to 90% give credit for millions of easy no-fire squares `[D]`.
3. **Strict measures are much lower everywhere.** OroraTech's ignition models reach 7.8 to 25% PR-AUC across four regions `[V]` *(18 Nov: could not re-find this at the source; the closest paper, FireSight by OroraTech and LMU, reports three regions: FWI → model PR-AUC Australia 0.39% → 3.6%, Brazil 6.24% → 11.75%, Greece 0.51% → 19.93% `[V]`; see [`../../lean-canvas/competition/README.md`](../../lean-canvas/competition/README.md). Our own PR-AUC script: `pipeline/risk/prauc_2026.py`)*. WISP, the research model closest to our task, places 54.1% of next-day fire clusters within 5 km `[V]`.

Our goal stays as registered: beat history and the NASA index with an interval that excludes zero, and publish the reliability chart.

## 4. Roadmap, in order

Each item is scored under the same protocol and plugs in as described in build plan 8.5.

### 4.1 Use yesterday's fires

- **What:** issue the forecast for day D in the evening of D-1 and let it use that afternoon's satellite detections, instead of stopping at D-2.
- **Why:** recent fires nearby are among the strongest signals we have. FIRMS publishes near-real-time detections "within 3 hours of a satellite observation (on a best-effort basis)" `[V]`, so the afternoon pass of D-1 is available by evening `[U]`.
- **Work:** change the cutoff in `PROTOCOL.md` and the recent-fire feature (D-3 to D-1), and rebuild the training rows with the same timing. The archive and near-real-time detections differ slightly; check the difference on a few weeks before training `[U]`.
- **Expected gain:** the largest of this list for the effort `[U]`.

### 4.2 Human activity

- **What:** population per square, road density, distance to the farmland edge, weekday and public-holiday flags.
- **Why:** most fires in Europe are started by people `[D]`, and the model sees no human input today `[V]`. This is the biggest gap the team plan names.
- **Sources:** an open global population grid (for example GHSL), roads from OpenStreetMap or an open global roads dataset, holidays per country from a public calendar. Check each licence before use; OpenStreetMap is share-alike `[U]`. The Mesogeos datacube (Zenodo 8036851, CC BY 4.0 `[V]`) holds similar human layers for the Mediterranean at 1 km and can serve as a cross-check.
- **Work:** fixed layers, downloaded once and averaged per square; flags are computed from the date.

### 4.3 Vegetation dryness

- **What:** soil moisture and greenness as model inputs.
- **Why:** the scorecard notes that no greenness input was available `[V]`. The map already shows both, but as picture tiles (`SMAP_L3_Passive_Enhanced_Day_Soil_Moisture`, `VIIRS_NOAA20_NDVI_8Day`), not numbers a model can read `[V]`.
- **Sources:** the underlying SMAP soil moisture and VIIRS greenness data need a free NASA Earthdata account, which we have not created yet `[V]`.
- **Work:** use only values already published before the forecast is issued; an 8-day greenness composite appears days after its last day `[U]`.

### 4.4 ECMWF Probability of Fire as a third baseline

- **What:** score ECMWF's experimental Probability of Fire on the same squares and days.
- **Why:** "better than history, the NASA index and ECMWF's machine-learning model" is the strongest claim we could make, or an honest place where we lose.
- **Source:** `github.com/ecmwf/AI-Probability-of-Fire`, Apache-2.0, labelled sandbox, runs on past forecasts only `[V]`.
- **First step:** check whether its past forecasts cover our test period. If they do not, we cite it and move on.

### 4.5 A separate rule for fires already burning

- **What:** for continuing fires, show "fire nearby yesterday" persistence instead of the new-fire model.
- **Why:** history beats the model on continuing fires (Europe 58.7% against 50.2%) `[V]`; the model was built for new fires.
- **Work:** score the simple rule on the same protocol; show spread and new ignitions as two different things on the map.

### 4.6 Smaller squares

- **What:** move from 0.25 degree (about 25 km) to 0.1 degree (about 10 km).
- **Why:** crews place resources at a finer scale than 25 km.
- **When:** after 4.1 to 4.3. With the same inputs, finer squares mostly add noise `[U]`.

### Later

- **Storm conditions for lightning-started fires:** forecast instability and convective rain from ECMWF open data. Matters most for Canada, Siberia and Australia, less for the Mediterranean `[D]`. NOAA's Geostationary Lightning Mapper covers the Americas only `[D]`.
- **A US view:** LANDFIRE fuels, the US Forest Service fire records (the only source in the list with fire causes) and NIFC. US only.
- **ERA5-Land** for longer training history: a model trained on recorded weather and run on forecasts expects better inputs than it gets. Our training on archived 3-day fire-weather forecasts avoids that; keep it that way `[U]`.

## 5. A fresh test period

`PROTOCOL.md` allows one look at the 2025 test year, and it has been used `[V]`. Any model built from this roadmap is chosen on 2025 (which becomes the validation year) and tested once on a new period, for example 1 Jan 2026 to the last full month `[U]`. This needs the NASA fire-weather forecasts for 2026; we downloaded 2021 to 2025 only `[V]`. The proof page should state which period each number comes from.

## 6. The source list, sorted

| Source | What we take | Notes |
|---|---|---|
| WISP (arXiv 2605.10298) | Method reference; its "within 5 km" measure | Same task as ours: next-day active fires, 375 m grid, 48 h of inputs `[V]` |
| ECMWF Probability of Fire | Third baseline (4.4) | Apache-2.0, sandbox `[V]` |
| OroraTech / LMU ignition models | Their 37 inputs as a checklist; realistic PR-AUC benchmark | CC BY-NC 4.0, gated download, no inference code `[V]` |
| Mesogeos | The datacube's human layers (4.2) | Use the original dataset; the linked repo is a thesis built on it `[V]` |
| Athens deep-learning study | Cite | Balanced samples; F1 not comparable `[D]` |
| SIMERF, British Columbia study, CSIRO evaluation guidance | Cite for method | CSIRO guidance matches our test rules `[U]` |
| BEYOND, FireAId | Cite as related systems | Closed; FireAId's 80% is a project claim `[D]` |
| ECMWF open forecasts, Open-Meteo | Later item (storm conditions) | Need archived forecasts for training |
| ERA5-Land | Training history only, with the caution above | |
| LANDFIRE, US Forest Service records, NIFC | US view | US only |
| NOAA Geostationary Lightning Mapper | Not for Europe | Americas only `[D]` |
| Western US, West Coast and human-activity repos, FireCastRL | Skip | Unstable results (83.3% falling to 24%) or future-data leakage, as the list itself notes |
| Global lightning-ignition XGBoost | Skip | Predicts whether a strike starts a fire, not where fires happen tomorrow |
| Power lines | Skip for now | Matters mainly in regions like California |

## 7. For the pitch on 15 Nov

- Compare against the strict published numbers in section 3, not the 80 to 90% figures.
- Answer "why not 90%" with the random baseline: a big percentage proves nothing, beating the right baselines does.
- Show sections 4.1 to 4.3 as next steps, credited to the team's research list.
