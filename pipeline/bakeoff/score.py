#!/usr/bin/env python3
"""Scorer for the A vs B bake-off. Implements PROTOCOL.md sections 1, 2, 3, 5 and 6.

Written before any prediction existed. It reads only the shared input
(cell_days.parquet), the circles list, the gap-day list and the prediction
files. It never reads pipeline code.

Usage:
  python pipeline/bakeoff/score.py --data <data dir>
  python pipeline/bakeoff/score.py --data <data dir> --truth-only
  python pipeline/bakeoff/score.py --data <data dir> --selftest
"""
import argparse
import csv
import json
import math
import os
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
COUNTRIES = ["Bulgaria", "United_States"]
SATS = ["Terra", "Aqua", "SNPP"]
UNITS = ["cd", "hot"]
GRIDS = ["q25", "d10"]
GRIDS_IN_FILE = GRIDS + ["country"]
WORLD_LABEL = "W"
WORLD_MIN_NONZERO_MONTHS = 12
WORLD_COVERAGE = (0.80, 0.97)
WORLD_BATCH_ROWS = 4_000_000
ADOPT_MIN_NOT_WORSE = 3
ADOPT_COVERAGE = (0.80, 0.97)
TESTS = ["t1", "t2", "t3"]
WINNER_TESTS = ["t1", "t2"]
LEVELS = ["a", "b", "c", "d"]
LEVEL_NAMES = {
    "a": "country x month",
    "b": "q25 cell x month",
    "c": "50 km circle x month",
    "a_joint": "country x month, jointly computed range (information)",
    "w_country": "every country x month, world fit (information)",
    "c2": "50 km circle, overlap-weighted (information)",
    "d": "d10 cell x month (information)",
}
PRED_COLS = ["pipeline", "test", "unit", "country", "grid", "cell", "year", "month", "pred", "lo", "hi"]
D7_FACTOR = 1.25
D7_NEEDED = 8
GATE_NRMSE = 0.30
GATE_BIAS = 0.10
GATE_COVERAGE = {0.9: (0.80, 0.97), 0.8: (0.70, 0.90)}
EARTH_KM = 6371.0088
SCORE_COLS = ["pipeline", "level", "test", "country", "unit", "grid", "n", "nrmse", "mae", "bias",
              "r", "slope", "coverage", "mape", "band"]


# ---------------------------------------------------------------- months and cells

def test_months(test):
    """List of (year, month) a test predicts."""
    if test == "t1":
        return [(y, m) for y in range(2019, 2023) for m in range(1, 13)]
    if test == "t2":
        return [(y, m) for y in range(2012, 2016) for m in range(1, 13) if (y, m) != (2012, 1)]
    if test == "t3":
        return [(y, m) for y in range(2023, 2026) for m in range(1, 13)]
    raise ValueError(test)


def ym_of(year, month):
    return year * 12 + (month - 1)


