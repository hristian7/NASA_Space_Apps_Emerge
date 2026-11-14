"""Tests for the prediction engine (methods from docs/verification-plan.md).

EXPECTED ANSWERS ARE STATED HERE, BEFORE THE TESTS WERE FIRST RUN (V-M19, V-M58).
They follow from how the synthetic data is built, not from engine output.
Written by the same AI agent that wrote the engine: a teammate should review them.

  V-M19  known answers: synthetic fire with a planted cause; the engine must name it
  V-M20  properties: Shapley weights add up; shifts, seasons and outlooks stay valid
  V-M62  leakage: data from the issue month onward cannot change a forecast
  V-M32  hard limits on the committed result files
  V-M125 control totals: fire tables add up to an independent count from NASA's files
  V-M101 audit sample: random unit-months recounted from NASA's files
"""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from hypothesis import given, settings, strategies as st

import engine as e
import forecast as fc

HERE = Path(__file__).resolve().parent.parent
RESULTS = HERE.parent / "docs" / "engine-results"
YEARS = range(2001, 2022)
IDX = pd.MultiIndex.from_product([YEARS, range(1, 13)], names=["y", "mo"])


# --------------------------------------------------------------- helpers ---------
def synthetic_weather(seed):
    """Plausible monthly weather: seasonal cycle + persistent (AR1) anomalies."""
    rng = np.random.default_rng(seed)
    n = len(IDX)
    mo = IDX.get_level_values("mo").to_numpy()

    def ar1(phi, sd):
        x = np.zeros(n)
        for i in range(1, n):
            x[i] = phi * x[i - 1] + rng.normal(0, sd)
        return x
    season = np.cos(2 * np.pi * (mo - 7) / 12)
    return pd.DataFrame({
        "GWETROOT": np.clip(0.5 - 0.15 * season + ar1(0.8, 0.04), 0.05, 1),
        "PRECTOTCORR": np.clip(2 - 1.5 * season + ar1(0.3, 0.6), 0, None),
        "RH2M": 60 - 15 * season + ar1(0.5, 3),
        "T2M_MAX": 22 + 10 * season + ar1(0.5, 1.0),
        "WS2M": 3 + ar1(0.2, 0.3),
        "VPD": np.clip(1.5 + 1.0 * season + ar1(0.5, 0.2), 0.05, None)}, index=IDX)


def synthetic_ocean(seed):
    rng = np.random.default_rng(seed)
    cols = ["nino34", "iod", "tna", "pdo", "nao", "ao", "sam"]
    out = {}
    for c in cols:
        x = np.zeros(len(IDX))
        for i in range(1, len(IDX)):
            x[i] = 0.9 * x[i - 1] + rng.normal(0, 0.35)
        out[c] = x
    return pd.DataFrame(out, index=IDX)


def zs(s):
    return (s - s.mean()) / s.std()


def planted_fire(w, oc, cause, seed, strength=0.7, noise=0.35):
    """log(1 + cell-days) = normal(month) + strength * z(cause) + noise.
    The cause is lagged exactly as the engine defines it at lead 0."""
    rng = np.random.default_rng(seed)
    normal = 4.0 + 1.5 * np.cos(2 * np.pi * (IDX.get_level_values("mo") - 8) / 12)
    if cause == "dryness_memory":
        x = -zs(e._shift(w.GWETROOT, 1))                       # drier last month -> more fire
    elif cause == "fuel_growth":
        x = zs(sum(e._shift(w.PRECTOTCORR, 5 + i) for i in range(12)))
    elif cause == "ocean":
        x = zs(e._shift(oc.nino34, 1))
    else:
        x = pd.Series(0.0, index=IDX)
    logf = normal + strength * x.fillna(0).to_numpy() + rng.normal(0, noise, len(IDX))
    cd = np.round(np.expm1(np.clip(logf, 0, None)))
    return pd.DataFrame({"y": IDX.get_level_values("y"), "mo": IDX.get_level_values("mo"), "cd": cd})


# --------------------------------------------------------------- V-M19 -----------
# Expected: the planted factor gets the largest weight, above 0.15; a unit with no
# cause gets no weight above 0.10 and total skill below 0.10.
@pytest.mark.parametrize("cause", ["dryness_memory", "fuel_growth", "ocean", "none"])
@pytest.mark.parametrize("seed", [1, 2, 3])
def test_known_answer_planted_cause(cause, seed):
    w, oc = synthetic_weather(seed), synthetic_ocean(seed + 100)
    fire = planted_fire(w, oc, cause, seed + 200)
    r = e.shapley(fire, w, oc, 0, months_in=list(range(1, 13)), lat=0.0)
    phi = r["phi"]
    if cause == "none":
        assert max(phi.values()) < 0.10, phi
        assert r["skill"] < 0.10, r["skill"]
    else:
        assert max(phi, key=phi.get) == cause, phi
        assert phi[cause] > 0.15, phi


