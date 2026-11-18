# Key metrics

Updated 18 Nov 2026.

## Product: is the forecast good?

| Metric | Value now | Source |
|---|---|---|
| Share of new fires in the top 5 squares per region (2026 test) | 21.4% world, 57.9% Europe; NASA index 11.5% and 43.6% | `web/public/data/risk/scorecard.json` `[V]` |
| Alarm precision: share of the top 1,000 spots a day with a new fire | 7.04% (v2: 6.27%) | [`v3-test-report.md`](../../specs/plan-3-model-inputs/v3-test-report.md) `[V]` |
| Brier score (lower is better) | 0.005772 (v2: 0.005790) | same `[V]` |
| Live daily log, 14–17 Nov | 620 of 3,219 new fires caught (19.3%); NASA index 406 (12.6%) | scorecard `daily_log` `[V]` |
| **PR-AUC** (average precision; what FireSight reports) | **Not computed.** Estimate about 4% against a base rate of 0.59% (about 7× the index) `[U]` | see below |

**How to compute PR-AUC:** run [`../../pipeline/risk/prauc_2026.py`](../../pipeline/risk/prauc_2026.py) on the machine that holds `data/derived/risk/v3/` (git-ignored; it isn't on every computer):

```bash
python pipeline/risk/prauc_2026.py data/derived/risk
```

It prints PR-AUC and ROC-AUC for v3, v2, the NASA index and history, worldwide and in Europe. It uses the same rows and the same "new fire" label as `v3_test.py`.

## Business: is anyone paying?

None measured yet. In order:
1. buyer interviews held (target 20);
2. paid pilots (target 3);
3. annual recurring revenue;
4. how many customers renew.
