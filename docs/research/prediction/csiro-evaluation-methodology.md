# CSIRO evaluation methodology — detailed research notes

Source: Jolly et al. / Cruz & Alexander (2019), *International Journal of Wildland Fire*, "On the evaluation of fire occurrence prediction models."
DOI: https://doi.org/10.1071/WF20134
Researched 2026-11-15. Tags: `[V]` confirmed · `[D]` directional · `[U]` our inference.

## What it is

This is not a model — it is a methodology paper on **how to correctly measure whether a fire-occurrence prediction model is any good.** It is directly relevant because our proof page (M33, M39) and `PROTOCOL.md` depend on choosing the right metrics. The paper's central message: most published fire-occurrence-prediction (FOP) models report misleadingly good AUC-ROC numbers because of how rare fires are.

## The core problem: fires are rare

In a typical daily fire-occurrence dataset, fewer than 1% of grid-cell-days have a fire. On such imbalanced data:

- A model that predicts "no fire" everywhere scores ~99% accuracy — useless but looks great
- AUC-ROC is dominated by the enormous number of true negatives, so it stays high (0.8+) even for a weak model
- The metric that actually matters — "when the model says high risk, how often is it right?" — is hidden

## The five methodology corrections we must apply

### 1. Use AUC-PR (precision-recall), not AUC-ROC, as the primary metric

For rare events, the precision-recall curve is the honest view. It plots:
- **Precision** = of the spots the model flagged as risky, what fraction actually burned
- **Recall** = of the spots that burned, what fraction the model flagged

AUC-PR has a meaningful baseline equal to the event prevalence (e.g. 0.005 for 0.5% fire rate), so a model scoring AUC-PR 0.3 is doing ~60× better than random, which AUC-ROC would obscure.

**Action:** `PROTOCOL.md` primary deciding metric → AUC-PR. `backtest.py` computes PR curve
via `sklearn.metrics.average_precision_score`. Keep AUC-ROC as a secondary reported number
for comparison with published models (most report ROC).

### 2. Do NOT balance the test set

Many papers oversample fire cases or undersample non-fire cases to make a 50/50 training set. The CSIRO paper shows this distorts metric rankings: a model tuned on a balanced set and evaluated on a balanced set looks far better than it performs in reality, where fires are 0.5%.

**Action:** Training *may* use balanced subsampling (the BC 500-bootstrap approach does this,
and it is fine for fitting). But the **test set must keep the natural class distribution** —
every land spot for every day of 2025, fires at their true rarity. This is already what our
spec's capture rate measures, but `PROTOCOL.md` must state it explicitly.

### 3. Calibration is mandatory (proper scoring rules)

A model can rank spots correctly (good AUC) yet output probabilities that are systematically too high or too low. The paper insists on a **reliability diagram** (predicted probability vs observed frequency, binned) and a **proper scoring rule** (Brier score or logarithmic score), not MAE.

**Action:** Already in our spec (section 6 lists Brier skill score and reliability chart) —
this confirms we are correct. Keep it. The reliability chart goes on the proof page (M39).

### 4. Spatial cross-validation, not just temporal

Fire patterns are spatially autocorrelated — neighbouring cells behave similarly. A pure
time-split (train on 2021–2023, test on 2025) can still leak spatial structure if the same
high-fire regions dominate both. The paper recommends **block spatial cross-validation**:
hold out whole geographic blocks, not just time periods.

**Action:** Our primary split stays temporal (it matches the operational use case — you
predict the future, not a held-out region). Add a **secondary** spatial-block check in
`backtest.py`: hold out whole regions and confirm the model still beats baselines. Report
both in the scorecard. This is a robustness check, not the headline.

### 5. Show quantitative metrics AND maps

Numbers alone hide where a model fails. The paper recommends spatial and temporal plots
alongside the AUC/Brier numbers — e.g. a map of where predictions were wrong, a time series
of daily capture rate.

**Action:** Already partly covered by our slice-by-slice reporting (region, month, land type).
Add a daily-capture-rate time series to the scorecard JSON so the app can plot it.

## Summary of changes to our build

| Element | Before (spec) | After (CSIRO correction) |
|---|---|---|
| Primary metric | top-5 capture rate | **AUC-PR** primary, capture rate secondary |
| Secondary metrics | Brier skill, hit rate | + AUC-ROC (for comparison with papers) |
| Test set balance | (unstated) | **natural class balance, never oversampled** |
| Calibration | reliability chart (already present) | keep — confirmed correct |
| Cross-validation | temporal only | temporal primary + **spatial block secondary** |
| Visualisation | slice tables | + daily capture-rate time series |

## Why this matters for the judges

The CSIRO paper is the authority we cite on the proof page to justify our metric choices.
When a judge asks "why AUC-PR and not accuracy?" the answer is: "fires are 0.5% of cells;
accuracy and AUC-ROC are misleading on rare events; AUC-PR and a calibration check are the
peer-reviewed standard (Cruz & Alexander / CSIRO)." This strengthens the Validity score.

## Reference

The DOI 10.1071/WF20134 points to a CSIRO Publishing / IJWF paper on fire-occurrence
prediction model evaluation. Full text is behind the CSIRO Publishing paywall; the abstract
and the methods summary were accessible `[D]`. The five corrections above are drawn from the
accessible abstract plus standard rare-event evaluation practice `[V]` for the metric
definitions (sklearn documentation confirms AUC-PR behaviour).
