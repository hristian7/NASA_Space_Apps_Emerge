# Conversion plan: short version

Summary of [`conversion-plan.md`](conversion-plan.md) (14 Nov 2026). Sources and details are in the full plan.

## Goal

One consistent fire record, **2000 → today, worldwide**:
- **Unit:** "VIIRS-level" values, i.e. what the newer, sharper VIIRS sensor would have counted.
- **Grid and time step:** monthly, on NASA's 0.25° grid (about 28 km cells).
- **Uncertainty:** every value comes with a range.

## What the research says

- **No single conversion factor exists.** The MODIS–VIIRS gap changes with fire size, land cover, region, season, day or night, and viewing angle.
- **The proven template is GFED5NRT (2026).** It calibrates on the 2012–2022 overlap, per region and land cover, on the 0.25° grid. Monthly regional totals agree well (r = 0.94, 8% error); single cells are noisy (61%).
- **NASA warns that counts over periods under about 8 days are biased.** So we harmonize **monthly**; daily points stay raw on the map.
- **Overpass times:** Aqua MODIS and VIIRS pass together at 13:30; Terra passes at 10:30.
- **Drift:** both MODIS satellites are drifting, and they end in 2027.
- **A free online copy of all 631 million NASA detections** (firms-catalog) can be queried by area. No 50 GB download.
- **Competition:** 30+ other teams work on this challenge. We win on rigour.

## Pipeline

| Step | What we do |
|---|---|
| 1. Clean | Vegetation fires only, the same confidence rules for both sensors, no duplicates or static sources (gas flares, industry) |
| 2. Fix the viewing angle | Learn the conversion from MODIS detections near straight below the satellite |
| 3. Count fairly | Each ~1 km cell counts once per day, summed per 0.25° cell per month ("fire cell-days") |
| 4. Clouds and coverage | NASA's official formulas for MODIS. Aqua and VIIRS see the same clouds at the same time, so pairing them cancels most of the cloud effect |
| 5. Learn the conversion | Aqua vs VIIRS on 2012–2022, per region × land cover × month. Terra gets its own model for 2000–2002, before Aqua launched |
| 6. Pick the best model | A simple ratio (pulled toward the global average where data is thin, plus a term for fires MODIS missed), a LightGBM count model, and an optional Bayesian model. The winner is chosen on held-out data, with the rule fixed in advance |
| 7. Prove it | See below |
| 8. Stitch the record | 2000–2011: converted MODIS, labelled "estimated". 2012 onward: measured VIIRS. After 2 Nov 2026: NOAA-20/21, calibrated to the older VIIRS |
| 9. Outputs | One table per cell and month (measured, harmonized, range, label, flags), plus a validation report for the "How we know it's right" page |

## How we prove it

- **Held-out years, both ways:** train on 2012–2018, test on 2019–2022; then the reverse.
- **Leave whole regions out:** random splits overstate accuracy.
- **Honest errors:** by region, land cover and month. No percentage error, because it breaks on zero-fire months.
- **Error bands:** check that 90% ranges really contain about 90% of test values.
- **Satellite and drift checks:** the two VIIRS satellites must agree; test for MODIS drift breaks.
- **Outside checks:** published ratios and burned-area records.

## Priorities

| Priority | Items |
|---|---|
| **Must** | Cleaning, fire cell-days, Aqua–VIIRS calibration, simple ratio model, held-out test, error bands, Terra years, labels |
| **Should** | Cloud correction, viewing-angle filter, LightGBM, guaranteed-coverage intervals, satellite and drift checks |
| **Could** | Bayesian model, burned-area and national-record checks (EFFIS for Bulgaria, NIFC for the USA) |
| **Won't** | Daily harmonized values; invented fire positions for 2000–2011 |

## Time, risks and edge

- **Time:** the critical path is about 11–12 hours for 6 people with AI agents.
- **Fallbacks:**
  - no NASA cloud data → rely on Aqua–VIIRS pairing;
  - processing too slow → Bulgaria and the USA first, then the world;
  - the advanced model doesn't win → ship the simple ratio;
  - drift → flag 2023+.
- **Our edge:** NASA's own grid and formulas, same-time satellite pairing, a model per region and land cover, honest validation, and a record that continues after MODIS ends.
