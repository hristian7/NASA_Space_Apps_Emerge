"""Emerge prediction engine: which physical factors drive fire, where, and how far ahead.

Model (per country, or per fire season within a country):
    log(1 + fire cell-days)[year, month] = normal[month] + sum_g  beta_g . x_g + e
The normal is the same-month mean of the training years (an offset), so the betas
explain ANOMALIES. A constant MODIS->VIIRS factor cancels from anomalies, which is
why training on one stable sensor (Aqua 2003-2021) is safe.

Factor groups (physics in section 1 of docs/prediction-engine-plan.md):
  dryness_now     same-month VPD, root-zone soil wetness, rain   (diagnostic only:
                  not known in advance; shows the physics)
  dryness_memory  latest known month's soil wetness and VPD, and rain of the 3
                  months before it (deep moisture has weeks-to-months memory)
  fuel_growth     rain in the 12 months ending 5 months before the target month
                  (last season's growth; positive effect = fuel-limited regime)
  ocean           Nino 3.4, IOD, tropical N. Atlantic, PDO, NAO, AO, SAM, latest
                  known month (teleconnections steer rain months ahead)
  trend           year (people, land use, policy; slow)

Lead L (months): issued at the start of month (target - L); data known up to the
month before issue. 'diag' uses same-month weather and is not a forecast.

Weights: exact Shapley values of held-out skill (leave one year out). Each group's
value is its average marginal gain in skill over all 2^5 combinations, so the
values add up to the full model's skill. A negative value means the group hurts
on unseen years. Ridge regression keeps the fits stable with ~20 years of data.
"""
import itertools
import math
import numpy as np
import pandas as pd

TRAIN_YEARS = list(range(2003, 2022))
ALPHA = 5.0
GROUPS = ["dryness_now", "dryness_memory", "fuel_growth", "ocean", "trend"]
LEADS = ["diag", 0, 1, 3]


# ------------------------------------------------------------- ocean indices -----
def _psl(path, missing):
    t = pd.read_csv(path, sep=r"\s+", skiprows=1, header=None, engine="python",
                    on_bad_lines="skip")
    t = t[pd.to_numeric(t[0], errors="coerce").between(1850, 2100)].astype(float)
    s = t.set_index(0).stack()
    s.index = pd.MultiIndex.from_tuples([(int(y), int(m)) for y, m in s.index], names=["y", "mo"])
    return s.where(s > missing)


def _cpc_dmi(path):
    """NOAA CPC Dipole Mode Index from ERSSTv6 (current to within ~2 months)."""
    rows = [l.split() for l in open(path) if len(l.split()) == 5 and l.split()[0].isdigit()]
    s = pd.Series({(int(r[0]), int(r[1])): float(r[4]) for r in rows})
    s.index.names = ["y", "mo"]
    return s


def _cpc_monthly(path):
    """NOAA CPC 'year month value' files (NAO, AO, SAM), current to last month."""
    rows = [l.split() for l in open(path) if len(l.split()) == 3 and l.split()[0].isdigit()]
    s = pd.Series({(int(r[0]), int(r[1])): float(r[2]) for r in rows})
    s.index.names = ["y", "mo"]
    return s


def ocean_indices(d="idx"):
    pdo = pd.read_csv(f"{d}/ersst.v5.pdo.dat", sep=r"\s+", skiprows=1).set_index("Year")
    pdo = pdo.stack()
    pdo.index = pd.MultiIndex.from_tuples(
        [(int(y), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].index(m) + 1)
         for y, m in pdo.index], names=["y", "mo"])
    return pd.DataFrame({
        "nino34": _psl(f"{d}/nina34.anom.data", -90),
        "iod": _cpc_dmi(f"{d}/mnth.ersstv6.clim19912020.dmi_current.txt"),
        "tna": _psl(f"{d}/tna.data", -90), "pdo": pdo.where(pdo < 99),
        "nao": _cpc_monthly(f"{d}/nao_cpc.txt"), "ao": _cpc_monthly(f"{d}/ao_cpc.txt"),
        "sam": _cpc_monthly(f"{d}/aao_cpc.txt")})


