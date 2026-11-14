# Conversion plan: MODIS → VIIRS-level fire record (research-based)

Written Sat 14 Nov 2026 after a research round. Three parallel research agents covered papers, existing products and code, and statistical methods; key claims were spot-checked.
**This plan replaces the method part of [`harmonization-plan.md`](harmonization-plan.md).** The corrections to that plan are listed in section 9.

Tags: `[V]` read on the original page or PDF · `[D]` abstract or snippet only · `[U]` our inference. Sources are in section 10.

---

## 1. What the research says, in 7 sentences

1. **There is no single MODIS-to-VIIRS factor.** The gap depends on fire size, land cover, region, season, day or night, scan angle and cloud `[V]`. No published global conversion table exists `[V/D]`.
2. **The best-tested template is GFED5NRT (2026).** It calibrates VIIRS counts on the 2012–2022 overlap, separately for 14 regions × 16 land-cover types, on a 0.25° grid. For monthly totals it scores r = 0.94, slope 1.07 and nRMSE 8% globally, but only 61% nRMSE per single 0.25° cell `[V]`.
3. **MODIS loses about two-thirds of its detections toward the swath edge; VIIRS barely changes** `[V]` (Li 2018). Scan angle must be handled.
4. **Aqua MODIS and VIIRS pass at the same time (about 13:30); Terra passes at about 10:30**, and no VIIRS satellite flies then `[V]`. So pair Aqua with VIIRS and treat Terra separately.
5. **Both MODIS satellites are drifting.** Terra has passed earlier than 10:15 since autumn 2022, and NASA ends Terra in Jan 2027 and Aqua around Sep 2027 `[V]`. GFED5 stopped at 2022 for this reason `[V]`.
6. **NASA's MODIS gridded fire product (MCD14CMQ) uses official formulas** to correct counts for how often a cell was observed and for cloud `[V]`. NASA warns that **periods shorter than about 8 days are severely biased** `[V]`.
7. **About 30 other public teams work on this same challenge** `[V]`, counted on GitHub on 14 Nov. Many "degrade VIIRS to MODIS". **We win on rigour:** official corrections, overpass matching, honest validation and outside checks.

## 2. What we build (the target)

**One consistent monthly fire record, 2000 → today, worldwide, in "S-NPP VIIRS-equivalent fire cell-days", on NASA's 0.25° grid, with an uncertainty range on every value.**

