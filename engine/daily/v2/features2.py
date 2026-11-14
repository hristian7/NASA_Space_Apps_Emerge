"""Version 2 features: NASA GEOS-5 weather model (via GFWED), land cover, terrain,
fire history. Labels follow the team's plan-2 protocol (specs/plan-2-fire-risk):

  label satellite   NOAA-20 VIIRS 375 m only (type 0, confidence n/h), from 1 Apr 2018
  new fire          fire in the cell today and none in that cell on the 2 days before
  years             train 2019-2023, validate 2024 (settings, epochs, early stopping),
                    test 2025 once
  lead              issue at the end of day t; target t+L. Weather for the target comes
                    from the GEOS-5 run of day t-2 (runs are posted 1-2 days late), so
                    run lead L+2: +3 for tomorrow, as in the team's spec. The state of
                    the slow fuel codes comes from the GEOS-5 analysis of day t-2 (on the evening of
                    14 Nov 2026 the newest analysis and run were both 12 Nov).

Feature groups (used later to measure each group's real weight by removing it):
  weather_fc  GEOS-5 forecast for the target day: FFMC, DMC, DC, ISI, BUI, FWI, DSR
  weather_now GEOS-5 analysis of day t-2: FFMC, DMC, DC, FWI; change to the target day
  fuel        land-cover shares (tree, shrub, grass, crop, built, bare, wetland),
              distance to forest and settlements, and weather x fuel interactions
  terrain     elevation, its spread, slope, share of south-facing slopes
  history     NOAA-20 fires in the cell and its 3x3 block (~15 km) in the last 1-30
              days, the municipality's last week, the same weeks last year, days since
              the last fire; S-NPP 2012-2023 climatology for this cell and month
              (leave-own-year-out on training rows, so a row never sees its own fire)
  season      day of year
"""
import os
import sys
import numpy as np
import pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))     # engine/daily/v2
V1 = os.path.dirname(HERE)                             # engine/daily (version 1: grid, fire CSVs)
sys.path.insert(0, V1)
import features as v1        # fire_arrays, START, DAYS, D

DAYS, D, START = v1.DAYS, v1.D, v1.START
CLIM_YEARS = (2012, 2023)              # S-NPP archive years used for climatology
TRAIN, VAL, TEST = (2019, 2023), (2024, 2024), (2025, 2025)
FC_VARS = ["FFMC", "DMC", "DC", "ISI", "BUI", "FWI", "DSR"]
AN_VARS = ["FFMC", "DMC", "DC", "FWI"]
LC = ["lc_tree", "lc_shrub", "lc_grass", "lc_crop", "lc_built", "lc_bare", "lc_wetland"]
TERRAIN = ["elev_mean", "elev_std", "slope_mean", "south_share"]


def bilinear(lat_g, lon_g, lat_p, lon_p):
    """Weights to interpolate a regular grid to points; NaN grid values (sea) are
    skipped and the weights renormalised."""
    i = np.clip(np.searchsorted(lat_g, lat_p) - 1, 0, len(lat_g) - 2)
    j = np.clip(np.searchsorted(lon_g, lon_p) - 1, 0, len(lon_g) - 2)
    ty = (lat_p - lat_g[i]) / (lat_g[i + 1] - lat_g[i])
    tx = (lon_p - lon_g[j]) / (lon_g[j + 1] - lon_g[j])
    idx = [(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)]
    w = [(1 - ty) * (1 - tx), ty * (1 - tx), (1 - ty) * tx, ty * tx]
    return idx, w


def interp(field, idx, w):
    """field (..., nlat, nlon) -> (..., npoints)"""
    num = 0.0; den = 0.0
    for (i, j), ww in zip(idx, w):
        v = field[..., i, j]
        ok = np.isfinite(v) & (v > -1e20)
        num = num + np.where(ok, v, 0) * ww
        den = den + ok * ww
    with np.errstate(invalid="ignore", divide="ignore"):
        return (num / den).astype(np.float32)


