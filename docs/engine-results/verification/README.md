# Prediction engine: verification report

Run 14 Nov 2026 against [`../../verification-plan.md`](../../verification-plan.md), with an AI assistant (log this for the SI usage note). Every number here comes from files in this folder or from `engine/verify/`, and is `[V]` unless tagged.

## Summary

| Verdict | Method |
|---|---|
| ✅ Pass | M19 known answers · M20 properties · M62 leakage (code) · M32 limits · M125 control totals · M101 audit sample · M57 mutation testing (after one fix) · M21 VIIRS and Terra differential · M38 reference directions · M112 calibration · M123 multiple testing · M44 hold-out and forward tests |
| ⚠️ Pass with a caveat | M62 fire-kind split (small, measured leak) · M114/M46 ranges (94% in held-out years, 86–88% forward vs 90% nominal) · M58 pre-registration (one rule changed after seeing results; sensitivity shown) · M24 coverage 72% |
| ❌ Not done | M95 real-user test (needs a firefighter or volunteer) · M41 triangulation with EFFIS/NIFC (not engine-specific; data feeds exist) |

**The most important finding:** on years the engine never saw (2022–2025), the physical factors beat history **only in the wet tropics**. Elsewhere the forecast skill comes from the recent level (trend), not from weather or ocean (section M58).

## Code checks

| Method | What was run | Result |
|---|---|---|
| **M19** known answers | Synthetic fire records with a planted cause (soil dryness, fuel, El Niño, or nothing), 3 random worlds each. Expected answers written in the test file before the first run | 12 of 12: the planted cause gets the largest weight; "nothing" gets no weight above 0.10. Signs correct (wetter soil → less fire; more rain last year → more fire) |
| **M20** properties (Hypothesis) | Shapley weights add up to the model's skill (15 random cases × 4 leads); time shifts exact (200 cases); seasons contiguous and never overlapping (200); outlook ranges and probabilities consistent | All pass |
| **M62** leakage, code | Overwrite every weather and ocean value from the issue month onward with noise (40 random cases × 3 climate zones): the forecast inputs must not change | Pass. The Aqua outage month (Aug 2020) is excluded from training ("no data is not zero") |
| **M32** hard limits | On the committed results: skill ≤ 1, finite weights, probabilities in [0, 1], below + above ≤ 1, range contains the forecast, targets after the issue date | Pass |
| **M125** control totals | Fire cell-days recounted with pandas from NASA's CSVs, independent of the DuckDB pipeline: Bulgaria, Greece, Portugal, Guatemala, every year | Exact match |
| **M101** audit sample | 20 random tile-months recounted independently | Exact match |
| **M57** mutation testing | 5 planted bugs: future data leak, wrong Shapley weight, outage month as zero, flipped fit sign, seasons not wrapping New Year | 4 of 5 caught at first. The fifth (season wrap) survived → test added → now caught |
| **M24** coverage | pytest-cov | `engine.py` 83%, `forecast.py` 50% (hindcast and forward tests run only in the full pipeline). 72% overall |
| **M131** trace audit | Full test log with counts: [`pytest_log.txt`](pytest_log.txt) | 26 passed, 0 skipped, 0 failed |

## Science checks

### M21: differential tests (does it depend on one satellite?)

**VIIRS vs MODIS anomalies** ([`m21_viirs_anomalies.csv`](m21_viirs_anomalies.csv)):
- **Why it matters:** the engine learns from Aqua MODIS anomalies (this year vs the same place's normal) and claims they carry over to VIIRS, because a constant sensor factor cancels out of an anomaly.
- **Test:** 76 units in 9 countries, monthly fire-season anomalies 2012–2021, each sensor against its own normal.
- **Result:** median correlation **0.91**; 93% of units above 0.7. The claim holds.
- **But the median slope is 0.79, not 1.** VIIRS swings are about 20% smaller than MODIS swings in log terms: in big fire years MODIS sees a larger share of the fire. **Fix applied:** the outlook gives factors at VIIRS level, `factor_viirs = factor^0.79`. Probabilities are unchanged, because the terciles move with the anomalies.

**Terra vs Aqua** ([`m21_terra.csv`](m21_terra.csv)):
- **Test:** refit every gated model (322 units) on Terra, the morning satellite, 2003–2019.
- **Result:** the main factor keeps its direction in **98%** of units (dryness 99%, fuel 97%, ocean 100%, trend 95%). The model still beats history on Terra's held-out years in **87%** of units.
- **Caveat:** both satellites see the same fires, three hours apart. This proves robustness to the instrument and overpass time, not an independent fire record.

### M38: reference directions (NOAA/IRI typical El Niño effects)

Reference: the ENSO dashboard's list of typical El Niño effects (from NOAA and IRI impact maps), fixed before looking. Engine units inside each region's ellipse, in seasons that overlap the region's months, issued at the start of the month:

| Region | Expected fire | Units | Agree |
|---|---|---|---|
| Indonesia and the Philippines | More | 38 | 97% |
| Eastern Australia | More | 23 | 78% |
| Northern Australia | Less | 4 | **25%** |
| Northern South America and the Amazon | More | 13 | 100% |
| Central America and the Caribbean | More | 21 | 86% |
| Southern US and northern Mexico | Less | 18 | 100% |
| Southeastern South America | Less | 3 | 67% |
| **All** | | **120** | **89%** (chance: 50%) |

Northern Australia disagrees; with 4 units it may be noise, or the engine's direction may be wrong there. Script: `engine/verify/m38_enso_direction.py`.

### M62: leakage in the fire-kind split

- **The leak:** the recurrent/episodic split uses all training years, including each held-out year.
- **Test:** rebuild the split from 2003–2011 only (≥ 5 of 9 years, the same share as 10 of 19).
- **Result:** **91.7%** of 6.0 million later cell-days keep their kind. The leak is small, and the forward test (2022–2025) is not affected by it at all. Script: `engine/verify/m62_class_leak.py`.

### M112: calibration (units with a gated factor, held-out years)

| Forecast "above normal" | 12% | 27% | 41% | 58% | 79% |
|---|---|---|---|---|---|
| Observed, issued at start of month | 12% | 25% | 41% | 58% | **71%** |
| Observed, 3 months ahead | 12% | 26% | 43% | 58% | **67%** |

Well calibrated up to about 60%; **overconfident at the top**. The app should cap displayed chances at about 70%, or say "likely" rather than a number above that.

### M123: multiple testing

- **Test:** the whole engine rerun 3 times with the years of weather and ocean data shuffled.
- **Rule:** a factor is used only if it beats the 95th percentile of the shuffled weights, so about 5% of units pass by chance.
- **Result:** real pass rates are 12–33% for dryness, 15–19% for ocean and 15–16% for fuel.
- **The trend can't be tested this way** (the shuffle doesn't move calendar years), so it has a fixed bar of +0.05 skill.

