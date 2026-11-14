"""Known-answer and leakage tests for version 2 (expected values worked out by hand first)."""
import os, pickle, sys
import numpy as np, pytest
from math import comb
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUILDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "builder2.pkl")


def test_random_expectation_by_hand():
    """Province of 10 spots, 2 with a fire, top 5 picked at random:
    expected capture 5/10 = 0.5; chance of at least one hit 1 - C(8,5)/C(10,5) = 1 - 56/252."""
    n, nf, k = 10, 2, 5
    assert nf * k / n / nf == 0.5
    assert abs((1 - comb(n - nf, k) / comb(n, k)) - 0.777777) < 1e-5


def test_bilinear_weights_sum_to_one_and_hit_grid_points():
    import features2 as f2
    lat = np.array([41.0, 41.25, 41.5]); lon = np.array([22.0, 22.3125, 22.625])
    idx, w = f2.bilinear(lat, lon, np.array([41.25, 41.125]), np.array([22.3125, 22.15625]))
    W = np.array(w)
    assert np.allclose(W.sum(0), 1)
    field = np.arange(9, dtype=float).reshape(3, 3)          # value = 3*i + j
    v = f2.interp(field, idx, w)
    assert abs(v[0] - 4.0) < 1e-6                             # exactly on grid point (1, 1)
    assert abs(v[1] - 2.0) < 1e-6                             # centre of the (0..1, 0..1) square: mean of 0,1,3,4


def test_nan_neighbours_are_skipped():
    import features2 as f2
    lat = np.array([41.0, 41.25]); lon = np.array([22.0, 22.3125])
    idx, w = f2.bilinear(lat, lon, np.array([41.125]), np.array([22.15625]))
    field = np.array([[1.0, np.nan], [3.0, np.nan]])        # sea on the east side
    assert abs(f2.interp(field, idx, w)[0] - 2.0) < 1e-6


@pytest.mark.skipif(not os.path.exists(BUILDER), reason="needs the built data")
def test_no_future_data_in_features():
    """Wipe every fire, analysis and forecast run after what is known on the issue
    evening (fires to day t, GEOS-5 analysis and runs to day t-2): features must not change."""
    import pandas as pd
    import features2 as f2
    b = pickle.load(open(BUILDER, "rb"))
    d = np.full(200, f2.DAYS.get_loc(pd.Timestamp("2025-08-10")))
    c = np.arange(200) * 20
    for L in (1, 2, 3):
        X0 = b.X(d, c, L)
        t = d[0] - L
        keep = {"cumF": b.cumF[t + 2:].copy(), "cumN": b.cumN[t + 2:].copy(), "cumM": b.cumM[t + 2:].copy(),
                "since": b.since[t + 1:].copy()}
        b.cumF[t + 2:] = b.cumF[t + 1]; b.cumN[t + 2:] = b.cumN[t + 1]; b.cumM[t + 2:] = b.cumM[t + 1]
        b.since[t + 1:] = 999
        an_keep = {v: b.AN[v][t - 1:].copy() for v in b.AN}
        fc_keep = {(v, k): b.FC[v][k][t - 1:].copy() for v in b.FC for k in b.FC[v]}
        for v in b.AN:
            b.AN[v][t - 1:] = np.nan
        for v in b.FC:
            for k in b.FC[v]:
                b.FC[v][k][t - 1:] = np.nan
        X1 = b.X(d, c, L)
        b.cumF[t + 2:], b.cumN[t + 2:], b.cumM[t + 2:], b.since[t + 1:] = keep["cumF"], keep["cumN"], keep["cumM"], keep["since"]
        for v in b.AN:
            b.AN[v][t - 1:] = an_keep[v]
        for (v, k), a in fc_keep.items():
            b.FC[v][k][t - 1:] = a
        assert np.allclose(X0.to_numpy(), X1.to_numpy(), equal_nan=True), L
