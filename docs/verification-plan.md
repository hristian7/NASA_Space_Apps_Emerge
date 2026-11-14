# Verification plan: how we prove the app is right

**Principle:** never let the AI be its own oracle. Every result is checked against something outside our code: real measurements, an independent sensor, or published numbers.
**Expected answers are written before the code that should produce them,** by a different person or agent.

The methods come from an open catalogue of 137 verification methods (IDs like M44); the definitions below are self-contained.

| ID | Method | What it proves here | How |
|---|---|---|---|
| **M44** | Hold-out backtest | The MODIS-to-VIIRS conversion works on years it never saw | Fit on part of the overlap (for example 2012–2018 or 2012–2020), test on the rest (2019–2025 or 2021–2025). Report the error per year |
| **M114** | Bootstrap confidence interval | How much each converted number could be off | Re-sample the training data many times and show error bands on the calendar and charts |
| **M124** | Slice-by-slice evaluation | A good average doesn't hide a bad month, season or region | Report the back-test error separately for each month, each season and each area size |
| **M21** | Differential testing | The VIIRS record is continuous across satellites | Compare S-NPP and NOAA-20 over 2018–2025. Both are VIIRS, so the counts should agree closely |
| **M41** | Triangulation with an independent source | Our fire seasons match an outside record | Compare with EFFIS burned-area seasons for Bulgaria (to be checked) |
| **M38** | Measured reference data | Our ratios are plausible | Compare with the published ranges in `firms-data.md` (for example 4.8–6.5× in Punjab) |

## What "good enough" could mean

This is a team decision: see `specs/interview-questions.md`, section F.

**Candidates** `[U]`:
- monthly back-test error (MAPE, the average percentage error) below a set threshold for areas with enough fires;
- error bands shown for every converted value;
- a validation page in the app that shows all of the above openly.

## Known limits to state honestly

- **Pre-2012 values can't be checked directly.** Only MODIS existed before 2012, so they are converted estimates.
- **Small areas and quiet months will be noisy** (counts of 0–5 fires).
- **Static industrial hot spots** (`type = 2`) must be filtered out, or they inflate counts.

## Methods selected from the 137 (MoSCoW), added 14 Nov

The team asked for every relevant method, prioritised so we can still build in time. Effort is our estimate `[U]`.

| Priority | ID | Method | What it checks in Emerge | Effort |
|---|---|---|---|---|
| **Must** | M44 | Hold-out backtest | The conversion predicts test years it never saw | M |
| **Must** | M21 | Differential testing | S-NPP and NOAA-20 agree, so the VIIRS record is continuous | S |
| **Must** | M38 | Measured reference data | Our sensor ratios fall in the published ranges | S |
| **Must** | M19 | Example tests with known answers | Unit tests on the hot paths, with expected answers written first | M |
| **Must** | M32 | Hard limits | Counts ≥ 0, coordinates valid, FRP ≥ 0, no future dates | S |
| **Must** | M125 | Reconciliation and control totals | Daily totals add up to monthly totals, which add up to the filtered raw rows | S |
| **Must** | M131 | AI-agent trace audit | Tests the agents claim they ran really ran (check test counts, not just "passed") | S |
| **Should** | M114 | Bootstrap error bands | The error range on every converted number | S |
| **Should** | M124 | Slice-by-slice evaluation | No bad month, season, country or area size hidden in the average | S |
| **Should** | M58 | Pre-registration | Method and test years fixed (committed) before we look at the test results | S |
| **Should** | M62 | Leakage audit | No future data sneaks into training or the "chance of fire" | S |
| **Should** | M112 | Calibration check | "30% chance" really happens about 30% of the time (for the risk outlook) | S |
| **Should** | M20 | Property-based testing | Area selection, conversion and aggregation hold for thousands of random inputs | M |
| **Should** | M101 | Audit sampling | Hand-check a random sample of our hot spots against NASA's own FIRMS map | S |
| **Should** | M95 | Real-user validation | A firefighter or volunteer tries it and gives feedback before the pitch | S |
| **Could** | M41 | Triangulation | Compare with EFFIS (Bulgaria) or US fire records | M |
| **Could** | M46 | Conformal prediction | Guaranteed-coverage ranges for the "certainty level" | M |
| **Could** | M45 + M127 | Time-stamped forecast | Publish and timestamp the outlook before the outcome is known | S |
| **Could** | M123 | Multiple-testing correction | "Unusual" flags across many areas aren't just chance | S |
| **Could** | M57 | Mutation testing | Our tests actually catch bugs | M |
| **Could** | M24 | Coverage measurement | Which code the tests never run | S |
| **Won't** | M01, M11 and other proof methods | Formal proofs | Too slow for a weekend |
| **Never** | M74–M78, M130 | "Not a check" methods (AI self-review, model confidence, debate) | They don't prove anything |
