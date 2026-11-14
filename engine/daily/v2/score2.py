"""Scorecard for version 2. Written to the team's plan-2 protocol (section 6.1):

  region     province (28 in Bulgaria, geoBoundaries ADM1)
  ranking    top 5 spots per province and day; only province-days with >= 1 target fire
  capture    share of the target fires (cells) that fell in the top 5 spots (main)
  hit        share of province-days where at least one of the top 5 had a target fire
  spots      0.05 deg cells (about 5 km) and 0.1 deg squares (about 11 km, the team's
             shipping grid; a 0.1 deg square is 2 x 2 cells)
  baselines  official index (GEOS-5 FWI from the same GFWED file), fire history (this
             cell's fire frequency this month, 2012-2023), last week's fires nearby,
             random (exact expectation)
  claim      'better than X' only if the 95% bootstrap interval of the capture
             difference (days resampled) is above zero

Plus the firefighter's own question (one station, one spot per municipality per day,
hit if the fire is within the 3 x 3 block, about 15 km) and the reinforcement
ranking of municipalities (AUC, 28 national teams).
"""
import numpy as np
from math import comb
from sklearn.metrics import roc_auc_score

K = 5


def _spot_setup(b):
    if hasattr(b, "_spot"):
        return b._spot
    cl = b.cells
    sid = (cl.ga // 2).astype(str) + "_" + (cl.gb // 2).astype(str)
    codes, uniq = np.unique(sid, return_inverse=True)[0], np.unique(sid, return_inverse=True)[1]
    S = len(codes)
    prov = np.zeros(S, int)
    for s in range(S):
        prov[s] = np.bincount(cl.prov_k.to_numpy()[uniq == s]).argmax()
    Fsp = np.zeros((b.F.shape[0], S), bool)
    np.logical_or.at(Fsp.T, uniq, b.F.T.astype(bool))
    prev = np.zeros_like(Fsp); prev[1:] |= Fsp[:-1]; prev[2:] |= Fsp[:-2]
    NEWsp = Fsp & ~prev
    b._spot = (uniq, S, prov, Fsp, NEWsp)
    return b._spot


def score(b, days, P, base, LAB, n_boot=1000, seed=0):
    cl = b.cells
    C = len(cl)
    pk, mk = cl.prov_k.to_numpy(), cl.muni_k.to_numpy()
    provs = [np.where(pk == k)[0] for k in range(pk.max() + 1)]
    munis = [np.where(mk == m)[0] for m in range(mk.max() + 1)]
    uniq, S, sprov, Fsp, NEWsp = _spot_setup(b)
    spot_lab_full = NEWsp if LAB is b.NEW else Fsp
    sp_provs = [np.where(sprov == k)[0] for k in range(sprov.max() + 1)]
    A = b.A
    scorers = {"model": P} | base
    names = list(scorers) + ["random"]
    rng = np.random.default_rng(seed)

    # per-day tallies for bootstrap: [captured, total, hit, regions]
    team = {g: {n: np.zeros((len(days), 4)) for n in names} for g in ("cell", "spot10")}
    ff = {n: [] for n in names}               # firefighter rows: (hit15, hit15_large or nan)
    ffk = {n: {k: [] for k in (1, 2, 3, 5)} for n in names}   # k spots per municipality
    muni_rows = []
    for i, day in enumerate(days):
        lab = LAB[day].astype(bool)
        large = lab & b.LARGE[day]
        near = np.asarray(lab.astype(np.int32) @ A).ravel() > 0
        near_l = np.asarray(large.astype(np.int32) @ A).ravel() > 0
        slab = spot_lab_full[day]
        for n in names:
            v = scorers[n][i] if n != "random" else None
            # ---- team protocol, 5 km cells
            t = team["cell"][n][i]
            for cs in provs:
                nf = lab[cs].sum()
                if nf == 0:
                    continue
                if n == "random":
                    k = min(K, len(cs))
                    t += [nf * k / len(cs), nf, 1 - comb(len(cs) - nf, k) / comb(len(cs), k), 1]
                else:
                    top = cs[np.argsort(-v[cs], kind="stable")[:K]]
                    t += [lab[top].sum(), nf, lab[top].any(), 1]
            # ---- team protocol, 0.1 deg squares
            t = team["spot10"][n][i]
            if n == "random":
                vs = None
            elif n == "model":
                vs = 1 - np.exp(np.bincount(uniq, np.log1p(-np.minimum(v, 0.999999)), S))
            elif n == "fwi":
                vs = np.bincount(uniq, v, S) / np.bincount(uniq, None, S)
            else:
                vs = np.bincount(uniq, v, S)
            for ss in sp_provs:
                nf = slab[ss].sum()
                if nf == 0:
                    continue
                if vs is None:
                    k = min(K, len(ss))
                    t += [nf * k / len(ss), nf, 1 - comb(len(ss) - nf, k) / comb(len(ss), k), 1]
                else:
                    top = ss[np.argsort(-vs[ss], kind="stable")[:K]]
                    t += [slab[top].sum(), nf, slab[top].any(), 1]
            # ---- firefighter: one spot per municipality, within 15 km
            for cs in munis:
                if not lab[cs].any():
                    continue
                anyl = large[cs].any()
                if n == "random":
                    ff[n].append((near[cs].mean(), near_l[cs].mean() if anyl else np.nan))
                    nn, nr = len(cs), int(near[cs].sum())
                    for k in ffk[n]:
                        kk = min(k, nn)
                        ffk[n][k].append(1 - comb(nn - nr, kk) / comb(nn, kk))
                else:
                    top = cs[np.argmax(v[cs])]
                    ff[n].append((near[top], near_l[top] if anyl else np.nan))
                    order = cs[np.argsort(-v[cs], kind="stable")]
                    for k in ffk[n]:
                        ffk[n][k].append(near[order[:k]].any())
        # ---- municipality ranking for reinforcements
        for m, cs in enumerate(munis):
            muni_rows.append((i, lab[cs].any(), large[cs].any(),
                              1 - np.prod(1 - P[i, cs]), base["fwi"][i, cs].mean(),
                              base["history"][i, cs].sum(), base["last_week"][i, cs].sum()))

    out = {"days": int(len(days)), "target_fires_cells": int(LAB[days].sum())}
    for g in team:
        out[f"top5_per_province_{g}"] = {}
        for n in names:
            T = team[g][n].sum(0)
            out[f"top5_per_province_{g}"][n] = {"capture": round(T[0] / T[1], 4), "hit": round(T[2] / T[3], 4),
                                               "province_days": int(T[3])}
        # bootstrap: model minus each baseline, days resampled
        out[f"top5_per_province_{g}"]["model_minus_baseline_capture_95ci"] = {}
        idx = rng.integers(0, len(days), (n_boot, len(days)))
        Mm = team[g]["model"]
        for n in names[1:]:
            Bb = team[g][n]
            diff = Mm[idx, 0].sum(1) / Mm[idx, 1].sum(1) - Bb[idx, 0].sum(1) / Bb[idx, 1].sum(1)
            out[f"top5_per_province_{g}"]["model_minus_baseline_capture_95ci"][n] = \
                [round(float(np.percentile(diff, 2.5)), 4), round(float(np.percentile(diff, 97.5)), 4)]
    out["one_spot_per_municipality_15km"] = {
        n: {"hit": round(float(np.mean([a for a, _ in ff[n]])), 4),
            "hit_large": round(float(np.nanmean([c for _, c in ff[n]])), 4)} for n in names}
    out["one_spot_per_municipality_15km"]["municipality_days"] = len(ff["model"])
    out["k_spots_per_municipality_15km"] = {n: {f"top{k}": round(float(np.mean(ffk[n][k])), 4) for k in ffk[n]}
                                            for n in names}
    R = np.array(muni_rows, dtype=float)
    out["municipality_ranking_auc"] = {}
    for j, n in zip(range(3, 7), ["model", "fwi", "history", "last_week"]):
        out["municipality_ranking_auc"][n] = {"any": round(roc_auc_score(R[:, 1], R[:, j]), 4),
                                              "large": round(roc_auc_score(R[:, 2], R[:, j]), 4)}
    # 28 national teams to the 28 highest-risk municipalities each day
    out["national_28_teams_catch"] = {}
    for j, n in zip(range(3, 7), ["model", "fwi", "history", "last_week"]):
        c_any = c_l = t_any = t_l = 0
        for i in range(len(days)):
            r = R[R[:, 0] == i]
            top = np.argsort(-r[:, j])[:28]
            c_any += r[top, 1].sum(); c_l += r[top, 2].sum(); t_any += r[:, 1].sum(); t_l += r[:, 2].sum()
        out["national_28_teams_catch"][n] = {"any": round(c_any / max(t_any, 1), 4), "large": round(c_l / max(t_l, 1), 4)}
    # calibration (reliability) and Brier skill against scaled climatology
    y = LAB[days].astype(np.float32).ravel()
    p = P.ravel()
    h = base["history"].ravel()
    h = h * (y.mean() / max(h.mean(), 1e-9))          # generous to the reference: scaled to the observed rate
    bs, bh = np.mean((p - y) ** 2), np.mean((h - y) ** 2)
    out["brier_skill_vs_history"] = round(1 - bs / bh, 4)
    edges = np.array([0, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0001])
    rel = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        s = (p >= lo) & (p < hi)
        if s.sum():
            rel.append({"bin": f"{lo:g}-{hi:g}", "n": int(s.sum()), "mean_predicted": round(float(p[s].mean()), 5),
                        "observed": round(float(y[s].mean()), 5)})
    out["reliability"] = rel
    return out
