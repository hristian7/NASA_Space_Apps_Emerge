"""PR-AUC (average precision) and ROC-AUC on the frozen v3 2026 test spot-days.

Same rows and label as v3_test.probability_checks: forest + shrub_grass, rank_fwi and
rank_hist_p not null, v2 and v3 p not null; y = (label == 'new').
Europe = scorecard box from backtest.py: lon -25..45, lat 34..72.
Usage: python pipeline/risk/prauc_2026.py data/derived/risk
Not yet run (18 Nov 2026): the evaluation data is git-ignored and lives only on the machine that ran v3_test.py.
Scores are used as given (higher fwi and hist_p mean higher risk, as in v3_select.py).
"""
import sys
from pathlib import Path
import duckdb, numpy as np
from sklearn.metrics import average_precision_score as ap, roc_auc_score as auc

data = Path(sys.argv[1]); v3 = data / 'v3'
con = duckdb.connect(); con.execute("SET memory_limit='8GB'")
df = con.execute("""
    SELECT (e.label='new')::TINYINT y, b.p p3, a.p p2, e.rank_fwi fwi, e.rank_hist_p hist,
           (g.lon BETWEEN -25 AND 45 AND g.lat BETWEEN 34 AND 72) europe
    FROM read_parquet(?) e
    JOIN read_parquet(?) a ON a.spot_id=e.spot_id AND a.day=e.day
    JOIN read_parquet(?) b ON b.spot_id=e.spot_id AND b.day=e.day
    JOIN read_parquet(?) g ON g.spot_id=e.spot_id
    WHERE e.fuel_class IN ('forest','shrub_grass') AND e.rank_fwi IS NOT NULL AND e.rank_hist_p IS NOT NULL
      AND a.p IS NOT NULL AND b.p IS NOT NULL""",
    [str(v3 / 'evalall_2026' / '*.parquet'), str(v3 / 'predictions_2026_v2.parquet'),
     str(v3 / 'predictions_2026_v3.parquet'), str(data / 'grid_0.25.parquet')]).fetchnumpy()
print('rows', len(df['y']), 'new fires', int(df['y'].sum()), '(expect 35,652,103 / 211,260)')
print('scope | rows | fires | prevalence | AP v3 | AP v2 | AP FWI | AP hist | v3/FWI | ROC v3 | ROC v2 | ROC FWI | ROC hist')
for name, m in (('world', np.ones(len(df['y']), bool)), ('europe_box', df['europe'].astype(bool))):
    y = df['y'][m]
    s = {k: np.asarray(df[k][m], np.float64) for k in ('p3', 'p2', 'fwi', 'hist')}
    a = {k: ap(y, v) for k, v in s.items()}; r = {k: auc(y, v) for k, v in s.items()}
    print(f"{name} | {m.sum():,} | {int(y.sum()):,} | {y.mean():.4%} | {a['p3']:.4f} | {a['p2']:.4f} | {a['fwi']:.4f} | "
          f"{a['hist']:.4f} | {a['p3']/a['fwi']:.1f}x | {r['p3']:.4f} | {r['p2']:.4f} | {r['fwi']:.4f} | {r['hist']:.4f}")
