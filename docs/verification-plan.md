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
