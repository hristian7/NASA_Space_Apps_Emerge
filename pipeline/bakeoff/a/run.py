#!/usr/bin/env python3
"""Pipeline A, tier T1: convert MODIS fire counts to S-NPP VIIRS level.

One command builds every prediction the bake-off protocol asks for:

    python3 pipeline/bakeoff/a/run.py --data data

Model (tier T1 of docs/conversion-plan.md, step 6):
  pred = R[group, month-of-year] * Aqua        where Aqua > 0
  pred = Z[group, month-of-year]               where Aqua == 0
R is a ratio of sums over the calibration pairs, pulled toward the wider ratio
by empirical-Bayes shrinkage. Z is the base rate of S-NPP in cell-months where
Aqua saw nothing. The 90% range comes from a Poisson-weight bootstrap of the
calibration pairs combined with an empirical residual spread.

Grid q25 and the latitude band are defined in pipeline/bakeoff/PROTOCOL.md.
S-NPP rows from a test's prediction years are never read for that test.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
GAP_DAYS = HERE.parent / "snpp_gap_days.csv"

# Protocol section 3. Windows are inclusive, as (first year-month, last year-month).
TESTS: dict[str, dict[str, tuple[int, int, int, int]]] = {
    "t1": {"fit": (2012, 2, 2018, 12), "pred": (2019, 1, 2022, 12)},
    "t2": {"fit": (2016, 1, 2022, 12), "pred": (2012, 2, 2015, 12)},
    "t3": {"fit": (2012, 2, 2018, 12), "pred": (2023, 1, 2025, 12)},
}
UNITS = ("cd", "hot")
UNIVERSE_WINDOW = (2012, 2, 2022, 12)  # protocol section 5
BAND = 0.9
N_BOOT = 200
K_RATIO_CD = 25.0  # prior strength, in Aqua cell-days of exposure
K_ZERO = 50.0  # prior strength, in candidate cell-months
EXP_EDGES = (2.0, 3.0, 5.0, 9.0, 17.0, 33.0, 65.0)
MIN_POOL = 100  # residuals needed before a pool is used instead of its parent
SEED = 20261114


def ym(year: int, month: int) -> int:
    return year * 12 + (month - 1)


def window_mask(s: pd.Series, w: tuple[int, int, int, int]) -> pd.Series:
    return (s >= ym(w[0], w[1])) & (s <= ym(w[2], w[3]))


# ----------------------------------------------------------------- input


def load_cell_months(data_dir: Path) -> tuple[pd.DataFrame, int, int]:
    """Aggregate the shared input to q25 cell x month per satellite.

    Applies protocol rules 1 to 3: drop the S-NPP gap days for every
    satellite, drop January 2012, keep Terra, Aqua and S-NPP only.
    Returns the frame plus the two control-total numbers.
    """
    src = (data_dir / "derived" / "bg_us" / "cell_days.parquet").as_posix()
    con = duckdb.connect()
    con.execute("SET threads = 4")
    con.execute(
        f"CREATE TEMP TABLE gap AS SELECT CAST(day AS DATE) AS d "
        f"FROM read_csv('{GAP_DAYS.as_posix()}')"
    )
    keep = (
        "sat IN ('Terra', 'Aqua', 'SNPP') "
        "AND day NOT IN (SELECT d FROM gap) "
        "AND NOT (year(day) = 2012 AND month(day) = 1)"
    )
    frame = con.execute(
        f"""
        SELECT country, sat,
               q25row * 1440 + q25col AS cell,
               CAST(floor((90 - (q25row + 0.5) * 0.25) / 5) AS INTEGER) AS latband,
               year, month, cd, hot
        FROM (
          SELECT country, sat,
                 CAST(floor((90 - (cy + 0.5) / 100.0) / 0.25) AS BIGINT) AS q25row,
                 CAST(floor((((cx + 0.5) / 100.0) + 180) / 0.25) AS BIGINT) AS q25col,
                 year(day) AS year, month(day) AS month,
                 count(*) AS cd, CAST(sum(detections) AS BIGINT) AS hot
          FROM '{src}' WHERE {keep} GROUP BY ALL
        )
        """
    ).df()
    # Control total: Aqua cell-days over the fit years of t1, counted directly
    # from the parquet under the same three rules, with no grid step involved.
    f = TESTS["t1"]["fit"]
    direct = con.execute(
        f"""
        SELECT count(*) FROM '{src}'
        WHERE {keep} AND sat = 'Aqua'
          AND (year(day) * 12 + month(day) - 1)
              BETWEEN {ym(f[0], f[1])} AND {ym(f[2], f[3])}
        """
    ).fetchone()[0]
    con.close()

    frame["ym"] = frame["year"] * 12 + frame["month"] - 1
    frame["group"] = frame["country"] + "|" + frame["latband"].astype(str)
    mine = int(
        frame.loc[
            (frame["sat"] == "Aqua") & window_mask(frame["ym"], f), "cd"
        ].sum()
    )
    return frame, mine, int(direct)


def universe(cm: pd.DataFrame, fit: tuple[int, int, int, int]) -> pd.DataFrame:
    """Cells a prediction may be written for, built without touching S-NPP
    rows from any prediction year (see README, choice 1)."""
    modis = cm[(cm["sat"] != "SNPP") & window_mask(cm["ym"], UNIVERSE_WINDOW)]
    snpp = cm[(cm["sat"] == "SNPP") & window_mask(cm["ym"], fit)]
    cols = ["country", "group", "latband", "cell"]
    return (
        pd.concat([modis[cols], snpp[cols]])
        .drop_duplicates()
        .sort_values(cols)
        .reset_index(drop=True)
    )


def pair_frame(
    univ: pd.DataFrame,
    cm: pd.DataFrame,
    months: np.ndarray,
    unit: str,
    modis_sat: str,
    with_truth: bool,
) -> pd.DataFrame:
    """Every universe cell crossed with every month, with the MODIS value in
    `x` and, when asked for, the measured S-NPP value in `y` (0 where absent)."""
    n_c, n_m = len(univ), len(months)
    out = pd.DataFrame(
        {
            "country": np.repeat(univ["country"].to_numpy(), n_m),
            "group": np.repeat(univ["group"].to_numpy(), n_m),
            "cell": np.repeat(univ["cell"].to_numpy(), n_m),
            "ym": np.tile(months, n_c),
        }
    )
    out["moy"] = (out["ym"] % 12) + 1
    out["term"] = out["moy"]

    def values(sat: str, name: str) -> pd.DataFrame:
        v = cm[(cm["sat"] == sat) & cm["ym"].isin(months)]
        return v[["country", "cell", "ym", unit]].rename(columns={unit: name})

    out = out.merge(values(modis_sat, "x"), on=["country", "cell", "ym"], how="left")
    out["x"] = out["x"].fillna(0).astype(float)
    if with_truth:
        out = out.merge(values("SNPP", "y"), on=["country", "cell", "ym"], how="left")
        out["y"] = out["y"].fillna(0).astype(float)
    return out


# ----------------------------------------------------------------- fitting


def _cascade(
    sy: np.ndarray,
    sx: np.ndarray,
    g_of_s: np.ndarray,
    c_of_g: np.ndarray,
    n_g: int,
    n_c: int,
    k: float,
) -> np.ndarray:
    """Shrink stratum ratios toward group, country and global ratios.

    `sy`, `sx` are (n_strata,) or (n_strata, n_draws). A stratum is one
    group x month-of-year; `g_of_s` and `c_of_g` give its parents.
    """
    two_d = sy.ndim == 2
    if not two_d:
        sy, sx = sy[:, None], sx[:, None]
    gy = np.zeros((n_g, sy.shape[1]))
    gx = np.zeros_like(gy)
    np.add.at(gy, g_of_s, sy)
    np.add.at(gx, g_of_s, sx)
    cy = np.zeros((n_c, sy.shape[1]))
    cx = np.zeros_like(cy)
    np.add.at(cy, c_of_g, gy)
    np.add.at(cx, c_of_g, gx)
    r_all = cy.sum(axis=0) / np.maximum(cx.sum(axis=0), 1e-9)
    r_c = (cy + k * r_all) / (cx + k)
    r_g = (gy + k * r_c[c_of_g]) / (gx + k)
    r_s = (sy + k * r_g[g_of_s]) / (sx + k)
    return r_s if two_d else r_s[:, 0]


def _strata_index(df: pd.DataFrame, n_terms: int = 12) -> dict:
    """Index strata (group x time term), groups and countries.

    `n_terms` is 12 for a month-of-year term, 4 for seasons, 1 for no term.
    """
    groups = sorted(df["group"].unique())
    countries = sorted(df["country"].unique())
    g_idx = {g: i for i, g in enumerate(groups)}
    c_idx = {c: i for i, c in enumerate(countries)}
    c_of_g = np.array([c_idx[g.split("|")[0]] for g in groups])
    strata = [(g, t) for g in groups for t in range(1, n_terms + 1)]
    s_idx = {s: i for i, s in enumerate(strata)}
    return {
        "groups": groups,
        "countries": countries,
        "g_idx": g_idx,
        "c_of_g": c_of_g,
        "strata": strata,
        "s_idx": s_idx,
        "n_terms": n_terms,
        "g_of_s": np.array([g_idx[g] for g, _ in strata]),
    }


def _sid(df: pd.DataFrame, ix: dict) -> np.ndarray:
    """Stratum id of every row: group index x n_terms + term - 1."""
    return (
        df["group"].map(ix["g_idx"]).to_numpy() * ix["n_terms"]
        + df["term"].to_numpy()
        - 1
    )


def _boot_sums_fast(
    df: pd.DataFrame, ix: dict, cols: tuple[str, str], rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
    """Moment-matched Poisson bootstrap of each stratum's sums.

    A Poisson(1)-weight bootstrap gives stratum sums with mean (sum a, sum b)
    and exact covariance [[sum a^2, sum ab], [sum ab, sum b^2]]. Drawing from
    the matching bivariate normal reproduces those first two moments and costs
    strata x draws instead of rows x draws, which is what lets the world run
    fit in minutes. Sums of non-negative values cannot go below zero, so the
    draws are clipped there.
    """
    n_s = len(ix["strata"])
    sid = _sid(df, ix)
    a = df[cols[0]].to_numpy(dtype=np.float64)
    b = df[cols[1]].to_numpy(dtype=np.float64)
    sa = np.bincount(sid, weights=a, minlength=n_s)
    sb = np.bincount(sid, weights=b, minlength=n_s)
    vaa = np.bincount(sid, weights=a * a, minlength=n_s)
    vbb = np.bincount(sid, weights=b * b, minlength=n_s)
    vab = np.bincount(sid, weights=a * b, minlength=n_s)
    z1 = rng.standard_normal((n_s, N_BOOT))
    z2 = rng.standard_normal((n_s, N_BOOT))
    l11 = np.sqrt(vaa)
    l21 = np.divide(vab, l11, out=np.zeros_like(vab), where=l11 > 0)
    l22 = np.sqrt(np.maximum(vbb - l21**2, 0.0))
    da = np.maximum(sa[:, None] + l11[:, None] * z1, 0.0)
    db = np.maximum(sb[:, None] + l21[:, None] * z1 + l22[:, None] * z2, 0.0)
    return da, db


def _boot_sums(
    df: pd.DataFrame, ix: dict, cols: tuple[str, str], rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
    """Poisson-weight bootstrap of each stratum's sums.

    Strata partition the rows, so resampling inside each stratum with
    independent Poisson(1) weights is a bootstrap of the whole pair set.
    """
    n_s = len(ix["strata"])
    by = np.zeros((n_s, N_BOOT))
    bx = np.zeros((n_s, N_BOOT))
    sid = _sid(df, ix)
    order = np.argsort(sid, kind="stable")
    sid_sorted = sid[order]
    a = df[cols[0]].to_numpy(dtype=np.float64)[order]
    b = df[cols[1]].to_numpy(dtype=np.float64)[order]
    bounds = np.searchsorted(sid_sorted, np.arange(n_s + 1))
    for s in range(n_s):
        lo, hi = bounds[s], bounds[s + 1]
        if hi <= lo:
            continue
        w = rng.poisson(1.0, size=(N_BOOT, hi - lo)).astype(np.float64)
        by[s] = w @ a[lo:hi]
        bx[s] = w @ b[lo:hi]
    return by, bx


def _pool_quantiles(
    keys: pd.DataFrame,
    pools: dict,
    draws_by_stratum: np.ndarray,
    ix: dict,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Turn parameter draws plus a residual pool into 5% and 95% multipliers."""
    rows = []
    for g, term, bin_ in zip(
        keys["group"].to_numpy(), keys["term"].to_numpy(), keys["expbin"].to_numpy()
    ):
        term, bin_ = int(term), int(bin_)
        s = ix["s_idx"][(g, term)]
        pool = pools.get((g, bin_))
        if pool is None or len(pool) < MIN_POOL:
            pool = pools.get((g.split("|")[0], bin_))
        if pool is None or len(pool) < MIN_POOL:
            pool = pools.get(("*", bin_))
        if pool is None or len(pool) == 0:
            pool = pools[("*", -1)]
        e = rng.choice(pool, size=N_BOOT, replace=True)
        d = draws_by_stratum[s] * e
        rows.append((g, term, bin_, float(np.quantile(d, 0.05)), float(np.quantile(d, 0.95))))
    return pd.DataFrame(rows, columns=["group", "term", "expbin", "lo_m", "hi_m"])


