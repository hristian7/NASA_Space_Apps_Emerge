#!/usr/bin/env python3
"""Run the scored A2 conversion for the whole world.

    python3 pipeline/convert/world.py --data data

Fits on Feb 2012 to Dec 2022 (S-NPP gap days and January 2012 dropped) and
writes the harmonized monthly record for Nov 2000 to Dec 2025 into
`data/derived/world/harmonized/`, in the shapes `docs/data-contract.md` fixes.

The model is not re-implemented here. The fit and predict functions are
imported from the bake-off script that the independent scorer scored, so the
world record and the scored model are the same code. `--check-bakeoff` proves
it: it refits on the bake-off's t1 fit years through these same imports and
compares the result with the A2 rows already in the bake-off output.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import time
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GAP_DAYS = ROOT / "pipeline" / "bakeoff" / "snpp_gap_days.csv"
MODEL_SRC = ROOT / "pipeline" / "bakeoff" / "a" / "run.py"


def _load_model_module():
    spec = importlib.util.spec_from_file_location("bakeoff_a_model", MODEL_SRC)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


M = _load_model_module()

FIT = (2012, 2, 2022, 12)
TERRA_PERIOD = (2000, 11, 2002, 6)
MODIS_PERIOD = (2002, 7, 2012, 1)
MEASURED_PERIOD = (2012, 2, 2026, 11)
RECORD_END_DAY = "2026-11-14"
SNPP_END_DAY = "2026-11-02"
CAL_2026 = (2026, 1, 2026, 10)  # the last full months S-NPP and NOAA-20 both flew
PROVISIONAL_SHARE = 0.5
SRC_CALIBRATED, SRC_PROVISIONAL = "measured_calibrated", "provisional"
UNASSIGNED = "Unassigned"
NOAA20_RATIO_YEARS = (2018, 1, 2022, 12)
WORLD_OPTIONS = ("moy", "moy_pooled")
MIN_INNER_PAIRS = 100  # positive-MODIS pairs a country needs for an inner split
INNER_HOLD_YEARS = 2
MODEL_VARIANT: list = []
FLAG_PARTIAL = 2
FLAG_GAP_FILLED = 4
SRC_TERRA, SRC_MODIS, SRC_MEASURED = "estimated_terra", "estimated_modis", "measured"
HARM_COLS = ["hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi"]


def ym(year: int, month: int) -> int:
    return year * 12 + (month - 1)


def months_in(w: tuple[int, int, int, int]) -> np.ndarray:
    return np.arange(ym(w[0], w[1]), ym(w[2], w[3]) + 1)


# ----------------------------------------------------------------- input


def aggregate(src: Path, threads: int) -> pd.DataFrame:
    """One pass over the cell-day table, down to q25 cell-months per country
    and satellite. Cell id and latitude band follow docs/data-contract.md
    section 2, with longitude wrapped into [-180, 180) and the row clamped."""
    con = duckdb.connect()
    con.execute(f"SET threads = {threads}")
    con.execute("SET memory_limit = '40GB'")
    # Spill beside the output, not into the working tree.
    spill = src.parent / "duckdb_tmp"
    spill.mkdir(parents=True, exist_ok=True)
    con.execute(f"SET temp_directory = '{spill.as_posix()}'")
    con.execute(
        f"""
        CREATE TEMP TABLE agg AS
        SELECT country, sat,
               CAST(grow * 1440 + gcol AS INTEGER) AS cell,
               CAST(floor((90 - (grow + 0.5) * 0.25) / 5) AS SMALLINT) AS latband,
               CAST(year(day) * 12 + month(day) - 1 AS INTEGER) AS ym,
               CAST(sum(CASE WHEN gap THEN 0 ELSE 1 END) AS INTEGER) AS cd,
               CAST(sum(CASE WHEN gap THEN 0 ELSE detections END) AS INTEGER) AS hot,
               sum(CASE WHEN gap THEN 0 ELSE frp END) AS frp,
               CAST(sum(CASE WHEN gap THEN 1 ELSE 0 END) AS INTEGER) AS cd_gap,
               CAST(sum(CASE WHEN gap THEN detections ELSE 0 END) AS INTEGER) AS hot_gap,
               sum(CASE WHEN gap THEN frp ELSE 0 END) AS frp_gap,
               CAST(sum(detections) AS INTEGER) AS hot_raw,
               min(day) AS first_day, max(day) AS last_day
        FROM (
          SELECT country, sat, day, detections, frp,
                 greatest(0, least(719,
                   CAST(floor((90 - (cy + 0.5) / 100.0) / 0.25) AS BIGINT))) AS grow,
                 CAST(floor((((cx + 0.5) / 100.0 + 180)
                       - 360 * floor(((cx + 0.5) / 100.0 + 180) / 360)) / 0.25)
                      AS BIGINT) AS gcol,
                 day IN (SELECT CAST(day AS DATE)
                         FROM read_csv('{GAP_DAYS.as_posix()}')) AS gap
          FROM '{src.as_posix()}'
        ) GROUP BY ALL
        """
    )
    frame = con.execute("SELECT * FROM agg").df()
    con.close()
    frame["group"] = frame["country"] + "|" + frame["latband"].astype(str)
    return frame



def aggregate_2026(src: Path, threads: int) -> pd.DataFrame:
    """The 2026 table, aggregated like the main one.

    Days after S-NPP stopped go into the same fill channel the 34 gap days
    use (`cd_gap`, `hot_gap`, `frp_gap`), so the measured series continues
    through one mechanism rather than two. NOAA-21 is read but not used: only
    NOAA-20 is calibrated here.
    """
    con = duckdb.connect()
    con.execute(f"SET threads = {threads}")
    con.execute("SET memory_limit = '40GB'")
    frame = con.execute(
        f"""
        SELECT country, sat,
               CAST(grow * 1440 + gcol AS INTEGER) AS cell,
               CAST(floor((90 - (grow + 0.5) * 0.25) / 5) AS SMALLINT) AS latband,
               CAST(year(day) * 12 + month(day) - 1 AS INTEGER) AS ym,
               CAST(sum(CASE WHEN post THEN 0 ELSE 1 END) AS INTEGER) AS cd,
               CAST(sum(CASE WHEN post THEN 0 ELSE detections END) AS INTEGER) AS hot,
               sum(CASE WHEN post THEN 0 ELSE frp END) AS frp,
               CAST(sum(CASE WHEN post THEN 1 ELSE 0 END) AS INTEGER) AS cd_gap,
               CAST(sum(CASE WHEN post THEN detections ELSE 0 END) AS INTEGER) AS hot_gap,
               sum(CASE WHEN post THEN frp ELSE 0 END) AS frp_gap,
               CAST(sum(detections) AS INTEGER) AS hot_raw,
               CAST(sum(CASE WHEN provisional THEN 1 ELSE 0 END) AS BIGINT) AS prov_rows,
               CAST(count(*) AS BIGINT) AS src_rows,
               min(day) AS first_day, max(day) AS last_day
        FROM (
          SELECT country, sat, day, detections, frp, provisional,
                 greatest(0, least(719,
                   CAST(floor((90 - (cy + 0.5) / 100.0) / 0.25) AS BIGINT))) AS grow,
                 CAST(floor((((cx + 0.5) / 100.0 + 180)
                       - 360 * floor(((cx + 0.5) / 100.0 + 180) / 360)) / 0.25)
                      AS BIGINT) AS gcol,
                 day > DATE '{SNPP_END_DAY}' AS post
          FROM '{src.as_posix()}'
          WHERE sat IN ('Terra', 'Aqua', 'SNPP', 'NOAA20')
        ) GROUP BY ALL
        """
    ).df()
    con.close()
    frame["group"] = frame["country"] + "|" + frame["latband"].astype(str)
    return frame


def provisional_months(agg: pd.DataFrame, report: dict) -> set:
    """Months whose reference-sensor rows are mostly near-real-time.

    The reference sensor is S-NPP, plus NOAA-20 on the days after S-NPP
    stopped, which is exactly what the measured value is built from.
    """
    ref = agg[
        (agg["sat"] == "SNPP")
        | ((agg["sat"] == "NOAA20") & (agg.get("cd_gap", 0) > 0))
    ]
    if "prov_rows" not in ref.columns:
        return set()
    per = ref.groupby("ym", as_index=False)[["prov_rows", "src_rows"]].sum()
    per = per[per["src_rows"] > 0]
    per["share"] = per["prov_rows"] / per["src_rows"]
    hit = per[per["share"] > PROVISIONAL_SHARE]
    report["provisional_share_by_month"] = {
        f"{int(r['ym']) // 12}-{int(r['ym']) % 12 + 1:02d}": round(float(r["share"]), 4)
        for _, r in per[per["ym"] >= ym(2026, 1)].iterrows()
    }
    return set(hit["ym"].astype(int))


def model_frame(agg: pd.DataFrame) -> pd.DataFrame:
    """The columns the imported model functions expect, gap days excluded."""
    cols = ["country", "group", "latband", "cell", "ym", "sat", "cd", "hot"]
    out = agg.loc[agg["cd"] > 0, cols].reset_index(drop=True)
    return out


# ----------------------------------------------------------------- fitting


# A3's background exposure, keyed by (unit, satellite). Empty under A2, so the
# wrapper below hands every frame the fixed exposure the scored model uses.
A3_STATE: dict = {}


def pair_frame(univ, cm, months, unit, sat, with_truth):
    """M.pair_frame, plus A3's background exposure when A3 is the variant."""
    frame = M.pair_frame(univ, cm, months, unit, sat, with_truth=with_truth)
    return attach_background(frame, unit, sat)


def attach_background(frame: pd.DataFrame, unit: str, sat: str) -> pd.DataFrame:
    state = A3_STATE.get((unit, sat))
    if state is None:
        return frame
    index, picks_form = state[0], state[1]
    parts = []
    for form in sorted(set(picks_form.values())):
        want = {c for c, f in picks_form.items() if f == form}
        part = frame[frame["country"].isin(want)]
        if len(part):
            parts.append(M.with_background(part, index, form))
    return pd.concat(parts, ignore_index=True) if parts else frame


def fast_country_pools(model, pairs: pd.DataFrame) -> dict:
    """Country-month residual pools using point predictions only, so the
    calibration pass costs no range machinery over a world-sized frame."""
    got = M.point_predict(model, pairs)
    got["y"] = pairs.loc[got.index, "y"]
    agg = got.groupby(["country", "ym"], as_index=False)[["pred", "y"]].sum()
    agg = agg[agg["pred"] > 0].copy()
    agg["res"] = agg["y"] / agg["pred"]
    pools = {"*": agg["res"].to_numpy() if len(agg) else np.ones(1)}
    for country, part in agg.groupby("country"):
        pools[country] = part["res"].to_numpy()
    return pools


