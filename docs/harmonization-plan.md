# Harmonization plan: turning MODIS ("low resolution") into VIIRS-level ("high resolution") fire data

Written 14 Nov 2026.

> **Superseded on 14 Nov by [`conversion-plan.md`](conversion-plan.md)**, a research-based plan with corrections: harmonize monthly on NASA's 0.25° grid (not daily at 1 km), pair Aqua with VIIRS, handle Terra separately, and calibrate within 2012–2022 because of MODIS drift. This is the plan for feature **M1**. How we prove it works: [`verification-plan.md`](verification-plan.md).

## The idea in one paragraph

From 2012 to 2025 both satellites watched the same fires:
- **MODIS:** 1 km pixels, so it misses many small fires.
- **VIIRS:** 375 m pixels, so it sees about **3–6× more detections** `[D]`.

We use those 14 overlap years to **learn how MODIS relates to VIIRS**, for each kind of place and season. Then we apply that to the MODIS-only years (**2000–2011**) to estimate **what VIIRS would have seen**. The result is one consistent record from 2000 to today, in "VIIRS-level" units, with an error range on every number.

## What "high resolution" can and can't mean here

| We CAN produce | We CAN'T honestly produce |
|---|---|
| **How many** fires VIIRS would have counted, per area and per day or month, with an error range | **Where exactly** each missed small fire was. That information was never measured |
| A fair comparison of any month in 2000–2025 with today | A sharper picture of the past than the data contains |
| Maps at an honest grid size (about 1–10 km cells), labelled "estimated" for 2000–2011 | 375 m dots for 2000–2011 (they would be made up) |

**In short:** we upgrade the **numbers** to VIIRS level, not the **pixels**. This is what the NASA challenge asks for ("the sensor of origin no longer matters").

## Step by step

### 1. Put both sensors on the same grid
- Assign every detection to a **grid cell** (start with about 1 km; also test about 10 km), plus a **day**.
- **Count "fire cell-days"**, not raw dots: a cell counts once per day if it had any detection. This removes most of the pixel-size effect (interview answer D3, option 2).
- **Clean first:** keep `type == 0` (vegetation fires); MODIS confidence ≥ 30; VIIRS confidence `n` or `h` (see [`firms-data.md`](firms-data.md)).

### 2. Build the training pairs (2012–2025)
- For each **region × month**, record the MODIS value and the VIIRS value. Region means continent × land-cover type, so forests, croplands, savannas and grasslands each get their own relationship.
- **Learn on matching times:** use only overpasses that are close in time (Aqua MODIS and VIIRS both pass in the early afternoon), so we compare the same moment (D3, option 5).

### 3. Learn the conversion: three models, keep the best
| Model | What it is | Why |
|---|---|---|
| A. Ratio | VIIRS ≈ k × MODIS, with one k per region × month | Simple and explainable. The baseline |
| B. Regression | VIIRS predicted from MODIS count, fire intensity (FRP), month, land cover and day/night share | Captures "small fires missed" better |
| C. Missed-fire term | Also predicts VIIRS fires where **MODIS saw zero**, from that place and season's base rate | MODIS misses small fires entirely, not just partly |

- **Where data is thin** (quiet regions), borrow strength from the wider region, so small areas don't get wild numbers.
- **Keep whichever model predicts the test years best** (step 4). Never pick a model by eye.

### 4. Prove it on years it never saw
- **Train on 2012–2018, test on 2019–2025** (method M44). Fix this split before looking at results (M58).
- **Report the error** by region, month and area size (M124), and put error bands on every number (M114).
- **Check that VIIRS on S-NPP and on NOAA-20 agree** over 2018–2025 (M21), so the "truth" itself is consistent.
- **Check our ratios** against published ones (Punjab 4.8–6.5×; MODIS missed 65–83% of VIIRS pixels in NE Asia) (M38).

### 5. Apply and stitch the record together
| Years | Source used | Label in the app |
|---|---|---|
| 2000–2011 | MODIS **converted** to VIIRS level | "Estimated (from MODIS)", with error band |
| 2012 – 2 Nov 2026 | **Measured** VIIRS (S-NPP), cross-checked with NOAA-20 from 2018 | "Measured" |
| After 2 Nov 2026 | **Measured** VIIRS (NOAA-20 and NOAA-21), since S-NPP stopped `[V]` | "Measured" |

### 6. Make it worldwide and fast
- **Pre-compute once on a server:** download the global yearly files (about 53 GB `[D]`) and pre-compute daily and monthly cell totals. Only these small totals go to the app.
- **Any area the user draws** is answered by adding up its cells, so it's fast for any place on Earth.

### 7. Show it honestly in the app
- **A toggle:** "Measured per sensor / Harmonized (VIIRS level) / Fire intensity".
- **Every estimated value** shows its error band, and 2000–2011 is visibly marked "estimated".
- **The "How we know it's right" page** shows the back-test results from step 4.

## Risks and fallbacks

| Risk | Fallback |
|---|---|
| The conversion error is too high in some regions | Show measured counts per sensor there, flag them "not harmonized", and keep the validation page |
| Global processing takes too long | Process Bulgaria and the USA first (demo), then the rest of the world overnight on the server |
| Too few fires in a small area | Show a "low confidence" label instead of a number |
