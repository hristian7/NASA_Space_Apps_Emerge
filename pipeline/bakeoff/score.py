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
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
COUNTRIES = ["Bulgaria", "United_States"]
SATS = ["Terra", "Aqua", "SNPP"]
UNITS = ["cd", "hot"]
GRIDS = ["q25", "d10"]
TESTS = ["t1", "t2", "t3"]
WINNER_TESTS = ["t1", "t2"]
LEVELS = ["a", "b", "c", "d"]
LEVEL_NAMES = {
    "a": "country x month",
    "b": "q25 cell x month",
    "c": "50 km circle x month",
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
    col = (2 * cx + 36001) // 50
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
            scope = df[(df["country"] == c) & (df["year"] <= 2022)]
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
    for col, ok in (("test", TESTS), ("unit", UNITS), ("country", COUNTRIES), ("grid", GRIDS)):
        bad = ~df[col].isin(ok)
        if bad.any():
            raise ValueError("column %s has values outside %s: %s" % (col, ok, sorted(df.loc[bad, col].astype(str).unique())[:5]))
    for col in ("pred", "lo", "hi"):
        if df[col].isna().any():
            raise ValueError("column %s has missing values" % col)
    if (df["pred"] < 0).any() or (df["lo"] < 0).any() or (df["hi"] < 0).any():
        raise ValueError("negative pred, lo or hi")
    df["cell"] = df["cell"].astype(np.int64)
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
                if len(d):
                    cells = truth.scored_d10[country]
                    tm = truth.dense("d10", country, unit, months)
                    pm, lm, hm = to_dense(d, cells, months, ["pred", "lo", "hi"])
                    add("d", "d10", tm.ravel(), pm.ravel(), lm.ravel(), hm.ravel())
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


def build_report(scores, cdf, winner, wa, wb, d7, gate, manifests, notes, truth_ok, skipped):
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
    if not frames:
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
    scores = pd.DataFrame(rows)[SCORE_COLS]
    scores.to_csv(base / "scores.csv", index=False)
    cdf = contests(scores)
    winner, wa, wb = decide_winner(cdf)
    d7 = (0, [])
    gate = []
    if winner is not None:
        d7 = d7_rule(cdf, winner)
        gate = gate_checks(scores, winner, manifests.get(winner, {}).get("band"), truth_ok)
    report = build_report(scores, cdf, winner, wa, wb, d7, gate, manifests, notes, truth_ok, skipped)
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