def pick_background_form(
    cm: pd.DataFrame,
    univ: pd.DataFrame,
    unit: str,
    sat: str,
    k_ratio: float,
    picks_term: dict,
    rng: np.random.Generator,
    fit_window: tuple[int, int, int, int] = FIT,
) -> tuple:
    """Choose a background form per country on the same inner split as A2."""
    w = fit_window
    inner_fit = (w[0], w[1], w[2] - INNER_HOLD_YEARS, 12)
    inner_hold = (w[2] - INNER_HOLD_YEARS + 1, 1, w[2], w[3])
    fit_m, hold_m = months_in(inner_fit), months_in(inner_hold)
    assert not set(fit_m) & set(hold_m), "inner split overlaps"
    index = M.activity_index(cm, unit, sat, w)
    base_fit = M.pair_frame(univ, cm, fit_m, unit, sat, with_truth=True)
    base_hold = M.pair_frame(univ, cm, hold_m, unit, sat, with_truth=True)
    terms = {n: (t, k) for n, t, k in M.A2_OPTIONS}
    scores: dict = {}
    inner_cr: dict = {}
    for form in M.BACKGROUND_FORMS:
        pf = M.with_background(base_fit, index, form)
        hf = M.with_background(base_hold, index, form)
        scores[form] = {}
        for opt in sorted(set(picks_term.values())):
            n_t, k_m = terms[opt]
            model = M.fit_convert(pf, k_ratio, n_t, rng, k_mult=k_m)
            got = M.point_predict(model, hf)
            got["y"] = hf.loc[got.index, "y"]
            scores[form][opt] = M.country_month_scores(got)
            pools = fast_country_pools(model, pf)
            cr = M.country_month_ranges(model, M.with_term(hf, n_t), pools, rng)
            truth = hf.groupby(["country", "ym"], as_index=False)["y"].sum()
            inner_cr[(form, opt)] = cr.merge(truth, on=["country", "ym"], how="left")
            del model, got, pools, cr
        del pf, hf
    picks_form = {}
    for country, opt in picks_term.items():
        rows = [
            (f, scores[f][opt][country])
            for f in M.BACKGROUND_FORMS
            if country in scores[f][opt]
            and scores[f][opt][country]["country_month_nrmse"] is not None
        ]
        if not rows:
            picks_form[country] = "fixed"
            continue
        ok = [r for r in rows if abs(r[1]["bias"]) <= M.BIAS_GATE]
        pool = ok if ok else rows
        picks_form[country] = min(pool, key=lambda r: r[1]["country_month_nrmse"])[0]
    held = pd.concat(
        [
            inner_cr[(picks_form[c], picks_term[c])].query("country == @c")
            for c in picks_form
            if (picks_form[c], picks_term[c]) in inner_cr
        ],
        ignore_index=True,
    )
    calib = M.band_factor(held)
    before = {
        c: float(np.mean((q["lo"] <= q["y"]) & (q["y"] <= q["hi"])))
        for c, q in held.groupby("country")
    }
    after_f = M.apply_band_factor(held, calib)
    after_f["y"] = held["y"].to_numpy()
    after = {
        c: float(np.mean((q["lo"] <= q["y"]) & (q["y"] <= q["hi"])))
        for c, q in after_f.groupby("country")
    }
    raw_width = {
        c: float(np.median((q["hi"] - q["lo"]) / q["pred"].where(q["pred"] > 0)))
        for c, q in held.groupby("country")
    }
    report_calib = {
        "pooled_factor": calib["*"],
        "countries_with_their_own_factor": len(calib["_own"]),
        "min_held_out_months_for_own_factor": M.MIN_CALIB_MONTHS,
        "blend_prior_months": M.BLEND_PRIOR_MONTHS,
        "median_own_factor": float(
            np.median([calib["_detail"][c]["own_factor"] for c in calib["_detail"]])
        ),
        "mean_inner_coverage_before": float(np.mean(list(before.values()))),
        "mean_inner_coverage_after": float(np.mean(list(after.values()))),
        "per_country": {
            c: calib["_detail"][c]
            | {
                "inner_coverage_before": before.get(c),
                "inner_coverage_after": after.get(c),
                "median_relative_width_before_the_factor": raw_width.get(c),
            }
            for c in sorted(calib["_detail"])
        },
    }
    return index, picks_form, scores, calib, report_calib


def fit_options(
    cm: pd.DataFrame,
    univ: pd.DataFrame,
    months: np.ndarray,
    unit: str,
    modis_sat: str,
    k_ratio: float,
    rng: np.random.Generator,
) -> tuple[dict, pd.DataFrame]:
    """Fit every world option on one window. Returns models and the pair table."""
    pairs = pair_frame(univ, cm, months, unit, modis_sat, with_truth=True)
    terms = {n: (t, k) for n, t, k in M.A2_OPTIONS}
    models = {}
    for name in WORLD_OPTIONS:
        n_terms, k_mult = terms[name]
        models[name] = M.fit_convert(pairs, k_ratio, n_terms, rng, k_mult=k_mult)
    return models, pairs


def pick_per_country(
    cm: pd.DataFrame,
    univ: pd.DataFrame,
    unit: str,
    modis_sat: str,
    k_ratio: float,
    rng: np.random.Generator,
    fit_window: tuple[int, int, int, int] = FIT,
) -> tuple[dict, dict]:
    """Choose `moy` or `moy_pooled` per country on an inner split of the fit
    years. A country with too few positive MODIS pairs in the inner fit, or no
    measured fire in the inner holdout, cannot be judged and takes
    `moy_pooled`, the safer of the two for a thin group."""
    w = fit_window
    inner_fit = (w[0], w[1], w[2] - INNER_HOLD_YEARS, 12)
    inner_hold = (w[2] - INNER_HOLD_YEARS + 1, 1, w[2], w[3])
    fit_m, hold_m = months_in(inner_fit), months_in(inner_hold)
    assert set(hold_m) <= set(months_in(w)), "inner holdout outside the fit years"
    assert not set(fit_m) & set(hold_m), "inner split overlaps"

    models, pairs = fit_options(cm, univ, fit_m, unit, modis_sat, k_ratio, rng)
    held = pair_frame(univ, cm, hold_m, unit, modis_sat, with_truth=True)
    n_pairs = (
        pairs.loc[pairs["x"] > 0].groupby("country").size().to_dict()
    )
    scores: dict = {}
    for name, model in models.items():
        got = M.predict_convert(model, held)
        got["y"] = held.loc[got.index, "y"]
        scores[name] = M.country_month_scores(got)
        del got

    picks, judged = {}, 0
    for country in sorted(univ["country"].unique()):
        enough = n_pairs.get(country, 0) >= MIN_INNER_PAIRS
        rows = [
            (n, scores[n].get(country))
            for n in WORLD_OPTIONS
            if scores[n].get(country) is not None
            and scores[n][country]["country_month_nrmse"] is not None
        ]
        if not enough or len(rows) < len(WORLD_OPTIONS):
            picks[country] = "moy_pooled"
            continue
        ok = [r for r in rows if abs(r[1]["bias"]) <= M.BIAS_GATE]
        pool = ok if ok else rows
        picks[country] = min(pool, key=lambda r: r[1]["country_month_nrmse"])[0]
        judged += 1
    return picks, {
        "inner_fit": f"{inner_fit[0]}-{inner_fit[1]:02d} to {inner_fit[2]}-12",
        "inner_holdout": f"{inner_hold[0]}-01 to {inner_hold[2]}-{inner_hold[3]:02d}",
        "countries_judged_on_the_split": judged,
        "countries_defaulted_to_moy_pooled": len(picks) - judged,
        "min_inner_positive_pairs": MIN_INNER_PAIRS,
    }


def fit_production(
    cm: pd.DataFrame,
    univ: pd.DataFrame,
    unit: str,
    modis_sat: str,
    k_ratio: float,
    rng: np.random.Generator,
    fit_window: tuple[int, int, int, int] = FIT,
    pred_window: tuple[int, int, int, int] | None = None,
) -> tuple[dict, dict]:
    """Refit both options on all fit years and record where S-NPP came from.

    The leakage record is taken from the rows that actually built the fitted
    parameters, not from a frame that was just filtered, so it can fail.
    """
    months = months_in(fit_window)
    models, pairs = fit_options(cm, univ, months, unit, modis_sat, k_ratio, rng)
    truth = pairs.loc[pairs["y"] > 0, "ym"]
    record = {
        "snpp_rows_in_fit": int(len(truth)),
        "snpp_first_ym": int(truth.min()),
        "snpp_last_ym": int(truth.max()),
        "window_first_ym": int(months[0]),
        "window_last_ym": int(months[-1]),
    }
    assert record["snpp_first_ym"] >= record["window_first_ym"], "S-NPP before the fit window"
    assert record["snpp_last_ym"] <= record["window_last_ym"], "S-NPP after the fit window"
    assert record["snpp_first_ym"] >= ym(2012, 2), "S-NPP used before Feb 2012"
    if pred_window is not None:
        bad = np.isin(truth.to_numpy(), months_in(pred_window))
        record["snpp_rows_inside_the_prediction_window"] = int(bad.sum())
        assert not bad.any(), "S-NPP from a prediction year entered the fit"
    pools = {n: fast_country_pools(m, pairs) for n, m in models.items()}
    del pairs
    return models, record, pools


def predict_rows(
    models: dict,
    picks: dict,
    frame: pd.DataFrame,
) -> pd.DataFrame:
    """Predict a table of cell-months, each country through its own option."""
    out = []
    for name in WORLD_OPTIONS:
        want = {c for c, p in picks.items() if p == name}
        part = frame[frame["country"].isin(want)]
        if len(part):
            out.append(M.predict_convert(models[name], part))
    return pd.concat(out, ignore_index=True)


def background_table(models: dict, picks: dict, period: str, unit: str, sat: str) -> pd.DataFrame:
    """The zero term as a table: one value per group and calendar month.

    This is `background.parquet` and ruling 10 of docs/number-logic.md. It is a
    function of group and calendar month only, never of the cell, which is what
    lets the exporter store it once per group.
    """
    groups = sorted({g for m in models.values() for g in m.ix["groups"]})
    rows = pd.DataFrame(
        {
            "group": np.repeat(groups, 12),
            "moy": np.tile(np.arange(1, 13), len(groups)),
        }
    )
    rows["country"] = rows["group"].str.rsplit("|", n=1).str[0]
    rows["lat_band"] = rows["group"].str.rsplit("|", n=1).str[1].astype(int)
    rows["cell"] = 0
    rows["x"] = 0.0
    rows["ym"] = 2005 * 12 + rows["moy"] - 1
    rows = attach_background(rows, unit, sat)
    got = predict_rows(models, picks, rows)
    got["period"] = period
    return got[["group", "country", "lat_band", "period", "moy", "pred", "hi"]]


# ----------------------------------------------------------------- the run


