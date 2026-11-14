"""Average the probabilities of two or more trained runs (same lead and label), chosen
by validation (2024), then score test 2025 once.

usage: python3 ensemble.py LEAD LABEL TAG [TAG ...]    e.g. 1 all L1_all_xgb L1_all_mlp
"""
import json, os, pickle, sys
HERE = os.path.dirname(os.path.abspath(__file__))     # engine/daily/v2
V1 = os.path.dirname(HERE)                             # engine/daily (version 1: grid, fire CSVs)
import numpy as np
import features2 as f2
import score2

LEAD, LABEL, tags = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
b = pickle.load(open(f"{HERE}/builder2.pkl", "rb"))
C = len(b.cells)
LAB = b.NEW if LABEL == "new" else (b.F == 1)
res = {"tag": f"L{LEAD}_{LABEL}_ens", "members": tags, "lead_days": LEAD, "label": LABEL, "model": "ensemble"}
for name in ("val2024", "test2025"):
    ps = [np.load(f"pred2_{t}_{name}.npz") for t in tags]
    days = ps[0]["days"]
    assert all((p["days"] == days).all() for p in ps)
    P = np.mean([p["p"] for p in ps], 0).astype(np.float32)
    base = {k: np.zeros((len(days), C), np.float32) for k in ("fwi", "history", "last_week")}
    for chunk in np.array_split(np.arange(len(days)), max(1, len(days) // 20)):
        d = np.repeat(days[chunk], C); c = np.tile(np.arange(C), len(chunk))
        X = b.X(d, c, LEAD)
        base["fwi"][chunk] = np.nan_to_num(X.fc_FWI.to_numpy(), nan=-1).reshape(len(chunk), C)
        base["history"][chunk] = (X.clim_month + 1e-3 * X.years_burned_month + 1e-6 * X.clim_all).to_numpy().reshape(len(chunk), C)
        base["last_week"][chunk] = (X.hist_nbr7 + 1e-3 * X.clim_month).to_numpy().reshape(len(chunk), C)
    res[name] = score2.score(b, days, P, base, LAB)
    np.savez_compressed(f"pred2_L{LEAD}_{LABEL}_ens_{name}.npz", days=days, p=P)
json.dump(res, open(f"res2_L{LEAD}_{LABEL}_ens.json", "w"), indent=1, default=float)
print("done", res["tag"])
