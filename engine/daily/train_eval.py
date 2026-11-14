"""Train the 1-3 day fire model and score it the way the firefighter asked.

Split fixed in advance: train 2013-2020, early stopping on 2021, test 2022-2025.
Model: XGBoost (runs on CPU here; device='cuda' on a rented GPU).

Firefighter's target:
  A. Each municipal station covers ONE high-risk spot per day. For every
     municipality-day with a fire, did the flagged 5 km cell (or its 3x3, ~15 km,
     neighbourhood) contain the fire? All fires and large fires (>= 4 detections).
  B. Reinforcements: which municipalities are most likely to burn (AUC; share of
     fire municipality-days caught by the top 10% of municipalities each day).
Baselines: random spot (exact expectation), usual hot spot for the month, last
week's fires, highest fire-weather index (FWI) with the usual hot spot as tie-break.
usage: python3 train_eval.py LEAD forecast|noforecast
"""
import json
import pickle
import sys
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import roc_auc_score
import features as ft

LEAD = int(sys.argv[1])
FORECAST = sys.argv[2] == "forecast"
import os as _os
# LIVE=1: only features available without a FIRMS key (last 7 days of fire history)
DROP = ["hist_cell30", "hist_cell365", "hist_nbr30"] if _os.environ.get("LIVE") else []
rng = np.random.default_rng(42)
b = pickle.load(open("builder.pkl", "rb"))
C = len(b.cells)
Y = ft.DAYS.year.to_numpy()
usable = ~b.gap & (np.arange(ft.D) >= 365 + LEAD)


def days_in(y0, y1):
    return np.where(usable & (Y >= y0) & (Y <= y1))[0]


def sample(days, neg_per_pos=10):
    """All fire cell-days plus random non-fire cell-days, weighted to stay calibrated."""
    Fd = b.F[days]
    pd_, pc = np.nonzero(Fd)
    n_neg_total = Fd.size - len(pd_)
    k = min(neg_per_pos * len(pd_), n_neg_total)
    nd = rng.integers(0, len(days), 3 * k)
    nc = rng.integers(0, C, 3 * k)
    keep = Fd[nd, nc] == 0
    nd, nc = nd[keep][:k], nc[keep][:k]
    d = np.r_[days[pd_], days[nd]]
    c = np.r_[pc, nc]
    y = np.r_[np.ones(len(pd_)), np.zeros(len(nd))]
    rate = len(nd) / n_neg_total                     # share of negatives kept
    return b.X(d, c, LEAD, FORECAST).drop(columns=DROP), y, rate


Xtr, ytr, rate = sample(days_in(2013, 2020))
Xva, yva, _ = sample(days_in(2021, 2021))
import shutil
import os
CONFIGS = {"a": dict(max_depth=6, learning_rate=0.05, min_child_weight=5),
           "b": dict(max_depth=4, learning_rate=0.02, min_child_weight=50),
           "c": dict(max_depth=3, learning_rate=0.03, min_child_weight=200, reg_lambda=10)}
cfg = CONFIGS[os.environ.get("CONFIG", "a")]   # best on 2021 validation
if os.environ.get("CONFIG_JSON"):                 # settings found by search_gpu.py (2021 only)
    cfg = {k: v for k, v in json.load(open(os.environ["CONFIG_JSON"])).items()
           if k not in ("val_aucpr_2021", "device", "trials")}
params = dict(objective="binary:logistic", eval_metric="aucpr", **cfg,
              subsample=0.8, colsample_bytree=0.8, tree_method="hist", nthread=2,
              device="cuda" if shutil.which("nvidia-smi") else "cpu")
dtr = xgb.DMatrix(Xtr, label=ytr)
dva = xgb.DMatrix(Xva, label=yva)
model = xgb.train(params, dtr, 3000, evals=[(dva, "val")], early_stopping_rounds=150, verbose_eval=False)
if os.environ.get("VAL_ONLY"):                          # model choice uses 2021 only
    print(json.dumps({"config": os.environ.get("CONFIG", "b"), "val_aucpr": model.best_score,
                      "trees": model.best_iteration + 1}))
    sys.exit(0)
