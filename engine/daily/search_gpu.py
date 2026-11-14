"""Hyperparameter search for the daily fire model, for a rented GPU (runs on CPU too).

Protocol (no peeking at the test years):
  1. Train each candidate on 2013-2020, score it on 2021 only (precision-recall AUC).
  2. Write the best settings to best_config.json.
  3. Then run once:  CONFIG_JSON=best_config.json python3 train_eval.py 1 forecast
     which trains on 2013-2020 and scores 2022-2025 a single time.
usage: python3 search_gpu.py N_TRIALS [LEAD]
On an RTX 4090 a trial takes seconds, so 200 trials fit in well under an hour.
"""
import json
import pickle
import shutil
import sys
import numpy as np
import xgboost as xgb
import features as ft

N = int(sys.argv[1]) if len(sys.argv) > 1 else 20
LEAD = int(sys.argv[2]) if len(sys.argv) > 2 else 1
rng = np.random.default_rng(0)
b = pickle.load(open("builder.pkl", "rb"))
C = len(b.cells)
Y = ft.DAYS.year.to_numpy()
usable = ~b.gap & (np.arange(ft.D) >= 365 + LEAD)


def sample(y0, y1, neg_per_pos=10):
    days = np.where(usable & (Y >= y0) & (Y <= y1))[0]
    Fd = b.F[days]
    pd_, pc = np.nonzero(Fd)
    k = neg_per_pos * len(pd_)
    nd, nc = rng.integers(0, len(days), 3 * k), rng.integers(0, C, 3 * k)
    keep = Fd[nd, nc] == 0
    nd, nc = nd[keep][:k], nc[keep][:k]
    X = b.X(np.r_[days[pd_], days[nd]], np.r_[pc, nc], LEAD, True)
    return xgb.DMatrix(X, label=np.r_[np.ones(len(pd_)), np.zeros(len(nd))])


dtr, dva = sample(2013, 2020), sample(2021, 2021)
device = "cuda" if shutil.which("nvidia-smi") else "cpu"
best = None
for t in range(N):
    cfg = {"max_depth": int(rng.integers(3, 11)), "learning_rate": float(10 ** rng.uniform(-2.3, -0.8)),
           "min_child_weight": float(10 ** rng.uniform(0, 2.7)), "subsample": float(rng.uniform(0.5, 1)),
           "colsample_bytree": float(rng.uniform(0.4, 1)), "reg_lambda": float(10 ** rng.uniform(-1, 1.5)),
           "gamma": float(rng.choice([0, 0.1, 1, 5]))}
    params = {"objective": "binary:logistic", "eval_metric": "aucpr", "tree_method": "hist", "device": device, **cfg}
    m = xgb.train(params, dtr, 4000, evals=[(dva, "val")], early_stopping_rounds=150, verbose_eval=False)
    score = m.best_score
    print(f"trial {t:3d}  val AUC-PR {score:.4f}  trees {m.best_iteration + 1:4d}  {cfg}", flush=True)
    if best is None or score > best[0]:
        best = (score, cfg)
json.dump({"val_aucpr_2021": best[0], "device": device, "trials": N, **best[1]}, open("best_config.json", "w"), indent=1)
print("best:", best)