def q25_cell_from_cd(cy, cx):
    """q25 cell of a 0.01 degree cell, exact integer arithmetic on its centre."""
    cy = np.asarray(cy, dtype=np.int64)
    cx = np.asarray(cx, dtype=np.int64)
    row = np.clip((17999 - 2 * cy) // 50, 0, 719)
    col = ((2 * cx + 36001) // 50) % 1440
    return row * 1440 + col


def d10_cell_from_cd(cy, cx):
    cy = np.asarray(cy, dtype=np.int64)
    cx = np.asarray(cx, dtype=np.int64)
    return (cy // 10 + 900) * 3600 + (cx // 10 + 1800)


def c01_cell_from_cd(cy, cx):
    """Internal grid, used only by the self-test: the 0.01 degree cell itself."""
    return (np.asarray(cy, dtype=np.int64) + 9000) * 40000 + (np.asarray(cx, dtype=np.int64) + 18000)


def centre_q25(cell):
    cell = np.asarray(cell, dtype=np.int64)
    row, col = cell // 1440, cell % 1440
    return 90.0 - (row + 0.5) * 0.25, -180.0 + (col + 0.5) * 0.25


def centre_d10(cell):
    cell = np.asarray(cell, dtype=np.int64)
    gy, gx = cell // 3600 - 900, cell % 3600 - 1800
    return (gy + 0.5) / 10.0, (gx + 0.5) / 10.0


def centre_c01(cell):
    cell = np.asarray(cell, dtype=np.int64)
    return ((cell // 40000 - 9000) + 0.5) / 100.0, ((cell % 40000 - 18000) + 0.5) / 100.0


CENTRES = {"q25": centre_q25, "d10": centre_d10, "c01": centre_c01}


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dl = np.radians(lon2) - np.radians(lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * EARTH_KM * np.arcsin(np.sqrt(np.minimum(1.0, a)))


def q25_overlap_weights(cells, lat0, lon0, radius_km):
    """Share of each q25 cell's 625 sub-cells (0.01 degree) whose centre is within the circle."""
    cells = np.asarray(cells, dtype=np.int64)
    off = (np.arange(25) + 0.5) * 0.01
    out = np.zeros(len(cells))
    for k, c in enumerate(cells):
        row, col = int(c // 1440), int(c % 1440)
        lat = 90.0 - row * 0.25 - off
        lon = -180.0 + col * 0.25 + off
        la, lo = np.meshgrid(lat, lon, indexing="ij")
        out[k] = float((haversine_km(lat0, lon0, la, lo) <= radius_km).mean())
    return out


# ---------------------------------------------------------------- truth

def read_gap_days():
    days = set()
    with open(HERE / "snpp_gap_days.csv", newline="") as f:
        for r in csv.DictReader(f):
            days.add(r["day"].strip())
    return days


def read_circles():
    df = pd.read_csv(HERE / "circles.csv")
    assert list(df.columns) == ["id", "country", "name", "lat", "lon", "radius_km"], df.columns
    return df


class Truth:
    """S-NPP truth and the scoring scope, built from the shared cell-days file."""

    def __init__(self, df):
        df = df.copy()
        day = pd.to_datetime(df["day"])
        gaps = pd.to_datetime(sorted(read_gap_days()))
        keep = df["sat"].isin(SATS) & df["country"].isin(COUNTRIES)
        keep &= ~day.isin(gaps)
        keep &= ~((day.dt.year == 2012) & (day.dt.month == 1))
        df = df[keep.values].reset_index(drop=True)
        day = day[keep.values].reset_index(drop=True)
        df["year"] = day.dt.year.astype(np.int64).values
        df["month"] = day.dt.month.astype(np.int64).values
        df["ym"] = df["year"] * 12 + df["month"] - 1
        df["q25"] = q25_cell_from_cd(df["cy"].values, df["cx"].values)
        df["d10"] = d10_cell_from_cd(df["cy"].values, df["cx"].values)
        df["detections"] = df["detections"].astype(np.int64)
        self.rows = df
        snpp = df[df["sat"] == "SNPP"]
        self.snpp = snpp
        self.q25 = {}
        self.d10 = {}
        self.scored_q25 = {}
        self.scored_d10 = {}
        for c in COUNTRIES:
            s = snpp[snpp["country"] == c]
            for grid, store in (("q25", self.q25), ("d10", self.d10)):
                g = s.groupby([grid, "ym"]).agg(cd=("detections", "size"), hot=("detections", "sum")).reset_index()
                g = g.rename(columns={grid: "cell"})
                store[c] = g
            scope = df[(df["country"] == c) & (df["year"] >= 2012) & (df["year"] <= 2022)]
            self.scored_q25[c] = np.sort(scope["q25"].unique())
            self.scored_d10[c] = np.sort(scope["d10"].unique())
        self.circles = read_circles()
        self.circle_tab = {}
        for _, ci in self.circles.iterrows():
            s = snpp[snpp["country"] == ci["country"]]
            cells = s[["cy", "cx"]].drop_duplicates()
            lat = (cells["cy"].values + 0.5) / 100.0
            lon = (cells["cx"].values + 0.5) / 100.0
            inside = haversine_km(ci["lat"], ci["lon"], lat, lon) <= ci["radius_km"]
            key = set(zip(cells["cy"].values[inside].tolist(), cells["cx"].values[inside].tolist()))
            if key:
                sel = pd.MultiIndex.from_arrays([s["cy"].values, s["cx"].values]).isin(list(key))
                t = s[sel].groupby("ym").agg(cd=("detections", "size"), hot=("detections", "sum")).reset_index()
            else:
                t = pd.DataFrame({"ym": [], "cd": [], "hot": []})
            self.circle_tab[ci["id"]] = t
        self._dense = {}

    def total_series(self, country, unit, months):
        ym = np.array([ym_of(y, m) for y, m in months])
        t = self.q25[country].groupby("ym")[unit].sum()
        return t.reindex(ym, fill_value=0).values.astype(float)

    def dense(self, grid, country, unit, months):
        key = (grid, country, unit, tuple(months))
        if key not in self._dense:
            cells = (self.scored_q25 if grid == "q25" else self.scored_d10)[country]
            tab = (self.q25 if grid == "q25" else self.d10)[country]
            self._dense[key] = to_dense(tab, cells, months, [unit])[0]
        return self._dense[key]

    def circle_series(self, cid, unit, months):
        t = self.circle_tab[cid]
        ym = np.array([ym_of(y, m) for y, m in months])
        if len(t) == 0:
            return np.zeros(len(months))
        return t.set_index("ym")[unit].reindex(ym, fill_value=0).values.astype(float)


def to_dense(df, cells, months, cols):
    """Matrices (cells x months) for each column; rows outside the scope are dropped."""
    ym = np.array([ym_of(y, m) for y, m in months])
    order = np.argsort(ym)
    ym_sorted = ym[order]
    out = [np.zeros((len(cells), len(months))) for _ in cols]
    if len(df) == 0 or len(cells) == 0:
        return out
    cell = df["cell"].values.astype(np.int64)
    ci = np.searchsorted(cells, cell)
    ci_c = np.minimum(ci, len(cells) - 1)
    ok = cells[ci_c] == cell
    mi = np.searchsorted(ym_sorted, df["ym"].values)
    mi_c = np.minimum(mi, len(ym_sorted) - 1)
    ok &= ym_sorted[mi_c] == df["ym"].values
    mcol = order[mi_c]
    for k, col in enumerate(cols):
        np.add.at(out[k], (ci_c[ok], mcol[ok]), df[col].values[ok].astype(float))
    return out


def load_truth(data):
    path = Path(data) / "derived" / "bg_us" / "cell_days.parquet"
    df = pd.read_parquet(path, columns=["sat", "country", "day", "cy", "cx", "detections"])
    return Truth(df)


# ---------------------------------------------------------------- truth samples check

def check_truth_samples(truth, quiet=False):
    """Compare the parquet-based truth with the raw-file samples. Returns a list of differences."""
    path = ROOT / "tests" / "expected" / "bakeoff" / "truth_samples.json"
    exp = json.load(open(path))
    diffs = []
    for s in exp["samples"]:
        c, y, m = s["country"], s["year"], s["month"]
        ym = ym_of(y, m)
        tab = truth.q25[c]
        tab = tab[tab["ym"] == ym]
        got = {
            "total_cd": int(tab["cd"].sum()),
            "total_hot": int(tab["hot"].sum()),
            "q25_cells_with_fire": int(len(tab)),
        }
        by_cd = tab.sort_values(["cd", "cell"], ascending=[False, True]).head(3)
        by_hot = tab.sort_values(["hot", "cell"], ascending=[False, True]).head(3)
        got["top3_cells_by_cd"] = [{"cell": int(r.cell), "cd": int(r.cd), "hot": int(r.hot)} for r in by_cd.itertuples()]
        got["top3_cells_by_hot"] = [{"cell": int(r.cell), "cd": int(r.cd), "hot": int(r.hot)} for r in by_hot.itertuples()]
        got["busiest_cell_by_cd"] = got["top3_cells_by_cd"][0] if got["top3_cells_by_cd"] else None
        got["busiest_cell_by_hot"] = got["top3_cells_by_hot"][0] if got["top3_cells_by_hot"] else None
        label = "%s %d-%02d" % (c, y, m)
        for k in got:
            if got[k] != s[k]:
                diffs.append("%s %s: parquet truth %s, raw-file truth %s" % (label, k, got[k], s[k]))
        if not quiet:
            print("  %-22s cd %7d (raw %7d)  hot %7d (raw %7d)  busiest q25 cell %s" % (
                label, got["total_cd"], s["total_cd"], got["total_hot"], s["total_hot"],
                got["busiest_cell_by_cd"]["cell"] if got["busiest_cell_by_cd"] else None))
    return diffs


def print_truth_totals(truth):
    rows = truth.snpp.groupby(["country", "year"]).agg(cd=("detections", "size"), hot=("detections", "sum")).reset_index()
    print("S-NPP totals per country and year after rules 1 to 3 (cd = fire cell-days, hot = hotspots):")
    for c in COUNTRIES:
        print("  " + c)
        for r in rows[rows["country"] == c].itertuples():
            print("    %d  cd %9d  hot %10d" % (r.year, r.cd, r.hot))


# ---------------------------------------------------------------- measures

def measures(t, p, lo, hi):
    t = np.asarray(t, dtype=float)
    p = np.asarray(p, dtype=float)
    lo = np.asarray(lo, dtype=float)
    hi = np.asarray(hi, dtype=float)
    n = len(t)
    out = {"n": n}
    if n == 0:
        for k in ["nrmse", "mae", "bias", "r", "slope", "coverage", "mape"]:
            out[k] = float("nan")
        return out
    mt = t.mean()
    err = p - t
    out["nrmse"] = math.sqrt(float((err ** 2).mean())) / mt if mt > 0 else float("nan")
    out["mae"] = float(np.abs(err).mean())
    st = t.sum()
    out["bias"] = float((p.sum() - st) / st) if st > 0 else float("nan")
    dt, dp = t - mt, p - p.mean()
    vt, vp = float((dt ** 2).sum()), float((dp ** 2).sum())
    cov = float((dt * dp).sum())
    out["r"] = cov / math.sqrt(vt * vp) if vt > 0 and vp > 0 else float("nan")
    out["slope"] = cov / vp if vp > 0 else float("nan")
    out["coverage"] = float(((lo <= t) & (t <= hi)).mean())
    pos = t > 0
    out["mape"] = float((np.abs(err[pos]) / t[pos]).mean()) if pos.any() else float("nan")
    return out


# ---------------------------------------------------------------- predictions

def validate_pred(df):
    """Returns (clean frame, notes). Raises ValueError for a file that cannot be scored."""
    missing = [c for c in PRED_COLS if c not in df.columns]
    if missing:
        raise ValueError("pred.parquet misses columns: %s" % missing)
    df = df[PRED_COLS].copy()
    notes = []
    for col, ok in (("test", TESTS), ("unit", UNITS), ("country", COUNTRIES), ("grid", GRIDS_IN_FILE)):
        bad = ~df[col].isin(ok)
        if bad.any():
            raise ValueError("column %s has values outside %s: %s" % (col, ok, sorted(df.loc[bad, col].astype(str).unique())[:5]))
    for col in ("pred", "lo", "hi"):
        if df[col].isna().any():
            raise ValueError("column %s has missing values" % col)
    if (df["pred"] < 0).any() or (df["lo"] < 0).any() or (df["hi"] < 0).any():
        raise ValueError("negative pred, lo or hi")
    df["cell"] = df["cell"].astype(np.int64)
    if (df.loc[df["grid"] == "country", "cell"] != 0).any():
        raise ValueError("rows with grid = country must have cell = 0")
    df["year"] = df["year"].astype(np.int64)
    df["month"] = df["month"].astype(np.int64)
    dup = df.duplicated(["pipeline", "test", "unit", "country", "grid", "cell", "year", "month"])
    if dup.any():
        raise ValueError("%d duplicate rows for the same pipeline, test, unit, country, grid, cell and month" % int(dup.sum()))
    bad_range = int(((df["lo"] > df["pred"] + 1e-9) | (df["pred"] > df["hi"] + 1e-9)).sum())
    if bad_range:
        notes.append("%d rows have pred outside [lo, hi]" % bad_range)
    df["ym"] = df["year"] * 12 + df["month"] - 1
    return df, notes


def preferred_circle_grid(label, grids_present):
    want = "d10" if label.startswith("B") else "q25"
    if want in grids_present:
        return want
    other = "q25" if want == "d10" else "d10"
    return other if other in grids_present else None


def score_label(truth, pred, label, band, circle_grid=None, circles=None):
    """All measures for one pipeline label. `pred` is a validated frame."""
    rows = []
    notes = []
    mine = pred[pred["pipeline"] == label]
    grids_present = set(mine["grid"].unique())
    cg = circle_grid or preferred_circle_grid(label, grids_present)
    circ = truth.circles if circles is None else circles
    for test in TESTS:
        months = test_months(test)
        ymset = set(ym_of(y, m) for y, m in months)
        for country in COUNTRIES:
            for unit in UNITS:
                sub = mine[(mine["test"] == test) & (mine["unit"] == unit) & (mine["country"] == country)]
                sub = sub[sub["ym"].isin(ymset)]
                if len(sub) == 0:
                    notes.append("%s %s %s %s: no prediction rows" % (label, test, country, unit))
                    continue
                q = sub[sub["grid"] == "q25"]
                d = sub[sub["grid"] == "d10"]

                def add(level, grid, tt, pp, ll, hh):
                    m = measures(tt, pp, ll, hh)
                    m.update({"pipeline": label, "level": level, "test": test, "country": country,
                              "unit": unit, "grid": grid, "band": band})
                    rows.append(m)

                if len(q):
                    ym = np.array([ym_of(y, m) for y, m in months])
                    agg = q.groupby("ym")[["pred", "lo", "hi"]].sum().reindex(ym, fill_value=0.0)
                    add("a", "q25", truth.total_series(country, unit, months), agg["pred"].values,
                        agg["lo"].values, agg["hi"].values)
                    cells = truth.scored_q25[country]
                    tm = truth.dense("q25", country, unit, months)
                    pm, lm, hm = to_dense(q.rename(columns={}), cells, months, ["pred", "lo", "hi"])
                    add("b", "q25", tm.ravel(), pm.ravel(), lm.ravel(), hm.ravel())
                else:
                    notes.append("%s %s %s %s: no q25 rows, levels a and b not scored" % (label, test, country, unit))
                jr = sub[sub["grid"] == "country"]
                if len(jr):
                    ymj = np.array([ym_of(y, m) for y, m in months])
                    aj = jr.groupby("ym")[["pred", "lo", "hi"]].sum().reindex(ymj, fill_value=0.0)
                    add("a_joint", "country", truth.total_series(country, unit, months), aj["pred"].values,
                        aj["lo"].values, aj["hi"].values)
                if len(d):
                    cells = truth.scored_d10[country]
                    tm = truth.dense("d10", country, unit, months)
                    pm, lm, hm = to_dense(d, cells, months, ["pred", "lo", "hi"])
                    add("d", "d10", tm.ravel(), pm.ravel(), lm.ravel(), hm.ravel())
                if len(q):
                    qlat, qlon = centre_q25(q["cell"].unique())
                    qcells = q["cell"].unique()
                    ymc = np.array([ym_of(y, m) for y, m in months])
                    tt2, pp2, ll2, hh2 = [], [], [], []
                    for _, ci in circ[circ["country"] == country].iterrows():
                        near = haversine_km(ci["lat"], ci["lon"], qlat, qlon) <= ci["radius_km"] + 25.0
                        wc = qcells[near]
                        w = dict(zip(wc.tolist(), q25_overlap_weights(wc, ci["lat"], ci["lon"], ci["radius_km"])))
                        sel = q[q["cell"].isin(wc)].copy()
                        wv = sel["cell"].map(w).values
                        for col in ("pred", "lo", "hi"):
                            sel[col] = sel[col].values * wv
                        agg = sel.groupby("ym")[["pred", "lo", "hi"]].sum().reindex(ymc, fill_value=0.0)
                        tt2.append(truth.circle_series(ci["id"], unit, months))
                        pp2.append(agg["pred"].values)
                        ll2.append(agg["lo"].values)
                        hh2.append(agg["hi"].values)
                    add("c2", "q25", np.concatenate(tt2), np.concatenate(pp2), np.concatenate(ll2), np.concatenate(hh2))
                cs = sub[sub["grid"] == cg] if cg else sub.iloc[0:0]
                if cg is None or len(cs) == 0:
                    notes.append("%s %s %s %s: no rows on the circle grid, level c not scored" % (label, test, country, unit))
                    continue
                centres = CENTRES[cg]
                ucell = cs["cell"].unique()
                clat, clon = centres(ucell)
                tt, pp, ll, hh = [], [], [], []
                ym = np.array([ym_of(y, m) for y, m in months])
                for _, ci in circ[circ["country"] == country].iterrows():
                    inside = haversine_km(ci["lat"], ci["lon"], clat, clon) <= ci["radius_km"]
                    sel = cs[cs["cell"].isin(ucell[inside])]
                    agg = sel.groupby("ym")[["pred", "lo", "hi"]].sum().reindex(ym, fill_value=0.0)
                    tt.append(truth.circle_series(ci["id"], unit, months))
                    pp.append(agg["pred"].values)
                    ll.append(agg["lo"].values)
                    hh.append(agg["hi"].values)
                add("c", cg, np.concatenate(tt), np.concatenate(pp), np.concatenate(ll), np.concatenate(hh))
    return rows, notes


# ---------------------------------------------------------------- decisions

def contests(scores, a="A", b="B"):
    """The 12 contests of rule 1. Lower nRMSE wins; a tie goes to A. Returns a DataFrame."""
    out = []
    for level in ["a", "b", "c"]:
        for test in WINNER_TESTS:
            for country in COUNTRIES:
                def get(p, unit):
                    s = scores[(scores.pipeline == p) & (scores.level == level) & (scores.test == test)
                               & (scores.country == country) & (scores.unit == unit)]
                    return float(s["nrmse"].iloc[0]) if len(s) else float("nan")
                na, nb = get(a, "cd"), get(b, "cd")
                if math.isnan(na) or math.isnan(nb):
                    win = ""
                else:
                    win = a if na <= nb else b
                out.append({"level": level, "test": test, "country": country,
                            "nrmse_A": na, "nrmse_B": nb, "winner": win,
                            "A_hot": get(a, "hot"), "B_hot": get(b, "hot")})
    return pd.DataFrame(out)


def decide_winner(cdf):
    decided = cdf[cdf["winner"] != ""]
    if len(decided) < 12:
        return None, int((decided["winner"] == "A").sum()), int((decided["winner"] == "B").sum())
    wa = int((decided["winner"] == "A").sum())
    wb = int((decided["winner"] == "B").sum())
    return ("A" if wa >= wb else "B"), wa, wb


def d7_rule(cdf, winner):
    """Count contests where the winner's hot nRMSE is at most 1.25 times its cd nRMSE."""
    col_cd = "nrmse_" + winner
    col_hot = winner + "_hot"
    ok = 0
    detail = []
    for r in cdf.itertuples(index=False):
        cd, hot = getattr(r, col_cd), getattr(r, col_hot)
        passed = (not math.isnan(cd)) and (not math.isnan(hot)) and hot <= D7_FACTOR * cd
        ok += int(passed)
        detail.append((r.level, r.test, r.country, cd, hot, passed))
    return ok, detail


def gate_checks(scores, winner, band, truth_ok):
    """World-gate checks of rule 3. Returns a list of (name, value, rule, passed)."""
    checks = []
    for country in COUNTRIES:
        for test in WINNER_TESTS:
            def get(level, col):
                s = scores[(scores.pipeline == winner) & (scores.level == level) & (scores.test == test)
                           & (scores.country == country) & (scores.unit == "cd")]
                return float(s[col].iloc[0]) if len(s) else float("nan")
            nr, bi, cov = get("a", "nrmse"), get("a", "bias"), get("b", "coverage")
            checks.append(("%s %s level a nRMSE" % (country, test), nr, "at most %.2f" % GATE_NRMSE,
                           (not math.isnan(nr)) and nr <= GATE_NRMSE))
            checks.append(("%s %s level a bias" % (country, test), bi, "within +-%.2f" % GATE_BIAS,
                           (not math.isnan(bi)) and abs(bi) <= GATE_BIAS))
            if band in GATE_COVERAGE:
                lo, hi = GATE_COVERAGE[band]
                checks.append(("%s %s level b coverage" % (country, test), cov,
                               "%.2f to %.2f (band %.1f)" % (lo, hi, band),
                               (not math.isnan(cov)) and lo <= cov <= hi))
            else:
                checks.append(("%s %s level b coverage" % (country, test), cov,
                               "no rule for band %s" % band, False))
    checks.append(("truth samples match the raw files", float(truth_ok), "must match exactly", bool(truth_ok)))
    checks.append(("control totals (V-M125)", float("nan"),
                   "not recomputed here; reported by the pipeline team", None))
    return checks


# ---------------------------------------------------------------- world scope

def build_world_truth(path):
    """S-NPP country x month totals for every country, by protocol rules 1 to 3. Batches with pyarrow only."""
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq
    gaps = pa.array([date.fromisoformat(d) for d in sorted(read_gap_days())], type=pa.date32())
    pf = pq.ParquetFile(path)
    parts = []
    for batch in pf.iter_batches(batch_size=WORLD_BATCH_ROWS, columns=["sat", "country", "day", "detections"]):
        t = pa.Table.from_batches([batch])
        m = pc.equal(t["sat"], "SNPP")
        m = pc.and_(m, pc.invert(pc.is_in(t["day"], value_set=gaps)))
        yr, mo = pc.year(t["day"]), pc.month(t["day"])
        m = pc.and_(m, pc.invert(pc.and_(pc.equal(yr, 2012), pc.equal(mo, 1))))
        t = t.filter(m)
        if t.num_rows == 0:
            continue
        ym = pc.add(pc.multiply(pc.year(t["day"]), 12), pc.subtract(pc.month(t["day"]), 1))
        t = t.append_column("ym", ym)
        g = t.group_by(["country", "ym"]).aggregate([("detections", "count", pc.CountOptions(mode="all")),
                                                      ("detections", "sum")])
        parts.append(g.to_pandas())
    df = pd.concat(parts, ignore_index=True)
    df = df.rename(columns={"detections_count": "cd", "detections_sum": "hot"})
    df = df.groupby(["country", "ym"], as_index=False)[["cd", "hot"]].sum()
    df["cd"] = df["cd"].astype(np.int64)
    df["hot"] = df["hot"].astype(np.int64)
    return df.sort_values(["country", "ym"]).reset_index(drop=True)


def load_world_truth(data, use_cache=True):
    """Country x month truth for all countries, cached under derived/bakeoff. Returns None when the file is absent."""
    src = Path(data) / "derived" / "world" / "cell_days.parquet"
    if not src.exists():
        return None
    cache_dir = Path(data) / "derived" / "bakeoff"
    cache = cache_dir / "world_truth_country_month.parquet"
    meta = cache_dir / "world_truth_country_month.json"
    st = src.stat()
    key = {"size": st.st_size, "mtime_ns": st.st_mtime_ns, "gap_days": sorted(read_gap_days()), "version": 1}
    if use_cache and cache.exists() and meta.exists():
        try:
            if json.load(open(meta)) == key:
                return pd.read_parquet(cache)
        except (ValueError, OSError):
            pass
    df = build_world_truth(src)
    cache_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(cache, index=False)
    json.dump(key, open(meta, "w"))
    return df


def validate_world_truth(wtruth, truth):
    """Bulgaria and the United States must equal the two-country truth for every month. Returns (lines, ok)."""
    lines = []
    ok = True
    first, last = ym_of(2012, 2), ym_of(2025, 12)
    ym = np.arange(first, last + 1)
    for c in COUNTRIES:
        w = wtruth[wtruth["country"] == c].set_index("ym")
        t = truth.q25[c].groupby("ym")[["cd", "hot"]].sum()
        wk = w[(w.index >= first) & (w.index <= last)]
        for unit in UNITS:
            a = w[unit].reindex(ym, fill_value=0).values.astype(np.int64)
            b = t[unit].reindex(ym, fill_value=0).values.astype(np.int64)
            same = bool((a == b).all())
            ok &= same
            lines.append("%s %s: %d months compared, %s (world total %d, two-country total %d)"
                         % (c, unit, len(ym), "equal" if same else "DIFFERENT", int(a.sum()), int(b.sum())))
            if not same:
                bad = np.nonzero(a != b)[0][:5]
                lines.append("  first differences at months %s: world %s, two-country %s"
                             % ([("%d-%02d" % (int(ym[i]) // 12, int(ym[i]) % 12 + 1)) for i in bad],
                                a[bad].tolist(), b[bad].tolist()))
        extra = set(wk.index) - set(truth.q25[c]["ym"].unique())
        if extra:
            ok = False
            lines.append("%s: %d months have world truth but no two-country truth" % (c, len(extra)))
    return lines, ok


def validate_world_pred(df):
    """The world file: any country, grids country and q25. Returns the frame with a ym column."""
    missing = [c for c in PRED_COLS if c not in df.columns]
    if missing:
        raise ValueError("W pred.parquet misses columns: %s" % missing)
    df = df[PRED_COLS].copy()
    for col, ok in (("test", TESTS), ("unit", UNITS), ("grid", ["country", "q25"])):
        bad = ~df[col].isin(ok)
        if bad.any():
            raise ValueError("W column %s has values outside %s" % (col, ok))
    if df["country"].isna().any():
        raise ValueError("W has rows without a country")
    for col in ("pred", "lo", "hi"):
        if df[col].isna().any():
            raise ValueError("W column %s has missing values" % col)
    if (df[["pred", "lo", "hi"]] < 0).any().any():
        raise ValueError("W has negative pred, lo or hi")
    df["cell"] = df["cell"].astype(np.int64)
    if (df.loc[df["grid"] == "country", "cell"] != 0).any():
        raise ValueError("W rows with grid = country must have cell = 0")
    df["year"] = df["year"].astype(np.int64)
    df["month"] = df["month"].astype(np.int64)
    if df.duplicated(["pipeline", "test", "unit", "country", "grid", "cell", "year", "month"]).any():
        raise ValueError("W has duplicate rows")
    df["ym"] = df["year"] * 12 + df["month"] - 1
    return df


def world_country_scores(wdf, wtruth, label=WORLD_LABEL, band=0.9):
    """Level w_country: one row per country, test and unit from the country-month rows."""
    rows = []
    cr = wdf[(wdf["pipeline"] == label) & (wdf["grid"] == "country")]
    tr = {c: g.set_index("ym") for c, g in wtruth.groupby("country")}
    for test in TESTS:
        months = test_months(test)
        ym = np.array([ym_of(y, m) for y, m in months])
        for unit in UNITS:
            sub = cr[(cr["test"] == test) & (cr["unit"] == unit) & cr["ym"].isin(set(ym.tolist()))]
            if len(sub) == 0:
                continue
            for country, g in sub.groupby("country"):
                agg = g.groupby("ym")[["pred", "lo", "hi"]].sum().reindex(ym, fill_value=0.0)
                tt = tr[country][unit].reindex(ym, fill_value=0).values.astype(float) if country in tr else np.zeros(len(ym))
                m = measures(tt, agg["pred"].values, agg["lo"].values, agg["hi"].values)
                m.update({"pipeline": label, "level": "w_country", "test": test, "country": country, "unit": unit,
                          "grid": "country", "band": band, "mean_truth": float(tt.mean()),
                          "nonzero_months": int((tt > 0).sum()),
                          "scorable": bool((tt > 0).sum() >= WORLD_MIN_NONZERO_MONTHS)})
                rows.append(m)
    cols = SCORE_COLS + ["mean_truth", "nonzero_months", "scorable"]
    return pd.DataFrame(rows, columns=cols) if rows else pd.DataFrame(columns=cols)


def world_summary(pc, wdf, wtruth, label=WORLD_LABEL):
    """Rows of the proof-page table for unit cd. pc = per-country scores. Returns (summary frame, too-little-fire lists)."""
    out = []
    little = {}
    cr = wdf[(wdf["pipeline"] == label) & (wdf["grid"] == "country")]
    for test in TESTS:
        d = pc[(pc["test"] == test) & (pc["unit"] == "cd")]
        if len(d) == 0:
            continue
        sc = d[d["scorable"]].sort_values(["mean_truth", "country"]).reset_index(drop=True)
        little[test] = sorted(d.loc[~d["scorable"], "country"].tolist())
        groups = [("all", sc)]
        if len(sc):
            parts = np.array_split(np.arange(len(sc)), 3)
            for name, idx in zip(("small", "medium", "large"), parts):
                groups.append((name, sc.iloc[idx]))
        for name, g in groups:
            row = {"test": test, "unit": "cd", "group": name, "n_countries": int(len(g)),
                   "too_little_fire": len(little[test]) if name == "all" else float("nan")}
            for col, tag in (("nrmse", "nrmse"), ("bias", "bias")):
                v = g[col].dropna().values.astype(float)
                row[tag + "_p50"] = float(np.percentile(v, 50)) if len(v) else float("nan")
                row[tag + "_p10"] = float(np.percentile(v, 10)) if len(v) else float("nan")
                row[tag + "_p90"] = float(np.percentile(v, 90)) if len(v) else float("nan")
            cov = g["coverage"].values.astype(float)
            row["coverage_in_range"] = float(((cov >= WORLD_COVERAGE[0]) & (cov <= WORLD_COVERAGE[1])).mean()) if len(cov) else float("nan")
            row["mean_truth_min"] = float(g["mean_truth"].min()) if len(g) else float("nan")
            row["mean_truth_max"] = float(g["mean_truth"].max()) if len(g) else float("nan")
            out.append(row)
        # pooled world total: every country added per month
        months = test_months(test)
        ym = np.array([ym_of(y, m) for y, m in months])
        sub = cr[(cr["test"] == test) & (cr["unit"] == "cd") & cr["ym"].isin(set(ym.tolist()))]
        pred = sub.groupby("ym")[["pred", "lo", "hi"]].sum().reindex(ym, fill_value=0.0)
        tru = wtruth.groupby("ym")["cd"].sum().reindex(ym, fill_value=0).values.astype(float)
        m = measures(tru, pred["pred"].values, pred["lo"].values, pred["hi"].values)
        out.append({"test": test, "unit": "cd", "group": "pooled_world", "n_countries": int(sub["country"].nunique()),
                    "pooled_nrmse": m["nrmse"], "pooled_bias": m["bias"], "pooled_r": m["r"]})
    cols = ["test", "unit", "group", "n_countries", "too_little_fire", "nrmse_p50", "nrmse_p10", "nrmse_p90",
            "bias_p50", "bias_p10", "bias_p90", "coverage_in_range", "mean_truth_min", "mean_truth_max",
            "pooled_nrmse", "pooled_bias", "pooled_r"]
    return pd.DataFrame(out, columns=cols), little


def world_scope(data, truth, truth_ok, wdf_all, band, use_cache=True):
    """Runs the world scope. Returns a dict for the report, and writes the two world CSV files."""
    res = {"available": False, "message": "", "validation": [], "summary": None, "little": {}, "ok": False}
    wt = load_world_truth(data, use_cache)
    if wt is None:
        res["message"] = "the world cell-days file is not available"
        return res
    lines, ok = validate_world_truth(wt, truth)
    res["validation"] = lines + ["truth samples from the raw files: %s" % ("match" if truth_ok else "DO NOT MATCH")]
    if not ok or not truth_ok:
        res["message"] = "world truth failed validation, world scope not scored"
        return res
    pc = world_country_scores(wdf_all, wt, band=band)
    summ, little = world_summary(pc, wdf_all, wt)
    base = Path(data) / "derived" / "bakeoff"
    pc.to_csv(base / "world_country_scores.csv", index=False)
    summ.to_csv(base / "world_scores.csv", index=False)
    res.update({"available": True, "summary": summ, "little": little, "ok": True, "per_country": pc,
                "countries_in_truth": int(wt["country"].nunique())})
    return res


def world_section(world):
    L = ["## World scope: the world fit on every country (information) [V]", ""]
    if world is None:
        L += ["not available (no W predictions).", ""]
        return L
    L.append("Pipeline label `W` is the model fitted on all countries. It is routed like a label starting with A: "
             "its `q25` rows for Bulgaria and the United States go through levels (a), (b), (c) and (c2), with `q25` cells for the circles. "
             "Its country-month rows (`grid` country) are scored for every country at level (w_country) against S-NPP truth "
             "from the world cell-days file (rules 1 to 3 of the protocol, no hot-spot of any other sensor).")
    L.append("")
    L.append("Truth validation:")
    for v in world["validation"]:
        L.append("- " + v)
    L.append("")
    if not world["available"]:
        L += ["Not scored: " + world["message"] + ".", ""]
        return L
    for n in world.get("notes", []):
        L.append("- note: " + n)
    summ = world["summary"]
    L.append("Unit `cd`. Percentiles are across countries with at least %d months of non-zero truth in the test window [U]. "
             "Groups are equal thirds of those countries by mean monthly truth. Coverage is the share of countries whose "
             "coverage lies between %.2f and %.2f for the 0.9 band [U]. The pooled world total adds every country per month."
             % (WORLD_MIN_NONZERO_MONTHS, WORLD_COVERAGE[0], WORLD_COVERAGE[1]))
    L.append("")
    L.append(md_table(summ))
    L.append("")
    for test, names in world["little"].items():
        L.append("Too little fire to score, %s: %d countries (left out of the percentiles)." % (test, len(names)))
    L.append("")
    return L


# ---------------------------------------------------------------- report

def fmt(x, nd=4):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "n/a"
    if isinstance(x, (int, np.integer)):
        return str(int(x))
    return ("%." + str(nd) + "f") % x


def md_table(df, cols=None, nd=4):
    cols = list(df.columns) if cols is None else cols
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for _, r in df.iterrows():
        lines.append("| " + " | ".join(fmt(r[c], nd) if not isinstance(r[c], str) else r[c] for c in cols) + " |")
    return "\n".join(lines)


def adoption_rule(scores, old="A2", new="A3"):
    """Rows for the A2 vs A3 adoption table. Returns (rows, available, not_worse, coverage_ok)."""
    rows = []
    have = set(scores["pipeline"].unique())
    if old not in have or new not in have:
        return rows, False, 0, 0
    not_worse = cov_ok = 0
    for test in WINNER_TESTS:
        for country in COUNTRIES:
            def get(p, level, col):
                g = scores[(scores.pipeline == p) & (scores.level == level) & (scores.test == test)
                           & (scores.country == country) & (scores.unit == "cd")]
                return float(g[col].iloc[0]) if len(g) else float("nan")
            n_old, n_new = get(old, "a", "nrmse"), get(new, "a", "nrmse")
            cov = get(new, "b", "coverage")
            nw = (not math.isnan(n_old)) and (not math.isnan(n_new)) and n_new <= n_old
            ok = (not math.isnan(cov)) and ADOPT_COVERAGE[0] <= cov <= ADOPT_COVERAGE[1]
            not_worse += int(nw)
            cov_ok += int(ok)
            rows.append({"test": test, "country": country, "nRMSE " + old: n_old, "nRMSE " + new: n_new,
                         "not worse": "yes" if nw else "no", "coverage b " + new: cov,
                         "in range": "yes" if ok else "no"})
    return rows, True, not_worse, cov_ok


def adoption_section(scores, old="A2", new="A3"):
    L = ["## For information: A2 vs A3 adoption rule [V]", ""]
    rows, avail, nw, ck = adoption_rule(scores, old, new)
    if not avail:
        L += ["not available (needs both %s and %s)." % (old, new), ""]
        return L
    L.append("Unit `cd`. Level (a) nRMSE of %s and %s for t1 and t2 in both countries. %s is not worse when its nRMSE is at most that of %s; "
             "the rule needs at least %d of 4 [U]. The level (b) coverage of %s must lie between %.2f and %.2f [U]."
             % (old, new, new, old, ADOPT_MIN_NOT_WORSE, new, ADOPT_COVERAGE[0], ADOPT_COVERAGE[1]))
    L.append("")
    L.append(md_table(pd.DataFrame(rows)))
    L.append("")
    L.append("%s is not worse in %d of 4 cases (needs %d): %s. Coverage inside the range in %d of 4 cases (needs 4): %s."
             % (new, nw, ADOPT_MIN_NOT_WORSE, "met" if nw >= ADOPT_MIN_NOT_WORSE else "not met", ck, "met" if ck == 4 else "not met"))
    L.append("")
    return L


def build_report(scores, cdf, winner, wa, wb, d7, gate, manifests, notes, truth_ok, skipped, world=None):
    L = []
    L.append("# Bake-off results: pipeline A vs pipeline B")
    L.append("")
    L.append("Written by `pipeline/bakeoff/score.py` from the frozen rules in `pipeline/bakeoff/PROTOCOL.md`. "
             "Every number here is measured by the scorer [V]. Thresholds are our own choice [U].")
    L.append("")
    L.append("## Summary")
    L.append("")
    if skipped:
        L.append("Not scored: " + "; ".join(skipped) + " [V].")
        L.append("")
    if winner is None:
        L.append("The 12 contests could not all be decided, because A or B has no scores for some of them [V].")
    else:
        L.append("Pipeline %s wins the method decision: A won %d of 12 contests and B won %d [V]. "
                 "A 6 to 6 result goes to A by the protocol." % (winner, wa, wb))
        k, _ = d7
        if k >= D7_NEEDED:
            L.append("Hotspots are the calendar default: the winner's hotspot error is within %.2f times its fire-day error "
                     "in %d of 12 contests (needs %d) [V]." % (D7_FACTOR, k, D7_NEEDED))
        else:
            L.append("Fire days are the calendar default: the winner's hotspot error is within %.2f times its fire-day error "
                     "in only %d of 12 contests (needs %d) [V]." % (D7_FACTOR, k, D7_NEEDED))
        failed = [g for g in gate if g[3] is False]
        if failed:
            L.append("The world gate is not met: %d check(s) fail [V]. The team decides." % len(failed))
        else:
            L.append("All world-gate checks that the scorer can compute pass [V]. The control-totals check is reported by the pipeline team.")
    L.append("")
    L.append("Truth check against the raw-file samples: %s [V]." % ("matches exactly" if truth_ok else "DOES NOT MATCH"))
    L.append("")
    L.append("## The 12 contests (rule 1) [V]")
    L.append("")
    L.append("Unit `cd` (fire cell-days). The lower nRMSE wins. A tie goes to A.")
    L.append("")
    L.append(md_table(cdf, ["level", "test", "country", "nrmse_A", "nrmse_B", "winner"]))
    L.append("")
    L.append("## Default unit (rule 2, D-7) [V]")
    L.append("")
    if winner is None:
        L.append("Not decided: the winner is not known.")
    else:
        k, detail = d7
        L.append("Winner %s. Needs hotspot nRMSE at most %.2f times fire-day nRMSE [U] in at least %d of 12 contests. Result: %d of 12."
                 % (winner, D7_FACTOR, D7_NEEDED, k))
        L.append("")
        dd = pd.DataFrame(detail, columns=["level", "test", "country", "nrmse_cd", "nrmse_hot", "within"])
        dd["within"] = dd["within"].map(lambda v: "yes" if v else "no")
        L.append(md_table(dd))
    L.append("")
    L.append("## Gate to the whole world (rule 3) [V]")
    L.append("")
    if winner is None:
        L.append("Not decided: the winner is not known.")
    else:
        gd = pd.DataFrame([(g[0], g[1], g[2], "pass" if g[3] else ("not computed" if g[3] is None else "fail")) for g in gate],
                          columns=["check", "value", "rule", "result"])
        L.append(md_table(gd))
        L.append("")
        L.append("A miss is reported here. The team decides.")
    L.append("")
    L.append("## Manifests")
    L.append("")
    for k, m in manifests.items():
        L.append("- %s: band %s." % (k, m.get("band")))
    L.append("")
    if notes:
        L.append("## Scoring notes")
        L.append("")
        for n in notes:
            L.append("- " + n)
        L.append("")
    L.append("## For information: every pipeline label side by side [V]")
    L.append("")
    L.append("Not part of the winner rule. Levels (a), (a_joint), (b), (c) and (c2), nRMSE, bias and coverage per label. "
             "Level (c2) weights each q25 cell by the share of its 625 sub-cells of 0.01 degrees inside the circle. "
             "Level (a_joint) scores the country-month rows (grid country) with their jointly computed range.")
    L.append("")
    labels = sorted(scores["pipeline"].unique())
    side = []
    for (level, test, country, unit), g in scores[scores["level"].isin(["a", "a_joint", "b", "c", "c2"])].groupby(
            ["level", "test", "country", "unit"], sort=True):
        row = {"level": level, "test": test, "country": country, "unit": unit}
        for lab in labels:
            gl = g[g["pipeline"] == lab]
            row["nRMSE " + lab] = float(gl["nrmse"].iloc[0]) if len(gl) else float("nan")
            row["bias " + lab] = float(gl["bias"].iloc[0]) if len(gl) else float("nan")
            row["cov " + lab] = float(gl["coverage"].iloc[0]) if len(gl) else float("nan")
        side.append(row)
    if side:
        L.append(md_table(pd.DataFrame(side)))
    L.append("")
    L.extend(adoption_section(scores))
    L.extend(world_section(world))
    L.append("## Full tables [V]")
    L.append("")
    L.append("Columns: n = rows scored, nRMSE = root mean squared error over mean truth, MAE = mean absolute error, "
             "bias = (sum predicted - sum truth) / sum truth, r = Pearson r, slope = slope of truth on prediction, "
             "coverage = share of rows with lo <= truth <= hi, MAPE = on rows with truth above 0 (information only).")
    L.append("")
    for (pipe, level), g in scores.groupby(["pipeline", "level"], sort=True):
        L.append("### Pipeline %s, level (%s) %s" % (pipe, level, LEVEL_NAMES[level]))
        L.append("")
        L.append(md_table(g.sort_values(["test", "country", "unit"]),
                          ["test", "country", "unit", "grid", "n", "nrmse", "mae", "bias", "r", "slope", "coverage", "mape", "band"]))
        L.append("")
    return "\n".join(L) + "\n"


# ---------------------------------------------------------------- driver

def run_scoring(data, truth, truth_ok, write_docs, docs_path=None):
    base = Path(data) / "derived" / "bakeoff"
    frames = []
    manifests = {}
    skipped = []
    notes = []
    for folder in ["A", "B"]:
        p = base / folder / "pred.parquet"
        m = base / folder / "manifest.json"
        if not p.exists():
            skipped.append("pipeline %s has no pred.parquet" % folder)
            continue
        if not m.exists():
            skipped.append("pipeline %s has no manifest.json" % folder)
            continue
        man = json.load(open(m))
        try:
            df, nt = validate_pred(pd.read_parquet(p))
        except ValueError as e:
            skipped.append("pipeline %s: %s" % (folder, e))
            continue
        notes += ["pipeline %s: %s" % (folder, n) for n in nt]
        manifests[folder] = man
        frames.append((folder, df, man))
    wdf = None
    wband = 0.9
    wnotes = []
    wp = base / WORLD_LABEL / "pred.parquet"
    if wp.exists():
        try:
            wdf = validate_world_pred(pd.read_parquet(wp))
            wm = base / WORLD_LABEL / "manifest.json"
            if wm.exists():
                wband = json.load(open(wm)).get("band", 0.9)
        except ValueError as e:
            wnotes.append("W: %s" % e)
            wdf = None
    world_fail = None
    if wp.exists() and wdf is None:
        world_fail = {"available": False, "message": "; ".join(wnotes), "validation": [], "notes": []}
    if not frames and wdf is None:
        print("No predictions found under %s. Nothing scored, no report written." % (base))
        for s in skipped:
            print("  skipped: " + s)
        return 0
    rows = []
    for folder, df, man in frames:
        band = man.get("band")
        for label in sorted(df["pipeline"].unique()):
            r, n = score_label(truth, df, label, band)
            rows += r
            notes += n
    world = world_fail
    if wdf is not None:
        two = wdf[wdf["country"].isin(COUNTRIES)]
        try:
            w2, nt = validate_pred(two.drop(columns=["ym"]))
        except ValueError as e:
            w2, nt = None, ["W: %s" % e]
        wnotes += nt
        if w2 is not None and len(w2):
            for label in sorted(w2["pipeline"].unique()):
                r, n = score_label(truth, w2, label, wband)
                rows += r
                wnotes += n
        world = world_scope(data, truth, truth_ok, wdf, wband)
        world["notes"] = wnotes
    scores = pd.DataFrame(rows)[SCORE_COLS]
    scores.to_csv(base / "scores.csv", index=False)
    cdf = contests(scores)
    winner, wa, wb = decide_winner(cdf)
    d7 = (0, [])
    gate = []
    if winner is not None:
        d7 = d7_rule(cdf, winner)
        gate = gate_checks(scores, winner, manifests.get(winner, {}).get("band"), truth_ok)
    report = build_report(scores, cdf, winner, wa, wb, d7, gate, manifests, notes, truth_ok, skipped, world)
    print(report)
    if write_docs:
        out = Path(docs_path) if docs_path else ROOT / "docs" / "research" / "bakeoff-results.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report)
        print("Wrote %s and %s" % (out, base / "scores.csv"))
    return 0


# ---------------------------------------------------------------- self-test

class Checker:
    def __init__(self):
        self.n = 0
        self.fail = []

    def ok(self, cond, msg):
        self.n += 1
        if not cond:
            self.fail.append(msg)
            print("  FAIL: " + msg)

    def close(self, a, b, msg, tol=1e-9):
        self.ok(abs(a - b) <= tol, "%s: got %r, expected %r" % (msg, a, b))


def fake_pred(truth, label, mult, grids, lo_mult=None, hi_mult=None):
    """Prediction = mult x truth for all three tests, both units, both countries."""
    parts = []
    for test in TESTS:
        months = test_months(test)
        ymset = set(ym_of(y, m) for y, m in months)
        for country in COUNTRIES:
            for grid in grids:
                tab = (truth.q25 if grid == "q25" else truth.d10)[country]
                tab = tab[tab["ym"].isin(ymset)]
                for unit in UNITS:
                    v = tab[unit].values.astype(float)
                    parts.append(pd.DataFrame({
                        "pipeline": label, "test": test, "unit": unit, "country": country, "grid": grid,
                        "cell": tab["cell"].values, "year": tab["ym"].values // 12,
                        "month": tab["ym"].values % 12 + 1, "pred": v * mult,
                        "lo": v * (mult if lo_mult is None else lo_mult),
                        "hi": v * (mult if hi_mult is None else hi_mult)}))
    return pd.concat(parts, ignore_index=True)


SYN_SPEC = [
    ("Alpha", lambda y, m: 3 * (1 + (y * 12 + m) % 3)),
    ("Beta", lambda y, m: 5 * (1 + (y * 12 + m) % 3)),
    ("Gamma", lambda y, m: 8 * (1 + (y * 12 + m) % 3)),
    ("Delta", lambda y, m: 12 * (1 + (y * 12 + m) % 3)),
    ("Zeta", lambda y, m: 20 * (1 + (y * 12 + m) % 3)),
    ("Edge12", lambda y, m: 6 if y in (2013, 2019) else 0),
    ("Quiet11", lambda y, m: 4 if (y in (2013, 2019) and m <= 11) else 0),
    ("Tiny", lambda y, m: 2 if (y in (2013, 2019) and m <= 5) else 0),
    ("Bulgaria", lambda y, m: 7 * (1 + (y + m) % 2)),
    ("United_States", lambda y, m: 30 * (1 + (y * 12 + m) % 3)),
]


def syn_world():
    """Synthetic world cell-days with answers known by construction. Returns (frame, expected {(country, ym): [cd, hot]})."""
    gaps = read_gap_days()
    rows = []
    expect = {}
    for ci, (name, fn) in enumerate(SYN_SPEC):
        for y in range(2012, 2026):
            for m in range(1, 13):
                for j in range(fn(y, m)):
                    d = date(y, m, 1 + (j % 27))
                    det = 1 + j % 2
                    counted = d.isoformat() not in gaps and not (y == 2012 and m == 1)
                    for sat in ("SNPP", "Terra", "Aqua", "NOAA20"):
                        rows.append({"sensor": "viirs", "sat": sat, "country": name, "day": d, "cy": 4000 + ci, "cx": ci * 1000 + j,
                                     "detections": det, "frp": 1.0, "seen_day": True, "seen_night": False})
                    if counted:
                        e = expect.setdefault((name, ym_of(y, m)), [0, 0])
                        e[0] += 1
                        e[1] += det
    return pd.DataFrame(rows), expect


def ref_measures(t, p, lo, hi):
    """Plain-Python reference of the measures, used only by the self-test."""
    n = len(t)
    mt = sum(t) / n
    mp = sum(p) / n
    out = {"nrmse": math.sqrt(sum((a - b) ** 2 for a, b in zip(p, t)) / n) / mt if mt > 0 else float("nan"),
           "mae": sum(abs(a - b) for a, b in zip(p, t)) / n,
           "bias": (sum(p) - sum(t)) / sum(t) if sum(t) > 0 else float("nan"),
           "coverage": sum(1 for a, l, h in zip(t, lo, hi) if l <= a <= h) / n,
           "mean_truth": mt}
    vt = sum((a - mt) ** 2 for a in t)
    vp = sum((b - mp) ** 2 for b in p)
    cov = sum((a - mt) * (b - mp) for a, b in zip(t, p))
    out["r"] = cov / math.sqrt(vt * vp) if vt > 0 and vp > 0 else float("nan")
    return out


def syn_pred(name, t):
    if name == "Beta":
        return 2.0 * t, 2.0 * t, 2.0 * t
    if name == "Gamma":
        return 0.5 * t, 0.5 * t, 0.5 * t
    if name == "Zeta":
        return 1.5 * t, 1.0 * t, 2.0 * t
    return t, t, t


def syn_pred_full(name, t, idx):
    pr, lo, hi = syn_pred(name, t)
    if name == "Delta":
        if idx % 12 == 0 and t > 0:
            return t + 5, t + 5, t + 5
        return t, 0.5 * t, 1.5 * t
    return pr, lo, hi


def selftest_world(ck):
    print("Self-test: world scope with a synthetic world")
    wdf, expect = syn_world()
    tmp = Path(tempfile.mkdtemp(prefix="bakeoff-world-selftest-"))
    try:
        (tmp / "derived" / "world").mkdir(parents=True)
        base = tmp / "derived" / "bakeoff"
        for f in ("A", "B", "W"):
            (base / f).mkdir(parents=True)
        wdf.to_parquet(tmp / "derived" / "world" / "cell_days.parquet")
        two = wdf[wdf["country"].isin(COUNTRIES)].reset_index(drop=True)
        st = Truth(two)
        wt = load_world_truth(tmp)
        got = {(r.country, int(r.ym)): [int(r.cd), int(r.hot)] for r in wt.itertuples()}
        ck.ok(got == expect, "world truth equals the counts known by construction (%d country-months)" % len(expect))
        ck.ok(not any(k[0] in ("Terra", "Aqua") for k in got) and len(set(k[0] for k in got)) == len(SYN_SPEC),
              "all countries present, other sensors ignored")
        ck.ok(all(k[1] >= ym_of(2012, 2) for k in got), "January 2012 is dropped")
        gap_rows = wdf[(wdf.sat == "SNPP") & (wdf.day == date(2022, 7, 27))]
        ck.ok(len(gap_rows) > 0 and got[("Zeta", ym_of(2022, 7))][0] == int(
            ((wdf.sat == "SNPP") & (wdf.country == "Zeta") & (pd.to_datetime(wdf.day).dt.year == 2022)
             & (pd.to_datetime(wdf.day).dt.month == 7) & (~wdf.day.astype(str).isin(read_gap_days()))).sum()),
            "gap days are dropped from the world truth")
        cache = base / "world_truth_country_month.parquet"
        ck.ok(cache.exists(), "the truth is cached")
        wt2 = load_world_truth(tmp)
        ck.ok(wt2.equals(wt), "a cached read gives the same truth")
        lines, ok = validate_world_truth(wt, st)
        ck.ok(ok and len(lines) == 4, "Bulgaria and the United States equal the two-country truth for every month")
        bad = wt.copy()
        i = bad.index[(bad.country == "Bulgaria") & (bad.ym == ym_of(2020, 5))][0]
        bad.loc[i, "cd"] += 1
        ck.ok(not validate_world_truth(bad, st)[1], "a one-count difference in Bulgaria is caught")

        # predictions
        tr = {n: {} for n, _ in SYN_SPEC}
        for (c, ym), (cd, hot) in expect.items():
            tr[c][ym] = {"cd": cd, "hot": hot}
        parts = []
        for test in TESTS:
            months = test_months(test)
            for name, _ in SYN_SPEC:
                for unit in UNITS:
                    for idx, (yy, mm) in enumerate(months):
                        t = float(tr[name].get(ym_of(yy, mm), {}).get(unit, 0))
                        pr, lo, hi = syn_pred_full(name, t, idx)
                        parts.append({"pipeline": "W", "test": test, "unit": unit, "country": name, "grid": "country",
                                      "cell": 0, "year": yy, "month": mm, "pred": pr, "lo": lo, "hi": hi})
        wp = pd.concat([pd.DataFrame(parts), fake_pred(st, "W", 1.0, ["q25"])], ignore_index=True)
        # baseline run without W, then with W
        A = fake_pred(st, "A", 1.0, ["q25"])
        B = fake_pred(st, "B", 2.0, ["q25", "d10"], lo_mult=1.0, hi_mult=2.0)
        A.to_parquet(base / "A" / "pred.parquet")
        B.to_parquet(base / "B" / "pred.parquet")
        json.dump({"band": 0.9}, open(base / "A" / "manifest.json", "w"))
        json.dump({"band": 0.8}, open(base / "B" / "manifest.json", "w"))
        d1, d2 = tmp / "docs1.md", tmp / "docs2.md"
        run_quiet(lambda: run_scoring(tmp, st, True, True, d1))
        sc1 = pd.read_csv(base / "scores.csv")
        wp.to_parquet(base / "W" / "pred.parquet")
        json.dump({"band": 0.9}, open(base / "W" / "manifest.json", "w"))
        run_quiet(lambda: run_scoring(tmp, st, True, True, d2))
        sc2 = pd.read_csv(base / "scores.csv")
        ck.ok(sc2[sc2.pipeline != "W"].reset_index(drop=True).equals(sc1), "adding W leaves every A and B score row unchanged")
        ck.ok("w_country" not in set(sc2.level), "w_country rows live in their own file, not in scores.csv")
        for lv in ("a", "b", "c", "c2", "a_joint"):
            ck.ok(len(sc2[(sc2.pipeline == "W") & (sc2.level == lv)]) > 0, "W has level %s rows" % lv)
        wa = sc2[(sc2.pipeline == "W") & (sc2.level == "a") & (sc2.test == "t1") & (sc2.country == "Bulgaria") & (sc2.unit == "cd")].iloc[0]
        ck.close(wa.nrmse, 0.0, "W q25 rows of Bulgaria are scored by level (a)")
        ck.ok(sc2[(sc2.pipeline == "W") & (sc2.level == "c")].grid.eq("q25").all(), "W is routed to q25 for the circles")
        t1, t2 = d1.read_text(), d2.read_text()
        for h in ("## Summary", "## The 12 contests (rule 1) [V]", "## Default unit (rule 2, D-7) [V]",
                  "## Gate to the whole world (rule 3) [V]"):
            def sec(txt):
                out, on = [], False
                for ln in txt.split("\n"):
                    if ln.startswith("## "):
                        on = ln == h
                    if on:
                        out.append(ln)
                return "\n".join(out)
            ck.ok(sec(t1) == sec(t2), "pre-registered section unchanged with W: " + h)
        # per-country scores against the plain-Python reference
        pc = pd.read_csv(base / "world_country_scores.csv")
        ck.ok(len(pc) == len(SYN_SPEC) * 3 * 2, "one w_country row per country, test and unit")
        worst = 0.0
        for test in TESTS:
            months = test_months(test)
            for name, _ in SYN_SPEC:
                for unit in UNITS:
                    t = [float(tr[name].get(ym_of(y, m), {}).get(unit, 0)) for y, m in months]
                    sub = wp[(wp.country == name) & (wp.grid == "country") & (wp.test == test) & (wp.unit == unit)]
                    sub = sub.assign(ym=sub.year * 12 + sub.month - 1).set_index("ym")
                    keys = [ym_of(y, m) for y, m in months]
                    p = [float(sub.loc[k, "pred"]) for k in keys]
                    lo = [float(sub.loc[k, "lo"]) for k in keys]
                    hi = [float(sub.loc[k, "hi"]) for k in keys]
                    ref = ref_measures(t, p, lo, hi)
                    row = pc[(pc.test == test) & (pc.country == name) & (pc.unit == unit)].iloc[0]
                    for k in ("nrmse", "mae", "bias", "coverage", "mean_truth", "r"):
                        a, b = float(row[k]), ref[k]
                        if math.isnan(b):
                            ck.ok(math.isnan(a), "%s %s %s %s is undefined" % (name, test, unit, k))
                        else:
                            worst = max(worst, abs(a - b) / max(1.0, abs(b)))
                    ck.ok(int(row.n) == len(months) and int(row.nonzero_months) == sum(1 for v in t if v > 0),
                          "months and non-zero months of %s %s %s" % (name, test, unit))
        ck.ok(worst < 1e-9, "w_country measures equal the plain-Python reference (worst relative difference %.2e)" % worst)
        ws = pd.read_csv(base / "world_scores.csv")
        for test in ("t1", "t2"):
            months = test_months(test)
            d = pc[(pc.test == test) & (pc.unit == "cd")]
            sc = d[d.scorable]
            ck.ok(sorted(d[~d.scorable].country) == ["Quiet11", "Tiny"], "too little fire: Quiet11 and Tiny, not Edge12 (exactly 12) %s" % test)
            ck.ok("Edge12" in set(sc.country), "a country with exactly 12 non-zero months is scored %s" % test)
            order = sc.sort_values(["mean_truth", "country"]).country.tolist()
            sizes = [3, 3, 2]
            pos = 0
            for gname, sz in zip(("small", "medium", "large"), sizes):
                members = order[pos:pos + sz]
                pos += sz
                vals = pc[(pc.test == test) & (pc.unit == "cd") & pc.country.isin(members)]
                row = ws[(ws.test == test) & (ws.group == gname)].iloc[0]
                ck.ok(int(row.n_countries) == sz, "%s %s has %d countries" % (test, gname, sz))
                ck.close(row.bias_p50, float(np.median(vals.bias)), "%s %s median bias" % (test, gname), 1e-9)
                ck.close(row.nrmse_p90, float(np.percentile(vals.nrmse, 90)), "%s %s p90 nRMSE" % (test, gname), 1e-9)
            allr = ws[(ws.test == test) & (ws.group == "all")].iloc[0]
            ck.ok(int(allr.n_countries) == 8 and int(allr.too_little_fire) == 2, "%s all: 8 scored, 2 too little fire" % test)
            ck.close(allr.bias_p10, float(np.percentile(sc.bias, 10)), "%s p10 bias" % test, 1e-9)
            inside = [c for c in sc.coverage if 0.80 <= c <= 0.97]
            ck.close(allr.coverage_in_range, len(inside) / len(sc), "%s share of countries with coverage in range" % test, 1e-12)
            ck.ok(len(inside) == 1, "only Delta has coverage inside 0.80 to 0.97 %s" % test)
            keys = [ym_of(y, m) for y, m in months]
            tt = [float(sum(tr[c].get(k, {}).get("cd", 0) for c in tr)) for k in keys]
            pp = [float(sum(syn_pred_full(c, float(tr[c].get(k, {}).get("cd", 0)), i)[0] for c in tr))
                  for i, k in enumerate(keys)]
            ref = ref_measures(tt, pp, pp, pp)
            pw = ws[(ws.test == test) & (ws.group == "pooled_world")].iloc[0]
            ck.close(pw.pooled_nrmse, ref["nrmse"], "%s pooled world nRMSE" % test, 1e-9)
            ck.close(pw.pooled_bias, ref["bias"], "%s pooled world bias" % test, 1e-9)
            ck.close(pw.pooled_r, ref["r"], "%s pooled world r" % test, 1e-9)
        ck.ok("## World scope" in t2 and "Too little fire to score" in t2, "the report carries the world scope")
        ck.ok("not available" in t1.split("## World scope")[1][:200], "without W the report says not available")
        bad_w = wp.copy()
        bad_w.loc[bad_w.grid == "country", "cell"] = 3
        try:
            validate_world_pred(bad_w)
            ck.ok(False, "W country rows with cell other than 0 must be rejected")
        except ValueError:
            ck.ok(True, "W country rows with cell other than 0 rejected")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def selftest(data):
    ck = Checker()
    print("Self-test: hand-computed measures")
    t = [1, 2, 3, 4]
    p = [1, 2, 3, 5]
    m = measures(t, p, [1, 2, 3, 5], [1, 2, 3, 5])
    ck.close(m["nrmse"], 0.2, "nRMSE of the hand example")
    ck.close(m["mae"], 0.25, "MAE of the hand example")
    ck.close(m["bias"], 0.1, "bias of the hand example")
    ck.close(m["r"], 6.5 / math.sqrt(5 * 8.75), "r of the hand example")
    ck.close(m["slope"], 6.5 / 8.75, "slope of truth on prediction")
    ck.close(m["coverage"], 0.75, "coverage when one row falls outside")
    ck.close(m["mape"], (0.0 + 0.0 + 0.0 + 0.25) / 4, "MAPE of the hand example")
    m0 = measures([0, 0, 2], [0, 0, 2], [0, 0, 2], [0, 0, 2])
    ck.close(m0["mape"], 0.0, "MAPE ignores rows with zero truth")

    print("Self-test: cell rule against tests/expected/cell_id.json")
    cases = json.load(open(ROOT / "tests" / "expected" / "cell_id.json"))["cases"]
    for c in cases:
        cy = round(c["center_lat"] * 100 - 0.5)
        cx = round(c["center_lon"] * 100 - 0.5)
        # a 0.01 cell at the centre of the q25 cell must map to that cell
        got = int(q25_cell_from_cd(cy, cx))
        ck.ok(got == c["cell_id"], "q25 cell of centre of %s: got %d, expected %d" % (c["name"], got, c["cell_id"]))
    ck.ok(int(q25_cell_from_cd(-1, 18000)) == 518400, "lon 180 wraps to column 0 (cell 518400)")
    ck.ok(int(q25_cell_from_cd(-1, -18000)) == 518400, "lon -180 is column 0 (cell 518400)")
    ck.ok(int(q25_cell_from_cd(-1, 17999)) == 360 * 1440 + 1439, "the last column before the wrap is 1439")
    ck.ok(int(d10_cell_from_cd(-1, -1)) == (-1 + 900) * 3600 + (-1 + 1800), "d10 floor for negative indices")
    ck.ok(int(d10_cell_from_cd(-10, -11)) == (-1 + 900) * 3600 + (-2 + 1800), "d10 floor at a negative boundary")
    d = haversine_km(0.0, 0.0, 0.0, 1.0)
    ck.close(d, 111.195, "haversine 1 degree of longitude at the equator", 0.01)

    print("Self-test: contest and gate logic")
    fake = []
    for lv in "abc":
        for tt in WINNER_TESTS:
            for co in COUNTRIES:
                fake.append({"level": lv, "test": tt, "country": co, "nrmse_A": 0.1, "nrmse_B": 0.1,
                             "winner": "A", "A_hot": 0.1, "B_hot": 0.1})
    cf = pd.DataFrame(fake)
    for i in range(6):
        cf.loc[i, "nrmse_B"] = 0.05
        cf.loc[i, "winner"] = "B"
    w, wa, wb = decide_winner(cf)
    ck.ok((w, wa, wb) == ("A", 6, 6), "a 6 to 6 result goes to A, got %r" % ((w, wa, wb),))
    cf.loc[0, "winner"] = "A"
    w, wa, wb = decide_winner(cf)
    ck.ok((w, wa, wb) == ("A", 7, 5), "7 to 5 goes to A")
    cf.loc[0:1, "winner"] = "B"
    cf.loc[6, "winner"] = "B"
    w, wa, wb = decide_winner(cf)
    ck.ok(w == "B", "B wins when it has more contests, got %r %d %d" % (w, wa, wb))
    cf2 = cf.copy()
    cf2["A_hot"] = 0.13
    k, _ = d7_rule(cf2, "A")
    ck.ok(k == 0, "D-7 counts none when hot is above 1.25 times cd, got %d" % k)
    cf2["A_hot"] = 0.125
    k, _ = d7_rule(cf2, "A")
    ck.ok(k == 12, "D-7 counts all when hot equals exactly 1.25 times cd, got %d" % k)

    print("Self-test: full scoring path with fake predictions (truth = S-NPP from the shared file)")
    truth = load_truth(data)
    tmp = Path(tempfile.mkdtemp(prefix="bakeoff-selftest-"))
    try:
        base = tmp / "derived" / "bakeoff"
        for folder in ("A", "B"):
            (base / folder).mkdir(parents=True)
        A = fake_pred(truth, "A", 1.0, ["q25"])
        B = fake_pred(truth, "B", 2.0, ["q25", "d10"], lo_mult=1.0, hi_mult=2.0)
        A.to_parquet(base / "A" / "pred.parquet")
        B.to_parquet(base / "B" / "pred.parquet")
        json.dump({"band": 0.9}, open(base / "A" / "manifest.json", "w"))
        json.dump({"band": 0.8}, open(base / "B" / "manifest.json", "w"))
        docs = tmp / "docs" / "bakeoff-results.md"
        run_quiet(lambda: run_scoring(tmp, truth, True, True, docs))
        sc = pd.read_csv(base / "scores.csv")

        def pick(pipe, level, test, country, unit, col):
            s = sc[(sc.pipeline == pipe) & (sc.level == level) & (sc.test == test) & (sc.country == country) & (sc.unit == unit)]
            ck.ok(len(s) == 1, "one score row for %s %s %s %s %s" % (pipe, level, test, country, unit))
            return float(s[col].iloc[0])

        for test in TESTS:
            for co in COUNTRIES:
                for unit in UNITS:
                    for lv in "ab":
                        tag = "A=truth %s %s %s %s" % (lv, test, co, unit)
                        ck.close(pick("A", lv, test, co, unit, "nrmse"), 0.0, "nRMSE " + tag)
                        ck.close(pick("A", lv, test, co, unit, "bias"), 0.0, "bias " + tag)
                        ck.close(pick("A", lv, test, co, unit, "coverage"), 1.0, "coverage " + tag)
                        ck.close(pick("A", lv, test, co, unit, "r"), 1.0, "r " + tag, 1e-9)
                        tag = "B=2x truth %s %s %s %s" % (lv, test, co, unit)
                        ck.close(pick("B", lv, test, co, unit, "bias"), 1.0, "bias " + tag)
                        ck.close(pick("B", lv, test, co, unit, "coverage"), 1.0, "coverage with range [truth, 2 x truth] " + tag)
                        ck.close(pick("B", lv, test, co, unit, "slope"), 0.5, "slope of truth on a 2x prediction " + tag, 1e-9)
                    tag = "B=2x truth d %s %s %s" % (test, co, unit)
                    ck.close(pick("B", "d", test, co, unit, "bias"), 1.0, "bias " + tag)
                    ck.close(pick("B", "d", test, co, unit, "nrmse"),
                             pick("B", "d", test, co, unit, "nrmse"), "nRMSE finite " + tag)
                    ck.ok(pick("B", "d", test, co, unit, "nrmse") > 0.5, "nRMSE of a 2x prediction is large " + tag)
        scs = pd.read_csv(base / "scores.csv")
        ck.ok(len(scs[(scs.pipeline == "A") & (scs.level == "c")]) == 12, "A has 12 circle scores (3 tests x 2 countries x 2 units)")
        ck.ok(len(scs[(scs.pipeline == "B") & (scs.level == "c")]) == 12, "B has 12 circle scores")
        ck.ok(len(scs[(scs.pipeline == "A") & (scs.level == "d")]) == 0, "A has no d10 level")
        ck.ok(scs[(scs.level == "c")]["nrmse"].notna().all(), "circle nRMSE is defined for all rows")
        for pipe in ("A", "B"):
            ck.ok(len(scs[(scs.pipeline == pipe) & (scs.level == "c2")]) == 12, "%s has 12 weighted-circle (c2) scores" % pipe)
        for test in TESTS:
            for co in COUNTRIES:
                for unit in UNITS:
                    ck.close(1.0 + pick("B", "c2", test, co, unit, "bias"), 2.0 * (1.0 + pick("A", "c2", test, co, unit, "bias")),
                             "c2 of a 2x prediction is exactly twice c2 of the 1x prediction %s %s %s" % (test, co, unit), 1e-9)
                    ck.ok(pick("A", "c2", test, co, unit, "nrmse") < 1.0, "c2 nRMSE of a perfect q25 prediction is small %s %s %s" % (test, co, unit))
        cdf = contests(scs)
        w, wa, wb = decide_winner(cdf)
        ck.ok((w, wa, wb) == ("A", 12, 0), "A=truth beats B=2x truth in all 12 contests, got %r" % ((w, wa, wb),))
        gate = gate_checks(scs, "A", 0.9, True)
        cov = [g for g in gate if "coverage" in g[0]]
        ck.ok(cov and all(g[3] is False for g in cov), "coverage 1.0 is above the 0.97 limit, so the gate flags it")
        nr = [g for g in gate if "nRMSE" in g[0]]
        ck.ok(nr and all(g[3] is True for g in nr), "nRMSE 0 passes the gate")
        ck.ok(docs.exists() and "Pipeline A wins" in docs.read_text(), "the report is written and names the winner")
        text = docs.read_text()
        ck.ok("\u2014" not in text and "\u2013" not in text, "the report has no em or en dashes")

        print("Self-test: country rows change nothing in the existing levels")
        base_scores = pd.read_csv(base / "scores.csv")
        jparts = []
        for test in TESTS:
            months = test_months(test)
            for co in COUNTRIES:
                for unit in UNITS:
                    tot = truth.total_series(co, unit, months)
                    for i, (yy, mm) in enumerate(months):
                        if i == 0:
                            continue
                        jparts.append({"pipeline": "A", "test": test, "unit": unit, "country": co, "grid": "country",
                                       "cell": 0, "year": yy, "month": mm, "pred": 2.0 * tot[i], "lo": tot[i], "hi": 2.0 * tot[i]})
        Aj = pd.concat([A, pd.DataFrame(jparts)], ignore_index=True)
        Aj.to_parquet(base / "A" / "pred.parquet")
        run_quiet(lambda: run_scoring(tmp, truth, True, False))
        sj = pd.read_csv(base / "scores.csv")
        rest = sj[sj.level != "a_joint"].reset_index(drop=True)
        ck.ok(rest.equals(base_scores), "adding grid = country rows leaves every existing score row unchanged")
        jj = sj[sj.level == "a_joint"]
        ck.ok(len(jj) == 12 and (jj.pipeline == "A").all(), "12 a_joint rows for A (3 tests x 2 countries x 2 units)")
        t1 = truth.total_series("Bulgaria", "cd", test_months("t1"))
        row = jj[(jj.test == "t1") & (jj.country == "Bulgaria") & (jj.unit == "cd")].iloc[0]
        ck.close(row.bias, (2.0 * (t1.sum() - t1[0]) - t1.sum()) / t1.sum(), "a_joint bias, first month missing counts as 0")
        ck.close(row.coverage, (len(t1) - (1 if t1[0] > 0 else 0)) / len(t1), "a_joint coverage, missing month has range 0 to 0")
        ck.ok(int(row.n) == len(t1), "a_joint scores every month of the test")
        bad_c = Aj.copy()
        bad_c.loc[bad_c.grid == "country", "cell"] = 5
        try:
            validate_pred(bad_c)
            ck.ok(False, "country rows with cell other than 0 must be rejected")
        except ValueError:
            ck.ok(True, "country rows with cell other than 0 rejected")
        print("Self-test: A2 vs A3 adoption rule")
        def fs(a2, a3, cov):
            r = []
            i = 0
            for test in WINNER_TESTS:
                for co in COUNTRIES:
                    r.append({"pipeline": "A2", "level": "a", "test": test, "country": co, "unit": "cd", "nrmse": a2[i], "coverage": 0.9})
                    r.append({"pipeline": "A3", "level": "a", "test": test, "country": co, "unit": "cd", "nrmse": a3[i], "coverage": 0.9})
                    r.append({"pipeline": "A3", "level": "b", "test": test, "country": co, "unit": "cd", "nrmse": 0.5, "coverage": cov[i]})
                    i += 1
            return pd.DataFrame(r)
        rws, av, nw, cc = adoption_rule(fs([0.2] * 4, [0.1, 0.1, 0.3, 0.2], [0.85, 0.9, 0.8, 0.97]))
        ck.ok(av and nw == 3 and cc == 4, "3 of 4 not worse and all coverages inside 0.80 to 0.97, got %r" % ((av, nw, cc),))
        rws, av, nw, cc = adoption_rule(fs([0.2] * 4, [0.3, 0.1, 0.3, 0.2], [0.79, 0.9, 0.98, 0.97]))
        ck.ok(av and nw == 2 and cc == 2, "2 of 4 not worse, 2 coverages inside, got %r" % ((av, nw, cc),))
        rws, av, nw, cc = adoption_rule(fs([0.2] * 4, [0.1] * 4, [0.9] * 4).query("pipeline != 'A3'"))
        ck.ok(not av, "adoption table reports not available when A3 is missing")
        ck.ok(adoption_section(fs([0.2] * 4, [0.1] * 4, [0.9] * 4).query("pipeline != 'A3'"))[2].startswith("not available"),
              "the section prints not available")

        print("Self-test: swapped roles")
        A2 = fake_pred(truth, "A", 2.0, ["q25"])
        B2 = fake_pred(truth, "B", 1.0, ["q25", "d10"])
        A2.to_parquet(base / "A" / "pred.parquet")
        B2.to_parquet(base / "B" / "pred.parquet")
        run_quiet(lambda: run_scoring(tmp, truth, True, False))
        cdf = contests(pd.read_csv(base / "scores.csv"))
        w, wa, wb = decide_winner(cdf)
        ck.ok((w, wa, wb) == ("B", 0, 12), "B=truth beats A=2x truth, got %r" % ((w, wa, wb),))

        print("Self-test: circle level with an exact grid (0.01 degree cells)")
        for unit_mult in (1.0, 2.0):
            parts = []
            for test in TESTS:
                months = test_months(test)
                ymset = set(ym_of(y, m) for y, m in months)
                for co in COUNTRIES:
                    s = truth.snpp[(truth.snpp.country == co) & (truth.snpp.ym.isin(ymset))]
                    g = s.groupby([c01_cell_from_cd(s.cy.values, s.cx.values), s.ym.values]).agg(
                        cd=("detections", "size"), hot=("detections", "sum")).reset_index()
                    g.columns = ["cell", "ym", "cd", "hot"]
                    for unit in UNITS:
                        parts.append(pd.DataFrame({
                            "pipeline": "A", "test": test, "unit": unit, "country": co, "grid": "c01",
                            "cell": g["cell"].values, "year": g.ym.values // 12, "month": g.ym.values % 12 + 1,
                            "pred": g[unit].values * unit_mult, "lo": g[unit].values * unit_mult,
                            "hi": g[unit].values * unit_mult, "ym": g.ym.values}))
            cp = pd.concat(parts, ignore_index=True)
            rows, _ = score_label(truth, cp, "A", 0.9, circle_grid="c01")
            rc = pd.DataFrame(rows)
            rc = rc[rc.level == "c"]
            ck.ok(len(rc) == 12, "12 circle rows on the exact grid")
            if unit_mult == 1.0:
                ck.ok((rc.nrmse.abs() < 1e-12).all(), "circle nRMSE 0 when prediction = truth")
                ck.ok((rc.bias.abs() < 1e-12).all(), "circle bias 0 when prediction = truth")
                ck.ok((rc.coverage == 1.0).all(), "circle coverage 1 when lo = hi = truth")
            else:
                ck.ok(((rc.bias - 1.0).abs() < 1e-12).all(), "circle bias +1.0 when prediction = 2 x truth")
        ck.ok(truth.circle_series("c08", "cd", test_months("t1")).sum() > 0, "a Northern California circle has fire in t1")

        print("Self-test: overlap weights")
        w_all = q25_overlap_weights([int(q25_cell_from_cd(4270, 2330))], 42.70, 23.32, 1000.0)
        ck.close(w_all[0], 1.0, "a cell far inside a huge circle has weight 1")
        w_far = q25_overlap_weights([int(q25_cell_from_cd(-4000, 2330))], 42.70, 23.32, 50.0)
        ck.close(w_far[0], 0.0, "a far cell has weight 0")
        lat0, lon0, rad = 42.70, 23.32, 50.0
        r0 = int((90 - lat0) // 0.25)
        c0 = int((lon0 + 180) // 0.25)
        cells = [rr * 1440 + cc for rr in range(r0 - 4, r0 + 5) for cc in range(c0 - 6, c0 + 7)]
        total = float(q25_overlap_weights(cells, lat0, lon0, rad).sum()) * 625
        cyv = np.arange(round(lat0 * 100) - 700, round(lat0 * 100) + 700)
        cxv = np.arange(round(lon0 * 100) - 700, round(lon0 * 100) + 700)
        gy, gx = np.meshgrid(cyv, cxv, indexing="ij")
        direct = int((haversine_km(lat0, lon0, (gy + 0.5) / 100.0, (gx + 0.5) / 100.0) <= rad).sum())
        ck.close(total, float(direct), "weights x 625 add up to the 0.01 degree cells inside the circle", 1e-6)

        print("Self-test: scored-cell scope")
        syn = pd.DataFrame({
            "sat": ["Terra", "Aqua", "SNPP", "Terra", "SNPP"],
            "country": ["Bulgaria"] * 5,
            "day": [pd.Timestamp("2010-06-01").date(), pd.Timestamp("2015-06-01").date(),
                    pd.Timestamp("2015-06-01").date(), pd.Timestamp("2023-06-01").date(),
                    pd.Timestamp("2023-06-01").date()],
            "cy": [4300, 4400, 4400, 4500, 4500],
            "cx": [2300, 2400, 2400, 2500, 2500],
            "detections": [1, 1, 1, 1, 1]})
        st = Truth(syn)
        cx_2010 = int(q25_cell_from_cd(4300, 2300))
        cx_2015 = int(q25_cell_from_cd(4400, 2400))
        cx_2023 = int(q25_cell_from_cd(4500, 2500))
        sc_set = set(st.scored_q25["Bulgaria"].tolist())
        ck.ok(cx_2010 not in sc_set, "a 2010 MODIS-only cell is not in the scored set")
        ck.ok(cx_2015 in sc_set, "a 2015 cell is in the scored set")
        ck.ok(cx_2023 not in sc_set, "a 2023-only cell is not in the scored set")

        selftest_world(ck)

        print("Self-test: validation")
        bad = A.copy()
        bad.loc[0, "pred"] = float("nan")
        try:
            validate_pred(bad)
            ck.ok(False, "NaN prediction must be rejected")
        except ValueError:
            ck.ok(True, "NaN prediction rejected")
        dup = pd.concat([A.head(2), A.head(1)], ignore_index=True)
        try:
            validate_pred(dup)
            ck.ok(False, "duplicate rows must be rejected")
        except ValueError:
            ck.ok(True, "duplicate rows rejected")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("Self-test: %d checks, %d failed" % (ck.n, len(ck.fail)))
    if ck.fail:
        for f in ck.fail:
            print("  " + f)
        return 1
    print("SELFTEST PASS")
    return 0


def run_quiet(fn):
    import contextlib
    import io
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        fn()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(ROOT / "data"), help="data folder (default: data in the repo root)")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--truth-only", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest(a.data)
    truth = load_truth(a.data)
    print("Truth check against tests/expected/bakeoff/truth_samples.json")
    diffs = check_truth_samples(truth)
    if diffs:
        print("TRUTH MISMATCH, scoring stopped:")
        for d in diffs:
            print("  " + d)
        return 1
    print("Truth samples match exactly.")
    if a.truth_only:
        print_truth_totals(truth)
        return 0
    return run_scoring(a.data, truth, True, True)


if __name__ == "__main__":
    sys.exit(main())