# Expected: the sign of the fitted coefficient matches the planted physics.
def test_known_answer_signs():
    w, oc = synthetic_weather(7), synthetic_ocean(107)
    b = e.shapley(planted_fire(w, oc, "dryness_memory", 207), w, oc, 0, list(range(1, 13)), 0.0)["beta"]
    assert b["dryness_memory:soil_k"] < 0            # wetter soil, less fire
    b = e.shapley(planted_fire(w, oc, "fuel_growth", 208), w, oc, 0, list(range(1, 13)), 0.0)["beta"]
    assert b["fuel_growth:rain_12m"] > 0             # more rain last year, more fire


# --------------------------------------------------------------- V-M20 -----------
@settings(max_examples=15, deadline=None)
@given(st.integers(0, 10_000), st.sampled_from(["diag", 0, 1, 3]))
def test_shapley_weights_add_up(seed, lead):
    """Efficiency: the weights sum to the full model's skill (the empty model is the
    normal itself, skill 0)."""
    w, oc = synthetic_weather(seed), synthetic_ocean(seed + 1)
    fire = planted_fire(w, oc, "dryness_memory", seed + 2, strength=0.3, noise=0.6)
    r = e.shapley(fire, w, oc, lead, list(range(1, 13)), 10.0)
    assert abs(sum(r["phi"].values()) - r["skill"]) < 1e-9


@settings(max_examples=200, deadline=None)
@given(st.integers(2002, 2021), st.integers(1, 12), st.integers(0, 15))
def test_shift_is_exactly_k_months(y, mo, k):
    s = pd.Series(np.arange(len(IDX), dtype=float), index=IDX)    # value = month counter
    v = e._shift(s, k).loc[(y, mo)]
    t = (y - 2001) * 12 + (mo - 1) - k
    assert (np.isnan(v) and t < 0) or v == t


@settings(max_examples=200, deadline=None)
@given(st.lists(st.floats(0, 1000), min_size=12, max_size=12))
def test_fire_seasons_are_valid(monthly):
    fire = pd.DataFrame([{"y": y, "mo": m, "cd": monthly[m - 1]} for y in e.TRAIN_YEARS for m in range(1, 13)])
    seasons = e.fire_seasons(fire)
    seen = []
    for months, share in seasons.values():
        assert 0 < share <= 1 + 1e-9
        for a, b in zip(months[:-1], months[1:]):
            assert b == a % 12 + 1                       # contiguous, wrapping Dec -> Jan
        seen += months
    assert len(seen) == len(set(seen))
    assert sum(s for _, s in seasons.values()) <= 1 + 1e-9


@settings(max_examples=10, deadline=None)
@given(st.integers(0, 10_000))
def test_outlook_is_internally_consistent(seed):
    w, oc = synthetic_weather(seed), synthetic_ocean(seed + 1)
    fire = planted_fire(w, oc, "ocean", seed + 2)
    for r in fc.outlook(fire, w, oc, 1, list(range(1, 13)), 0.0, ["ocean", "dryness_memory"],
                        [(2021, 6), (2021, 12)]):
        assert r["factor_lo"] <= r["factor"] <= r["factor_hi"]
        assert 0 <= r["p_above"] <= 1 and 0 <= r["p_below"] <= 1
        assert r["p_above"] + r["p_below"] <= 1 + 1e-9


# --------------------------------------------------------------- V-M62 -----------
@settings(max_examples=40, deadline=None)
@given(st.integers(2004, 2021), st.integers(1, 12), st.sampled_from([0, 1, 3]), st.integers(0, 10_000))
def test_no_future_data_in_features(y, mo, lead, seed):
    """Overwrite every weather and ocean value from the issue month onward with noise.
    The features of the target month must not change."""
    w, oc = synthetic_weather(seed), synthetic_ocean(seed + 1)
    issue = (y * 12 + mo - 1) - lead                    # month index of the issue month
    t = np.array([a * 12 + b - 1 for a, b in IDX])
    future = t >= issue
    w2, oc2 = w.copy(), oc.copy()
    rng = np.random.default_rng(seed)
    w2.loc[future] = rng.normal(0, 99, (future.sum(), w.shape[1]))
    oc2.loc[future] = rng.normal(0, 99, (future.sum(), oc.shape[1]))
    for lat in (0.0, 45.0, -35.0):
        f1, f2 = e.features(w, oc, lead, lat), e.features(w2, oc2, lead, lat)
        for g in f1:
            a, b = f1[g].loc[(y, mo)], f2[g].loc[(y, mo)]
            assert np.allclose(a.to_numpy(dtype=float), b.to_numpy(dtype=float), equal_nan=True), (g, lead)