### M44: hold-out and forward tests

| Test | Issued at start of month | 1 month ahead | 3 months ahead |
|---|---|---|---|
| Held-out years 2003–2021, Brier skill vs history (gated units) | 0.134 | 0.125 | 0.122 |
| **Forward 2022–2025**, gates and fit from 2003–2021 only | **+10.6%** | **+9.2%** | **+8.3%** |
| Forward, correlation of forecast and outcome | 0.40 | 0.38 | 0.36 |

- **The held-out numbers flatter the engine:** the gates were chosen on those same years. The forward test is the honest one.
- **Forward by year:** 2022 +12%, 2023 +5%, 2024 +9%, 2025 +13%.
- **Caveat:** Aqua's orbit drifted after 2021, which shifts the engine and the history baseline alike.

### M124: slices of the forward test ([`m124_slices.csv`](m124_slices.csv))

| Slice | Brier skill vs history |
|---|---|
| Tropics / subtropics / mid-high latitudes | +15% / +1% / +7% |
| Humid / sub-humid / semi-arid / arid | +29% / +12% / 0% / +5% |
| Episodic / recurrent fire | +9% / +11% |
| Unit size < 300 / 300–1k / 1k–5k / > 5k cell-days a year | +16% / +10% / +7% / **−6%** |

**Weak spots:** the largest fire units (worse than history) and semi-arid units (no gain). Months: best in Nov–Jan (+13% to +21%), weakest in May–Jul (+2% to +4%).

### M58: pre-registration, and what the skill is made of

**Disclosed changes made after seeing results:**
1. The trend gate became a fixed bar (+0.05), because the shuffled null can't test it.
2. The forward test now freezes the trend at 2021, the same rule as the live outlook. This raised forward skill slightly, from 10.1 / 8.5 / 7.6% to 10.6 / 9.2 / 8.3%.

**Sensitivity:** the same forward test with the trend never allowed (physical factors only):

| Forward 2022–2025, physical factors only | Start of month | 1 month | 3 months |
|---|---|---|---|
| All units | +4.9% | +3.2% | +0.8% |
| Wet tropics (> 1000 mm, \|lat\| < 23.5°) | **+16.1%** | **+15.0%** | **+4.3%** |
| Drier tropics | +1.2% | −5.9% | −5.3% |
| Outside the tropics, drier | +0.1% | −1.0% | +1.3% |
| Outside the tropics, wetter | −4.6% | −4.3% | −6.2% |
| Units using the ocean factor | +12.8% | +5.8% | +1.2% |

**Reading:** about half of the forward skill is the recent level (the trend, frozen at 2021): "this place burns more or less than it used to". The physical factors add real skill on unseen years **in the wet tropics only**. Outside the tropics they passed the held-out and null tests but did not carry over to 2022–2025.

**What the outlook does about it:** every outlook row has an `evidence` label:
- **confirmed on unseen years (wet tropics);**
- **held-out years only;**
- **recent level only (trend).**

No rows were removed, so the forward test was not used to select forecasts.

### M45 + M127: time-stamped forecast

[`../outlook_2026-11-15.csv`](../outlook_2026-11-15.csv), issued 15 Nov 2026 with data to October 2026. SHA-256 at commit time: `43f3bd6710a76741e262725299fd822d7923537b04e1eaef7349b88bed36266e`. Score it against FIRMS after February 2027.

## Not done, and why

- **M95 real-user test:** needs a firefighter or volunteer; ask before the pitch.
- **M41 triangulation:** EFFIS and NIFC compare burned area with hot spots, which belongs to the harmonized record rather than the engine. The data feeds are already verified in the spec.
- **Expected answers by a different person:** the known-answer expectations were written before the first run, but by the same AI agent that wrote the engine. A teammate should read `engine/tests/test_engine.py` and confirm them.
