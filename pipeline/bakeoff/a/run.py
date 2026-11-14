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
    for b in np.unique(bins):
        idx = np.flatnonzero(bins == b)
        pools[("*", int(b))] = e[idx]
        # One stable sort per key column instead of one pass per key. A stable
        # sort keeps each pool in original row order, which is what the old
        # mask loop produced, so the pools are identical member for member.
        for column in ("country", "group"):
            codes, names = pd.factorize(df[column].iloc[idx], sort=False)
            order = np.argsort(codes, kind="stable")
            edges = np.searchsorted(codes[order], np.arange(len(names) + 1))
            sel = idx[order]
            for i, name in enumerate(names):
                pools[(str(name), int(b))] = e[sel[edges[i] : edges[i + 1]]]
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

    @staticmethod
    def _expo(frame: pd.DataFrame) -> np.ndarray:
        """The background's exposure per candidate cell-month.

        A2 uses 1.0 for every candidate, so the background is a fixed level per
        empty cell-month. A3 passes a `zero_exposure` column that follows the
        period's own MODIS activity, and the same ratio-of-sums machinery then
        fits a background that scales with it.
        """
        if "zero_exposure" in frame.columns:
            return frame["zero_exposure"].to_numpy(dtype=np.float64)
        return np.ones(len(frame), dtype=np.float64)

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
        expo = self._expo(zero)
        zy = np.bincount(sid_zero, weights=zero["y"].to_numpy(), minlength=n_s)
        zn = np.bincount(sid_zero, weights=expo, minlength=n_s)
        self.z = _cascade(zy, zn, ix["g_of_s"], ix["c_of_g"], n_g, n_c, K_ZERO)

        # Parameter draws.
        by, bx = self.boot(pos, ix, ("y", "x"), self.rng)
        self.r_draws = _cascade(by, bx, ix["g_of_s"], ix["c_of_g"], n_g, n_c, self.k_ratio)
        zero["one"] = expo
        bzy, bzn = self.boot(zero, ix, ("y", "one"), self.rng)
        self.z_draws = _cascade(bzy, bzn, ix["g_of_s"], ix["c_of_g"], n_g, n_c, K_ZERO)

        # Residual pools: measured spread around the point estimate.
        pos["expbin"] = expbin(pos["x"].to_numpy())
        pos["res"] = pos["y"].to_numpy() / np.maximum(self.r[sid_pos] * pos["x"].to_numpy(), 1e-12)
        self.pools_pos = build_pools(pos, "res")
        zero["expbin"] = 0
        zero["res"] = zero["y"].to_numpy() / np.maximum(self.z[sid_zero] * expo, 1e-12)
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
        expo = self._expo(out)
        is_pos = x > 0
        out["pred"] = np.where(is_pos, self.r[sid] * x, self.z[sid] * expo)
        out["expbin"] = np.where(is_pos, expbin(x), 0)

        for mask, pools, draws, scale in (
            (is_pos, self.pools_pos, self.r_draws, x),
            (~is_pos, self.pools_zero, self.z_draws, expo),
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
    inner_truth = pairs.loc[pairs["y"] > 0, "ym"].to_numpy()
    assert len(inner_truth), "no measured S-NPP entered the inner fit"
    assert not np.isin(inner_truth, hold_m).any(), "inner fit holds a holdout month"
    assert int(inner_truth.max()) <= int(fit_m[-1]), "inner fit S-NPP past its window"

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
    truth_ym = pairs.loc[pairs["y"] > 0, "ym"]
    assert len(truth_ym), "no measured S-NPP entered the fit"
    assert int(truth_ym.min()) >= int(fit_m[0]), "S-NPP before the fit window"
    assert int(truth_ym.max()) <= int(fit_m[-1]), "S-NPP after the fit window"
    assert not np.isin(truth_ym.to_numpy(), pred_m).any(), "S-NPP leak"
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


# ------------------------------------- variant A3: a background that scales

BACKGROUND_FORMS = ("fixed", "prop_month", "prop_trailing", "blend")
EXPO_CLIP = (0.05, 20.0)
BLEND_WEIGHT = 0.5
MIN_CM_POOL = 12  # country-months needed before a country's own pool is used


def activity_index(
    cm: pd.DataFrame,
    unit: str,
    modis_sat: str,
    fit_window: tuple[int, int, int, int],
) -> pd.DataFrame:
    """How active a group's MODIS record is in a month, against its own
    fit-years average for that calendar month.

    Two indexes: the month itself, and a trailing 12 months. Both are built
    from MODIS only, so they may be read in a prediction year; the averages
    they are divided by come from the fit years alone.
    """
    act = (
        cm[cm["sat"] == modis_sat]
        .groupby(["group", "ym"], as_index=False)[unit]
        .sum()
        .rename(columns={unit: "act"})
    )
    groups = sorted(act["group"].unique())
    lo, hi = int(act["ym"].min()), int(act["ym"].max())
    full = pd.DataFrame(
        {
            "group": np.repeat(groups, hi - lo + 1),
            "ym": np.tile(np.arange(lo, hi + 1), len(groups)),
        }
    ).merge(act, on=["group", "ym"], how="left")
    full["act"] = full["act"].fillna(0.0)
    full = full.sort_values(["group", "ym"]).reset_index(drop=True)
    full["act12"] = (
        full.groupby("group")["act"].rolling(12, min_periods=1).sum().to_numpy()
    )
    full["moy"] = (full["ym"] % 12) + 1
    base = (
        full[window_mask(full["ym"], fit_window)]
        .groupby(["group", "moy"], as_index=False)[["act", "act12"]]
        .mean()
        .rename(columns={"act": "base", "act12": "base12"})
    )
    full = full.merge(base, on=["group", "moy"], how="left")
    for col, ref, name in (("act", "base", "s_month"), ("act12", "base12", "s_trail")):
        s = np.where(
            full[ref].to_numpy() > 0,
            full[col].to_numpy() / np.maximum(full[ref].to_numpy(), 1e-12),
            1.0,
        )
        full[name] = np.clip(s, EXPO_CLIP[0], EXPO_CLIP[1])
    full["s_blend"] = np.clip(
        (1 - BLEND_WEIGHT) + BLEND_WEIGHT * full["s_month"], EXPO_CLIP[0], EXPO_CLIP[1]
    )
    return full[["group", "ym", "s_month", "s_trail", "s_blend"]]


def with_background(frame: pd.DataFrame, index: pd.DataFrame, form: str) -> pd.DataFrame:
    """Attach the background exposure a form asks for. Table in, table out."""
    if form == "fixed":
        out = frame.copy()
        out["zero_exposure"] = 1.0
        return out
    col = {"prop_month": "s_month", "prop_trailing": "s_trail", "blend": "s_blend"}[form]
    out = frame.merge(index[["group", "ym", col]], on=["group", "ym"], how="left")
    out["zero_exposure"] = out[col].fillna(1.0)
    return out.drop(columns=[col])


def country_month_ranges(
    model: T1Model,
    frame: pd.DataFrame,
    pools: dict,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """A country-month range computed jointly, not by adding cell ranges.

    Inside one bootstrap draw every cell of a group shares that group's ratio
    and background, so the cells are added up first and the 5% and 95% points
    are taken of the country-month total. A country-month level residual, drawn
    from the fit years, carries the spread that the parameters do not.
    """
    work = frame[["country", "ym", "group", "term", "x"]].copy()
    work["expo"] = model._expo(frame)
    work["sid"] = _sid(work, model.ix)
    work["xpos"] = np.where(work["x"] > 0, work["x"], 0.0)
    work["szero"] = np.where(work["x"] > 0, 0.0, work["expo"])
    cell = work.groupby(["country", "ym", "sid"], as_index=False)[["xpos", "szero"]].sum()
    keys = cell[["country", "ym"]].drop_duplicates().reset_index(drop=True)
    keys["k"] = np.arange(len(keys))
    cell = cell.merge(keys, on=["country", "ym"], how="left")
    total = np.zeros((len(keys), N_BOOT))
    sid = cell["sid"].to_numpy()
    contrib = (
        model.r_draws[sid] * cell["xpos"].to_numpy()[:, None]
        + model.z_draws[sid] * cell["szero"].to_numpy()[:, None]
    )
    np.add.at(total, cell["k"].to_numpy(), contrib)
    point = (
        model.r[sid] * cell["xpos"].to_numpy() + model.z[sid] * cell["szero"].to_numpy()
    )
    pt = np.zeros(len(keys))
    np.add.at(pt, cell["k"].to_numpy(), point)
    res = np.empty((len(keys), N_BOOT))
    for i, country in enumerate(keys["country"].to_numpy()):
        pool = pools.get(country)
        if pool is None or len(pool) < MIN_CM_POOL:
            pool = pools["*"]
        res[i] = rng.choice(pool, size=N_BOOT, replace=True)
    draws = total * res
    out = keys[["country", "ym"]].copy()
    out["pred"] = pt
    out["lo"] = np.minimum(np.quantile(draws, 0.05, axis=1), pt).clip(min=0.0)
    out["hi"] = np.maximum(np.quantile(draws, 0.95, axis=1), pt)
    return out


def point_predict(model: "T1Model", frame: pd.DataFrame) -> pd.DataFrame:
    """Point predictions only, with no range and so no random draw.

    Used where only the value is needed, such as building country-month
    residual pools over a large frame. It draws nothing, so it cannot move the
    bake-off rows, which is why the bake-off path keeps the full predict.
    """
    out = with_term(frame, model.n_terms)
    ix = model.ix
    out = out[out["group"].isin(ix["g_idx"])].copy()
    sid = _sid(out, ix)
    x = out["x"].to_numpy(dtype=float)
    expo = model._expo(out)
    out["pred"] = np.where(x > 0, model.r[sid] * x, model.z[sid] * expo).clip(min=0.0)
    return out


def country_residual_pools(model: T1Model, pairs: pd.DataFrame) -> dict:
    """Country-month residuals in the fit years: measured over predicted."""
    got = model.predict(pairs)
    got["y"] = pairs.loc[got.index, "y"]
    agg = got.groupby(["country", "ym"], as_index=False)[["pred", "y"]].sum()
    agg = agg[agg["pred"] > 0]
    agg["res"] = agg["y"] / agg["pred"]
    pools = {"*": agg["res"].to_numpy()}
    for country, part in agg.groupby("country"):
        pools[country] = part["res"].to_numpy()
    if len(pools["*"]) == 0:
        pools["*"] = np.ones(1)
    return pools


MIN_CALIB_MONTHS = 12  # held-out country-months before a country gets its own factor
BAND_FACTOR_CAP = 50.0
BLEND_PRIOR_MONTHS = 12.0  # pooled-factor weight, in held-out months


def band_factor(held: pd.DataFrame, level: float = BAND) -> dict:
    """Split-conformal widening factor for a country-month range.

    `held` carries `country`, `pred`, `lo`, `hi` and the measured `y` for the
    inner holdout. For each held-out month the factor that would just cover it
    is measured on the side it falls, and the factor kept is the one that covers
    `level` of them: the ceil(level x (n + 1)) / n order statistic, which is the
    usual split-conformal choice. A country with fewer than
    MIN_CALIB_MONTHS held-out months uses the pooled factor instead.
    """
    d = held.copy()
    p = d["pred"].to_numpy(dtype=float)
    y = d["y"].to_numpy(dtype=float)
    lo_w = np.maximum(p - d["lo"].to_numpy(dtype=float), 0.0)
    hi_w = np.maximum(d["hi"].to_numpy(dtype=float) - p, 0.0)
    need = np.where(
        y < p,
        np.divide(p - y, lo_w, out=np.full_like(p, BAND_FACTOR_CAP), where=lo_w > 0),
        np.divide(y - p, hi_w, out=np.full_like(p, BAND_FACTOR_CAP), where=hi_w > 0),
    )
    d["need"] = np.clip(np.nan_to_num(need, nan=BAND_FACTOR_CAP), 0.0, BAND_FACTOR_CAP)

    def pick(v: np.ndarray) -> float:
        n = len(v)
        if n == 0:
            return 1.0
        k = min(int(np.ceil(level * (n + 1))), n)
        return float(max(np.sort(v)[k - 1], 1.0))

    pooled = pick(d["need"].to_numpy())
    out = {"*": pooled, "_pooled_n": int(len(d)), "_own": [], "_detail": {}}
    for country, part in d.groupby("country"):
        n = len(part)
        own = pick(part["need"].to_numpy())
        # A country's own factor rests on n held-out months, so it is blended
        # toward the pooled factor with weight n / (n + BLEND_PRIOR_MONTHS).
        # With many held-out months the own factor is used almost as is.
        w = n / (n + BLEND_PRIOR_MONTHS)
        applied = w * own + (1 - w) * pooled
        out["_detail"][str(country)] = {
            "held_out_months": int(n),
            "own_factor": float(own),
            "applied_factor": float(applied),
        }
        if n >= MIN_CALIB_MONTHS:
            out[str(country)] = float(applied)
            out["_own"].append(str(country))
    return out


def apply_band_factor(cr: pd.DataFrame, factors: dict) -> pd.DataFrame:
    """Widen a country-month range around its prediction by the factor."""
    out = cr.copy()
    f = np.array(
        [
            float(factors.get(c, factors["*"]))
            if not str(c).startswith("_")
            else float(factors["*"])
            for c in out["country"].to_numpy()
        ]
    )
    p = out["pred"].to_numpy(dtype=float)
    out["lo"] = np.maximum(p - f * (p - out["lo"].to_numpy(dtype=float)), 0.0)
    out["hi"] = p + f * (out["hi"].to_numpy(dtype=float) - p)
    out["lo"] = np.minimum(out["lo"], p)
    out["hi"] = np.maximum(out["hi"], p)
    return out


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
            # Leakage gate, read off the rows that actually carry measured
            # S-NPP into the fitted parameters rather than off a frame that was
            # just filtered, so it can fail: every such row's month must sit
            # inside the fit window and outside the prediction window.
            truth_ym = pairs.loc[pairs["y"] > 0, "ym"]
            assert len(truth_ym), "no measured S-NPP entered the fit"
            assert int(truth_ym.min()) >= int(fit_months[0]), "S-NPP before the fit window"
            assert int(truth_ym.max()) <= int(fit_months[-1]), "S-NPP after the fit window"
            assert not np.isin(truth_ym.to_numpy(), pred_months).any(), "S-NPP leak"
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

    # Variant A3: the background follows the period's own MODIS activity.
    # Both A2 and A3 also get country-month rows whose range is computed
    # jointly rather than by adding cell ranges.
    rng3 = np.random.default_rng(SEED + 2)
    a3_inner, a3_insample, a3_counts, a3_calib = {}, {}, {}, {}
    terms = {n: (t, k) for n, t, k in A2_OPTIONS}
    t_a3 = time.time()
    for test, win in TESTS.items():
        univ = universe(cm, win["fit"])
        fit_m, pred_m = months_in(win["fit"]), months_in(win["pred"])
        inner_fit = (win["fit"][0], win["fit"][1], win["fit"][2] - 2, 12)
        inner_hold = (win["fit"][2] - 1, 1, win["fit"][2], win["fit"][3])
        for unit in UNITS:
            key = f"{test}_{unit}"
            picks_term = a2_inner[key]["picks"]
            k_r = K_RATIO_CD * k_scale[unit]
            index = activity_index(cm, unit, "Aqua", win["fit"])
            i_fit = pair_frame(univ, cm, months_in(inner_fit), unit, "Aqua", True)
            i_hold = pair_frame(univ, cm, months_in(inner_hold), unit, "Aqua", True)
            assert not set(i_fit["ym"]) & set(months_in(inner_hold).tolist())
            assert not set(i_hold["ym"]) & set(pred_m.tolist()), "inner holdout leak"
            opts = sorted(set(picks_term.values()))

            scores, cover, inner_cr = {}, {}, {}
            for form in BACKGROUND_FORMS:
                pf = with_background(i_fit, index, form)
                hf = with_background(i_hold, index, form)
                scores[form], cover[form] = {}, {}
                for opt in opts:
                    n_t, k_m = terms[opt]
                    m_i = fit_convert(pf, k_r, n_t, rng3, k_mult=k_m)
                    got = predict_convert(m_i, hf)
                    got["y"] = hf.loc[got.index, "y"]
                    scores[form][opt] = country_month_scores(got)
                    pools = country_residual_pools(m_i, pf)
                    cr = country_month_ranges(
                        m_i, with_term(hf, n_t), pools, rng3
                    )
                    truth = hf.groupby(["country", "ym"], as_index=False)["y"].sum()
                    cr = cr.merge(truth, on=["country", "ym"], how="left")
                    cover[form][opt] = {
                        c: float(
                            np.mean((p["lo"] <= p["y"]) & (p["y"] <= p["hi"]))
                        )
                        for c, p in cr.groupby("country")
                    }
                    inner_cr[(form, opt)] = cr
                    del m_i, got

            picks_form = {}
            for country, opt in picks_term.items():
                rows = [
                    (f, scores[f][opt][country])
                    for f in BACKGROUND_FORMS
                    if country in scores[f][opt]
                    and scores[f][opt][country]["country_month_nrmse"] is not None
                ]
                ok = [r for r in rows if abs(r[1]["bias"]) <= BIAS_GATE]
                pool = ok if ok else rows
                picks_form[country] = min(
                    pool, key=lambda r: r[1]["country_month_nrmse"]
                )[0]
            held = pd.concat(
                [
                    inner_cr[(picks_form[c], picks_term[c])].query("country == @c")
                    for c in picks_form
                    if (picks_form[c], picks_term[c]) in inner_cr
                ],
                ignore_index=True,
            )
            calib = band_factor(held)
            cov_before = {
                c: float(np.mean((p["lo"] <= p["y"]) & (p["y"] <= p["hi"])))
                for c, p in held.groupby("country")
            }
            after = apply_band_factor(held, calib)
            after["y"] = held["y"].to_numpy()
            cov_after = {
                c: float(np.mean((p["lo"] <= p["y"]) & (p["y"] <= p["hi"])))
                for c, p in after.groupby("country")
            }
            a3_calib[key] = {
                "factors": {k: v for k, v in calib.items() if not k.startswith("_")},
                "countries_with_their_own_factor": calib["_own"],
                "pooled_factor_used_otherwise": calib["*"],
                "min_held_out_months_for_own_factor": MIN_CALIB_MONTHS,
                "inner_coverage_before": cov_before,
                "inner_coverage_after": cov_after,
            }
            a3_inner[key] = {
                "inner_fit": f"{inner_fit[0]}-{inner_fit[1]:02d} to {inner_fit[2]}-12",
                "inner_holdout": f"{inner_hold[0]}-01 to {inner_hold[2]}-{inner_hold[3]:02d}",
                "time_term_from_a2": picks_term,
                "forms": list(BACKGROUND_FORMS),
                "scores": scores,
                "country_range_coverage_on_the_inner_split": cover,
                "picks": picks_form,
            }

            full = pair_frame(univ, cm, fit_m, unit, "Aqua", with_truth=True)
            future = pair_frame(univ, cm, pred_m, unit, "Aqua", with_truth=False)
            for label, chosen in (
                ("A2", {c: "fixed" for c in picks_term}),
                ("A3", picks_form),
            ):
                q25_rows, ctry_rows, ins = [], [], {}
                for form in sorted(set(chosen.values())):
                    for opt in sorted({picks_term[c] for c, f in chosen.items() if f == form}):
                        want = {c for c, f in chosen.items() if f == form and picks_term[c] == opt}
                        n_t, k_m = terms[opt]
                        pf = with_background(full, index, form)
                        model = fit_convert(pf, k_r, n_t, rng3, k_mult=k_m)
                        pools = country_residual_pools(model, pf)
                        own = pf[pf["country"].isin(want)]
                        ins_got = predict_convert(model, own)
                        ins_got["y"] = own.loc[ins_got.index, "y"]
                        for c, d in diagnostics(ins_got).items():
                            ins[c] = d | {"time_term": opt, "background": form}
                        ff = with_background(future, index, form)
                        ff = ff[ff["country"].isin(want)]
                        got = predict_convert(model, ff)
                        if label == "A3":
                            q25_rows.append(got[got["pred"] > 0])
                        cr_final = country_month_ranges(
                            model, with_term(ff, n_t), pools, rng3
                        )
                        if label == "A3":
                            cr_final = apply_band_factor(cr_final, calib)
                        ctry_rows.append(cr_final)
                        del model, ins_got, got
                if label == "A3":
                    a3_insample[key] = ins
                for frame_, grid, cell_id in (
                    (q25_rows, "q25", None),
                    (ctry_rows, "country", 0),
                ):
                    if not frame_:
                        continue
                    got = pd.concat(frame_, ignore_index=True)
                    got["pipeline"], got["test"], got["unit"], got["grid"] = (
                        label, test, unit, grid,
                    )
                    if cell_id is not None:
                        got["cell"] = cell_id
                    got["year"] = got["ym"] // 12
                    got["month"] = (got["ym"] % 12) + 1
                    a3_counts[f"{label}_{key}_{grid}"] = int(len(got))
                    pieces.append(
                        got[
                            [
                                "pipeline", "test", "unit", "country", "grid",
                                "cell", "year", "month", "pred", "lo", "hi",
                            ]
                        ]
                    )
            print(f"A3 {test} {unit}: background {picks_form}")
    a3_seconds = time.time() - t_a3

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
    assert set(pred["pipeline"]) == {"A", "A2", "A3"}
    assert set(pred["test"]) <= set(TESTS)
    assert set(pred["unit"]) <= set(UNITS)
    assert set(pred["grid"]) <= {"q25", "country"}
    assert set(pred.loc[pred["grid"] == "country", "cell"]) == {0}
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
        "A3": {
            "what_changed": (
                "A2 with a background that follows the period's own MODIS activity. "
                "The background is still a ratio of sums per group and calendar "
                "month, but its exposure per candidate cell-month is an activity "
                "index instead of 1, so the background falls in a quiet period. "
                "Four forms are compared on the same inner split and one is picked "
                "per country. The diagnostic that prompted it: a fixed background "
                "was 23% of Bulgaria's fit-years prediction and 48% of its 2023 to "
                "2025 prediction, because it cannot shrink when activity falls."
            ),
            "forms": {
                "fixed": "exposure 1, which is A2",
                "prop_month": "the group's MODIS total that month over its fit-years "
                              "average for that calendar month",
                "prop_trailing": "the same over a trailing 12 months",
                "blend": f"{1 - BLEND_WEIGHT} fixed plus {BLEND_WEIGHT} prop_month",
            },
            "exposure_clip": list(EXPO_CLIP),
            "selection_rule": (
                "Same inner split as A2 and the same rule: among forms with inner "
                "country-month bias within plus or minus 0.10, the lowest inner "
                "country-month nRMSE wins. The time term stays each country's A2 "
                "pick. Only fit-year rows are read; the activity index itself is "
                "MODIS only, which a prediction year may supply."
            ),
            "inner_split": a3_inner,
            "country_band_calibration": a3_calib,
            "in_sample_fit_years_only": a3_insample,
            "rows": a3_counts,
            "seconds": round(a3_seconds, 1),
            "country_rows": (
                "Rows with grid 'country' and cell 0 carry a country-month range "
                "computed jointly: the cells are added up inside each bootstrap "
                "draw and a country-month residual drawn from the fit years is "
                "applied, then the 5% and 95% points are taken. Adding cell ranges "
                "instead made the country range far too wide. Written for A2 and A3; "
                "the q25 rows are unchanged."
            ),
            "adoption_rule": (
                "The independent scorer decides. A3 replaces A2 for the world run "
                "only if, on unit cd, its level (a) nRMSE is no worse than A2's in "
                "at least 3 of the 4 cases (t1 and t2 x two countries) and its level "
                "(b) coverage stays inside 0.80 to 0.97. Otherwise A2 stays. The "
                "world script runs either with --model A2 or --model A3, default A2."
            ),
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