class Builder2:
    def __init__(self, root=HERE):
        cells = pd.read_csv(f"{V1}/cells.csv")
        cells["c"] = np.arange(len(cells))
        cells["muni_k"] = cells.muni_id.astype("category").cat.codes
        st = pd.read_parquet(f"{root}/static.parquet")
        cells = cells.merge(st, on=["ga", "gb"], how="left")
        cells["prov_k"] = cells.province.astype("category").cat.codes
        self.cells = cells
        C = len(cells)
        vpath = f"{V1}/viirs/*.csv"
        self.Fs, self.Ns, gap_s = v1.fire_arrays(cells, vpath, sat="SNPP")
        self.F, self.N, _ = v1.fire_arrays(cells, vpath, sat="N20")
        # NOAA-20 outage days: >= 3 S-NPP detections nationally and none from NOAA-20
        n20_day, snpp_day = self.N.sum(1), self.Ns.sum(1)
        self.gap = ((snpp_day >= 3) & (n20_day == 0)) | (DAYS < pd.Timestamp("2018-04-01")) \
            | (DAYS > pd.Timestamp("2025-12-31"))
        F = self.F
        prev = np.zeros_like(F)
        prev[1:] |= F[:-1]
        prev[2:] |= F[:-2]
        self.NEW = (F == 1) & (prev == 0)
        self.LARGE = self.N >= 4

        # ---- GEOS-5 weather, interpolated to cell centres
        an = np.load(f"{root}/gfwed_analysis_2014_2026.npz")
        fc = np.load(f"{root}/gfwed_forecast_2017_2026.npz")
        idx, w = bilinear(an["lat"], an["lon"], cells.lat.to_numpy(), cells.lon.to_numpy())
        vars_ = list(an["vars"])
        self.AN = {v: np.full((D, C), np.nan, np.float32) for v in AN_VARS}
        di = ((pd.to_datetime(an["issue"]) - START).days).to_numpy()
        ok = (di >= 0) & (di < D)
        for v in AN_VARS:
            self.AN[v][di[ok]] = interp(an["data"][ok, vars_.index(v)], idx, w)
        # forecast: FC[v][L][run_day, c] = forecast from the run of run_day, valid run_day + L
        self.FC = {v: {L: np.full((D, C), np.nan, np.float16) for L in (3, 4, 5)} for v in FC_VARS}
        ri = ((pd.to_datetime(fc["issue"]) - START).days).to_numpy()
        ld = fc["lead"]
        for v in FC_VARS:
            vals = interp(fc["data"][:, vars_.index(v)], idx, w)
            for L in (3, 4, 5):
                s = (ld == L) & (ri >= 0) & (ri < D)
                self.FC[v][L][ri[s]] = vals[s]

        # ---- cumulative fire counts (NOAA-20) for windows
        self.cumF = np.vstack([np.zeros((1, C), np.int32), np.cumsum(F, 0, dtype=np.int32)])
        from scipy import sparse
        ga, gb = cells.ga.to_numpy(), cells.gb.to_numpy()
        lut = {(a, g): i for i, (a, g) in enumerate(zip(ga, gb))}
        r, cc = [], []
        for i, (a, g) in enumerate(zip(ga, gb)):
            for da in (-1, 0, 1):
                for db in (-1, 0, 1):
                    j = lut.get((a + da, g + db))
                    if j is not None:
                        r.append(j); cc.append(i)
        self.A = sparse.csr_matrix((np.ones(len(r), np.int32), (r, cc)), shape=(C, C))
        Fn = (sparse.csr_matrix(F.astype(np.int32)) @ self.A).toarray().astype(np.int32)
        self.cumN = np.vstack([np.zeros((1, C), np.int32), np.cumsum(Fn, 0, dtype=np.int32)])
        mk = cells.muni_k.to_numpy()
        Fm = np.zeros((D, mk.max() + 1), np.int32)
        np.add.at(Fm.T, mk, F.T)
        self.cumM = np.vstack([np.zeros((1, Fm.shape[1]), np.int32), np.cumsum(Fm, 0)])
        # days since the last NOAA-20 fire in the cell as of the end of day d (0 = fire on d), capped at 400
        last = np.full(C, -10 ** 6)
        self.since = np.zeros((D, C), np.int16)
        for d in range(D):
            last = np.where(F[d] == 1, d, last)
            self.since[d] = np.minimum(d - last, 400)

        # ---- S-NPP climatology per (year, month, cell): leave-own-year-out on training rows
        Y, M = DAYS.year.to_numpy(), DAYS.month.to_numpy()
        yrs = np.arange(CLIM_YEARS[0], CLIM_YEARS[1] + 1)
        S = np.zeros((len(yrs), 12, C), np.float32)
        B = np.zeros((len(yrs), 12, C), np.float32)           # 1 if any fire that month
        Nd = np.zeros((len(yrs), 12), np.float32)
        good = ~gap_s
        for yi, y in enumerate(yrs):
            for m in range(12):
                sel = (Y == y) & (M == m + 1) & good
                S[yi, m] = self.Fs[sel].sum(0); Nd[yi, m] = sel.sum()
                B[yi, m] = self.Fs[sel].any(0) if sel.any() else 0
        self._clim = (yrs, S, B, Nd)

    def clim(self, d, c):
        """Fire frequency and share of years burned for the target cell and month,
        from S-NPP 2012-2023, leaving out the target's own year."""
        yrs, S, B, Nd = self._clim
        y = DAYS.year.to_numpy()[d]
        m = DAYS.month.to_numpy()[d] - 1
        s_all, b_all, n_all = S.sum(0), B.sum(0), Nd.sum(0)
        yi = y - yrs[0]
        inyrs = (yi >= 0) & (yi < len(yrs))
        if getattr(self, "loyo", True) is False:     # version-1 style: a row's own year stays in
            inyrs = np.zeros_like(inyrs)
        yi_c = np.clip(yi, 0, len(yrs) - 1)
        s = s_all[m, c] - np.where(inyrs, S[yi_c, m, c], 0)
        n = n_all[m] - np.where(inyrs, Nd[yi_c, m], 0)
        b = b_all[m, c] - np.where(inyrs, B[yi_c, m, c], 0)
        ny = len(yrs) - inyrs.astype(int)
        sa = S.sum((0, 1))[c] - np.where(inyrs, S.sum(1)[yi_c, c], 0)
        na = Nd.sum() - np.where(inyrs, Nd.sum(1)[yi_c], 0)
        return (s / np.maximum(n, 1)).astype(np.float32), (b / ny).astype(np.float32), (sa / np.maximum(na, 1)).astype(np.float32)

    def X(self, d, c, lead):
        t = d - lead                       # issue day (end of)
        run = t - 2                        # newest GEOS-5 run surely posted by then
        rl = lead + 2
        cl = self.cells
        f = {}
        for v in FC_VARS:
            f["fc_" + v] = self.FC[v][rl][run, c].astype(np.float32)
        for v in AN_VARS:
            f["an_" + v] = self.AN[v][run, c]          # analysis of day t-2: posted with the same lag as the run
        f["fc_minus_an_FWI"] = f["fc_FWI"] - f["an_FWI"]
        f["fc_minus_an_FFMC"] = f["fc_FFMC"] - f["an_FFMC"]
        for v in LC + TERRAIN + ["dist_built_km", "dist_forest_km"]:
            f[v] = cl[v].to_numpy()[c].astype(np.float32)
        f["fwi_x_tree"] = f["fc_FWI"] * f["lc_tree"]
        f["ffmc_x_crop"] = f["fc_FFMC"] * f["lc_crop"]
        f["isi_x_grass_shrub"] = f["fc_ISI"] * (f["lc_grass"] + f["lc_shrub"])
        cf, cn = self.cumF, self.cumN
        for w in (1, 3, 7, 30):
            f[f"hist_cell{w}"] = (cf[t + 1, c] - cf[np.maximum(t + 1 - w, 0), c]).astype(np.float32)
        for w in (3, 7, 30):
            f[f"hist_nbr{w}"] = (cn[t + 1, c] - cn[np.maximum(t + 1 - w, 0), c]).astype(np.float32)
        m = cl.muni_k.to_numpy()[c]
        f["hist_muni7"] = (self.cumM[t + 1, m] - self.cumM[np.maximum(t - 6, 0), m]).astype(np.float32)
        f["hist_lastyear_cell"] = (cf[np.maximum(d - 365 + 16, 0), c] - cf[np.maximum(d - 365 - 15, 0), c]).astype(np.float32)
        f["hist_lastyear_nbr"] = (cn[np.maximum(d - 365 + 16, 0), c] - cn[np.maximum(d - 365 - 15, 0), c]).astype(np.float32)
        f["days_since_fire"] = self.since[t, c].astype(np.float32)
        f["clim_month"], f["years_burned_month"], f["clim_all"] = self.clim(d, c)
        doy = DAYS.dayofyear.to_numpy()[d]
        f["doy_sin"], f["doy_cos"] = np.sin(2 * np.pi * doy / 365.25), np.cos(2 * np.pi * doy / 365.25)
        return pd.DataFrame(f).astype(np.float32)