def harmonize(
    agg: pd.DataFrame,
    cm: pd.DataFrame,
    univ: pd.DataFrame,
    rng: np.random.Generator,
    report: dict,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Build the per-cell record, the background table and the group table."""
    k_scale = {}
    aqua_fit = cm[(cm["sat"] == "Aqua") & M.window_mask(cm["ym"], FIT)]
    for u in M.UNITS:
        k_scale[u] = float(aqua_fit[u].sum() / aqua_fit["cd"].sum())
    report["prior_strength_per_unit"] = {
        u: M.K_RATIO_CD * k_scale[u] for u in M.UNITS
    }

    # Which cell-months get a row at all: any satellite saw fire there.
    seen = (
        agg.loc[agg["cd"] + agg["cd_gap"] > 0, ["country", "group", "cell", "ym"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    est = {
        SRC_TERRA: (seen[M.window_mask(seen["ym"], TERRA_PERIOD)], "Terra"),
        SRC_MODIS: (seen[M.window_mask(seen["ym"], MODIS_PERIOD)], "Aqua"),
    }

    picks, inner = pick_per_country(cm, univ, "cd", "Aqua", M.K_RATIO_CD, rng)
    report["inner_split"] = inner
    report["option_counts"] = (
        pd.Series(picks).value_counts().to_dict() if picks else {}
    )
    report["picks"] = picks

    est_parts, backgrounds = [], []
    joint_ranges: dict = {}
    factor_parts: list = []
    pooled: list = []
    if MODEL_VARIANT and MODEL_VARIANT[0] == "A3":
        report["a3_background"] = {}
        for sat in ("Terra", "Aqua"):
            # The form and the band factor are chosen on cd and reused for hot,
            # as the time term already is. The activity index is per unit.
            _, picks_form, scores, calib, rep = pick_background_form(
                cm, univ, "cd", sat, M.K_RATIO_CD * k_scale["cd"], picks, rng
            )
            for unit in M.UNITS:
                A3_STATE[(unit, sat)] = (
                    M.activity_index(cm, unit, sat, FIT), picks_form, calib,
                )
            report["a3_background"][sat] = {
                "picks": pd.Series(picks_form).value_counts().to_dict(),
                "chosen_on": "cd, reused for hot",
                "country_band_calibration": rep,
            }
    for src, (frame, sat) in est.items():
        per_unit, models_by_unit = {}, {}
        for unit in M.UNITS:
            models, record, pools = fit_production(
                cm, univ, unit, sat, M.K_RATIO_CD * k_scale[unit], rng
            )
            report.setdefault("leakage_record", {})[f"{src}_{unit}"] = record
            base = frame.copy()
            vals = cm.loc[cm["sat"] == sat, ["country", "cell", "ym", unit]]
            base = base.merge(
                vals.rename(columns={unit: "x"}), on=["country", "cell", "ym"], how="left"
            )
            base["x"] = base["x"].fillna(0).astype(float)
            base["moy"] = (base["ym"] % 12) + 1
            base = attach_background(base, unit, sat)
            got = predict_rows(models, picks, base)
            per_unit[unit] = got[
                ["country", "cell", "ym", "pred", "lo", "hi"]
            ].rename(
                columns={"pred": unit, "lo": f"{unit}_lo", "hi": f"{unit}_hi"}
            )
            if unit == "cd":
                bg_cd = background_table(models, picks, src, unit, sat)
                f_cd = factor_table(models, picks, src, unit, sat)
            else:
                bg_hot = background_table(models, picks, src, unit, sat)
                f_hot = factor_table(models, picks, src, unit, sat)
            joint = joint_country_ranges(
                models, picks, univ, cm, months_in(
                    TERRA_PERIOD if src == SRC_TERRA else MODIS_PERIOD
                ), unit, sat, pools, rng
            )
            joint["src"] = src
            joint_ranges.setdefault(unit, []).append(joint)
            models_by_unit[unit] = models
            del got, base
        joined = per_unit["cd"].merge(
            per_unit["hot"], on=["country", "cell", "ym"], how="outer"
        )
        joined["src"] = src
        est_parts.append(joined)
        bg = bg_cd.rename(columns={"pred": "cd", "hi": "cd_hi"}).merge(
            bg_hot.rename(columns={"pred": "hot", "hi": "hot_hi"})[
                ["group", "moy", "hot", "hot_hi"]
            ],
            on=["group", "moy"],
            how="left",
        )
        backgrounds.append(bg)
        factor_parts.append(
            f_cd.merge(f_hot[["group", "moy", "k_hot"]], on=["group", "moy"], how="left")
        )
        pbg, pf_cd = pooled_rows(models_by_unit["cd"], bg_cd, f_cd, src, "cd")
        _, pf_hot = pooled_rows(models_by_unit["hot"], bg_hot, f_hot, src, "hot")
        pooled.append(
            (
                pbg.rename(columns={"pred": "cd", "hi": "cd_hi"}).assign(
                    hot=pbg["pred"], hot_hi=pbg["hi"]
                ),
                pf_cd.merge(pf_hot[["group", "moy", "k_hot"]], on=["group", "moy"]),
            )
        )

    estimated = pd.concat(est_parts, ignore_index=True)
    report["joint_country_range"] = (
        "For an estimated month the country range is computed jointly: the cells "
        "are added inside each bootstrap draw and a country-month residual drawn "
        "from the fit years is applied, then the 5% and 95% points are taken. The "
        "band is then centred on the country value by the ratio of the joint range "
        "to the joint point estimate, so the value itself still equals the cells "
        "plus the background. Adding cell ranges instead made the range far too "
        "wide, which the scorer saw as 100% coverage for a 90% band."
    )

    # Measured period: S-NPP as it is, with the gap days filled from NOAA-20.
    ratio = noaa20_ratio(agg, report)
    ratio_2026 = noaa20_ratio(agg, report, CAL_2026, "noaa20_to_snpp_ratio_2026")
    prov_ym = provisional_months(agg, report)
    snpp = agg.loc[
        (agg["sat"] == "SNPP") & M.window_mask(agg["ym"], MEASURED_PERIOD),
        ["country", "cell", "ym", "cd", "hot"],
    ]
    fill = agg.loc[
        (agg["sat"] == "NOAA20")
        & (agg["cd_gap"] > 0)
        & M.window_mask(agg["ym"], MEASURED_PERIOD),
        ["country", "cell", "ym", "cd_gap", "hot_gap"],
    ]
    meas = (
        seen[M.window_mask(seen["ym"], MEASURED_PERIOD)][["country", "cell", "ym"]]
        .merge(snpp, on=["country", "cell", "ym"], how="left")
        .merge(fill, on=["country", "cell", "ym"], how="left")
    )
    for c in ("cd", "hot", "cd_gap", "hot_gap"):
        meas[c] = meas[c].fillna(0).astype(float)
    meas["gap_filled"] = meas["cd_gap"] > 0
    after_snpp = meas["ym"] >= ym(2026, 1)
    for u in M.UNITS:
        r = np.where(after_snpp, ratio_2026[u], ratio[u])
        meas[u] = meas[u] + meas[f"{u}_gap"] * r
        meas[f"{u}_lo"] = meas[u]
        meas[f"{u}_hi"] = meas[u]
    # Label: a month holding a day after S-NPP stopped is measured_calibrated
    # and keeps that label; a month whose reference rows are mostly
    # near-real-time is provisional; everything else is measured.
    calibrated_ym = set(
        meas.loc[meas["gap_filled"] & after_snpp, "ym"].astype(int).unique()
    )
    meas["src"] = np.where(
        meas["ym"].isin(calibrated_ym),
        SRC_CALIBRATED,
        np.where(meas["ym"].isin(prov_ym), SRC_PROVISIONAL, SRC_MEASURED),
    )
    report["month_labels"] = {
        "measured_calibrated": sorted(
            f"{v // 12}-{v % 12 + 1:02d}" for v in calibrated_ym
        ),
        "provisional": sorted(
            f"{v // 12}-{v % 12 + 1:02d}" for v in prov_ym if v not in calibrated_ym
        ),
        "measured_calibrated_is_also_provisional": sorted(
            f"{v // 12}-{v % 12 + 1:02d}" for v in calibrated_ym if v in prov_ym
        ),
        "snpp_gap_filled": sorted(
            f"{v // 12}-{v % 12 + 1:02d}"
            for v in meas.loc[
                meas["gap_filled"] & ~after_snpp, "ym"
            ].astype(int).unique()
        ),
    }
    measured = meas[
        ["country", "cell", "ym", "src", "gap_filled"] + HARM_COLS
    ]

    estimated["gap_filled"] = False
    per_country = pd.concat(
        [estimated[measured.columns], measured], ignore_index=True
    )
    joint = {u: pd.concat(v, ignore_index=True) for u, v in joint_ranges.items()}
    return (
        per_country,
        pd.concat(backgrounds, ignore_index=True),
        picks,
        joint,
        pd.concat(factor_parts, ignore_index=True),
        pooled,
    )


def joint_country_ranges(
    models: dict,
    picks: dict,
    univ: pd.DataFrame,
    cm: pd.DataFrame,
    months: np.ndarray,
    unit: str,
    sat: str,
    pools: dict,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Country-month ranges for one estimated period, added up inside each draw.

    Reuses the bake-off's `country_month_ranges`, so the construction the scorer
    will read on the bake-off country rows is the same one used here.
    """
    out = []
    for name in WORLD_OPTIONS:
        want = {c for c, p in picks.items() if p == name}
        part = univ[univ["country"].isin(want)]
        if part.empty:
            continue
        frame = pair_frame(part, cm, months, unit, sat, with_truth=False)
        frame = M.with_term(frame, models[name].n_terms)
        out.append(
            M.country_month_ranges(models[name], frame, pools[name], rng)
        )
        del frame
    joined = pd.concat(out, ignore_index=True)
    joined["lo_raw"] = joined["lo"]
    joined["hi_raw"] = joined["hi"]
    state = A3_STATE.get((unit, sat))
    if state is not None and len(state) > 2:
        widened = M.apply_band_factor(joined, state[2])
        joined[["lo", "hi"]] = widened[["lo", "hi"]]
    return joined.rename(
        columns={
            "pred": f"{unit}_joint",
            "lo": f"{unit}_joint_lo",
            "hi": f"{unit}_joint_hi",
            "lo_raw": f"{unit}_joint_lo_raw",
            "hi_raw": f"{unit}_joint_hi_raw",
        }
    )


def centre_band(out: pd.DataFrame, joint: pd.DataFrame, unit: str) -> pd.DataFrame:
    """Scale a joint range onto the country value, keeping the value itself."""
    merged = out.merge(joint, on=["country", "ym", "src"], how="left")
    p = merged[f"{unit}_joint"].to_numpy(dtype=float)
    ok = np.isfinite(p) & (p > 0)
    for end in ("lo", "hi", "lo_raw", "hi_raw"):
        f = np.where(ok, merged[f"{unit}_joint_{end}"].to_numpy(dtype=float) / np.where(ok, p, 1.0), 1.0)
        merged[f"{unit}_{end}"] = np.where(
            merged["src"] == SRC_MEASURED, merged[unit], merged[unit] * f
        )
    for end in ("lo", "lo_raw"):
        merged[f"{unit}_{end}"] = np.minimum(
            merged[f"{unit}_{end}"], merged[unit]
        ).clip(lower=0.0)
    for end in ("hi", "hi_raw"):
        merged[f"{unit}_{end}"] = np.maximum(merged[f"{unit}_{end}"], merged[unit])
    return merged.drop(
        columns=[
            f"{unit}_joint", f"{unit}_joint_lo", f"{unit}_joint_hi",
            f"{unit}_joint_lo_raw", f"{unit}_joint_hi_raw",
        ]
    )


def factor_table(models: dict, picks: dict, period: str, unit: str, sat: str) -> pd.DataFrame:
    """The multiplier the model applies to the source sensor's raw count.

    For a cell-month in which the source sensor saw fire the model is exactly
    `value = raw source count x factor`; nothing is added. The factor is the
    pooled ratio of the cell's group for that calendar month, so a group with
    no ratio of its own carries the group, country or global value the
    shrinkage cascade actually gives it. Built by predicting a raw count of 1,
    through the same predict path the record itself uses.
    """
    groups = sorted({g for m in models.values() for g in m.ix["groups"]})
    rows = pd.DataFrame(
        {"group": np.repeat(groups, 12), "moy": np.tile(np.arange(1, 13), len(groups))}
    )
    rows["country"] = rows["group"].str.rsplit("|", n=1).str[0]
    rows["cell"] = 0
    rows["x"] = 1.0
    rows["ym"] = 2005 * 12 + rows["moy"] - 1
    rows = attach_background(rows, unit, sat)
    got = predict_rows(models, picks, rows)
    got["period"] = period
    return got[["group", "period", "moy", "pred"]].rename(columns={"pred": f"k_{unit}"})


def check_factors(
    cells: pd.DataFrame, agg: pd.DataFrame, factors: pd.DataFrame, groups_map: dict
) -> list:
    """Three groups: does value equal raw source count times the factor?"""
    out = []
    one = agg.groupby(["cell", "ym"], as_index=False)["country"].nunique()
    single = one.loc[one["country"] == 1, ["cell", "ym"]]
    for period, sat, window in (
        (SRC_MODIS, "Aqua", MODIS_PERIOD),
        (SRC_TERRA, "Terra", TERRA_PERIOD),
    ):
        raw = agg.loc[
            (agg["sat"] == sat) & M.window_mask(agg["ym"], window) & (agg["cd"] > 0),
            ["cell", "ym", "group", "cd", "hot"],
        ]
        for g in sorted(raw["group"].unique())[:: max(len(raw["group"].unique()) // 3, 1)][:3]:
            part = raw[raw["group"] == g].head(5000).merge(
                single, on=["cell", "ym"], how="inner"
            )
            if part.empty:
                continue
            r = part.iloc[0]
            row = cells[(cells["cell"] == r["cell"])
                        & (cells["year"] * 12 + cells["month"] - 1 == r["ym"])]
            f = factors[(factors["group"] == g) & (factors["period"] == period)
                        & (factors["month"] == (r["ym"] % 12) + 1)]
            if row.empty or f.empty:
                continue
            got = {u: float(row.iloc[0][u]) for u in M.UNITS}
            want = {u: float(r[u]) * float(f.iloc[0][f"k_{u}"]) for u in M.UNITS}
            ok = all(abs(got[u] - want[u]) <= 1e-6 * max(abs(want[u]), 1.0) for u in M.UNITS)
            out.append({
                "group": g, "group_id": int(groups_map.get(g, -1)), "period": period,
                "cell": int(r["cell"]), "year": int(r["ym"] // 12),
                "month": int((r["ym"] % 12) + 1),
                "raw_source_cd": float(r["cd"]), "raw_source_hot": float(r["hot"]),
                "value_cd": got["cd"], "expected_cd": want["cd"],
                "value_hot": got["hot"], "expected_hot": want["hot"],
                "matches": bool(ok),
            })
            print(f"factor check {period} {g} cell {int(r['cell'])}: "
                  f"cd {got['cd']:.4f} vs raw x k {want['cd']:.4f} "
                  f"{'PASS' if ok else 'MISS'}")
    assert out and all(c["matches"] for c in out), "factor check failed"
    return out


def noaa20_ratio(
    agg: pd.DataFrame,
    report: dict,
    window: tuple[int, int, int, int] = NOAA20_RATIO_YEARS,
    key: str = "noaa20_to_snpp_ratio",
) -> dict:
    """S-NPP over NOAA-20, measured on the window's non-gap days.

    The returned number multiplies a NOAA-20 count to bring it to S-NPP level,
    so it is the reciprocal of the NOAA-20 to S-NPP ratio that the research
    note quotes. Both are reported.
    """
    w = M.window_mask(agg["ym"], window)
    out = {}
    for unit in M.UNITS:
        a = float(agg.loc[w & (agg["sat"] == "SNPP"), unit].sum())
        b = float(agg.loc[w & (agg["sat"] == "NOAA20"), unit].sum())
        out[unit] = a / b if b else 1.0
    report[key] = {
        "window": f"{window[0]}-{window[1]:02d} to {window[2]}-{window[3]:02d}",
        "snpp_over_noaa20_cd": round(out["cd"], 5),
        "snpp_over_noaa20_hot": round(out["hot"], 5),
        "noaa20_over_snpp_cd": round(1 / out["cd"], 5) if out["cd"] else None,
        "noaa20_over_snpp_hot": round(1 / out["hot"], 5) if out["hot"] else None,
        "applied_as": "a NOAA-20 count is multiplied by snpp_over_noaa20 before filling",
    }
    return out


def partial_months(agg: pd.DataFrame) -> dict:
    """Which month a sensor only partly covers, from its own first and last day."""
    span = agg.groupby("sat")[["first_day", "last_day"]].agg(
        {"first_day": "min", "last_day": "max"}
    )
    out = {}
    for sat, row in span.iterrows():
        f, l = pd.Timestamp(row["first_day"]), pd.Timestamp(row["last_day"])
        bad = set()
        if f.day > 1:
            bad.add(ym(f.year, f.month))
        if l.day < l.days_in_month:
            bad.add(ym(l.year, l.month))
        out[sat] = bad
    return out



# ------------------------------------------------- the world model's own tests

Q25_COUNTRIES = ("Bulgaria", "United_States")


def holdout_run(agg, cm, rng, report, out_dir):
    """Hold-out predictions from the world model, for the independent scorer.

    The scored bake-off fitted two countries. These rows come from the same
    functions fitted on all of them, so the scorer can say what the world
    model is worth, including for a small country.
    """
    pieces, counts, leak = [], {}, {}
    for test in ("t1", "t2"):
        fitw, predw = M.TESTS[test]["fit"], M.TESTS[test]["pred"]
        univ = M.universe(cm, fitw)
        k_cd = M.K_RATIO_CD
        aqua = cm[(cm["sat"] == "Aqua") & M.window_mask(cm["ym"], fitw)]
        k_scale = {u: float(aqua[u].sum() / aqua["cd"].sum()) for u in M.UNITS}
        picks_term, inner_t = pick_per_country(
            cm, univ, "cd", "Aqua", k_cd * k_scale["cd"], rng, fit_window=fitw
        )
        A3_STATE.clear()
        index, picks_form, scores, calib, rep = pick_background_form(
            cm, univ, "cd", "Aqua", k_cd * k_scale["cd"], picks_term, rng,
            fit_window=fitw,
        )
        for unit in M.UNITS:
            A3_STATE[(unit, "Aqua")] = (
                M.activity_index(cm, unit, "Aqua", fitw), picks_form, calib,
            )
        report.setdefault("tests", {})[test] = {
            "fit": f"{fitw[0]}-{fitw[1]:02d} to {fitw[2]}-{fitw[3]:02d}",
            "predict": f"{predw[0]}-{predw[1]:02d} to {predw[2]}-{predw[3]:02d}",
            "time_term_counts": pd.Series(picks_term).value_counts().to_dict(),
            "background_form_counts": pd.Series(picks_form).value_counts().to_dict(),
            "inner_split": inner_t,
            "country_band_calibration": rep,
        }
        for unit in M.UNITS:
            models, record, pools = fit_production(
                cm, univ, unit, "Aqua", k_cd * k_scale[unit], rng,
                fit_window=fitw, pred_window=predw,
            )
            leak[f"{test}_{unit}"] = record
            future = pair_frame(
                univ, cm, months_in(predw), unit, "Aqua", with_truth=False
            )
            cr = joint_country_ranges(
                models, picks_term, univ, cm, months_in(predw), unit, "Aqua",
                pools, rng,
            ).rename(
                columns={
                    f"{unit}_joint": "pred",
                    f"{unit}_joint_lo": "lo",
                    f"{unit}_joint_hi": "hi",
                }
            )
            cr = cr.drop(
                columns=[c for c in cr.columns if c.endswith("_raw")], errors="ignore"
            )
            cr["grid"], cr["cell"] = "country", 0
            q = predict_rows(
                models, picks_term, future[future["country"].isin(Q25_COUNTRIES)]
            )
            q = q[q["pred"] > 0].copy()
            q["grid"] = "q25"
            for frame in (cr, q):
                frame["pipeline"], frame["test"], frame["unit"] = "W", test, unit
                frame["year"] = frame["ym"] // 12
                frame["month"] = (frame["ym"] % 12) + 1
                pieces.append(
                    frame[
                        [
                            "pipeline", "test", "unit", "country", "grid", "cell",
                            "year", "month", "pred", "lo", "hi",
                        ]
                    ]
                )
            counts[f"{test}_{unit}_country"] = int(len(cr))
            counts[f"{test}_{unit}_q25"] = int(len(q))
            print(f"W {test} {unit}: {len(cr):,} country rows "
                  f"({cr['country'].nunique()} countries), {len(q):,} q25 rows",
                  flush=True)
            del models, pools, future, cr, q
    pred = pd.concat(pieces, ignore_index=True)
    pred["cell"] = pred["cell"].astype("int64")
    pred["year"] = pred["year"].astype("int32")
    pred["month"] = pred["month"].astype("int32")
    for c in ("pred", "lo", "hi"):
        pred[c] = pred[c].astype("float64")
    pred["pred"] = pred["pred"].clip(lower=0.0)
    pred["lo"] = np.minimum(pred["lo"].clip(lower=0.0), pred["pred"])
    pred["hi"] = np.maximum(pred["hi"], pred["pred"])
    assert list(pred.columns) == [
        "pipeline", "test", "unit", "country", "grid", "cell",
        "year", "month", "pred", "lo", "hi",
    ]
    assert set(pred["pipeline"]) == {"W"}
    assert set(pred["test"]) == {"t1", "t2"}
    assert set(pred["unit"]) == set(M.UNITS)
    assert set(pred["grid"]) == {"country", "q25"}
    assert set(pred.loc[pred["grid"] == "country", "cell"]) == {0}
    assert set(pred.loc[pred["grid"] == "q25", "country"]) <= set(Q25_COUNTRIES)
    assert not pred.isna().any().any(), "NaN in the hold-out output"
    assert (pred["pred"] >= 0).all()
    assert (pred["lo"] <= pred["pred"]).all() and (pred["pred"] <= pred["hi"]).all()
    assert pred["month"].between(1, 12).all()
    out_dir.mkdir(parents=True, exist_ok=True)
    pred.to_parquet(out_dir / "pred.parquet", index=False, compression="zstd")
    report["rows"] = counts
    report["rows_total"] = int(len(pred))
    report["countries"] = int(
        pred.loc[pred["grid"] == "country", "country"].nunique()
    )
    report["leakage_record"] = leak
    return pred


def main() -> int:
    ap = argparse.ArgumentParser(description="World run of the scored A2 conversion")
    ap.add_argument("--data", default=str(ROOT / "data"))
    ap.add_argument("--threads", type=int, default=16)
    ap.add_argument("--model", choices=("A2", "A3"), default="A3",
                    help="A3 is the adopted model and the default. A2 is the "
                         "earlier scored model, kept so the bake-off rows can "
                         "be reproduced.")
    ap.add_argument("--holdout", action="store_true",
                    help="Write the hold-out predictions of the world model "
                         "for the scorer instead of the record.")
    ap.add_argument("--check-bakeoff", action="store_true")
    args = ap.parse_args()
    data = Path(args.data).resolve()
    out_dir = data / "derived" / "world" / "harmonized"
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    report: dict = {}
    report["model_variant"] = args.model
    MODEL_VARIANT.append(args.model)

    src = data / "derived" / "world" / "cell_days.parquet"
    agg = aggregate(src, args.threads)
    src26 = data / "derived" / "world" / "cell_days_2026.parquet"
    if src26.exists() and not args.holdout:
        a26 = aggregate_2026(src26, args.threads)
        report["rows_2026_aggregate"] = int(len(a26))
        report["unassigned_cell_months_2026"] = int(
            a26.loc[a26["country"] == UNASSIGNED, ["cell", "ym"]]
            .drop_duplicates()
            .shape[0]
        )
        print(f"2026 table: {len(a26):,} aggregate rows, "
              f"{report['unassigned_cell_months_2026']:,} cell-months with no country")
        agg = pd.concat([agg, a26], ignore_index=True)
        for c in ("prov_rows", "src_rows"):
            agg[c] = agg[c].fillna(0)
    if args.holdout:
        cm = model_frame(agg)
        rng = np.random.default_rng(M.SEED + 7)
        MODEL_VARIANT.append("A3")
        hout = data / "derived" / "bakeoff" / "W"
        report["pipeline"] = "W"
        report["band"] = M.BAND
        report["model"] = (
            "The world model (A3) fitted on all countries, predicting the protocol "
            "t1 and t2 windows. Country rows carry the jointly computed and "
            "conformally calibrated range. q25 rows are written for Bulgaria and "
            "the United States so the world model can sit next to A3 on the "
            "existing levels."
        )
        t_h = time.time()
        holdout_run(agg, cm, rng, report, hout)
        report["seconds_model"] = round(time.time() - t_h, 1)
        report["seconds_total"] = round(time.time() - t0, 1)
        for key, rec in report["leakage_record"].items():
            print(f"  leakage {key}: S-NPP months {rec['snpp_first_ym']} to "
                  f"{rec['snpp_last_ym']}, fit window {rec['window_first_ym']} to "
                  f"{rec['window_last_ym']}, rows inside the prediction window "
                  f"{rec.get('snpp_rows_inside_the_prediction_window')}")
        (hout / "manifest.json").write_text(
            json.dumps(report, indent=2, default=str) + "\n"
        )
        print(f"\nwrote {hout}: {report['rows_total']:,} rows, "
              f"{report['countries']} countries, {report['seconds_total']} s")
        return 0
    print(f"aggregate: {len(agg):,} country x satellite x cell x month rows "
          f"in {time.time() - t0:.0f} s")
    cm = model_frame(agg)
    univ = M.universe(cm, FIT)
    print(f"universe: {len(univ):,} country-cell pairs, "
          f"{univ['cell'].nunique():,} cells, {univ['group'].nunique()} groups, "
          f"{univ['country'].nunique()} countries")

    rng = np.random.default_rng(M.SEED)
    t_fit = time.time()
    (cells, background, picks, joint, factors, pooled_parts) = harmonize(
        agg, cm, univ, rng, report
    )
    report["seconds_model"] = round(time.time() - t_fit, 1)

    # One row per cell-month: a border cell's countries are added together.
    partial = partial_months(agg)
    cells["flags"] = 0
    src_sat = {SRC_TERRA: "Terra", SRC_MODIS: "Aqua", SRC_MEASURED: "SNPP"}
    for s, sat in src_sat.items():
        bad = partial.get(sat, set())
        if bad:
            hit = (cells["src"] == s) & cells["ym"].isin(bad)
            cells.loc[hit, "flags"] = cells.loc[hit, "flags"] | FLAG_PARTIAL
    cells.loc[cells["gap_filled"], "flags"] = (
        cells.loc[cells["gap_filled"], "flags"] | FLAG_GAP_FILLED
    )
    # The record ends mid-month, so its last month is partial whatever the
    # per-satellite spans say.
    end = pd.Timestamp(RECORD_END_DAY)
    last_ym = ym(end.year, end.month)
    if end.day < end.days_in_month:
        hit = cells["ym"] == last_ym
        cells.loc[hit, "flags"] = cells.loc[hit, "flags"] | FLAG_PARTIAL

    frp = reference_frp(agg)
    countries = country_rollup(cells, agg, univ, background, picks, report, joint, rng)

    per_cell = cells.groupby(["cell", "ym"], as_index=False).agg(
        {**{c: "sum" for c in HARM_COLS}, "flags": "max", "src": "min"}
    )
    per_cell = per_cell.merge(frp, on=["cell", "ym"], how="left")
    per_cell["frp"] = per_cell["frp"].fillna(0.0)
    per_cell["year"] = per_cell["ym"] // 12
    per_cell["month"] = (per_cell["ym"] % 12) + 1
    per_cell = per_cell[
        ["cell", "year", "month"] + ["hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi"]
        + ["frp", "src", "flags"]
    ]
    write_checks(per_cell, countries, background)
    per_cell.to_parquet(out_dir / "cells_monthly.parquet", index=False, compression="zstd")

    if pooled_parts:
        background = pd.concat(
            [background] + [b for b, _ in pooled_parts], ignore_index=True
        )
        factors = pd.concat(
            [factors] + [f for _, f in pooled_parts], ignore_index=True
        )
        factors = factors.groupby(
            ["group", "period", "moy"], as_index=False
        ).agg({"k_cd": "max", "k_hot": "max"})
    background = background.rename(columns={"moy": "month"})
    background["group_id"] = (
        background["group"].astype("category").cat.codes.astype("int32")
    )
    background[
        ["group_id", "country", "lat_band", "period", "month", "hot", "hot_hi", "cd", "cd_hi"]
    ].to_parquet(out_dir / "background.parquet", index=False, compression="zstd")

    groups_map = dict(zip(background["group"], background["group_id"]))
    cell_groups = cell_groups_table(agg, univ, groups_map, report)
    if POOLED_GROUP in set(cell_groups["group"]):
        groups_map[POOLED_GROUP] = int(max(groups_map.values())) + 1
    cell_groups["group_id"] = cell_groups["group"].map(groups_map).astype("int32")
    # Every cell in the record has exactly one group row.
    in_record = set(per_cell["cell"].astype(int))
    have = cell_groups.loc[cell_groups["cell"].isin(in_record), "cell"]
    report["cell_group_completeness"] = {
        "cells_in_cells_monthly": len(in_record),
        "cells_with_exactly_one_group_row": int(
            have.value_counts().eq(1).sum()
        ),
        "cells_without_a_group": int(len(in_record) - have.nunique()),
    }
    print(f"cell groups: {report['cell_group_completeness']['cells_with_exactly_one_group_row']:,}"
          f" of {len(in_record):,} cells in the record have exactly one group row")
    assert report["cell_group_completeness"]["cells_without_a_group"] == 0, (
        "a cell in the record has no group"
    )
    assert have.value_counts().eq(1).all(), "a cell has more than one group row"
    cell_groups[["cell", "group_id", "country"]].to_parquet(
        out_dir / "cell_groups.parquet", index=False, compression="zstd"
    )
    # The pre-factor band ends are a diagnostic, not part of the contract.
    raw_cols = [c for c in countries.columns if c.endswith("_raw")]
    countries.drop(columns=raw_cols).to_parquet(
        out_dir / "countries_monthly.parquet", index=False, compression="zstd"
    )
    factors = factors.rename(columns={"moy": "month"})
    factors["group_id"] = factors["group"].map(groups_map).astype("int32")
    assert factors[["k_cd", "k_hot"]].notna().all().all(), "factors has a null"
    assert (factors[["k_cd", "k_hot"]] > 0).all().all(), "factors has a non-positive k"
    assert len(factors) == len(background), "factors and background do not line up"
    report["factor_checks"] = check_factors(per_cell, agg, factors, groups_map)
    report["factor_formula"] = (
        "For a cell-month before Feb 2012 in which the period's source sensor "
        "(Terra for estimated_terra, Aqua for estimated_modis) saw fire, the "
        "harmonized value is exactly raw source count x k, with nothing added: "
        "cd = cd_source x k_cd and hot = hot_source x k_hot, where k is the row of "
        "factors.parquet for the cell's group, period and calendar month. The "
        "background is NOT added on top; it applies only to a cell-month in which "
        "the source sensor saw nothing, which is ruling 10. One exception: a cell "
        "on a border belongs to more than one country, and cells_monthly adds the "
        "countries together, so its value is the sum over countries of that "
        "country's own group factor times that country's own raw count. For a cell "
        "inside one country, which is nearly all of them, the single factor holds."
    )
    factors[["group_id", "period", "month", "k_hot", "k_cd"]].to_parquet(
        out_dir / "factors.parquet", index=False, compression="zstd"
    )

    report["rows"] = {
        "cells_monthly": int(len(per_cell)),
        "background": int(len(background)),
        "cell_groups": int(len(cell_groups)),
        "factors": int(len(factors)),
        "countries_monthly": int(len(countries)),
        "aggregate": int(len(agg)),
    }
    # Gate: every country has a row for every month of its coverage.
    first = (
        agg[agg["country"] != UNASSIGNED].groupby("country", as_index=False)["ym"].min()
    )
    last = ym(MEASURED_PERIOD[2], MEASURED_PERIOD[3])
    have = countries.assign(ym=countries["year"] * 12 + countries["month"] - 1)
    counts = have.groupby("country", as_index=False)["ym"].count().rename(
        columns={"ym": "rows"}
    )
    want = first.assign(want=lambda d: last - d["ym"] + 1)[["country", "want"]]
    gate = counts.merge(want, on="country", how="outer").fillna(0)
    gate["ok"] = gate["rows"] == gate["want"]
    report["month_completeness"] = {
        "countries": int(len(gate)),
        "countries_complete": int(gate["ok"].sum()),
        "countries_incomplete": sorted(
            gate.loc[~gate["ok"], "country"].astype(str).tolist()
        )[:20],
    }
    print(f"\nmonth completeness: {int(gate['ok'].sum())} of {len(gate)} countries "
          f"have a row for every month of their coverage")
    assert gate["ok"].all(), "a country is missing months"

    # Width of the country band, before and after the conformal factor.
    est_rows = countries[countries["src"] != SRC_MEASURED]
    shown = ["Bulgaria", "Slovenia", "Estonia", "Jamaica", "United_States"]
    width = {}
    for c in shown:
        part = est_rows[(est_rows["country"] == c) & (est_rows["cd"] > 0)]
        if part.empty:
            continue
        width[c] = {
            "months": int(len(part)),
            "hi_over_value_before": float(np.median(part["cd_hi_raw"] / part["cd"])),
            "lo_over_value_before": float(np.median(part["cd_lo_raw"] / part["cd"])),
            "hi_over_value_after": float(np.median(part["cd_hi"] / part["cd"])),
            "lo_over_value_after": float(np.median(part["cd_lo"] / part["cd"])),
        }
    report["country_band_width"] = width
    print("median hi/value and lo/value over estimated country-months, cd:")
    for c, d in width.items():
        print(f"  {c:16s} before {d['hi_over_value_before']:6.2f} / "
              f"{d['lo_over_value_before']:4.2f}   after "
              f"{d['hi_over_value_after']:6.2f} / {d['lo_over_value_after']:4.2f}"
              f"   ({d['months']} months)")

    years = {}
    for y in (2001, 2005, 2011, 2013, 2020):
        part = countries[countries["year"] == y]
        years[y] = {
            "cd": float(part["cd"].sum()),
            "cd_lo": float(part["cd_lo"].sum()),
            "cd_hi": float(part["cd_hi"].sum()),
            "src": sorted(set(part["src"])),
        }
    report["world_year_totals"] = years
    report["world_year_totals_note"] = (
        "Fire cell-days added over every country and month of the year. The range "
        "is the sum of the calibrated country-month bands, so it is itself an "
        "addition and not a jointly computed world band."
    )
    print("\nworld fire cell-days per year, harmonized:")
    for y, d in years.items():
        print(f"  {y}  {d['cd']:14,.0f}   range {d['cd_lo']:12,.0f} to {d['cd_hi']:12,.0f}"
              f"   {','.join(d['src'])}")
    coverage = {
        "last_day_per_satellite": {
            str(k): str(pd.Timestamp(v).date())
            for k, v in agg.groupby("sat")["last_day"].max().items()
        },
        "last_day_of_the_record": RECORD_END_DAY,
        "snpp_last_day": SNPP_END_DAY,
        "first_month": f"{TERRA_PERIOD[0]}-{TERRA_PERIOD[1]:02d}",
        "last_month": f"{MEASURED_PERIOD[2]}-{MEASURED_PERIOD[3]:02d}",
        "calibration": {
            "gap_days_2022_2024": report.get("noaa20_to_snpp_ratio"),
            "after_snpp_2026": report.get("noaa20_to_snpp_ratio_2026"),
        },
        "month_labels": report.get("month_labels", {}),
        "provisional_share_by_month": report.get("provisional_share_by_month", {}),
        "src_periods": src_periods(report),
        "notes": (
            "November 2026 holds 14 days of 30 and carries partial_month. S-NPP "
            "stopped on 2 Nov 2026, so 3 to 14 Nov rests on NOAA-20 brought to "
            "S-NPP level. NOAA-21 is in the input but is not used."
        ),
    }
    (out_dir / "coverage.json").write_text(json.dumps(coverage, indent=2) + "\n")
    report["seconds_total"] = round(time.time() - t0, 1)
    control_totals(data, per_cell, countries, report, args.threads)
    checks_2026(data, per_cell, countries, report, args.threads)
    if args.check_bakeoff:
        report["bakeoff_consistency"] = check_bakeoff(data)
    report["diagnostic_t3_overshoot"] = drift_diagnostic(cm, univ, rng)
    report["model"] = (
        "Tier T1 of docs/conversion-plan.md as scored in the bake-off as A2: ratio "
        "of sums of S-NPP over the MODIS sensor per country x 5 degree latitude band "
        "x calendar month, shrunk group to country to global by empirical Bayes, plus "
        "a background term for cell-months where the MODIS sensor saw nothing; 90% "
        "range from a moment-matched Poisson bootstrap times an empirical residual "
        "spread. Aqua for Jul 2002 to Jan 2012, Terra for Nov 2000 to Jun 2002."
    )
    report["left_out"] = [
        "estimated_modis is converted from Aqua alone, the sensor that shares VIIRS's "
        "overpass time (conversion plan section 1 point 4). Terra is not added in.",
        "The Terra model reuses each country's Aqua option pick rather than running a "
        "second inner split, because the Terra period is 20 months.",
        "No MODIS drift correction after 2022; the measured record covers those years.",
        "frp is not converted. For a gap-filled month it is S-NPP's own FRP on the "
        "non-gap days plus NOAA-20's FRP on the gap days.",
        "cell_groups gives a border cell one group, the country with the most fire "
        "rows, so a per-cell background lookup uses that country's group.",
        "Processes were not needed: the duckdb pass reduces 324 million rows to about "
        "23 million, which one process holds, so the run is single-process with a "
        "16-thread aggregation.",
    ]
    (out_dir / "manifest.json").write_text(json.dumps(report, indent=2, default=str) + "\n")
    print(f"\nwrote {out_dir}")
    for k, v in report["rows"].items():
        print(f"  {k}: {v:,} rows")
    print(f"model seconds {report['seconds_model']}, total seconds {report['seconds_total']}")
    return 0


def reference_frp(agg: pd.DataFrame) -> pd.DataFrame:
    """FRP of the reference sensor per cell-month, not converted."""
    parts = []
    for w, sat in ((TERRA_PERIOD, "Terra"), (MODIS_PERIOD, "Aqua")):
        m = M.window_mask(agg["ym"], w) & (agg["sat"] == sat)
        parts.append(agg.loc[m, ["cell", "ym", "frp"]])
    m = M.window_mask(agg["ym"], MEASURED_PERIOD) & (agg["sat"] == "SNPP")
    parts.append(agg.loc[m, ["cell", "ym", "frp"]])
    m = (
        M.window_mask(agg["ym"], MEASURED_PERIOD)
        & (agg["sat"] == "NOAA20")
        & (agg["frp_gap"] > 0)
    )
    parts.append(agg.loc[m, ["cell", "ym", "frp_gap"]].rename(columns={"frp_gap": "frp"}))
    return pd.concat(parts, ignore_index=True).groupby(
        ["cell", "ym"], as_index=False
    )["frp"].sum()


def dominant_country(agg: pd.DataFrame, univ: pd.DataFrame) -> pd.DataFrame:
    """One country and group per cell: the country with the most fire rows."""
    weight = agg.groupby(["cell", "country", "group"], as_index=False)["cd"].sum()
    weight = weight.sort_values(["cell", "cd", "country"], ascending=[True, False, True])
    best = weight.drop_duplicates("cell", keep="first")
    return best[best["cell"].isin(set(univ["cell"]))][["cell", "country", "group"]]



POOLED_GROUP = "POOLED|0"


def pooled_rows(models: dict, background: pd.DataFrame, factors: pd.DataFrame,
                period: str, unit: str) -> tuple:
    """A background and a factor row for the pooled group.

    A cell whose own country and band never entered the fit still has to answer
    for an estimated month, so it is given the cascade's global level, which is
    the value the model itself falls back to. The upper end carries the median
    relative width of the fitted groups.
    """
    model = models[sorted(models)[0]]
    bg_hi_ratio = float(
        np.median(
            (background["hi"] / background["pred"].where(background["pred"] > 0)).dropna()
        )
    ) if len(background) else 2.0
    bg = {
        "group": POOLED_GROUP, "country": "POOLED", "lat_band": 0,
        "period": period, "moy": list(range(1, 13)),
    }
    bgr = pd.DataFrame({
        "group": POOLED_GROUP, "country": "POOLED", "lat_band": 0, "period": period,
        "moy": np.arange(1, 13),
        "pred": model.z_global, "hi": model.z_global * bg_hi_ratio,
    })
    fac = pd.DataFrame({
        "group": POOLED_GROUP, "period": period, "moy": np.arange(1, 13),
        f"k_{unit}": model.r_global,
    })
    return bgr, fac


def cell_groups_table(
    agg: pd.DataFrame, univ: pd.DataFrame, groups_map: dict, report: dict
) -> pd.DataFrame:
    """A group for every cell that appears in the record, not only fitted ones.

    A cell that first burned after the fit window still has to answer for an
    estimated month, so it takes the group its own country and 5 degree band
    would give it; failing that the nearest fitted band of the same country;
    failing that the pooled group. The background does apply to such a cell
    before Feb 2012: the background is the expected value where the old sensor
    saw nothing in a cell that can burn, and a cell that burned in 2023 can
    burn, so leaving it out would read 0 for every estimated month.
    """
    weight = agg.groupby(["cell", "country", "latband", "group"], as_index=False)["cd"].sum()
    weight = weight.sort_values(
        ["cell", "cd", "country"], ascending=[True, False, True]
    )
    best = weight.drop_duplicates("cell", keep="first").reset_index(drop=True)
    fitted = {g for g in groups_map if g != POOLED_GROUP}
    in_univ = set(univ["cell"].astype(int))
    bands = {}
    for g in fitted:
        country, band = g.rsplit("|", 1)
        bands.setdefault(country, []).append(int(band))

    final, route = [], []
    for cell, country, band, group in zip(
        best["cell"].to_numpy(), best["country"].to_numpy(),
        best["latband"].to_numpy(), best["group"].to_numpy(),
    ):
        if group in fitted:
            final.append(group)
            route.append("fit_universe" if int(cell) in in_univ else "own_country_band")
            continue
        near = bands.get(str(country))
        if near:
            pick = min(near, key=lambda b: (abs(b - int(band)), b))
            final.append(f"{country}|{pick}")
            route.append("nearest_band_same_country")
            continue
        final.append(POOLED_GROUP)
        route.append("pooled")
    best["group_final"] = final
    best["route"] = route
    report["cell_group_routes"] = (
        pd.Series(route).value_counts().to_dict() if route else {}
    )
    out = best[["cell", "country", "group_final", "route"]].rename(
        columns={"group_final": "group"}
    )
    return out


def country_rollup(
    cells: pd.DataFrame,
    agg: pd.DataFrame,
    univ: pd.DataFrame,
    background: pd.DataFrame,
    picks: dict,
    report: dict,
    joint: dict,
    rng: np.random.Generator,
) -> pd.DataFrame:
    """Per country and month, with the background added for every cell of the
    country's cell universe that has no row that month."""
    cells = cells[cells["country"] != UNASSIGNED]
    seen_rows = cells.groupby(["country", "ym", "src"], as_index=False).agg(
        {**{c: "sum" for c in HARM_COLS}, "gap_filled": "max"}
    )
    # Every country gets a row for every month from its first covered month to
    # the end of the record. A month the source sensor never saw still carries
    # the background of all the country's cells, and a measured month with no
    # fire is an honest zero.
    first = (
        agg[agg["country"] != UNASSIGNED]
        .groupby("country", as_index=False)["ym"]
        .min()
        .rename(columns={"ym": "first_ym"})
    )
    last = ym(MEASURED_PERIOD[2], MEASURED_PERIOD[3])
    full = pd.concat(
        [
            pd.DataFrame({"country": c, "ym": np.arange(int(f), last + 1)})
            for c, f in zip(first["country"], first["first_ym"])
        ],
        ignore_index=True,
    )
    full["src"] = np.where(
        full["ym"] <= ym(TERRA_PERIOD[2], TERRA_PERIOD[3]),
        SRC_TERRA,
        np.where(
            full["ym"] <= ym(MODIS_PERIOD[2], MODIS_PERIOD[3]), SRC_MODIS, SRC_MEASURED
        ),
    )
    labels = report.get("month_labels", {})

    def relabel(names: list, label: str) -> None:
        want = {
            ym(int(n.split("-")[0]), int(n.split("-")[1])) for n in names
        }
        full.loc[full["ym"].isin(want), "src"] = label

    relabel(labels.get("provisional", []), SRC_PROVISIONAL)
    relabel(labels.get("measured_calibrated", []), SRC_CALIBRATED)
    listed = full.merge(seen_rows, on=["country", "ym", "src"], how="left")
    for c in HARM_COLS:
        listed[c] = listed[c].fillna(0.0)
    listed["gap_filled"] = listed["gap_filled"].fillna(False)
    # Background for the cells with no row, per country x band x month.
    cells_per = univ.groupby(["country", "group"], as_index=False)["cell"].nunique()
    cells_per = cells_per.rename(columns={"cell": "n_cells"})
    have = (
        cells.merge(univ[["country", "cell", "group"]], on=["country", "cell"], how="inner")
        .groupby(["country", "group", "ym"], as_index=False)["cell"]
        .nunique()
        .rename(columns={"cell": "n_listed"})
    )
    est = listed[listed["src"] != SRC_MEASURED][["country", "ym", "src"]].drop_duplicates()
    grid = est.merge(cells_per, on="country", how="left")
    grid = grid.merge(have, on=["country", "group", "ym"], how="left")
    grid["n_listed"] = grid["n_listed"].fillna(0)
    grid["missing"] = (grid["n_cells"] - grid["n_listed"]).clip(lower=0)
    grid["month"] = (grid["ym"] % 12) + 1
    grid = grid.merge(
        background.rename(columns={"moy": "month", "period": "src"})[
            ["group", "src", "month", "cd", "cd_hi", "hot", "hot_hi"]
        ],
        on=["group", "src", "month"],
        how="left",
    )
    for c in ("cd", "cd_hi", "hot", "hot_hi"):
        grid[c] = grid[c].fillna(0.0) * grid["missing"]
    add = grid.groupby(["country", "ym", "src"], as_index=False)[
        ["cd", "cd_hi", "hot", "hot_hi"]
    ].sum()
    out = listed.merge(
        add, on=["country", "ym", "src"], how="left", suffixes=("", "_bg")
    )
    for c in ("cd", "cd_hi", "hot", "hot_hi"):
        out[c] = out[c] + out[f"{c}_bg"].fillna(0.0)
    out = out.drop(columns=[f"{c}_bg" for c in ("cd", "cd_hi", "hot", "hot_hi")])

    raw = agg.pivot_table(
        index=["country", "ym"], columns="sat", values="hot_raw", aggfunc="sum"
    ).reset_index()
    for sat in ("Terra", "Aqua", "SNPP", "NOAA20"):
        if sat not in raw:
            raw[sat] = np.nan
    starts = {
        sat: int(agg.loc[agg["sat"] == sat, "ym"].min())
        for sat in ("Terra", "Aqua", "SNPP", "NOAA20")
    }
    out = out.merge(raw, on=["country", "ym"], how="left")
    for sat, name in (("Terra", "terra"), ("Aqua", "aqua"), ("SNPP", "snpp"), ("NOAA20", "noaa20")):
        v = out[sat].astype("float64")
        v = v.where(out["ym"] >= starts[sat], np.nan)
        v = v.where(~((out["ym"] >= starts[sat]) & v.isna()), 0.0)
        out[name] = v
    out = out.drop(columns=["Terra", "Aqua", "SNPP", "NOAA20"])

    cfrp = agg
    parts = []
    for w, sat in ((TERRA_PERIOD, "Terra"), (MODIS_PERIOD, "Aqua"), (MEASURED_PERIOD, "SNPP")):
        m = M.window_mask(cfrp["ym"], w) & (cfrp["sat"] == sat)
        parts.append(cfrp.loc[m, ["country", "ym", "frp"]])
    m = (
        M.window_mask(cfrp["ym"], MEASURED_PERIOD)
        & (cfrp["sat"] == "NOAA20")
        & (cfrp["frp_gap"] > 0)
    )
    parts.append(
        cfrp.loc[m, ["country", "ym", "frp_gap"]].rename(columns={"frp_gap": "frp"})
    )
    fr = pd.concat(parts, ignore_index=True).groupby(
        ["country", "ym"], as_index=False
    )["frp"].sum()
    out = out.merge(fr, on=["country", "ym"], how="left")
    out["frp"] = out["frp"].fillna(0.0)
    for unit in M.UNITS:
        if unit in joint:
            out = centre_band(out, joint[unit], unit)
    out["flags"] = np.where(out["gap_filled"].fillna(False), FLAG_GAP_FILLED, 0)
    out["year"] = out["ym"] // 12
    out["month"] = (out["ym"] % 12) + 1
    cols = (
        ["country", "year", "month"]
        + HARM_COLS
        + ["frp", "terra", "aqua", "snpp", "noaa20", "src", "flags"]
        + [c for c in ("cd_lo_raw", "cd_hi_raw", "hot_lo_raw", "hot_hi_raw") if c in out]
    )
    return out[cols].sort_values(["country", "year", "month"]).reset_index(drop=True)


# ----------------------------------------------------------------- checks


def write_checks(cells: pd.DataFrame, countries: pd.DataFrame, bg: pd.DataFrame) -> None:
    for name, frame, pairs in (
        ("cells_monthly", cells, (("hot", "hot_lo", "hot_hi"), ("cd", "cd_lo", "cd_hi"))),
        ("countries_monthly", countries, (("hot", "hot_lo", "hot_hi"), ("cd", "cd_lo", "cd_hi"))),
    ):
        for v, lo, hi in pairs:
            assert frame[[v, lo, hi]].notna().all().all(), f"{name} {v} has NaN"
            assert (frame[v] >= 0).all(), f"{name} {v} negative"
            assert (frame[lo] <= frame[v] + 1e-9).all(), f"{name} {lo} above {v}"
            assert (frame[v] <= frame[hi] + 1e-9).all(), f"{name} {v} above {hi}"
        assert (frame["frp"] >= 0).all(), f"{name} frp negative"
    assert (cells["cell"].between(0, 1036799)).all(), "cell id out of range"
    assert (cells["month"].between(1, 12)).all()
    assert (cells["year"] * 12 + cells["month"] - 1 >= ym(2000, 11)).all()
    assert set(cells["src"]) <= {SRC_TERRA, SRC_MODIS, SRC_MEASURED}
    assert (bg["cd"] >= 0).all() and (bg["hot"] >= 0).all()
    assert (bg["cd"] <= bg["cd_hi"] + 1e-9).all()
    meas = cells[cells["src"] == SRC_MEASURED]
    assert (meas["year"] * 12 + meas["month"] - 1 >= ym(2012, 2)).all(), "measured before Feb 2012"


def control_totals(
    data: Path, cells: pd.DataFrame, countries: pd.DataFrame, report: dict, threads: int
) -> None:
    src = (data / "derived" / "world" / "cell_days.parquet").as_posix()
    con = duckdb.connect()
    con.execute(f"SET threads = {threads}")
    direct = con.execute(
        f"""SELECT count(*) AS cd, sum(detections) AS hot FROM '{src}'
            WHERE sat = 'SNPP' AND year(day) = 2019"""
    ).fetchone()
    bgr = con.execute(
        f"""SELECT sat, sum(detections) AS hot FROM '{src}'
            WHERE country = 'Bulgaria' AND year(day) = 2020 AND month(day) = 8
            GROUP BY 1 ORDER BY 1"""
    ).df()
    con.close()
    mine = cells[cells["year"] == 2019][["cd", "hot"]].sum()
    row = countries[
        (countries["country"] == "Bulgaria")
        & (countries["year"] == 2020)
        & (countries["month"] == 8)
    ].iloc[0]
    sats = {"Aqua": "aqua", "NOAA20": "noaa20", "SNPP": "snpp", "Terra": "terra"}
    raw_ok = all(
        abs(float(row[sats[r["sat"]]]) - float(r["hot"])) < 1e-6
        for _, r in bgr.iterrows()
    )
    print(f"\ncontrol total 2019 S-NPP cd: pipeline {mine['cd']:,.0f} | direct {direct[0]:,}")
    print(f"control total 2019 S-NPP hot: pipeline {mine['hot']:,.0f} | direct {direct[1]:,}")
    print("control total Bulgaria Aug 2020 raw hotspots per satellite: "
          f"{'PASS' if raw_ok else 'MISS'} "
          + ", ".join(f"{r['sat']} {int(r['hot'])}" for _, r in bgr.iterrows()))
    report["control_totals"] = {
        "world_2019_snpp_cd": {"pipeline": float(mine["cd"]), "direct": int(direct[0])},
        "world_2019_snpp_hot": {"pipeline": float(mine["hot"]), "direct": int(direct[1])},
        "bulgaria_aug_2020_raw_per_satellite_match": bool(raw_ok),
    }
    assert abs(mine["cd"] - direct[0]) < 1e-6, "2019 cd control total mismatch"
    assert abs(mine["hot"] - direct[1]) < 1e-6, "2019 hot control total mismatch"
    assert raw_ok, "Bulgaria Aug 2020 raw hotspot mismatch"




def src_periods(report: dict) -> list:
    """The label timeline, built from the labels the run actually applied."""
    labels = report.get("month_labels", {})
    special = {}
    for name in ("provisional", "measured_calibrated"):
        for m in labels.get(name, []):
            y, mo = (int(x) for x in m.split("-"))
            special[ym(y, mo)] = name
    out = [
        {"from": "2000-11", "to": "2002-06", "src": SRC_TERRA},
        {"from": "2002-07", "to": "2012-01", "src": SRC_MODIS},
    ]
    start, last = ym(2012, 2), ym(MEASURED_PERIOD[2], MEASURED_PERIOD[3])
    run_src = special.get(start, SRC_MEASURED)
    run_from = start
    for v in range(start + 1, last + 2):
        here = special.get(v, SRC_MEASURED) if v <= last else None
        if here != run_src:
            out.append({
                "from": f"{run_from // 12}-{run_from % 12 + 1:02d}",
                "to": f"{(v - 1) // 12}-{(v - 1) % 12 + 1:02d}",
                "src": run_src,
            })
            run_src, run_from = here, v
    return out


def checks_2026(
    data: Path, cells: pd.DataFrame, countries: pd.DataFrame, report: dict, threads: int
) -> None:
    """The gates the 2026 extension adds."""
    src26 = data / "derived" / "world" / "cell_days_2026.parquet"
    if not src26.exists():
        return
    con = duckdb.connect()
    con.execute(f"SET threads = {threads}")
    direct = con.execute(
        f"""SELECT count(*) AS cd, sum(detections) AS hot FROM '{src26.as_posix()}'
            WHERE sat = 'SNPP' AND day <= DATE '2026-10-31'"""
    ).fetchone()
    post = con.execute(
        f"""SELECT count(*) AS cd, sum(detections) AS hot FROM '{src26.as_posix()}'
            WHERE sat = 'NOAA20' AND day > DATE '{SNPP_END_DAY}'"""
    ).fetchone()
    con.close()
    jan_oct = cells[
        (cells["year"] == 2026) & (cells["month"] <= 10)
    ][["cd", "hot"]].sum()
    nov = cells[(cells["year"] == 2026) & (cells["month"] == 11)]
    r = report["noaa20_to_snpp_ratio_2026"]
    expected_nov_fill = {
        "cd": float(post[0]) * r["snpp_over_noaa20_cd"],
        "hot": float(post[1]) * r["snpp_over_noaa20_hot"],
    }
    print(f"\n2026 Jan to Oct S-NPP cd: pipeline {jan_oct['cd']:,.0f} | "
          f"direct {direct[0]:,}")
    print(f"2026 Jan to Oct S-NPP hot: pipeline {jan_oct['hot']:,.0f} | "
          f"direct {direct[1]:,}")
    print(f"3 to 14 Nov 2026 fill, cd: NOAA-20 {post[0]:,} / "
          f"{r['noaa20_over_snpp_cd']} = {expected_nov_fill['cd']:,.0f}")
    partial_ok = bool(
        (nov["flags"].astype(int) & FLAG_PARTIAL).all() and len(nov)
    )
    print(f"November 2026 carries partial_month: {'PASS' if partial_ok else 'MISS'}")
    report["checks_2026"] = {
        "jan_to_oct_snpp_cd": {"pipeline": float(jan_oct["cd"]), "direct": int(direct[0])},
        "jan_to_oct_snpp_hot": {"pipeline": float(jan_oct["hot"]), "direct": int(direct[1])},
        "post_snpp_noaa20_rows": {"cd": int(post[0]), "hot": int(post[1])},
        "post_snpp_value_after_scaling": expected_nov_fill,
        "november_2026_partial_month": partial_ok,
    }
    assert abs(jan_oct["cd"] - direct[0]) < 1e-6, "2026 Jan to Oct cd mismatch"
    assert abs(jan_oct["hot"] - direct[1]) < 1e-6, "2026 Jan to Oct hot mismatch"
    assert partial_ok, "November 2026 is missing partial_month"

    prev = data / "derived" / "world" / "prev_cells_monthly.parquet"
    if prev.exists():
        old = pd.read_parquet(prev, columns=["cell", "year", "month", "cd", "hot"])
        old = old[old["year"] <= 2025].head(200000).sample(
            n=1000, random_state=1
        )
        now = cells[["cell", "year", "month", "cd", "hot"]]
        both = old.merge(
            now, on=["cell", "year", "month"], how="left", suffixes=("_old", "_new")
        )
        same = int(
            ((both["cd_old"] == both["cd_new"]) & (both["hot_old"] == both["hot_new"])).sum()
        )
        print(f"months to Dec 2025 unchanged on a 1,000 cell-month sample: "
              f"{same} of {len(both)}")
        report["checks_2026"]["sample_unchanged_to_2025"] = {
            "sampled": int(len(both)), "identical": same
        }
        assert same == len(both), "a pre-2026 cell-month changed"


def check_bakeoff(data: Path) -> dict:
    """Refit the bake-off's t1 through these same imports and compare with the
    A2 rows already written, which proves this script is the scored model."""
    cm, _, _ = M.load_cell_months(data)
    univ = M.universe(cm, M.TESTS["t1"]["fit"])
    rng = np.random.default_rng(M.SEED + 1)
    out = {}
    pred = pd.read_parquet(data / "derived" / "bakeoff" / "A" / "pred.parquet")
    for unit in M.UNITS:
        got, _, _ = M.run_conversion(
            cm, univ, M.TESTS["t1"]["fit"], M.TESTS["t1"]["pred"], unit,
            M.K_RATIO_CD * float(
                cm[(cm["sat"] == "Aqua") & M.window_mask(cm["ym"], M.TESTS["t1"]["fit"])][unit].sum()
                / cm[(cm["sat"] == "Aqua") & M.window_mask(cm["ym"], M.TESTS["t1"]["fit"])]["cd"].sum()
            ),
            rng,
        )
        want = pred[
            (pred["pipeline"] == "A2")
            & (pred["test"] == "t1")
            & (pred["unit"] == unit)
            & (pred["grid"] == "q25")
        ]
        a, b = float(got["pred"].sum()), float(want["pred"].sum())
        out[unit] = {
            "refit_sum": a,
            "bakeoff_a2_sum": b,
            "relative_difference": abs(a - b) / b,
            "match_within_1e-6": bool(abs(a - b) / b < 1e-6),
        }
        print(f"bake-off consistency {unit}: refit {a:,.4f} vs A2 {b:,.4f} "
              f"(relative {abs(a - b) / b:.2e})")
        assert abs(a - b) / b < 1e-6, f"{unit} does not match the scored A2 rows"

    # A3, the adopted model: refit t1 with the forms and time terms the
    # bake-off picked and check the rows come back identical.
    man = json.loads(
        (data / "derived" / "bakeoff" / "A" / "manifest.json").read_text()
    )
    terms = {n: (t, k) for n, t, k in M.A2_OPTIONS}
    for unit in M.UNITS:
        inner = man["A3"]["inner_split"][f"t1_{unit}"]
        pterm, pform = inner["time_term_from_a2"], inner["picks"]
        aqua = cm[(cm["sat"] == "Aqua") & M.window_mask(cm["ym"], M.TESTS["t1"]["fit"])]
        kr = M.K_RATIO_CD * float(aqua[unit].sum() / aqua["cd"].sum())
        idx = M.activity_index(cm, unit, "Aqua", M.TESTS["t1"]["fit"])
        full = M.pair_frame(univ, cm, months_in(M.TESTS["t1"]["fit"]), unit, "Aqua", True)
        fut = M.pair_frame(univ, cm, months_in(M.TESTS["t1"]["pred"]), unit, "Aqua", False)
        total = 0.0
        for form in sorted(set(pform.values())):
            for opt in sorted({pterm[c] for c, f in pform.items() if f == form}):
                keep = {c for c, f in pform.items() if f == form and pterm[c] == opt}
                n_t, k_m = terms[opt]
                model = M.fit_convert(
                    M.with_background(full, idx, form), kr, n_t,
                    np.random.default_rng(M.SEED + 3), k_mult=k_m,
                )
                ff = M.with_background(fut, idx, form)
                got = M.point_predict(model, ff[ff["country"].isin(keep)])
                total += float(got.loc[got["pred"] > 0, "pred"].sum())
                del model, got
        want = pred[
            (pred["pipeline"] == "A3")
            & (pred["test"] == "t1")
            & (pred["unit"] == unit)
            & (pred["grid"] == "q25")
        ]
        b = float(want["pred"].sum())
        rel = abs(total - b) / b
        out[f"A3_{unit}"] = {
            "refit_sum": total, "bakeoff_a3_sum": b,
            "relative_difference": rel, "match_within_1e-6": bool(rel < 1e-6),
        }
        print(f"bake-off consistency A3 {unit}: refit {total:,.4f} vs A3 {b:,.4f} "
              f"(relative {rel:.2e})")
        assert rel < 1e-6, f"A3 {unit} does not match the adopted bake-off rows"
    return out


def drift_diagnostic(cm: pd.DataFrame, univ: pd.DataFrame, rng: np.random.Generator) -> dict:
    """Where the bake-off t3 overshoot for Bulgaria comes from.

    Fitted on t1's fit years, measured against MODIS only in 2023 to 2025: how
    much of the overshoot is the calendar-month mix rather than the level.
    """
    fit = M.TESTS["t1"]["fit"]
    bg = cm[cm["country"] == "Bulgaria"]
    if bg.empty:
        return {"note": "Bulgaria not in this input"}
    u = univ[univ["country"] == "Bulgaria"]
    pairs = M.pair_frame(u, bg, M.months_in(fit), "cd", "Aqua", with_truth=True)
    model = M.fit_convert(pairs, M.K_RATIO_CD, 12, rng)
    ix = model.ix
    pos = pairs[pairs["x"] > 0]
    flat = float(pos["y"].sum() / pos["x"].sum())
    per_moy = {}
    for moy in range(1, 13):
        s = ix["s_idx"][(u["group"].iloc[0], moy)]
        fit_x = float(pos.loc[pos["moy"] == moy, "x"].sum())
        per_moy[moy] = {"ratio": float(model.r[s]), "fit_aqua_cd": fit_x}
    split = {}
    for label, win, truth in (
        ("fit_2012_2018", fit, True),
        ("drift_2023_2025", (2023, 1, 2025, 12), False),
    ):
        f = M.pair_frame(u, bg, M.months_in(win), "cd", "Aqua", with_truth=truth)
        got = M.predict_convert(model, f)
        pos = got["x"] > 0
        ratio_part = float(got.loc[pos, "pred"].sum())
        back_part = float(got.loc[~pos, "pred"].sum())
        total = ratio_part + back_part
        split[label] = {
            "total_predicted_cd": round(total, 1),
            "from_the_ratio": round(ratio_part, 1),
            "from_the_background": round(back_part, 1),
            "background_share": round(back_part / total, 4) if total else None,
            "aqua_cd": float(f["x"].sum()),
            "aqua_cd_per_month": round(float(f["x"].sum()) / len(M.months_in(win)), 1),
            "empty_cell_months": int((~pos).sum()),
            "background_per_empty_cell_month": round(back_part / max(int((~pos).sum()), 1), 4),
            "measured_cd": round(float(f["y"].sum()), 1) if truth else None,
        }
    later = M.pair_frame(
        u, bg, M.months_in((2023, 1, 2025, 12)), "cd", "Aqua", with_truth=False
    )
    lx = later.groupby("moy")["x"].sum()
    num = sum(per_moy[m]["ratio"] * float(lx.get(m, 0.0)) for m in range(1, 13))
    den = flat * float(lx.sum())
    fit_mix = sum(per_moy[m]["ratio"] * per_moy[m]["fit_aqua_cd"] for m in range(1, 13))
    fit_den = flat * sum(per_moy[m]["fit_aqua_cd"] for m in range(1, 13))
    heavy = sorted(
        ((float(lx.get(m, 0.0)), m) for m in range(1, 13)), reverse=True
    )[:3]
    return {
        "fitted_flat_ratio_2012_2018": round(flat, 4),
        "fitted_ratio_per_calendar_month": {m: round(v["ratio"], 4) for m, v in per_moy.items()},
        "aqua_cd_2023_2025_per_calendar_month": {int(m): float(lx.get(m, 0.0)) for m in range(1, 13)},
        "month_mix_lift_2023_2025": round(num / den, 4) if den else None,
        "month_mix_lift_in_fit_years": round(fit_mix / fit_den, 4) if fit_den else None,
        "three_heaviest_months_2023_2025": [int(m) for _, m in heavy],
        "prediction_split": split,
        "inference": (
            "Tagged [U], and it is not the month term. The month mix in 2023 to "
            "2025 pulls the ratio part 7% BELOW a flat ratio, so the month term "
            "cannot be the overshoot. The background term is. It is a fixed amount "
            "per empty cell-month, about 0.46 cd for Bulgaria, and the cell universe "
            "is fixed, so the background total barely moves between periods while "
            "Aqua activity fell from about 112 cd a month in the fit years to about "
            "42 in 2023 to 2025. Its share of the Bulgarian prediction therefore "
            "rose from 23% to 48%, and it carries the overshoot, spread over every "
            "calendar month in proportion to empty cell-months and so worst in the "
            "quiet months where the ratio part is near zero. Bulgaria has one "
            "latitude band, band 8, so there is no band to single out. A flat ratio "
            "with no background term has nothing that fails to scale with a quiet "
            "period, which is why it overshot far less. The USA is unharmed because "
            "its background share moved only from 31% to 35%. The fix to test is a "
            "background that scales with the period's own MODIS activity rather "
            "than a constant per cell-month; not applied here."
        ),
    }


if __name__ == "__main__":
    raise SystemExit(main())