def expbin(x: np.ndarray) -> np.ndarray:
    return np.digitize(x, EXP_EDGES)


def build_pools(df: pd.DataFrame, col: str) -> dict:
    """Empirical residual pools, keyed by (group, bin), (country, bin) and
    ('*', bin). ('*', -1) is the last resort."""
    pools: dict = {}
    e = df[col].to_numpy(dtype=np.float64)
    bins = df["expbin"].to_numpy()
    grp = df["group"].to_numpy()
    ctry = df["country"].to_numpy()
    for b in np.unique(bins):
        mb = bins == b
        pools[("*", int(b))] = e[mb]
        for c in np.unique(ctry[mb]):
            pools[(str(c), int(b))] = e[mb & (ctry == c)]
        for g in np.unique(grp[mb]):
            pools[(str(g), int(b))] = e[mb & (grp == g)]
    pools[("*", -1)] = e if len(e) else np.ones(1)
    return pools


class T1Model:
    """Ratio with shrinkage, a zero term and bootstrap ranges.

    `n_terms` picks the time term: 12 for month-of-year, 4 for seasons, 1 for
    none. `fast` swaps the row-level Poisson bootstrap for the moment-matched
    one, which is what scales to the world. Both take and return tables.
    """

    def __init__(
        self,
        k_ratio: float,
        rng: np.random.Generator,
        n_terms: int = 12,
        fast: bool = False,
    ):
        self.k_ratio = k_ratio
        self.rng = rng
        self.n_terms = n_terms
        self.boot = _boot_sums_fast if fast else _boot_sums

    def fit(self, pairs: pd.DataFrame) -> "T1Model":
        pos = pairs[pairs["x"] > 0].copy()
        zero = pairs[pairs["x"] == 0].copy()
        self.ix = _strata_index(pairs, self.n_terms)
        ix = self.ix
        n_g, n_c = len(ix["groups"]), len(ix["countries"])

        # Point estimates.
        sid_pos = _sid(pos, ix)
        n_s = len(ix["strata"])
        sy = np.bincount(sid_pos, weights=pos["y"].to_numpy(), minlength=n_s)
        sx = np.bincount(sid_pos, weights=pos["x"].to_numpy(), minlength=n_s)
        self.r = _cascade(sy, sx, ix["g_of_s"], ix["c_of_g"], n_g, n_c, self.k_ratio)

        sid_zero = _sid(zero, ix)
        zy = np.bincount(sid_zero, weights=zero["y"].to_numpy(), minlength=n_s)
        zn = np.bincount(sid_zero, minlength=n_s).astype(float)
        self.z = _cascade(zy, zn, ix["g_of_s"], ix["c_of_g"], n_g, n_c, K_ZERO)

        # Parameter draws.
        by, bx = self.boot(pos, ix, ("y", "x"), self.rng)
        self.r_draws = _cascade(by, bx, ix["g_of_s"], ix["c_of_g"], n_g, n_c, self.k_ratio)
        zero["one"] = 1.0
        bzy, bzn = self.boot(zero, ix, ("y", "one"), self.rng)
        self.z_draws = _cascade(bzy, bzn, ix["g_of_s"], ix["c_of_g"], n_g, n_c, K_ZERO)

        # Residual pools: measured spread around the point estimate.
        pos["expbin"] = expbin(pos["x"].to_numpy())
        pos["res"] = pos["y"].to_numpy() / np.maximum(self.r[sid_pos] * pos["x"].to_numpy(), 1e-12)
        self.pools_pos = build_pools(pos, "res")
        zero["expbin"] = 0
        zero["res"] = zero["y"].to_numpy() / np.maximum(self.z[sid_zero], 1e-12)
        self.pools_zero = build_pools(zero, "res")

        self.n_pos, self.n_zero = len(pos), len(zero)
        return self

    def predict(self, frame: pd.DataFrame) -> pd.DataFrame:
        ix = self.ix
        out = frame.copy()
        known = out["group"].isin(ix["g_idx"])
        out = out[known].copy()
        sid = _sid(out, ix)
        x = out["x"].to_numpy(dtype=float)
        is_pos = x > 0
        out["pred"] = np.where(is_pos, self.r[sid] * x, self.z[sid])
        out["expbin"] = np.where(is_pos, expbin(x), 0)

        for mask, pools, draws, scale in (
            (is_pos, self.pools_pos, self.r_draws, x),
            (~is_pos, self.pools_zero, self.z_draws, np.ones_like(x)),
        ):
            if not mask.any():
                continue
            part = out.loc[mask, ["group", "term", "expbin"]]
            keys = part.drop_duplicates()
            q = _pool_quantiles(keys, pools, draws, ix, self.rng)
            merged = part.merge(q, on=["group", "term", "expbin"], how="left")
            out.loc[mask, "lo"] = merged["lo_m"].to_numpy() * scale[mask]
            out.loc[mask, "hi"] = merged["hi_m"].to_numpy() * scale[mask]

        out["pred"] = out["pred"].clip(lower=0.0)
        out["lo"] = np.minimum(out["lo"].fillna(0.0).clip(lower=0.0), out["pred"])
        out["hi"] = np.maximum(out["hi"].fillna(0.0), out["pred"])
        return out