GROUPS = {
    "weather_fc": ["fc_" + v for v in FC_VARS] + ["fc_minus_an_FWI", "fc_minus_an_FFMC"],
    "weather_now": ["an_" + v for v in AN_VARS],
    "fuel": LC + ["dist_built_km", "dist_forest_km", "fwi_x_tree", "ffmc_x_crop", "isi_x_grass_shrub"],
    "terrain": TERRAIN,
    "history_recent": ["hist_cell1", "hist_cell3", "hist_cell7", "hist_cell30", "hist_nbr3", "hist_nbr7",
                       "hist_nbr30", "hist_muni7", "days_since_fire"],
    "history_calendar": ["hist_lastyear_cell", "hist_lastyear_nbr", "clim_month", "years_burned_month", "clim_all"],
    "season": ["doy_sin", "doy_cos"],
}

if __name__ == "__main__":
    import pickle, time
    t0 = time.time()
    import features2                       # pickle the class from the module, not __main__
    b = features2.Builder2()
    pickle.dump(b, open(f"{HERE}/builder2.pkl", "wb"), protocol=4)
    yr = DAYS.year
    for y in range(2018, 2026):
        s = (yr == y) & ~b.gap
        print(y, "days", int(s.sum()), "fire cell-days", int(b.F[s].sum()), "new", int(b.NEW[s].sum()),
              "large", int(b.LARGE[s].sum()))
    d = np.array([DAYS.get_loc(pd.Timestamp("2024-08-10"))] * 5)
    print(b.X(d, np.arange(5), 1).T)
    print("built in", round(time.time() - t0), "s")