tag = f"L{LEAD}_{'fc' if FORECAST else 'nofc'}" + ("_live" if DROP else "")
model.save_model(f"model_{tag}.json")
imp = model.get_score(importance_type="total_gain")

# ---------------------------------------------------------- test 2022-2025 ----
test_days = days_in(2022, 2025)
mk = b.cells.muni_k.to_numpy()
M = mk.max() + 1
ga, gb_ = b.cells.ga.to_numpy(), b.cells.gb.to_numpy()
lookup = {(a, g): i for i, (a, g) in enumerate(zip(ga, gb_))}
nbr = [[lookup.get((ga[i] + da, gb_[i] + db)) for da in (-1, 0, 1) for db in (-1, 0, 1)] for i in range(C)]
nbr = [[j for j in n if j is not None] for n in nbr]
cells_of = [np.where(mk == m)[0] for m in range(M)]
large = b.N >= 4

rows, muni_rows = [], []
for chunk in np.array_split(test_days, 16):
    d = np.repeat(chunk, C)
    c = np.tile(np.arange(C), len(chunk))
    X = b.X(d, c, LEAD, FORECAST)
    ps = model.predict(xgb.DMatrix(X.drop(columns=DROP))).reshape(len(chunk), C)
    p = ps * rate / (ps * rate + (1 - ps))             # undo the negative subsampling
    fwi = X["wx_FWI"].to_numpy().reshape(len(chunk), C) if FORECAST else X["dry_FWI"].to_numpy().reshape(len(chunk), C)
    h7 = X["hist_cell7"].to_numpy().reshape(len(chunk), C)
    cm = X["clim_month"].to_numpy().reshape(len(chunk), C)
    for i, day in enumerate(chunk):
        fire, big = b.F[day].astype(bool), large[day]
        risk_m = np.zeros(M)
        for m in range(M):
            cs = cells_of[m]
            risk_m[m] = 1 - np.prod(1 - p[i, cs])
            if not fire[cs].any():
                continue
            fire_m = set(cs[fire[cs]])
            big_m = set(cs[big[cs]])

            def hit(cell, targets):
                return (cell in targets), any(j in targets for j in nbr[cell])
            picks = {"model": cs[np.argmax(p[i, cs])],
                     "usual_hot_spot": cs[np.argmax(cm[i, cs] + 1e-6 * b.clim_all[cs])],
                     "last_week": cs[np.argmax(h7[i, cs] + 1e-3 * cm[i, cs])],
                     "fire_weather_index": cs[np.argmax(fwi[i, cs] + 1e-3 * cm[i, cs])]}
            r = {"day": day, "muni": m, "n_cells": len(cs), "large": bool(big_m)}
            # capture vs budget: top-k spots per municipality (k = 1..5), within 15 km
            order = {"model": cs[np.argsort(-p[i, cs])], "last_week": cs[np.argsort(-(h7[i, cs] + 1e-3 * cm[i, cs]))],
                     "usual_hot_spot": cs[np.argsort(-(cm[i, cs] + 1e-6 * b.clim_all[cs]))]}
            for kk in (1, 2, 3, 5):                      # random k spots: expectation by simulation
                hits = hits_l = 0
                for _ in range(200):
                    o = rng.choice(cs, min(kk, len(cs)), replace=False)
                    cov = set(j for cc in o for j in nbr[cc])
                    hits += bool(fire_m & cov); hits_l += bool(big_m & cov)
                r[f"random_top{kk}_15km"] = hits / 200
                if big_m:
                    r[f"random_top{kk}_15km_large"] = hits_l / 200
            for name, o in order.items():
                for kk in (1, 2, 3, 5):
                    cov = set(j for cc in o[:kk] for j in nbr[cc])
                    r[f"{name}_top{kk}_15km"] = bool(fire_m & cov)
                    if big_m:
                        r[f"{name}_top{kk}_15km_large"] = bool(big_m & cov)
            for name, cell in picks.items():
                r[f"{name}_cell"], r[f"{name}_15km"] = hit(cell, fire_m)
                if big_m:
                    r[f"{name}_cell_large"], r[f"{name}_15km_large"] = hit(cell, big_m)
            # random spot: exact expectation over all cells of the municipality
            r["random_cell"] = len(fire_m) / len(cs)
            r["random_15km"] = np.mean([any(j in fire_m for j in nbr[cc]) for cc in cs])
            if big_m:
                r["random_cell_large"] = len(big_m) / len(cs)
                r["random_15km_large"] = np.mean([any(j in big_m for j in nbr[cc]) for cc in cs])
            rows.append(r)
        fire_mday = np.array([fire[cells_of[m]].any() for m in range(M)])
        big_mday = np.array([big[cells_of[m]].any() for m in range(M)])
        clim_m = np.array([cm[i, cells_of[m]].sum() for m in range(M)])
        fwi_m = np.array([fwi[i, cells_of[m]].mean() for m in range(M)])
        for m in range(M):
            muni_rows.append((day, m, fire_mday[m], big_mday[m], risk_m[m], clim_m[m], fwi_m[m]))

