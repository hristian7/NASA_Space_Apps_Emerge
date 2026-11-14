"""Train and score version 2 (GEOS-5 weather + land cover + terrain + history).

usage: python3 train2.py LEAD LABEL MODEL [DROP_GROUP]
  LEAD   1, 2 or 3 (days ahead)
  LABEL  new  (team protocol: new fires only)  |  all  (every fire cell-day)
  MODEL  xgb  (gradient-boosted trees, rounds chosen by early stopping on 2024)
         mlp  (neural network, exactly 10 epochs, as asked)
  DROP_GROUP  optional feature group to remove (measures that group's weight)

Split: train 2019-2023, validate 2024, test 2025 (scored once per configuration).
Writes res2_<tag>.json and pred2_<tag>.npz (test probabilities, for the scorecard).
"""
import json, os, pickle, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))     # engine/daily/v2
V1 = os.path.dirname(HERE)                             # engine/daily (version 1: grid, fire CSVs)
import numpy as np, pandas as pd
import features2 as f2
import score2

LEAD, LABEL, MODEL = int(sys.argv[1]), sys.argv[2], sys.argv[3]
DROPG = sys.argv[4] if len(sys.argv) > 4 else None
tag = f"L{LEAD}_{LABEL}_{MODEL}" + (f"_no_{DROPG}" if DROPG else "") + \
    (f"_ep{os.environ['EPOCHS']}" if os.environ.get("EPOCHS") else "")
rng = np.random.default_rng(0)
t0 = time.time()
b = pickle.load(open(f"{HERE}/builder2.pkl", "rb"))
C = len(b.cells)
if os.environ.get("NOLOYO"):
    b.loyo = False
    tag = tag + "_noloyo"
Y = f2.DAYS.year.to_numpy()
LAB = b.NEW if LABEL == "new" else (b.F == 1)
DROP = [c for g in DROPG.split("+") for c in f2.GROUPS[g]] if DROPG else []
# WX=power: replace the GEOS-5 weather model by the version-1 weather (NASA POWER, 0.5 deg
# points): dryness known at issue, plus the OBSERVED target-day weather (a perfect
# forecast, so this variant is an upper bound for POWER)
WX = os.environ.get("WX", "geos5")
if WX == "power":
    DROP = DROP + f2.GROUPS["weather_fc"] + f2.GROUPS["weather_now"] + ["fwi_x_tree", "ffmc_x_crop", "isi_x_grass_shrub"]
    sys.path.insert(0, V1)
    import features as v1
    b1 = pickle.load(open(f"{V1}/builder.pkl", "rb"))
    key1 = dict(zip(zip(b1.cells.ga, b1.cells.gb), b1.cells.p))
    P1 = np.array([key1[k] for k in zip(b.cells.ga, b.cells.gb)])
    _X = b.X

    def X_power(d, c, lead):
        X = _X(d, c, lead)
        p, t = P1[c], d - lead
        for v in ["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "VPD", "FFMC", "ISI", "FWI"]:
            X["pw_" + v] = b1.W[v][d, p]
        for v in ["DSR", "RAIN7", "RAIN30", "GWETTOP", "GWETROOT", "DC", "FWI"]:
            X["pwdry_" + v] = b1.W[v][t, p]
        X["fc_FWI"] = X["pw_FWI"]          # the FWI baseline uses the same weather
        return X
    b.X = X_power
    tag = tag + "_power"

# usable target days: label satellite up. Missing weather stays NaN (GFWED leaves the
# index undefined outside the fire season and over snow), exactly as it would live.
d_all = np.arange(f2.D)
usable = ~b.gap & (d_all >= 400)


def days_in(y0, y1):
    return np.where(usable & (Y >= y0) & (Y <= y1))[0]


def sample(days, neg_per_pos=10):
    L = LAB[days]
    pd_, pc = np.nonzero(L)
    pos_d, pos_c = days[pd_], pc
    n_neg = neg_per_pos * len(pos_d)
    nd = rng.choice(days, n_neg); nc = rng.integers(0, C, n_neg)
    keep = ~LAB[nd, nc]
    nd, nc = nd[keep], nc[keep]
    d = np.r_[pos_d, nd]; c = np.r_[pos_c, nc]
    y = np.r_[np.ones(len(pos_d)), np.zeros(len(nd))].astype(np.float32)
    rate = len(nd) / ((~LAB[days]).sum())                  # share of negatives kept
    X = b.X(d, c, LEAD).drop(columns=DROP)
    return X, y, rate


tr_days, va_days, te_days = days_in(*f2.TRAIN), days_in(*f2.VAL), days_in(*f2.TEST)
Xtr, ytr, rate = sample(tr_days)
Xva, yva, _ = sample(va_days)
feats = list(Xtr.columns)
print(tag, "train rows", len(ytr), "positives", int(ytr.sum()), "features", len(feats),
      f"{time.time()-t0:.0f}s", flush=True)
curve = []

if MODEL == "xgb":
    import xgboost as xgb
    import shutil
    dev = "cuda" if shutil.which("nvidia-smi") else "cpu"
    params = {"objective": "binary:logistic", "eval_metric": "aucpr", "max_depth": 6, "eta": 0.05,
              "min_child_weight": 5, "subsample": 0.8, "colsample_bytree": 0.8, "lambda": 1.0,
              "tree_method": "hist", "device": dev, "seed": 0, "nthread": 2}
    dtr, dva = xgb.DMatrix(Xtr, ytr), xgb.DMatrix(Xva, yva)
    ev = {}
    model = xgb.train(params, dtr, 2000, evals=[(dva, "val2024")], early_stopping_rounds=150,
                      evals_result=ev, verbose_eval=False)
    curve = [round(v, 4) for v in ev["val2024"]["aucpr"]]
    n_used = model.best_iteration + 1

    def predict(X):
        return model.predict(xgb.DMatrix(X[feats]), iteration_range=(0, n_used))
    imp = model.get_score(importance_type="gain")
    info = {"trees": n_used, "trees_tried": len(curve), "device": dev,
            "top_features": dict(sorted(imp.items(), key=lambda x: -x[1])[:15])}
    model.save_model(f"model2_{tag}.json")
    pickle.dump({"feats": feats, "rate": rate, "trees": n_used}, open(f"model2_{tag}.prep.pkl", "wb"))
else:
    import torch
    torch.manual_seed(0)
    torch.set_num_threads(2)
    LOG = [c for c in feats if c.startswith(("hist_", "days_since", "dist_", "fc_DC", "fc_DMC", "fc_BUI",
                                             "an_DC", "an_DMC", "fc_DSR", "elev_std"))]

    def prep(X):
        X = X[feats].copy()
        for c in LOG:
            X[c] = np.log1p(np.maximum(X[c], 0))
        return X
    P = prep(Xtr)
    med = P.median()
    mu, sd = P.fillna(med).mean(), P.fillna(med).std().replace(0, 1)

    def tensor(X):
        X = prep(X)
        miss = X.isna().any(axis=1).to_numpy()[:, None].astype(np.float32)
        Z = ((X.fillna(med) - mu) / sd).to_numpy(np.float32)
        return torch.from_numpy(np.hstack([Z, miss]))
    Ttr, Tva = tensor(Xtr), tensor(Xva)
    net = torch.nn.Sequential(
        torch.nn.Linear(Ttr.shape[1], 256), torch.nn.SiLU(), torch.nn.Dropout(0.2),
        torch.nn.Linear(256, 256), torch.nn.SiLU(), torch.nn.Dropout(0.2),
        torch.nn.Linear(256, 128), torch.nn.SiLU(), torch.nn.Linear(128, 1))
    EPOCHS, BS = int(os.environ.get("EPOCHS", 10)), 2048
    opt = torch.optim.AdamW(net.parameters(), lr=2e-3, weight_decay=1e-4)
    steps = EPOCHS * int(np.ceil(len(ytr) / BS))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=steps)
    ytr_t = torch.from_numpy(ytr)
    lossf = torch.nn.BCEWithLogitsLoss()
    from sklearn.metrics import average_precision_score
    for ep in range(EPOCHS):
        net.train()
        perm = torch.randperm(len(ytr))
        tot = 0.0
        for i in range(0, len(ytr), BS):
            idx = perm[i:i + BS]
            opt.zero_grad()
            loss = lossf(net(Ttr[idx]).squeeze(1), ytr_t[idx])
            loss.backward(); opt.step(); sched.step()
            tot += loss.item() * len(idx)
        net.eval()
        with torch.no_grad():
            pv = torch.sigmoid(net(Tva).squeeze(1)).numpy()
        ap = average_precision_score(yva, pv)
        curve.append({"epoch": ep + 1, "train_loss": round(tot / len(ytr), 4), "val2024_aucpr": round(ap, 4)})
        print(curve[-1], f"{time.time()-t0:.0f}s", flush=True)

    def predict(X):
        with torch.no_grad():
            out = []
            T = tensor(X)
            for i in range(0, len(T), 200000):
                out.append(torch.sigmoid(net(T[i:i + 200000]).squeeze(1)).numpy())
            return np.concatenate(out)
    info = {"epochs": EPOCHS, "batch": BS, "layers": [256, 256, 128]}
    torch.save(net.state_dict(), f"model2_{tag}.pt")
    pickle.dump({"feats": feats, "log": LOG, "med": med, "mu": mu, "sd": sd, "rate": rate,
                 "layers": [256, 256, 128], "n_in": Ttr.shape[1]}, open(f"model2_{tag}.prep.pkl", "wb"))


