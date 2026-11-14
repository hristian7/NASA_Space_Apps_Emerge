"""Stage 4: gated forecasts, their calibration, and the live outlook.

For each unit (tile x fire kind x season) only the factor groups that passed the
null test (analyze.py -> gates.csv) are used. Then:
  hindcast  leave-one-year-out predictions 2003-2021 -> tercile probabilities ->
            reliability check (verification method M112) and Brier skill vs history
  outlook   refit on 2003-2021, predict the coming months from data known today
Outputs are ANOMALY factors (x normal). The normal itself should come from the
harmonized record, which turns them into VIIRS-level numbers.
"""
import json
import numpy as np
import pandas as pd
from scipy.stats import norm as gauss
import engine as e


def design(fire, w, ocean, lead, months, lat, groups):
    feats = e.features(w, ocean, lead, lat)
    X = pd.concat([feats[g].add_prefix(g + ":") for g in groups], axis=1) if groups else \
        pd.DataFrame(index=w.index)
    y = np.log1p(fire.set_index(["y", "mo"]).cd.reindex(w.index).fillna(0))
    keep = w.index.get_level_values("mo").isin(months)
    return X[keep], y[keep]


def _fit(Xtr, rtr):
    if Xtr.shape[1] == 0:
        return lambda X: np.full(len(X), rtr.mean())
    mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-9
    A = (Xtr - mu) / sd
    beta = np.linalg.solve(A.T @ A + e.ALPHA * np.eye(A.shape[1]), A.T @ (rtr - rtr.mean()))
    return lambda X: rtr.mean() + ((X - mu) / sd) @ beta


def hindcast(fire, w, ocean, lead, months, lat, groups):
    X, y = design(fire, w, ocean, lead, months, lat, groups)
    tr = X.index.get_level_values("y").isin(e.TRAIN_YEARS) & X.notna().all(1).to_numpy()
    X, y = X[tr], y[tr]
    yrs, mos = X.index.get_level_values("y").to_numpy(), X.index.get_level_values("mo").to_numpy()
    out = []
    for yr in np.unique(yrs):
        a, b = yrs != yr, yrs == yr
        nm = pd.Series(y.to_numpy()[a]).groupby(mos[a]).mean()
        off_a, off_b = nm.reindex(mos[a]).to_numpy(), nm.reindex(mos[b]).to_numpy()
        f = _fit(X.to_numpy()[a], y.to_numpy()[a] - off_a)
        anom_a = y.to_numpy()[a] - off_a
        # the tercile limits of "normal" come from training years only
        lo, hi = np.quantile(anom_a, [1 / 3, 2 / 3])
        resid_sd = np.std(anom_a - f(X.to_numpy()[a])) * 1.15   # inflate: in-sample is optimistic
        pred = f(X.to_numpy()[b])
        obs = y.to_numpy()[b] - off_b
        p_hi = 1 - gauss.cdf(hi, pred, resid_sd)
        p_lo = gauss.cdf(lo, pred, resid_sd)
        for i in range(b.sum()):
            out.append({"y": yr, "pred": pred[i], "obs": obs[i], "p_above": p_hi[i],
                        "p_below": p_lo[i], "above": obs[i] > hi, "below": obs[i] < lo})
    return pd.DataFrame(out)


def outlook(fire, w, ocean, lead, months, lat, groups, targets):
    """targets: list of (y, mo). Weather/ocean must exist up to the latest known month."""
    X, y = design(fire, w, ocean, lead, months, lat, groups)
    tr = X.index.get_level_values("y").isin(e.TRAIN_YEARS) & X.notna().all(1).to_numpy()
    mos = X.index.get_level_values("mo").to_numpy()[tr]
    nm = pd.Series(y.to_numpy()[tr]).groupby(mos).mean()
    anom = y.to_numpy()[tr] - nm.reindex(mos).to_numpy()
    f = _fit(X.to_numpy()[tr], anom)
    lo, hi = np.quantile(anom, [1 / 3, 2 / 3])
    resid_sd = np.std(anom - f(X.to_numpy()[tr])) * 1.15
    Xt = X.reindex(pd.MultiIndex.from_tuples(targets, names=["y", "mo"]))
    res = []
    for (ty, tm), row in Xt.iterrows():
        if row.isna().any():
            continue
        p = float(f(row.to_numpy()[None, :])[0])
        res.append({"y": ty, "mo": tm, "factor": float(np.exp(p)),
                    "factor_lo": float(np.exp(p - 1.645 * resid_sd)),
                    "factor_hi": float(np.exp(p + 1.645 * resid_sd)),
                    "p_above": float(1 - gauss.cdf(hi, p, resid_sd)),
                    "p_below": float(gauss.cdf(lo, p, resid_sd))})
    return res


def forward(fire, w, ocean, lead, months, lat, groups, years=(2022, 2023, 2024, 2025)):
    """Honest out-of-sample test: gates and fit from 2003-2021 only, predict later
    years. Aqua drifted after 2021, which shifts both the engine and the history
    baseline equally, so compare the two rather than reading absolute scores."""
    X, y = design(fire, w, ocean, lead, months, lat, groups)
    yrs = X.index.get_level_values("y").to_numpy()
    mos = X.index.get_level_values("mo").to_numpy()
    ok = X.notna().all(1).to_numpy()
    tr, te = ok & np.isin(yrs, e.TRAIN_YEARS), ok & np.isin(yrs, years)
    nm = pd.Series(y.to_numpy()[tr]).groupby(mos[tr]).mean()
    anom_tr = y.to_numpy()[tr] - nm.reindex(mos[tr]).to_numpy()
    f = _fit(X.to_numpy()[tr], anom_tr)
    lo, hi = np.quantile(anom_tr, [1 / 3, 2 / 3])
    sd = np.std(anom_tr - f(X.to_numpy()[tr])) * 1.15
    pred = f(X.to_numpy()[te])
    obs = y.to_numpy()[te] - nm.reindex(mos[te]).to_numpy()
    return pd.DataFrame({"y": yrs[te], "mo": mos[te], "pred": pred, "obs": obs,
                         "p_above": 1 - gauss.cdf(hi, pred, sd), "above": obs > hi})