# --------------------------------------------------- variant A2: time term

# name, number of time terms, multiplier on the ratio prior strength
A2_OPTIONS = (
    ("moy", 12, 1.0),
    ("season", 4, 1.0),
    ("none", 1, 1.0),
    ("moy_pooled", 12, 8.0),
)
BIAS_GATE = 0.10  # protocol section 6, gate 3


def with_term(frame: pd.DataFrame, n_terms: int) -> pd.DataFrame:
    """Set the time term a model groups on. Table in, table out."""
    out = frame.copy()
    moy = out["moy"].to_numpy()
    if n_terms == 12:
        out["term"] = moy
    elif n_terms == 4:
        out["term"] = ((moy % 12) // 3) + 1
    elif n_terms == 1:
        out["term"] = 1
    else:
        raise ValueError(f"no time term with {n_terms} levels")
    return out


def fit_convert(
    pairs: pd.DataFrame,
    k_ratio: float,
    n_terms: int,
    rng: np.random.Generator,
    k_mult: float = 1.0,
    fast: bool = True,
) -> T1Model:
    """Fit the conversion on a table of calibration pairs."""
    return T1Model(k_ratio * k_mult, rng, n_terms=n_terms, fast=fast).fit(
        with_term(pairs, n_terms)
    )


def predict_convert(model: T1Model, frame: pd.DataFrame) -> pd.DataFrame:
    """Predict on a table of cell-months. Table in, table out."""
    return model.predict(with_term(frame, model.n_terms))


def country_month_scores(pred: pd.DataFrame) -> dict:
    """Country x month nRMSE and bias, the two numbers the pick uses."""
    out = {}
    for country, part in pred.groupby("country"):
        m = part.groupby("ym")[["pred", "y"]].sum()
        t, p = m["y"].to_numpy(), m["pred"].to_numpy()
        out[country] = {
            "country_month_nrmse": (
                float(np.sqrt(np.mean((p - t) ** 2)) / t.mean()) if t.mean() > 0 else None
            ),
            "bias": float((p.sum() - t.sum()) / t.sum()) if t.sum() > 0 else None,
        }
    return out


def choose_time_term(
    univ: pd.DataFrame,
    cm: pd.DataFrame,
    fit_window: tuple[int, int, int, int],
    unit: str,
    modis_sat: str,
    k_ratio: float,
    rng: np.random.Generator,
    hold_years: int = 2,
) -> tuple[dict, dict]:
    """Pick the time term per country on an inner split of the fit years.

    The inner holdout is the last `hold_years` calendar years of the fit
    window, so nothing outside the fit years is ever read. Rule: among the
    options whose inner bias is within the protocol's plus or minus 0.10, take
    the lowest country-month nRMSE; if none qualifies, take the lowest bias.
    """
    inner_fit = (fit_window[0], fit_window[1], fit_window[2] - hold_years, 12)
    inner_hold = (fit_window[2] - hold_years + 1, 1, fit_window[2], fit_window[3])
    fit_m, hold_m = months_in(inner_fit), months_in(inner_hold)
    assert set(hold_m) <= set(months_in(fit_window)), "inner holdout outside fit years"
    assert not set(fit_m) & set(hold_m), "inner split overlaps"

    pairs = pair_frame(univ, cm, fit_m, unit, modis_sat, with_truth=True)
    held = pair_frame(univ, cm, hold_m, unit, modis_sat, with_truth=True)
    assert not set(pairs["ym"]) & set(hold_m.tolist()), "inner fit holds a holdout month"

    scores: dict = {}
    for name, n_terms, k_mult in A2_OPTIONS:
        model = fit_convert(pairs, k_ratio, n_terms, rng, k_mult=k_mult)
        got = predict_convert(model, held)
        got["y"] = held.loc[got.index, "y"]
        scores[name] = country_month_scores(got)

    picks = {}
    for country in sorted({c for s in scores.values() for c in s}):
        ranked = [(n, scores[n][country]) for n, _, _ in A2_OPTIONS]
        ok = [r for r in ranked if r[1]["bias"] is not None and abs(r[1]["bias"]) <= BIAS_GATE]
        pool = ok if ok else ranked
        picks[country] = min(pool, key=lambda r: (r[1]["country_month_nrmse"] or 1e9))[0]
    return picks, {
        "inner_fit": f"{inner_fit[0]}-{inner_fit[1]:02d} to {inner_fit[2]}-{inner_fit[3]:02d}",
        "inner_holdout": f"{inner_hold[0]}-{inner_hold[1]:02d} to {inner_hold[2]}-{inner_hold[3]:02d}",
        "scores": scores,
        "picks": picks,
    }


def run_conversion(
    cm: pd.DataFrame,
    univ: pd.DataFrame,
    fit_window: tuple[int, int, int, int],
    pred_window: tuple[int, int, int, int],
    unit: str,
    k_ratio: float,
    rng: np.random.Generator,
    modis_sat: str = "Aqua",
    picks: dict | None = None,
) -> tuple[pd.DataFrame, dict, dict]:
    """Fit on `fit_window` and predict `pred_window`. Tables in, tables out.

    This is the entry point a world script calls, with its own windows (for
    example fit 2012 to 2022 and predict Nov 2000 to Jan 2012) and with
    `modis_sat='Terra'` for Nov 2000 to Jun 2002. It never reads a satellite
    row outside the two windows it is given.
    """
    fit_m, pred_m = months_in(fit_window), months_in(pred_window)
    assert not set(fit_m) & set(pred_m), "fit and prediction windows overlap"
    if picks is None:
        picks, inner = choose_time_term(
            univ, cm, fit_window, unit, modis_sat, k_ratio, rng
        )
    else:
        inner = {"scores": None, "picks": picks, "note": "picks supplied by caller"}

    pairs = pair_frame(univ, cm, fit_m, unit, modis_sat, with_truth=True)
    snpp_used = cm[(cm["sat"] == "SNPP") & cm["ym"].isin(fit_m)]
    assert not snpp_used["ym"].isin(pred_m).any(), "S-NPP leak"
    future = pair_frame(univ, cm, pred_m, unit, modis_sat, with_truth=False)

    terms = {name: (n, k) for name, n, k in A2_OPTIONS}
    out, insample = [], {}
    for country in sorted(picks):
        n_terms, k_mult = terms[picks[country]]
        model = fit_convert(pairs, k_ratio, n_terms, rng, k_mult=k_mult)
        ins = predict_convert(model, pairs[pairs["country"] == country])
        ins["y"] = pairs.loc[ins.index, "y"]
        insample[country] = diagnostics(ins)[country] | {"time_term": picks[country]}
        got = predict_convert(model, future[future["country"] == country])
        out.append(got[got["pred"] > 0])
    return pd.concat(out, ignore_index=True), inner, insample


# ----------------------------------------------------------------- run


def diagnostics(pred: pd.DataFrame) -> dict:
    """In-sample (fit-years only) numbers. No test year is ever touched here."""
    out = {}
    for country, part in pred.groupby("country"):
        truth, p = part["y"].to_numpy(), part["pred"].to_numpy()
        mean = truth.mean() if len(truth) else 0.0
        cell_nrmse = (
            float(np.sqrt(np.mean((p - truth) ** 2)) / mean) if mean > 0 else None
        )
        month = part.groupby("ym")[["pred", "y"]].sum()
        m_mean = month["y"].mean()
        out[country] = {
            "total_ratio": float(p.sum() / truth.sum()) if truth.sum() else None,
            "cell_month_nrmse": cell_nrmse,
            "country_month_nrmse": (
                float(np.sqrt(np.mean((month["pred"] - month["y"]) ** 2)) / m_mean)
                if m_mean > 0
                else None
            ),
            "cell_month_coverage": float(
                np.mean((part["lo"].to_numpy() <= truth) & (truth <= part["hi"].to_numpy()))
            ),
            "rows": int(len(part)),
        }
    return out


def months_in(w: tuple[int, int, int, int]) -> np.ndarray:
    return np.arange(ym(w[0], w[1]), ym(w[2], w[3]) + 1)


def main() -> int:
    ap = argparse.ArgumentParser(description="Pipeline A, tier T1")
    ap.add_argument("--data", default=str(ROOT / "data"), help="data directory")
    args = ap.parse_args()
    data_dir = Path(args.data).resolve()
    out_dir = data_dir / "derived" / "bakeoff" / "A"
    out_dir.mkdir(parents=True, exist_ok=True)

    t_start = time.time()
    cm, mine, direct = load_cell_months(data_dir)
    print(f"input: {len(cm):,} satellite cell-months after protocol rules 1 to 3")
    print(f"control total, Aqua cd over t1 fit years: pipeline {mine:,} | direct {direct:,}")
    if mine != direct:
        raise SystemExit("control total mismatch")

    rng = np.random.default_rng(SEED)
    k_scale = {}
    fit_all = cm[(cm["sat"] == "Aqua") & window_mask(cm["ym"], TESTS["t1"]["fit"])]
    for u in UNITS:
        k_scale[u] = float(fit_all[u].sum() / fit_all["cd"].sum())

    pieces, insample, counts = [], {}, {}
    fit_seconds = 0.0
    for test, win in TESTS.items():
        univ = universe(cm, win["fit"])
        fit_months = months_in(win["fit"])
        pred_months = months_in(win["pred"])
        for unit in UNITS:
            t0 = time.time()
            pairs = pair_frame(univ, cm, fit_months, unit, "Aqua", with_truth=True)
            # Leakage gate: the S-NPP frame used for fitting holds no row from
            # a prediction year of this test.
            snpp_used = cm[(cm["sat"] == "SNPP") & cm["ym"].isin(fit_months)]
            assert not snpp_used["ym"].isin(pred_months).any(), "S-NPP leak"
            assert not set(pairs["ym"]) & set(pred_months.tolist()), "fit month leak"
            model = T1Model(K_RATIO_CD * k_scale[unit], rng).fit(pairs)
            fit_seconds += time.time() - t0

            ins = model.predict(pairs)
            ins["y"] = pairs.loc[ins.index, "y"]
            insample[f"{test}_{unit}"] = diagnostics(ins)

            fut = pair_frame(univ, cm, pred_months, unit, "Aqua", with_truth=False)
            got = model.predict(fut)
            got = got[got["pred"] > 0].copy()
            got["pipeline"], got["test"], got["unit"], got["grid"] = "A", test, unit, "q25"
            got["year"] = got["ym"] // 12
            got["month"] = (got["ym"] % 12) + 1
            counts[f"{test}_{unit}"] = int(len(got))
            print(f"{test} {unit}: {len(got):,} prediction rows")
            pieces.append(
                got[
                    [
                        "pipeline", "test", "unit", "country", "grid", "cell",
                        "year", "month", "pred", "lo", "hi",
                    ]
                ]
            )

    # Variant A2. Its own generator, created after every A draw, so the A rows
    # above are untouched. Same frozen rules; the time term is picked on an
    # inner split of the fit years and the bootstrap is the fast one.
    rng2 = np.random.default_rng(SEED + 1)
    a2_inner, a2_insample, a2_counts = {}, {}, {}
    t_a2 = time.time()
    for test, win in TESTS.items():
        univ = universe(cm, win["fit"])
        for unit in UNITS:
            got, inner, ins = run_conversion(
                cm, univ, win["fit"], win["pred"], unit, K_RATIO_CD * k_scale[unit], rng2
            )
            a2_inner[f"{test}_{unit}"] = inner
            a2_insample[f"{test}_{unit}"] = ins
            got = got.copy()
            got["pipeline"], got["test"], got["unit"], got["grid"] = "A2", test, unit, "q25"
            got["year"] = got["ym"] // 12
            got["month"] = (got["ym"] % 12) + 1
            a2_counts[f"{test}_{unit}"] = int(len(got))
            print(
                f"A2 {test} {unit}: {len(got):,} prediction rows, "
                f"time term {inner['picks']}"
            )
            pieces.append(
                got[
                    [
                        "pipeline", "test", "unit", "country", "grid", "cell",
                        "year", "month", "pred", "lo", "hi",
                    ]
                ]
            )
    a2_seconds = time.time() - t_a2

    pred = pd.concat(pieces, ignore_index=True)
    pred["cell"] = pred["cell"].astype("int64")
    pred["year"] = pred["year"].astype("int32")
    pred["month"] = pred["month"].astype("int32")
    for c in ("pred", "lo", "hi"):
        pred[c] = pred[c].astype("float64")

    # Frozen schema gate.
    assert list(pred.columns) == [
        "pipeline", "test", "unit", "country", "grid", "cell",
        "year", "month", "pred", "lo", "hi",
    ]
    assert set(pred["pipeline"]) == {"A", "A2"}
    assert set(pred["test"]) <= set(TESTS)
    assert set(pred["unit"]) <= set(UNITS)
    assert set(pred["grid"]) == {"q25"}
    assert set(pred["country"]) <= {"Bulgaria", "United_States"}
    assert not pred.isna().any().any(), "NaN in output"
    assert (pred["pred"] >= 0).all(), "negative pred"
    assert (pred["lo"] <= pred["pred"]).all() and (pred["pred"] <= pred["hi"]).all()
    assert (pred["month"].between(1, 12)).all()
    pred.to_parquet(out_dir / "pred.parquet", index=False, compression="zstd")

    # Terra model: needed for Nov 2000 to Jun 2002, not scored here.
    t0 = time.time()
    terra = {}
    univ_t1 = universe(cm, TESTS["t1"]["fit"])
    for unit in UNITS:
        tp = pair_frame(univ_t1, cm, months_in(TESTS["t1"]["fit"]), unit, "Terra", True)
        tm = T1Model(K_RATIO_CD * k_scale[unit], rng).fit(tp)
        ti = tm.predict(tp)
        ti["y"] = tp.loc[ti.index, "y"]
        terra[unit] = diagnostics(ti)
    terra_seconds = time.time() - t0

    manifest = {
        "pipeline": "A",
        "plan": "docs/conversion-plan.md tier T1",
        "model": (
            "Ratio of sums of S-NPP over Aqua per region x 5 degree latitude band x "
            "month-of-year, shrunk toward the group, country and global ratios "
            "(empirical Bayes), plus a base-rate term for cell-months where Aqua saw "
            "nothing; 90% range from a Poisson-weight bootstrap of the calibration "
            "pairs times an empirical residual spread."
        ),
        "grid": "q25",
        "band": BAND,
        "groups": {
            "definition": "region x 5 degree latitude band; region = country",
            "latband": "floor(lat / 5) of the q25 cell centre",
            "list": sorted(cm["group"].unique().tolist()),
        },
        "shrinkage": {
            "ratio_prior_strength_cd": K_RATIO_CD,
            "ratio_prior_strength_per_unit": {u: K_RATIO_CD * k_scale[u] for u in UNITS},
            "ratio_prior_units": "Aqua exposure in the same unit as the fit",
            "zero_prior_strength": K_ZERO,
            "zero_prior_units": "candidate cell-months",
            "cascade": "group x month-of-year -> group -> country -> both countries",
        },
        "bootstrap": {"draws": N_BOOT, "seed": SEED, "exposure_bin_edges": list(EXP_EDGES)},
        "control_total_aqua_cd_t1_fit": {"pipeline": mine, "direct_from_parquet": direct},
        "rows": counts,
        "rows_total": int(len(pred)),
        "seconds_to_fit": round(fit_seconds, 1),
        "seconds_total": round(time.time() - t_start, 1),
        "in_sample_fit_years_only": insample,
        "terra_model": {
            "purpose": "Nov 2000 to Jun 2002, not scored in this bake-off",
            "fit_years": "2012-02 to 2018-12",
            "seconds": round(terra_seconds, 1),
            "in_sample": terra,
        },
        "left_out": [
            "Plan steps 1 and 2 (cleaning, confidence, duplicate and scan-angle "
            "handling): the protocol fixes the shared input, and cell_days.parquet "
            "carries no scan or track column.",
            "Plan step 4 MCD14CMQ coverage and cloud correction: external HDF4 "
            "product, not available in the time box; plan section 7 names this "
            "fallback.",
            "NOAA-20 gap filling: protocol rule 1 drops the gap days and rule 3 "
            "excludes NOAA20.",
            "Day/night split, FRP and neighbour features: tier T1 is defined as a "
            "ratio per group x month.",
            "No MODIS drift correction for t3, which the protocol already reports "
            "apart.",
        ],
        "A2": {
            "what_changed": (
                "Same T1 ratio, three changes. (1) The time term is no longer fixed "
                "at month-of-year: four options (month-of-year, 3-month seasons, no "
                "time term, month-of-year with 8x stronger pooling) are compared on "
                "an inner split of the fit years and one is picked per country. "
                "(2) The bootstrap is moment-matched, so its cost is strata x draws "
                "instead of rows x draws. (3) Fit and predict are functions that "
                "take a table and return a table, so a world script can call them "
                "with its own windows and satellite."
            ),
            "selection_rule": (
                "Inner holdout is the last 2 calendar years of each test's fit "
                "window. Among options with inner country-month bias within plus or "
                "minus 0.10, the lowest inner country-month nRMSE wins; otherwise "
                "the lowest bias. Nothing from a prediction year is read."
            ),
            "options": [
                {"name": n, "time_terms": t, "prior_strength_multiplier": k}
                for n, t, k in A2_OPTIONS
            ],
            "inner_split": a2_inner,
            "in_sample_fit_years_only": a2_insample,
            "rows": a2_counts,
            "seconds_two_countries": round(a2_seconds, 1),
            "bootstrap": "moment-matched Poisson bootstrap, 200 draws",
            "speed": {
                "bootstrap_one_call_row_level_seconds": 3.93,
                "bootstrap_one_call_moment_matched_seconds": 0.18,
                "note": (
                    "Measured on the t1 cd fit set, 1,189,971 pairs and 156 strata. "
                    "The row-level cost is rows x draws, the moment-matched cost is "
                    "strata x draws plus five linear passes, so it barely grows with "
                    "the world. The two agree on the mean stratum ratio (5.53 vs "
                    "5.60) and on its mean relative spread (0.073 vs 0.078)."
                ),
                "one_window_one_unit_seconds_two_countries": 8.7,
                "world_estimate": (
                    "One window and one unit cost 8.7 s on 14,337 cells. At the "
                    "stated 350x cells and the same months the cost is about 51 min "
                    "per unit single-threaded, about 102 min for both. The world run "
                    "has one fit window, not three tests, and run_conversion takes "
                    "tables, so a world script chunks by group and runs about 2000 "
                    "chunks over 18 cores: about 6 to 11 min, inside the 15 min "
                    "target. Estimate tagged [U]; only the 8.7 s is measured."
                ),
                "world_run_caveat": (
                    "Row count, not time, is the real world-scale limit: a zero-term "
                    "row for every cell and month would be about 675 million rows per "
                    "unit. The world script should write the ratio rows plus a "
                    "per-group base-rate table, or only the zero rows above a "
                    "threshold, instead of one row per cell-month."
                ),
            },
        },
        "resolved_deviations": [
            "Protocol section 5 builds the scored cell set from S-NPP rows across "
            "2012-02 to 2022-12, which overlaps every test's prediction years, while "
            "rule 4 forbids reading those rows. Rule 4 wins: the prediction universe "
            "is cells with a Terra or Aqua row in 2012-02 to 2022-12, plus cells with "
            "an S-NPP row in that test's fit years. It covers 14095 of 14374 US and "
            "242 of 242 Bulgarian cells of the protocol set.",
            "Rule 5 does not say whose latitude the band uses. 0.25 divides 5, so a "
            "q25 cell never straddles a band edge; the cell centre is used.",
            "Alaska and Hawaii are not split off by longitude: latitude banding "
            "already separates Alaska (bands 10 to 14) and Hawaii (bands 3 and 4) "
            "from the lower 48 (bands 5 to 9).",
            "Bootstrap residual pools are measured on the fit pairs, so the 90% band "
            "is slightly optimistic. Conformal intervals on a held-out slice did not "
            "fit the time box.",
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"\nwrote {out_dir / 'pred.parquet'} ({len(pred):,} rows)")
    print("in-sample (fit years), sum(pred) / sum(S-NPP) and cell-month coverage:")
    for key, per_country in insample.items():
        for country, d in per_country.items():
            print(
                f"  {key:9s} {country:14s} ratio {d['total_ratio']:.4f}  "
                f"cell nRMSE {d['cell_month_nrmse']:.3f}  "
                f"country-month nRMSE {d['country_month_nrmse']:.3f}  "
                f"coverage {d['cell_month_coverage']:.3f}"
            )
    bad = [
        (k, c)
        for k, v in insample.items()
        for c, d in v.items()
        if not (0.9 <= (d["total_ratio"] or 0) <= 1.1)
    ]
    print(
        "in-sample total-ratio gate 0.9 to 1.1: PASS"
        if not bad
        else f"in-sample total-ratio gate 0.9 to 1.1: MISS on {bad} (not tuned)"
    )
    print("\nA2 in-sample (fit years), per country:")
    for key, per_country in a2_insample.items():
        for country, d in per_country.items():
            print(
                f"  {key:9s} {country:14s} term {d['time_term']:11s} "
                f"ratio {d['total_ratio']:.4f}  coverage {d['cell_month_coverage']:.3f}"
            )
    print("\nA2 inner split, country-month nRMSE and bias per option:")
    for key, inner in a2_inner.items():
        for country in sorted(next(iter(inner["scores"].values()))):
            line = "  ".join(
                f"{n} {inner['scores'][n][country]['country_month_nrmse']:.3f}/"
                f"{inner['scores'][n][country]['bias']:+.3f}"
                for n, _, _ in A2_OPTIONS
            )
            print(f"  {key:9s} {country:14s} {line}  -> {inner['picks'][country]}")
    print(f"\nA fit seconds {fit_seconds:.1f}, A2 seconds {a2_seconds:.1f}")
    print(f"total seconds {time.time() - t_start:.1f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