A = pd.DataFrame(rows)
B = pd.DataFrame(muni_rows, columns=["day", "muni", "fire", "large", "model", "usual", "fwi"])
A.to_parquet(f"evalA_{tag}.parquet")
B.to_parquet(f"evalB_{tag}.parquet")
res = {"lead_days": LEAD, "forecast_weather": FORECAST, "device": params["device"], "neg_sampling_rate": rate,
       "live_features_only": bool(DROP),
       "trees": model.best_iteration + 1, "muni_days_with_fire": len(A), "muni_days_with_large_fire": int(A.large.sum())}
for name in ["model", "usual_hot_spot", "last_week", "fire_weather_index", "random"]:
    res[name] = {k: round(float(A[f"{name}_{k}"].dropna().mean()), 3)
                 for k in ["cell", "15km", "cell_large", "15km_large"]}


def top_share(col, target, frac=0.10):
    """Share of fire municipality-days caught by the top 10% of municipalities each day."""
    caught = total = 0
    for _, g in B.groupby("day"):
        k = max(1, int(round(frac * len(g))))
        top = g.nlargest(k, col)
        caught += top[target].sum()
        total += g[target].sum()
    return caught / max(total, 1)


res["capture_vs_spots_per_municipality_15km"] = {
    name: {f"top{kk}": round(float(A[f"{name}_top{kk}_15km"].mean()), 3) for kk in (1, 2, 3, 5)} |
          {f"top{kk}_large": round(float(A[f"{name}_top{kk}_15km_large"].dropna().mean()), 3) for kk in (1, 2, 3, 5)}
    for name in ["model", "last_week", "usual_hot_spot", "random"]}


def national(col, target, n_teams):
    """With n teams nationwide sent to the n highest-risk municipalities each day,
    what share of the target fire municipality-days do they cover?"""
    caught = total = 0
    for _, g in B.groupby("day"):
        caught += g.nlargest(n_teams, col)[target].sum()
        total += g[target].sum()
    return round(caught / max(total, 1), 3)


B["random"] = rng.random(len(B))
res["national_teams"] = {name: {f"{n}_teams_{t}": national(col, t, n) for n in (10, 28, 50) for t in ("fire", "large")}
                         for name, col in [("model", "model"), ("usual_hot_spot", "usual"),
                                           ("fire_weather_index", "fwi"), ("random", "random")]}
res["reinforcement_ranking"] = {
    name: {"auc_any": round(roc_auc_score(B.fire, B[col]), 3),
           "auc_large": round(roc_auc_score(B.large, B[col]), 3),
           "top10pct_catch_any": round(top_share(col, "fire"), 3),
           "top10pct_catch_large": round(top_share(col, "large"), 3)}
    for name, col in [("model", "model"), ("usual_hot_spot", "usual"), ("fire_weather_index", "fwi")]}
res["top_features"] = dict(sorted(imp.items(), key=lambda x: -x[1])[:12])
json.dump(res, open(f"result_{tag}.json", "w"), indent=1, default=float)
print(json.dumps({k: v for k, v in res.items() if k != "top_features"}, indent=1, default=float))
