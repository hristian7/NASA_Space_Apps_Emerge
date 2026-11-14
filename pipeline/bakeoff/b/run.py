#!/usr/bin/env python3
"""Pipeline B, model A: convert MODIS fire counts to S-NPP level with a stratum ratio.

Follows docs/harmonization-pipeline-plan.md steps 2 to 6 under the frozen rules in
pipeline/bakeoff/PROTOCOL.md. One ratio k per stratum (continent x 5 degree latitude
band) per MODIS path, an 80 percent range from a 200 resample bootstrap of the
training pairs, written on the 0.1 degree grid and added up to the 0.25 degree grid.

Usage:
  python3 pipeline/bakeoff/b/run.py --data data
"""

import argparse
import json
import sys
import time
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
GAPS = ROOT / "pipeline" / "bakeoff" / "snpp_gap_days.csv"

UNITS = ("cd", "hot")
PATHS = ("A", "T")
BAND = 0.8          # 80 percent range, as the plan asks (step 5)
NBOOT = 200         # 200 resamples, as the plan asks (step 5)
POOL_CAP = 2000     # ratios kept per pool before resampling, for speed
MIN_N = 20          # "borrow from parent region where n < 20 cell-days" (step 4)
NBINS = 8           # size bins 0..7 on floor(log2(MODIS value))
SEED = 20261114

# Protocol section 3. (first month, last month) as year * 12 + month - 1.
TESTS = {
    "t1": {"fit": ((2012, 2), (2018, 12)), "pred": ((2019, 1), (2022, 12))},
    "t2": {"fit": ((2016, 1), (2022, 12)), "pred": ((2012, 2), (2015, 12))},
    "t3": {"fit": ((2012, 2), (2018, 12)), "pred": ((2023, 1), (2025, 12))},
}

# No continent polygon map is available at bake-off scope, so the continent comes
# from NASA's own country label. Documented in the manifest and the README.
CONTINENT = {"Bulgaria": "Europe", "United_States": "North_America"}


def ym(y: int, m: int) -> int:
    return y * 12 + m - 1


def size_bin(v: pd.Series) -> pd.Series:
    b = np.floor(np.log2(np.maximum(v.to_numpy(dtype="float64"), 1.0)))
    return pd.Series(np.minimum(b, NBINS - 1).astype("int16"), index=v.index)


# ---------------------------------------------------------------- input


def load(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, duckdb.DuckDBPyConnection]:
    """Return (parts, wide, con).

    parts: one row per country, satellite, month, 0.1 degree cell and 0.25 degree
           cell, holding that piece's cell-days and hotspots. A 0.1 degree cell can
           straddle two 0.25 degree cells, so the split is kept explicitly and both
           output grids are sums of the same pieces.
    wide:  one row per country, month and 0.1 degree cell with the Aqua, Terra and
           S-NPP values side by side (the training pairs of plan step 3).
    """
    src = (data_dir / "derived" / "bg_us" / "cell_days.parquet").as_posix()
    con = duckdb.connect()
    con.execute("SET threads = 8")
    con.execute(f"CREATE TABLE gaps AS SELECT CAST(day AS DATE) AS day FROM read_csv('{GAPS.as_posix()}')")
    con.execute(
        f"""
        CREATE TABLE parts AS
        WITH f AS (
            SELECT * FROM read_parquet('{src}')
            WHERE sat IN ('Terra', 'Aqua', 'SNPP')          -- protocol rule 3
              AND NOT (year(day) = 2012 AND month(day) = 1) -- protocol rule 2
              AND day NOT IN (SELECT day FROM gaps)         -- protocol rule 1
        )
        SELECT country, sat, year(day) AS y, month(day) AS m,
               CAST(floor(cy / 10.0) AS INTEGER) AS gy,
               CAST(floor(cx / 10.0) AS INTEGER) AS gx,
               CAST(floor((90 - (cy + 0.5) / 100.0) / 0.25) AS BIGINT) * 1440
                 + CAST(floor(((cx + 0.5) / 100.0 + 180) / 0.25) AS BIGINT) AS q25,
               count(*) AS cd, sum(detections) AS hot
        FROM f GROUP BY ALL
        """
    )
    parts = con.execute(
        """
        SELECT country, sat, y, m, gy, gx,
               (gy + 900) * 3600 + (gx + 1800) AS d10,
               q25, cd, CAST(hot AS BIGINT) AS hot
        FROM parts
        """
    ).df()
    wide = con.execute(
        """
        SELECT country, y, m, gy, gx,
               (gy + 900) * 3600 + (gx + 1800) AS d10,
               CAST(floor(gy / 50.0) AS INTEGER) AS band,
               coalesce(sum(cd)  FILTER (sat = 'Aqua'),  0) AS a_cd,
               coalesce(sum(hot) FILTER (sat = 'Aqua'),  0) AS a_hot,
               coalesce(sum(cd)  FILTER (sat = 'Terra'), 0) AS t_cd,
               coalesce(sum(hot) FILTER (sat = 'Terra'), 0) AS t_hot,
               coalesce(sum(cd)  FILTER (sat = 'SNPP'),  0) AS s_cd,
               coalesce(sum(hot) FILTER (sat = 'SNPP'),  0) AS s_hot
        FROM parts GROUP BY ALL
        """
    ).df()
    for c in ("a_cd", "a_hot", "t_cd", "t_hot", "s_cd", "s_hot"):
        wide[c] = wide[c].astype("float64")
    wide["ym"] = wide["y"] * 12 + wide["m"] - 1
    wide["cont"] = wide["country"].map(CONTINENT)
    parts["ym"] = parts["y"] * 12 + parts["m"] - 1
    parts["band"] = np.floor(parts["gy"] / 50.0).astype("int32")
    parts["cont"] = parts["country"].map(CONTINENT)
    return parts, wide, con