# ------------------------------------------------------------- features ----------
def _shift(s, months):
    """Value of a (y, mo) series `months` months earlier."""
    idx = s.index.to_frame(index=False)
    t = idx.y * 12 + idx.mo - 1 + months
    out = pd.Series(s.to_numpy(), index=pd.MultiIndex.from_arrays([t // 12, t % 12 + 1],
                                                                   names=["y", "mo"]))
    return out.reindex(s.index)


def ocean_set(lat):
    """Three indices per climate zone, chosen from known teleconnections (a physical
    prior). Seven indices everywhere overfit badly with ~20 years of data."""
    if abs(lat) < 25:
        return ["nino34", "iod", "tna"]          # tropics: Pacific, Indian, Atlantic
    if lat >= 25:
        return ["nino34", "nao", "pdo"]          # northern extratropics
    return ["nino34", "iod", "sam"]              # southern extratropics


def features(w, ocean, lead, lat=0.0):
    """w: weather (y, mo) frame. Returns {group: DataFrame of features} on the (y, mo) grid."""
    k = 1 if lead == "diag" else lead + 1         # months back to the latest known month
    p = w.PRECTOTCORR
    g = {}
    if lead == "diag":
        g["dryness_now"] = pd.DataFrame({"vpd": w.VPD, "soil": w.GWETROOT, "rain": p})
    g["dryness_memory"] = pd.DataFrame({
        "soil_k": _shift(w.GWETROOT, k), "vpd_k": _shift(w.VPD, k),
        "rain_3m": sum(_shift(p, k + i) for i in range(3))})
    g["fuel_growth"] = pd.DataFrame({"rain_12m": sum(_shift(p, 5 + i) for i in range(12))})
    oc = ocean.reindex(w.index)
    g["ocean"] = pd.DataFrame({c: _shift(oc[c], k)
                               for c in ocean_set(lat)})
    g["trend"] = pd.DataFrame({"year": w.index.get_level_values("y").astype(float)}, index=w.index)
    return g


# ------------------------------------------------------------- fitting -----------
def _loyo_skill(y, months, years, X):
    """Leave-one-year-out skill vs the same-month normal. X may have 0 columns."""
    pred = np.empty_like(y)
    clim = np.empty_like(y)
    for yr in np.unique(years):
        tr, te = years != yr, years == yr
        norm = pd.Series(y[tr]).groupby(months[tr]).mean()
        off_tr, off_te = norm.reindex(months[tr]).to_numpy(), norm.reindex(months[te]).to_numpy()
        clim[te] = off_te
        if X.shape[1] == 0:
            pred[te] = off_te
            continue
        mu, sd = X[tr].mean(0), X[tr].std(0) + 1e-9
        A, B = (X[tr] - mu) / sd, (X[te] - mu) / sd
        r = y[tr] - off_tr
        beta = np.linalg.solve(A.T @ A + ALPHA * np.eye(A.shape[1]), A.T @ (r - r.mean()))
        pred[te] = off_te + r.mean() + B @ beta
    return 1 - np.sum((y - pred) ** 2) / np.sum((y - clim) ** 2), pred


def permute_years(frame, perm):
    """Null model: give each year the weather/ocean of another year (months kept)."""
    f = frame.copy()
    y = f.index.get_level_values("y").map(lambda v: perm.get(v, v))
    f.index = pd.MultiIndex.from_arrays([y, f.index.get_level_values("mo")], names=["y", "mo"])
    return f.sort_index()


def shapley(fire, w, ocean, lead, months_in=None, lat=0.0, perm=None):
    """Exact Shapley attribution of held-out skill to factor groups.
    perm: optional {year: year} shuffle of weather and ocean (null model)."""
    if perm is not None:
        w, ocean = permute_years(w, perm), permute_years(ocean, perm)
    feats = features(w, ocean, lead, lat)
    groups = [gname for gname in GROUPS if gname in feats]
    df = fire.set_index(["y", "mo"]).cd.reindex(w.index).fillna(0).to_frame("cd")
    df = df[df.index.get_level_values("y").isin(TRAIN_YEARS)]
    if months_in is not None:
        df = df[df.index.get_level_values("mo").isin(months_in)]
    allf = pd.concat([feats[gname].add_prefix(gname + ":") for gname in groups], axis=1).reindex(df.index)
    ok = allf.notna().all(1)
    df, allf = df[ok], allf[ok]
    y = np.log1p(df.cd.to_numpy())
    months = df.index.get_level_values("mo").to_numpy()
    years = df.index.get_level_values("y").to_numpy()
    cols = {gname: [c for c in allf.columns if c.startswith(gname + ":")] for gname in groups}
    value = {}
    for r in range(len(groups) + 1):
        for S in itertools.combinations(groups, r):
            X = allf[[c for gname in S for c in cols[gname]]].to_numpy()
            value[frozenset(S)] = _loyo_skill(y, months, years, X)[0]
    n = len(groups)
    phi = {}
    for gname in groups:
        others = [o for o in groups if o != gname]
        tot = 0.0
        for r in range(n):
            for S in itertools.combinations(others, r):
                wgt = math.factorial(r) * math.factorial(n - r - 1) / math.factorial(n)
                tot += wgt * (value[frozenset(S) | {gname}] - value[frozenset(S)])
        phi[gname] = tot
    full = value[frozenset(groups)]
    # Signs: standardized coefficients of the full model fitted on all training years.
    X = allf.to_numpy()
    norm = pd.Series(y).groupby(months).transform("mean").to_numpy()
    mu, sd = X.mean(0), X.std(0) + 1e-9
    A = (X - mu) / sd
    beta = np.linalg.solve(A.T @ A + ALPHA * np.eye(A.shape[1]), A.T @ (y - norm))
    return {"skill": full, "phi": phi, "beta": dict(zip(allf.columns, beta)), "n": len(y)}


# ------------------------------------------------------------- seasons -----------
def fire_seasons(fire, min_share=0.06):
    """Calendar months holding the fire, split into separate seasons when the
    months are not contiguous (e.g. spring farm burning vs late-summer wildfire)."""
    clim = fire[fire.y.isin(TRAIN_YEARS)].groupby("mo").cd.mean().reindex(range(1, 13), fill_value=0)
    on = clim / clim.sum() >= min_share
    months = [m for m in range(1, 13) if on[m]]
    if not months:
        return {}
    runs, cur = [], [months[0]]
    for m in months[1:]:
        if m == cur[-1] + 1:
            cur.append(m)
        else:
            runs.append(cur)
            cur = [m]
    runs.append(cur)
    if len(runs) > 1 and runs[0][0] == 1 and runs[-1][-1] == 12:   # wrap Dec -> Jan
        runs[0] = runs.pop() + runs[0]
    share = {f"{r[0]:02d}-{r[-1]:02d}": float(clim[r].sum() / clim.sum()) for r in runs}
    return {k: (r, share[k]) for k, r in zip(share, runs)}