def full(days):
    """Corrected probabilities and the baselines for every cell on every day."""
    P = np.zeros((len(days), C), np.float32)
    base = {k: np.zeros((len(days), C), np.float32) for k in ("fwi", "history", "last_week")}
    for chunk in np.array_split(np.arange(len(days)), max(1, len(days) // 20)):
        d = np.repeat(days[chunk], C); c = np.tile(np.arange(C), len(chunk))
        X = b.X(d, c, LEAD)
        ps = predict(X.drop(columns=DROP)).reshape(len(chunk), C)
        P[chunk] = ps * rate / (ps * rate + 1 - ps)
        base["fwi"][chunk] = np.nan_to_num(X.fc_FWI.to_numpy(), nan=-1).reshape(len(chunk), C)
        base["history"][chunk] = (X.clim_month + 1e-3 * X.years_burned_month + 1e-6 * X.clim_all).to_numpy().reshape(len(chunk), C)
        base["last_week"][chunk] = (X.hist_nbr7 + 1e-3 * X.clim_month).to_numpy().reshape(len(chunk), C)
    return P, base


res = {"tag": tag, "lead_days": LEAD, "label": LABEL, "model": MODEL, "dropped_group": DROPG,
       "features": len(feats), "train_rows": int(len(ytr)), "train_positives": int(ytr.sum()),
       "neg_sampling_rate": rate, "validation_curve": curve} | info
for name, days in (("val2024", va_days), ("test2025", te_days)):
    P, base = full(days)
    res[name] = score2.score(b, days, P, base, LAB)
    np.savez_compressed(f"pred2_{tag}_{name}.npz", days=days, p=P.astype(np.float32))
json.dump(res, open(f"res2_{tag}.json", "w"), indent=1, default=float)
print(json.dumps({k: res[k] for k in ("val2024", "test2025")}, default=float)[:3000])
print("done", tag, f"{time.time()-t0:.0f}s")