def test_outage_month_is_not_zero_fire():
    """Spec rule 'no data is not zero': the Aqua outage month is excluded from training."""
    w, oc = synthetic_weather(5), synthetic_ocean(105)
    fire = planted_fire(w, oc, "none", 205)
    X, y = fc.design(fire, w, oc, 0, list(range(1, 13)), 0.0, ["dryness_memory"])
    assert (2020, 8) not in X.index


# --------------------------------------------------------------- V-M32 -----------
needs_results = pytest.mark.skipif(not (RESULTS / "results.csv").exists(), reason="no committed results")


@needs_results
def test_result_files_within_limits():
    r = pd.read_csv(RESULTS / "results.csv")
    r = r[r.n >= 30]                                  # thin units are excluded by analyze.py
    assert (r.skill <= 1).all() and r.skill.notna().all()
    phi = r[[c for c in r.columns if c.startswith("phi_")]]
    assert np.isfinite(phi.to_numpy()[~np.isnan(phi.to_numpy())]).all()
    assert r.lat.between(-90, 90).all() and (r.cd_per_year >= 0).all()
    o = pd.read_csv(RESULTS / "outlook_2026-11-15.csv")
    assert (o.factor > 0).all() and (o.factor_lo <= o.factor).all() and (o.factor <= o.factor_hi).all()
    assert o.p_above.between(0, 1).all() and o.p_below.between(0, 1).all()
    assert (o.p_above + o.p_below <= 1 + 1e-9).all()
    assert (o.skill_held_out >= 0.05).all()                       # only skilful units published
    assert (pd.to_datetime(o.target + "-01") > pd.Timestamp("2026-11-15")).all()
    meta = json.load(open(RESULTS / "outlook_meta.json"))
    assert meta["latest_month_used"] < meta["issued"][:7]


# --------------------------------------------------------------- V-M125, V-M101 --
RAW = HERE.parent / "data" / "raw" / "modis"
FIRE = HERE / "fire"
needs_raw = pytest.mark.skipif(not RAW.exists() or not FIRE.exists(), reason="no NASA files or fire tables")


def independent_counts(country):
    """Recount fire cell-days straight from NASA's CSVs with pandas (not DuckDB)."""
    frames = []
    for f in sorted(RAW.glob(f"*/modis_*_{country}.csv")):
        d = pd.read_csv(f, usecols=["latitude", "longitude", "acq_date", "satellite", "confidence", "type"],
                        dtype={"confidence": str, "satellite": str})
        d = d[(d["type"] == 0) & (pd.to_numeric(d.confidence, errors="coerce") >= 30)
              & d.satellite.isin(["Aqua", "A"])]
        frames.append(pd.DataFrame({"a": np.floor(d.latitude * 100), "b": np.floor(d.longitude * 100),
                                    "d": d.acq_date}).drop_duplicates())
    return pd.concat(frames).drop_duplicates()


@needs_raw
@pytest.mark.parametrize("country", ["Bulgaria", "Greece", "Portugal", "Guatemala"])
def test_control_totals(country):
    if not (FIRE / f"{country}.csv").exists():
        pytest.skip("not built")
    ours = pd.read_csv(FIRE / f"{country}.csv")
    cells = independent_counts(country)
    assert ours.cd.sum() == len(cells)                         # every cell-day counted once
    cells["y"] = pd.to_datetime(cells.d).dt.year
    by_year = cells.groupby("y").size()
    assert (ours.groupby("y").cd.sum().reindex(by_year.index) == by_year).all()


@needs_raw
def test_audit_sample_unit_months():
    """20 random (unit, month) cells recounted independently, kind ignored."""
    rng = np.random.default_rng(0)
    country = "Bulgaria"
    ours = pd.read_csv(FIRE / f"{country}.csv").groupby(["unit", "y", "mo"]).cd.sum()
    cells = independent_counts(country)
    dt = pd.to_datetime(cells.d)
    cells["unit"] = ((np.floor(cells.a / 500) * 5).astype(int).astype(str) + "_" +
                     (np.floor(cells.b / 500) * 5).astype(int).astype(str))
    cells["y"], cells["mo"] = dt.dt.year, dt.dt.month
    theirs = cells.groupby(["unit", "y", "mo"]).size()
    for i in rng.choice(len(ours), 20, replace=False):
        k = ours.index[i]
        assert ours.iloc[i] == theirs.get(k, 0), k


def test_season_wraps_new_year():
    """Added after mutation testing (V-M57): a Nov-Feb season is ONE season."""
    shape = {11: 50, 12: 100, 1: 100, 2: 50}
    fire = pd.DataFrame([{"y": y, "mo": m, "cd": shape.get(m, 0)} for y in e.TRAIN_YEARS for m in range(1, 13)])
    seasons = e.fire_seasons(fire)
    assert list(seasons) == ["11-02"] and seasons["11-02"][0] == [11, 12, 1, 2]