| Term | Meaning |
|---|---|
| **Fire cell-day** | A small cell (0.01°, about 1 km) counts once on a day it has any detection. This removes most of the pixel-size difference `[U]` (the literature's recommended unit, alongside FRP `[V]`) |
| **Harmonized value** | The sum of fire cell-days in one 0.25° cell for one month |
| **S-NPP VIIRS-equivalent** | Scaled to what VIIRS on Suomi NPP would have counted. That is the "high-resolution" level the team asked for |
| **0.25° grid** | NASA's official climate-modelling grid (1440 × 720 cells) `[V]`, so we can use NASA's correction formulas and compare with NASA products |

**Any area the user picks** is answered by adding up its 0.25° cells. Areas smaller than about one cell get a "low confidence" label. Single cells are noisy (nRMSE 61% `[V]`), while regions are reliable (8% `[V]`).

**Daily data** is shown **raw** (measured points on the map), not harmonized: NASA says periods under about 8 days are biased `[V]`. The harmonized calendar is **monthly**.

## 3. Data (all public)

| Use | Source | Access | Tag |
|---|---|---|---|
| **All detections 2000 → today, worldwide** | **firms-catalog** (a GeoParquet mirror of NASA FIRMS on Source Cooperative): 631 million rows; MODIS Terra and Aqua from Nov 2000, S-NPP from Jan 2012, NOAA-20 from Apr 2018, NOAA-21 from Jan 2024; year-partitioned | Query by area with DuckDB over HTTP. No key, no 50 GB download. Apache-2.0 | `[V]` |
| Backup and official copy | NASA FIRMS yearly country CSVs, plus the API with a free key | No login / key | `[V]` |
| **MODIS observation coverage and cloud** | **MCD14CMQ** monthly 0.25° (layers: `CorrFirePix`, `CloudCorrFirePix`, `MeanCloudFraction`, `TotalPix`, `CloudPix`, `RawFirePix`, `MeanFRP`, `NumPixFRP`) | UMD SFTP (`fuoco.geog.umd.edu`, folder `MODIS/C6/Mx14CMQ`), HDF4 | `[V]` |
| Regions × land cover | GFED basis regions (14) and a land-cover map (for example MODIS MCD12C1, 0.05°, or the GFED land-cover classes) | To confirm in the data research | `[U]` |
| **Outside truth for validation** | GFED5 burned area (0.25° monthly, 1997–2020, CC BY 4.0, Zenodo); MCD64A1 / VNP64A1 burned area; national statistics (EFFIS for Bulgaria, NIFC/MTBS for the USA) | Zenodo, LP DAAC, agencies | `[D]` |

**Columns we need from each detection:** latitude, longitude, date, time, satellite, instrument, confidence, `type` (0 = vegetation), FRP, day/night, **scan/track** (pixel size, a stand-in for scan angle).

## 4. Pipeline: step by step

### Step 1: Clean (about 1 h)
- **Keep only vegetation fires:** `type == 0`. Also remove persistent static sources (gas flares, industry, volcanoes) with a static mask, as in GFED5NRT `[V]`.
- **Same confidence rule for both:** MODIS ≥ 30; VIIRS `n` or `h` (the VIIRS scale is letters, the MODIS scale numbers) `[V]`.
- **Remove MODIS edge duplicates:** detections less than 8 s apart with more than 30% footprint overlap `[V]` (Zheng 2026).

### Step 2: Fix the geometry (about 1–2 h)
- **MODIS scan angle:** compute pixel area from `scan × track`, and keep MODIS detections within about ±30° of nadir for *calibration*. Also test area-weighting `[V]` (MODIS guide formula; Li 2018).
- **VIIRS:** almost flat across the swath; optional sample-position weights as in GFED5NRT `[V]`.

### Step 3: Count fire cell-days (about 1–2 h)
- For each sensor stream (Terra, Aqua, S-NPP, NOAA-20, NOAA-21) and each day, count the distinct 0.01° cells with a detection.
- Sum them per 0.25° cell × month, and record day and night separately.
- Output: one Parquet table per stream.

### Step 4: Correct for observation coverage (about 2 h)
- **MODIS:** use MCD14CMQ's `TotalPix` and `MeanCloudFraction` per cell-month with NASA's formulas `[V]`:
  - overpass correction: `N′ = N · Ndays · A(i) · Neq / (Ntotal · Aeq)`;
  - cloud correction: `N″ = N′ / (1 − f_cloud)`.
- **VIIRS:** no public gridded coverage product exists `[V]`.
  - **Smart shortcut** `[U]`: Aqua and VIIRS pass at nearly the same time, so they see the same clouds. Calibrating VIIRS on **Aqua at the same time** cancels most of the cloud effect.
  - For the final series, apply the Aqua cloud fraction as a stand-in. This is a clear novelty versus other teams.

### Step 5: Build calibration pairs (about 1 h)
- **Pairs:** for every 0.25° cell × month in **2012–2022** (before the worst drift `[V]`), pair the **Aqua** value with the **S-NPP** value (same 13:30 overpass).
- **Separate Terra pairs:** a Terra × S-NPP set for the Terra-only years (Nov 2000 – Jun 2002), when Aqua wasn't flying yet `[V]`.
- **Features:** MODIS cell-days (day and night), MODIS FRP, region, land cover, month, latitude band, neighbouring-cell activity.

### Step 6: Fit the conversion: three tiers, keep the best (about 4–8 h)

| Tier | Model | Why | Time |
|---|---|---|---|
| **T1: Baseline (must)** | **Ratio of sums per region × land cover × month**, pulled toward the global ratio where data is thin (empirical-Bayes shrinkage), plus a **"MODIS saw 0, VIIRS saw fires" term** (the base rate per region × month) | Explainable as a table judges can read. It mirrors GFED5NRT's tested design `[V]` | 2–3 h |
| **T2: Main (should)** | **LightGBM with Poisson/Tweedie loss** on the step-5 features, compared with a Poisson GLM on log(1+MODIS) | Handles zeros, heavy tails and interactions | 3–5 h |
| **T3: Optional (could)** | **Bayesian hierarchical hurdle negative-binomial** (bambi/PyMC), with partial pooling across regions | Best uncertainty for sparse regions | 4–6 h |

**Rule:** the tier with the best **held-out** score (step 7) is used in the app. The choice is fixed in a commit **before** the test years are scored (pre-registration, M58).

### Step 7: Prove it, before it goes in the app (about 2–3 h)

| Check | How | Pass signal |
|---|---|---|
| **Temporal hold-out (M44)** | Train on 2012–2018, test on 2019–2022. Then the reverse (train 2016–2022, test 2012–2015) | Low error both ways |
| **Spatial block cross-validation** | Leave whole regions out (GroupKFold by region), because random splits underestimate error `[D]` (Roberts 2017) | Error close to the temporal test |
| **Metrics** | Poisson deviance, MAE, bias of totals, and per-region monthly **r, slope and nRMSE** (comparable with GFED5NRT's 0.94 / 1.07 / 8%), plus KGE on regional series. **No MAPE:** it breaks on zero months `[D]` | Report all, honestly |
| **Slices (M124)** | The error by region, land cover, month, day/night and area size | No hidden failing slice |
| **Uncertainty (M114 + M46)** | Bootstrap for T1; **conformal intervals per land-cover class** for T2. Check that a 90% interval really covers about 90% of test values | Coverage near nominal |
| **Satellite agreement (M21)** | S-NPP vs NOAA-20, 2018–2025, on the same cells | Close agreement, otherwise calibrate NOAA-20 to S-NPP |
| **Drift check** | Change-point test (`ruptures`) on the Aqua/VIIRS ratio, 2012–2025 | Flag 2022+ if a break appears |
| **Published ranges (M38)** | Compare our ratios with Punjab (about 4.8–6.5×), NE Asia (MODIS missed 65–83%), and Csiszar's +26% / +70% (750 m) | Inside or explained |
| **Outside truth (M41)** | Correlate the harmonized monthly series with GFED5 / MCD64A1 burned area, and check EFFIS (Bulgaria) and NIFC (USA) seasons | Similar r to GFED5NRT |

### Step 8: Apply and stitch the record (about 1–2 h)

| Period | Source | Label in the app |
|---|---|---|
| Nov 2000 – Jun 2002 | **Terra** converted (Terra model) | "Estimated from MODIS Terra" (widest uncertainty) |
| Jul 2002 – Jan 2012 | **Aqua** converted (main model); Terra as a cross-check | "Estimated from MODIS" |
| Jan 2012 – 2 Nov 2026 | **Measured S-NPP VIIRS** | "Measured" |
| From 2018 / 2024 onward | NOAA-20 / NOAA-21, **calibrated to S-NPP** on their overlap | "Measured (calibrated)" |
| After 2 Nov 2026 | NOAA-20 and NOAA-21 only (S-NPP stopped `[V]`) | "Measured (calibrated)" |

**Every value carries** the measured or estimated flag, the lower and upper bound, the model tier, and an **out-of-range flag** when a cell's MODIS values fall outside what the model saw in training (extrapolation).

### Step 9: Outputs for the app (about 1 h)
- **`harmonized_monthly.parquet`**, columns: `cell_id, year, month, terra, aqua, snpp, noaa20, noaa21, harmonized, lo, hi, source_flag, tier, ood_flag`.
- **Region and country roll-ups** for instant loading.
- **`validation_report.json`**, which feeds the "How we know it's right" page.
- **Daily raw points** for the map: unharmonized and labelled as raw.

## 5. Time plan (team of 6 with AI agents) `[U]`

| Block | Steps | Owner | Hours |
|---|---|---|---|
| A | Data access (firms-catalog via DuckDB) and cleaning; Bulgaria and USA first, then the world | Data | 3 |
| B | Geometry and cell-days | Data | 2–3 |
| C | MCD14CMQ download and coverage correction | Data/science | 2 |
| D | T1 model plus validation harness (writes the expected answers first) | Science + QA | 4 |
| E | T2 model plus conformal intervals | Science | 4 |
| F | Stitching, outputs, roll-ups | Data | 2 |
| G | Validation page content | QA + story | 2 |

**Critical path:** A → B → D → F, about 11–12 h. T2 and T3 run in parallel with D.

## 6. MoSCoW for the conversion

| Priority | Items |
|---|---|
| **Must** | Cleaning and static mask · fire cell-days on the 0.25° grid · Aqua↔S-NPP pairing on 2012–2022 · T1 ratio with shrinkage plus a zero term · temporal hold-out · error by slice · bootstrap bands · Terra-only handling for 2000–2002 · measured/estimated labels |
| **Should** | MCD14CMQ coverage and cloud correction · scan-angle filter and weights · T2 LightGBM Poisson · conformal intervals · S-NPP vs NOAA-20 check · drift change-points · comparison with published ratios |
| **Could** | T3 Bayesian hurdle model · outside-truth correlation with GFED5 / burned area · EFFIS/NIFC checks · an FRP-based second series |
| **Won't** | Harmonized daily values (NASA warns of bias under about 8 days) · moving individual fires to 375 m positions for 2000–2011 (not in the data) |

## 7. Risks and fallbacks

| Risk | Fallback |
|---|---|
| MCD14CMQ hard to get (SFTP, HDF4) | Skip the coverage correction and rely on Aqua↔VIIRS same-time pairing (clouds largely cancel) `[U]`; say so on the validation page |
| Global processing too slow | Bulgaria and USA first, then the world at 0.25° monthly (small); the firms-catalog per-cell totals can speed this up |
| T2 doesn't beat T1 | Ship T1. It's explainable and matches the GFED5NRT design |
| Drift breaks the 2023+ ratio | Calibrate on 2012–2022 only; flag 2023+ MODIS values |
| Weak regions (for example temperate N. America in GFED5NRT `[V]`) | Wider bands plus a "low confidence" label |

## 8. Why this beats the other 30+ teams `[U]`

1. **NASA's own correction formulas and grid**, not an invented scale.
2. **Overpass-matched calibration** (Aqua↔VIIRS, the same time and the same clouds), with Terra handled separately.
3. **A model per region and land cover** with partial pooling, following the published GFED5NRT design.
4. **Honest validation:** a two-way temporal hold-out, spatial blocks, published-ratio checks, and outside truth.
5. **Ready for the post-MODIS era:** the record continues on NOAA-20 and NOAA-21 after S-NPP's end (2 Nov 2026) and MODIS's end (2027).

## 9. Corrections to the earlier `harmonization-plan.md`

| Earlier | Now | Why |
|---|---|---|
| A grid of about 1 km for harmonizing | **0.25° grid for harmonizing**; 0.01° cells only for counting cell-days | Single small cells are too noisy (nRMSE 61% `[V]`); 0.25° is NASA's official grid |
| Daily where possible | **Monthly harmonized**; daily stays raw | NASA: under about 8 days is severely biased `[V]` |
| Train 2012–2018, test 2019–2025 | **Calibrate within 2012–2022**, test 2019–2022 and the reverse; check 2023+ for drift | MODIS drift after 2022 `[V]` |
| "MODIS" as one stream | **Aqua paired with VIIRS; Terra separate**, with its own model for Nov 2000 – Jun 2002 | Different overpass times; Aqua only from Jul 2002 `[V]` |
| Downloading about 53 GB of yearly files | **Query firms-catalog GeoParquet by area** with DuckDB | 631 M rows already cloud-hosted `[V]` |

## 10. Sources

**Papers and data products:**
- GFED5NRT: Chen et al. 2026, ESSD 18:7535 `[V]`. https://essd.copernicus.org/articles/18/7535/2026/essd-18-7535-2026.pdf. Code: https://github.com/ychenzgithub/GFED5NRT (MIT)
- MODIS C6/C6.1 Fire User Guide (MCD14CMQ, correction formulas, the 8-day warning) `[V]`. https://earthdata.nasa.gov/s3fs-public/2023-09/MODIS_C6_C6.1_Fire_User_Guide_1.0.pdf
- Giglio, Csiszar & Justice 2006, JGR 111 G02016 (gridded corrections) `[V]`
- Csiszar et al. 2014, JGR 119:803 (VIIRS 750 m vs MODIS: +26% / +70%) `[V]`. https://directreadout.sci.gsfc.nasa.gov/publications_documents/Csiszar_et_al_2014_JGR.pdf
- Schroeder et al. 2014, RSE 143:85 (375 m vs 750 m: 3× by day, 25× by night) `[V]`. https://directreadout.sci.gsfc.nasa.gov/publications_documents/Schroeder_et_al_2014b_RSE.pdf
- Li et al. 2018, JGR 123:4545 (scan angle: MODIS −67% counts; FRP within ~20% at 1°) `[V]`. https://repository.library.noaa.gov/view/noaa/49896/noaa_49896_DS1.pdf
- Li et al. 2020, Remote Sens. 12:1561 (Africa; MODIS under-reads FRP by ≥ 42.8%) `[V]`
- Fu et al. 2020, Remote Sens. 12:2870 (MODIS missed 65–83%) `[D]`
- Vadrevu & Lasko 2018, Remote Sens. 10:978 (Punjab, about 4.8–6.5×) `[D]`
- Sofiev & Kouznetsov 2026, GMD 19:10123 (detection limits; observation operators) `[V]`. https://gmd.copernicus.org/articles/19/10123/2026/
- Zheng et al. 2026, Remote Sens. 18:1650 (correction before fusion; duplicate removal) `[V]`
- Giglio et al. 2025, RSE 331:115006 (VIIRS burned-area continuity; overpass undersampling) `[V]`
- VIIRS Active Fire User Guide (750 m built for MODIS continuity; no VIIRS gridded product) `[V]`. https://www.earthdata.nasa.gov/sites/default/files/imported/VIIRS_activefire_User_Guide.pdf

**Agencies and data:**
- CAMS: "Drifting away from MODIS" (VIIRS added on 4 Dec 2025; Terra ends Jan 2027, Aqua ~Sep 2027) `[V]`, checked again 14 Nov. https://atmosphere.copernicus.eu/drifting-away-modis-cams-global-fire-assimilation-system
- Terra orbit drift `[D]`: https://terra.nasa.gov/about/terra-orbital-drift-information
- firms-catalog (GeoParquet mirror, Apache-2.0) `[V]`: https://github.com/portolan-mirrors/firms-catalog · data: https://source.coop/portolan-mirrors/firms-catalog

**Methods:**
- Roberts et al. 2017, Ecography (spatial cross-validation) `[D]`
- Hyndman & Koehler 2006 (MAPE problems with zeros) `[D]`

## 11. Not verified (to check during the build)

- Exact Terra and Aqua crossing times for 2023–2026.
- The Boschetti 2022 MODIS science-team harmonization slides (download failed).
- Whether UMD still posts MCD14CMQ through 2026.
- The GFED region and land-cover file access.
- The exact class names for hurdle models in statsmodels and bambi.
- The firms-catalog columns (`scan`, `track`, `type`), to check in its AGENTS.md before the build.