# ---------------------------------------------------------------- fit


def _ratio_pools(frame: pd.DataFrame, mcol: str, scol: str, path: str) -> dict:
    """Empirical per-pair ratios, keyed at three levels so thin pools can borrow."""
    if frame.empty:
        return {}
    r = (frame[scol] / frame[mcol]).to_numpy(dtype="float64")
    b = size_bin(frame[mcol]).to_numpy()
    cont = frame["cont"].to_numpy()
    band = frame["band"].to_numpy()
    pools: dict = {}
    for keys in (
        list(zip(cont, band, b)),
        list(zip(cont, b)),
        list(zip(b)),
        list(zip(cont, band)),
        list(zip(cont)),
        [()] * len(r),
    ):
        idx: dict = {}
        for i, k in enumerate(keys):
            idx.setdefault(k, []).append(i)
        for k, v in idx.items():
            pools[(path, k)] = r[np.array(v)]
    return pools


def _band_mult(pool: np.ndarray, rng: np.random.Generator) -> tuple[float, float]:
    """80 percent range of the per-pair ratio, stabilised by 200 bootstrap resamples."""
    if len(pool) > POOL_CAP:
        pool = rng.choice(pool, POOL_CAP, replace=False)
    n = len(pool)
    draws = pool[rng.integers(0, n, size=(NBOOT, n))]
    return (
        float(np.percentile(draws, 10, axis=1).mean()),
        float(np.percentile(draws, 90, axis=1).mean()),
    )


def fit_models(wide: pd.DataFrame, fit_lo: int, fit_hi: int, pred_lo: int, pred_hi: int,
               strata: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    """One k per stratum and MODIS path per unit, plus an 80 percent range per size bin."""
    fit_mask = wide["ym"].between(fit_lo, fit_hi)
    f = wide.loc[fit_mask].copy()

    # Leakage gate: the S-NPP frame used for fitting holds no prediction-year row.
    assert not f["ym"].between(pred_lo, pred_hi).any(), "S-NPP fit frame reaches into prediction years"
    assert f["ym"].min() >= fit_lo and f["ym"].max() <= fit_hi

    dom_a = f["a_cd"] > 0
    dom_t = (f["a_cd"] == 0) & (f["t_cd"] > 0)
    dom_n = (f["a_cd"] == 0) & (f["t_cd"] == 0) & (f["s_cd"] > 0)
    fa, ft, fn = f.loc[dom_a], f.loc[dom_t], f.loc[dom_n]

    # Support is counted in cell-days for both units, as plan step 4 words it.
    def agg(frame, keys, cols):
        if frame.empty:
            return pd.DataFrame(columns=cols).astype("float64")
        return frame.groupby(keys, observed=True)[cols].sum()

    levels = [("cont", "band"), ("cont",), ()]
    rows = []
    for unit in UNITS:
        dedup = lambda xs: list(dict.fromkeys(xs))
        acols = dedup([f"a_{unit}", f"s_{unit}", "a_cd"])
        tcols = dedup([f"t_{unit}", f"s_{unit}", "t_cd"])
        ncols = [f"s_{unit}"]
        tot = {}
        for lv in levels:
            keys = list(lv) if lv else None
            if keys is None:
                tot[lv] = (
                    fa[acols].sum(), ft[tcols].sum(), fn[ncols].sum(),
                )
            else:
                tot[lv] = (agg(fa, keys, acols), agg(ft, keys, tcols), agg(fn, keys, ncols))

        pools = _ratio_pools(fa, f"a_{unit}", f"s_{unit}", "A")
        pools.update(_ratio_pools(ft, f"t_{unit}", f"s_{unit}", "T"))
        mult_cache: dict = {}

        def mult(path, cont, band, b):
            for key in ((cont, band, b), (cont, b), (b,), (cont, band), (cont,), ()):
                pool = pools.get((path, key))
                if pool is not None and len(pool) >= MIN_N:
                    ck = (path, key)
                    if ck not in mult_cache:
                        mult_cache[ck] = _band_mult(pool, rng)
                    return mult_cache[ck]
            return (0.0, float("inf"))

        def k_for(path, cont, band):
            """Ratio of S-NPP to MODIS totals in the stratum, borrowing up when thin.

            S-NPP seen where no MODIS satellite saw anything cannot be placed by a
            ratio model, so it is shared between the two MODIS paths in proportion
            to their MODIS mass. The stratum total is then reproduced exactly.
            """
            for lv in levels:
                if lv == ("cont", "band"):
                    key = (cont, band)
                elif lv == ("cont",):
                    key = cont
                else:
                    key = None
                A, T, N = tot[lv]
                if key is None:
                    ma, sa, na = A[f"a_{unit}"], A[f"s_{unit}"], A["a_cd"]
                    mt, st, nt = T[f"t_{unit}"], T[f"s_{unit}"], T["t_cd"]
                    sn = N[f"s_{unit}"]
                else:
                    if key not in A.index and key not in T.index:
                        continue
                    ra = A.loc[key] if key in A.index else None
                    rt = T.loc[key] if key in T.index else None
                    ma, sa, na = ((ra[f"a_{unit}"], ra[f"s_{unit}"], ra["a_cd"]) if ra is not None else (0.0, 0.0, 0.0))
                    mt, st, nt = ((rt[f"t_{unit}"], rt[f"s_{unit}"], rt["t_cd"]) if rt is not None else (0.0, 0.0, 0.0))
                    sn = float(N.loc[key][f"s_{unit}"]) if key in N.index else 0.0
                ma, sa, na, mt, st, nt, sn = (float(x) for x in (ma, sa, na, mt, st, nt, sn))
                n_here = na if path == "A" else nt
                m_here = ma if path == "A" else mt
                if n_here < MIN_N or m_here <= 0:
                    continue
                share = (ma / (ma + mt)) if (ma + mt) > 0 else 0.0
                if path == "A":
                    return (sa + share * sn) / ma, lv, n_here
                return (st + (1.0 - share) * sn) / mt, lv, n_here
            return None

        for cont, band in strata[["cont", "band"]].itertuples(index=False):
            for path in PATHS:
                got = k_for(path, cont, band)
                if got is None:
                    continue
                k, lv, n_here = got
                for b in range(NBINS):
                    rlo, rhi = mult(path, cont, band, b)
                    rhi = max(rhi, k) if np.isfinite(rhi) else k * 3.0
                    rows.append(
                        {"unit": unit, "cont": cont, "band": band, "path": path, "bin": b,
                         "k": k, "rlo": min(rlo, k), "rhi": rhi,
                         "k_level": "x".join(lv) if lv else "global", "n": n_here}
                    )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- predict


def predict(parts: pd.DataFrame, wide: pd.DataFrame, kt: pd.DataFrame,
            lo: int, hi: int, test: str, pipeline: str = "B") -> pd.DataFrame:
    """Apply the ratio to MODIS pieces, then add the pieces up on both grids."""
    p = parts.loc[parts["ym"].between(lo, hi) & parts["sat"].isin(["Aqua", "Terra"])]
    w = wide[["country", "y", "m", "gy", "gx", "a_cd", "a_hot", "t_cd", "t_hot"]]
    p = p.merge(w, on=["country", "y", "m", "gy", "gx"], how="left")
    out = []
    for unit in UNITS:
        aq = p.loc[p["sat"] == "Aqua"].copy()
        aq["md10"], aq["path"] = aq[f"a_{unit}"], "A"
        # Terra enters only where Aqua saw nothing in that 0.1 degree cell-month,
        # so nothing is counted twice and the Aqua ratio stays uncontaminated.
        te = p.loc[(p["sat"] == "Terra") & (p["a_cd"] == 0)].copy()
        te["md10"], te["path"] = te[f"t_{unit}"], "T"
        q = pd.concat([aq, te], ignore_index=True)
        q = q.loc[q["md10"] > 0]
        if q.empty:
            continue
        q["bin"] = size_bin(q["md10"])
        q = q.merge(kt.loc[kt["unit"] == unit, ["cont", "band", "path", "bin", "k", "rlo", "rhi"]],
                    on=["cont", "band", "path", "bin"], how="left")
        assert not q["k"].isna().any(), "a prediction stratum has no fitted ratio"
        mass = q[unit].to_numpy(dtype="float64")
        q["pred"], q["lo"], q["hi"] = q["k"] * mass, q["rlo"] * mass, q["rhi"] * mass
        for grid, col in (("d10", "d10"), ("q25", "q25")):
            g = (q.groupby(["country", col, "y", "m"], observed=True)[["pred", "lo", "hi"]]
                   .sum().reset_index().rename(columns={col: "cell", "y": "year", "m": "month"}))
            g["pipeline"], g["test"], g["unit"], g["grid"] = pipeline, test, unit, grid
            out.append(g)
    cols = ["pipeline", "test", "unit", "country", "grid", "cell", "year", "month", "pred", "lo", "hi"]
    res = pd.concat(out, ignore_index=True)[cols]
    res = res.astype({"cell": "int64", "year": "int32", "month": "int32"})
    return res.loc[res["pred"] > 0].reset_index(drop=True)


# ---------------------------------------------------------------- checks


def verify(pred: pd.DataFrame) -> None:
    cols = ["pipeline", "test", "unit", "country", "grid", "cell", "year", "month", "pred", "lo", "hi"]
    assert list(pred.columns) == cols, f"columns are {list(pred.columns)}"
    assert set(pred["test"]) <= {"t1", "t2", "t3"}
    assert set(pred["unit"]) <= {"cd", "hot"}
    assert set(pred["grid"]) <= {"q25", "d10"}
    assert set(pred["country"]) <= {"Bulgaria", "United_States"}
    assert not pred[["pred", "lo", "hi"]].isna().any().any(), "NaN in pred, lo or hi"
    assert (pred["pred"] >= 0).all(), "negative pred"
    assert (pred["lo"] >= 0).all(), "negative lo"
    assert (pred["lo"] <= pred["pred"] + 1e-9).all(), "lo above pred"
    assert (pred["pred"] <= pred["hi"] + 1e-9).all(), "pred above hi"
    assert np.isfinite(pred[["pred", "lo", "hi"]].to_numpy()).all(), "non-finite value"
    print("schema check: columns, value sets, no NaN, no negative pred, lo <= pred <= hi  OK")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data", help="data directory (default: data under the repo root)")
    a = ap.parse_args()
    data_dir = Path(a.data)
    if not data_dir.is_absolute():
        data_dir = (ROOT / data_dir).resolve()
    out_dir = data_dir / "derived" / "bakeoff" / "B"
    out_dir.mkdir(parents=True, exist_ok=True)

    t_start = time.time()
    rng = np.random.default_rng(SEED)
    parts, wide, con = load(data_dir)
    print(f"input: {len(parts):,} grid pieces, {len(wide):,} cell-months  ({time.time() - t_start:.0f} s)")

    # Strata that must have a ratio: every continent x latitude band where MODIS
    # ever saw fire. Built from MODIS rows only, so no S-NPP year leaks in.
    strata = (wide.loc[(wide["a_cd"] > 0) | (wide["t_cd"] > 0), ["cont", "band"]]
                  .drop_duplicates().sort_values(["cont", "band"]).reset_index(drop=True))
    print(f"strata (continent x 5 degree latitude band): {len(strata)}")

    # ---- control total (protocol rules 1 to 3, t1 fit years, Aqua, unit cd)
    f_lo, f_hi = ym(*TESTS["t1"]["fit"][0]), ym(*TESTS["t1"]["fit"][1])
    mine = float(wide.loc[wide["ym"].between(f_lo, f_hi), "a_cd"].sum())
    direct = con.execute(
        f"""
        SELECT count(*) FROM read_parquet('{(data_dir / "derived" / "bg_us" / "cell_days.parquet").as_posix()}')
        WHERE sat = 'Aqua'
          AND NOT (year(day) = 2012 AND month(day) = 1)
          AND day NOT IN (SELECT day FROM gaps)
          AND day BETWEEN DATE '2012-02-01' AND DATE '2018-12-31'
        """
    ).fetchone()[0]
    print(f"control total, Aqua cell-days in t1 fit years: pipeline {mine:,.0f} vs direct count {direct:,}"
          f"  {'OK' if int(mine) == int(direct) else 'MISMATCH'}")
    assert int(mine) == int(direct), "control total mismatch"

    # ---- fit and predict
    fits: dict = {}
    fit_seconds: dict = {}
    frames = []
    for test, spec in TESTS.items():
        fl, fh = ym(*spec["fit"][0]), ym(*spec["fit"][1])
        pl, ph = ym(*spec["pred"][0]), ym(*spec["pred"][1])
        key = (fl, fh)
        if key not in fits:
            t0 = time.time()
            fits[key] = fit_models(wide, fl, fh, pl, ph, strata, rng)
            fit_seconds[f"{spec['fit'][0][0]}-{spec['fit'][1][0]}"] = round(time.time() - t0, 1)
        else:
            # Same fit window as an earlier test; re-run the leakage gate for this test.
            assert not wide["ym"].between(fl, fh).loc[lambda s: s].index.empty
            assert not (pl <= fh and ph >= fl), "fit and prediction windows overlap"
        kt = fits[key]
        frames.append(predict(parts, wide, kt, pl, ph, test))
    pred = pd.concat(frames, ignore_index=True)
    print(f"fit seconds per window: {fit_seconds}")

    # ---- row counts
    print("\nrow counts per test, unit and grid:")
    counts = pred.groupby(["test", "unit", "grid"], observed=True).size().reset_index(name="rows")
    for r in counts.itertuples(index=False):
        print(f"  {r.test}  {r.unit:3s}  {r.grid:3s}  {r.rows:>9,}")
    print(f"  total {len(pred):,}")

    # ---- grid total check
    print("\nq25 total equals d10 total (per test and unit):")
    ok = True
    for (test, unit), g in pred.groupby(["test", "unit"], observed=True):
        a_ = g.loc[g["grid"] == "d10", "pred"].sum()
        b_ = g.loc[g["grid"] == "q25", "pred"].sum()
        same = abs(a_ - b_) <= 1e-6 * max(1.0, abs(a_))
        ok &= same
        print(f"  {test}  {unit:3s}  d10 {a_:,.3f}  q25 {b_:,.3f}  {'OK' if same else 'MISMATCH'}")
    assert ok, "q25 total does not equal d10 total"

    verify(pred)

    # ---- in-sample sanity: predict the t1 fit years and compare with measured S-NPP
    print("\nin-sample (t1 fit years) sum(predicted) / sum(S-NPP), per country and unit:")
    ins = predict(parts, wide, fits[(f_lo, f_hi)], f_lo, f_hi, "t1")
    insample = {}
    for unit in UNITS:
        for country in sorted(CONTINENT):
            p_ = ins.loc[(ins["unit"] == unit) & (ins["country"] == country) & (ins["grid"] == "d10"), "pred"].sum()
            t_ = wide.loc[wide["ym"].between(f_lo, f_hi) & (wide["country"] == country), f"s_{unit}"].sum()
            ratio = p_ / t_ if t_ else float("nan")
            insample[f"{country}/{unit}"] = round(float(ratio), 4)
            print(f"  {country:14s} {unit:3s}  predicted {p_:,.0f}  measured {t_:,.0f}  ratio {ratio:.3f}")

    # ---- in-sample band diagnostic (fit years only, never a test score)
    print("\nin-sample (t1 fit years) 0.8 band against measured S-NPP:")
    sn = parts.loc[(parts["sat"] == "SNPP") & parts["ym"].between(f_lo, f_hi)]
    bands = {}
    for grid in ("d10", "q25"):
        for unit in UNITS:
            t = sn.groupby(["country", grid, "y", "m"], observed=True)[unit].sum().reset_index()
            t.columns = ["country", "cell", "year", "month", "truth"]
            p = ins.loc[(ins["grid"] == grid) & (ins["unit"] == unit),
                        ["country", "cell", "year", "month", "pred", "lo", "hi"]]
            j = t.merge(p, on=["country", "cell", "year", "month"], how="outer").fillna(0.0)
            inside = (j["lo"] <= j["truth"]) & (j["truth"] <= j["hi"])
            has = j["pred"] > 0
            blind_mass = float(j.loc[~has, "truth"].sum() / max(j["truth"].sum(), 1.0))
            bands[f"{grid}/{unit}"] = {
                "coverage_all_rows": round(float(inside.mean()), 3),
                "coverage_rows_with_a_prediction": round(float(inside[has].mean()), 3),
                "snpp_mass_share_where_modis_saw_nothing": round(blind_mass, 3),
            }
            print(f"  {grid} {unit:3s} coverage {inside.mean():.3f} over all rows, "
                  f"{inside[has].mean():.3f} over rows with a prediction; "
                  f"{blind_mass:.1%} of S-NPP mass sits where MODIS saw nothing")

    # ---- write
    pred.to_parquet(out_dir / "pred.parquet", index=False)
    kt1 = fits[(f_lo, f_hi)]
    ratios = (kt1.loc[kt1["bin"] == 0, ["unit", "cont", "band", "path", "k", "k_level", "n"]]
                 .sort_values(["unit", "cont", "band", "path"]))
    manifest = {
        "pipeline": "B",
        "model": ("Model A, the ratio: per stratum k = S-NPP total divided by MODIS total over the "
                  "fit-year 0.1 degree cell-months, applied to MODIS counts in the prediction years."),
        "plan": "docs/harmonization-pipeline-plan.md steps 2 to 6",
        "band": BAND,
        "groups": "stratum = continent x 5 degree latitude band (floor(lat/5)); plus MODIS path A (Aqua) or T (Terra)",
        "continent_source": "assigned from NASA's country label: Bulgaria = Europe, United_States = North_America",
        "k_varies_by_month": False,
        "grids": ["d10", "q25"],
        "units": list(UNITS),
        "tests": {t: {"fit": TESTS[t]["fit"], "pred": TESTS[t]["pred"]} for t in TESTS},
        "bootstrap": {"resamples": NBOOT, "pool_cap": POOL_CAP, "seed": SEED,
                      "range": "10th to 90th percentile of the per-pair ratio, averaged over the resamples"},
        "borrowing": {"min_n_cell_days": MIN_N, "chain": ["continent x band", "continent", "global"]},
        "fit_seconds": fit_seconds,
        "total_seconds": round(time.time() - t_start, 1),
        "rows": {"total": int(len(pred)),
                 "by_test_unit_grid": {f"{r.test}/{r.unit}/{r.grid}": int(r.rows) for r in counts.itertuples(index=False)}},
        "control_total_aqua_cd_t1_fit": {"pipeline": int(mine), "direct": int(direct)},
        "in_sample_pred_over_snpp": insample,
        "in_sample_band": bands,
        "range_combination": ("q25 lo and hi are the sums of the same 0.1 degree pieces as pred, so the ratio error "
                              "is treated as perfectly correlated inside a stratum. That is the wider, safer choice."),
        "resolved_choices": {
            "k_by_month": ("The pipeline plan lists month as a feature of model B only, and words model A as one k "
                           "per stratum, so k does not vary by month here."),
            "terra": ("Terra is kept out of the training pairs. It enters a prediction only in 0.1 degree "
                      "cell-months where Aqua saw nothing, through its own ratio, so nothing is double counted."),
            "unseen_snpp_mass": ("S-NPP cell-months where no MODIS satellite saw anything cannot be placed by a "
                                 "ratio. That mass is shared between the Aqua and Terra paths in proportion to "
                                 "their MODIS mass, so the stratum total is reproduced in sample."),
            "pair_universe": ("k = mean(S-NPP) / mean(MODIS) over the stratum's cell-month pairs equals the ratio of "
                              "totals, so it does not depend on how many empty cell-months are counted as pairs."),
            "support_n": "n for borrowing is counted in cell-days for both units, as the plan words it.",
            "zero_rows": "A cell-month where MODIS saw nothing gets no row; the scorer reads a missing row as 0.",
        },
        "left_out": [
            "The plan's daily output table (step 6 and 7): scoring is monthly.",
            "Models B (Poisson regression) and C (missed-fire term): outside the first model's scope.",
            "NOAA-20 gap filling: protocol rule 1 drops the 34 gap days instead.",
            "Land cover: no map available, the protocol replaces it with a 5 degree latitude band.",
        ],
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    ratios.to_csv(out_dir / "ratios.csv", index=False)
    print(f"\nwrote {out_dir / 'pred.parquet'}, manifest.json, ratios.csv")
    print(f"total {time.time() - t_start:.0f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
