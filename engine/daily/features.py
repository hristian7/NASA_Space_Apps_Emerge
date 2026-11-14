"""Daily fire-danger features for Bulgaria: 5 km cells x days, for a target day t
and a lead L (issued at the end of day t-L).

Fire label: VIIRS S-NPP 375 m (type 0, confidence n/h), fire in the 5 km cell on day t.
Large fire: >= 4 detections in the cell that day (top 10% of fire cell-days).

Feature groups (the firefighter's factors, plus history):
  weather_t   forecast weather for day t: Tmax, humidity, wind, rain, VPD and the
              Canadian Fire Weather Index chain (FFMC, DMC, DC, ISI, BUI, FWI).
              In hindcasts this is the OBSERVED weather (a perfect forecast);
              the 'noforecast' variant drops it and gives the lower bound.
  dryness     known at issue: days since rain, rain in the last 7/30 days,
              topsoil and root-zone wetness, Drought Code
  history     known at issue: fires in this cell in the last 7/30/365 days, in the
              municipality in the last 7 days; the cell's usual fire frequency in
              this month (training years only)
  calendar    day of year
"""
import json
import numpy as np
import pandas as pd
import duckdb
from xclim.compute.fire import _cffwis as F

START, END = pd.Timestamp("2012-01-01"), pd.Timestamp("2026-11-12")
TRAIN = (2013, 2020)
DAYS = pd.date_range(START, END, freq="D")
D = len(DAYS)


def load_static():
    cells = pd.read_csv("cells.csv")
    pts = cells[["wlat", "wlon"]].drop_duplicates().reset_index(drop=True)
    pts["p"] = np.arange(len(pts))
    cells = cells.merge(pts, on=["wlat", "wlon"])
    cells["c"] = np.arange(len(cells))
    cells["muni_k"] = cells.muni_id.astype("category").cat.codes
    return cells, pts


def fire_arrays(cells, path="viirs/*.csv", sat="SNPP"):
    """F[d, c] = 1 if fire, N[d, c] = detections; plus days to exclude (likely S-NPP gaps)."""
    con = duckdb.connect()
    con.execute(f"""CREATE TABLE v AS SELECT floor(latitude/0.05)::INT ga, floor(longitude/0.05)::INT gb,
        CAST(acq_date AS DATE) d, CASE WHEN filename LIKE '%jpss1%' THEN 'N20' ELSE 'SNPP' END sat
        FROM read_csv('{path}', filename=true, union_by_name=true,
             types={{'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}})
        WHERE type=0 AND confidence IN ('n','h')""")
    q = con.execute(f"SELECT ga, gb, d, count(*) n FROM v WHERE sat='{sat}' GROUP BY ALL").df()
    q = q.merge(cells[["ga", "gb", "c"]], on=["ga", "gb"])
    di = ((pd.to_datetime(q.d) - START).dt.days).to_numpy()
    ok = (di >= 0) & (di < D)
    Fa = np.zeros((D, len(cells)), np.int8)
    Na = np.zeros((D, len(cells)), np.int16)
    Fa[di[ok], q.c.to_numpy()[ok]] = 1
    Na[di[ok], q.c.to_numpy()[ok]] = q.n.to_numpy()[ok]
    # likely S-NPP gaps: >= 3 NOAA-20 detections in Bulgaria, none from S-NPP
    gaps = con.execute("""SELECT d FROM (SELECT d, sum(CASE WHEN sat='N20' THEN 1 ELSE 0 END) n20,
        sum(CASE WHEN sat='SNPP' THEN 1 ELSE 0 END) sn FROM v GROUP BY d) WHERE n20 >= 3 AND sn = 0""").df()
    gap = np.zeros(D, bool)
    gi = (pd.to_datetime(gaps.d) - START).dt.days.to_numpy()
    gap[gi[(gi >= 0) & (gi < D)]] = True
    gap[DAYS > pd.Timestamp("2025-12-31")] = True        # S-NPP yearly files end here
    return Fa, Na, gap


def weather_arrays(pts):
    """Per weather point and day: raw weather and the FWI chain (Van Wagner 1987, xclim)."""
    w = pd.read_parquet("weather_daily.parquet")
    w = w.merge(pts, on=["wlat", "wlon"])
    P = len(pts)
    out = {}
    for v in ["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "GWETTOP", "GWETROOT"]:
        a = np.full((D, P), np.nan, np.float32)
        di = (w.date - START).dt.days.to_numpy()
        ok = (di >= 0) & (di < D)
        a[di[ok], w.p.to_numpy()[ok]] = w[v].to_numpy()[ok]
        out[v] = pd.DataFrame(a).ffill().to_numpy(np.float32)
    T, H, P_, R = out["T2M_MAX"], out["RH2M"], out["PRECTOTCORR"], None
    # 2 m mean wind (m/s) -> 10 m (log profile, z0 = 3 cm: x1.38) in km/h
    W = out["WS2M"] * 3.6 * 1.38
    es = 0.6108 * np.exp(17.27 * T / (T + 237.3))
    out["VPD"] = (es * (1 - H / 100)).astype(np.float32)
    names = ["FFMC", "DMC", "DC", "ISI", "BUI", "FWI"]
    fw = {n: np.zeros((D, P), np.float32) for n in names}
    lat = pts.wlat.to_numpy()
    mth = DAYS.month.to_numpy()
    ffmc, dmc, dc = np.full(P, 85.0), np.full(P, 6.0), np.full(P, 15.0)
    for d in range(D):
        for p in range(P):
            t, h, ws, pr = float(T[d, p]), float(min(max(H[d, p], 0), 100)), float(W[d, p]), float(max(P_[d, p], 0))
            ffmc[p] = F._fine_fuel_moisture_code(t, pr, ws, h, ffmc[p])
            dmc[p] = F._duff_moisture_code(t, pr, h, int(mth[d]), float(lat[p]), dmc[p])
            dc[p] = F._drought_code(t, pr, int(mth[d]), float(lat[p]), dc[p])
        isi = F.initial_spread_index(W[d], ffmc)
        bui = F.build_up_index(dmc, dc)
        fw["FFMC"][d], fw["DMC"][d], fw["DC"][d] = ffmc, dmc, dc
        fw["ISI"][d], fw["BUI"][d], fw["FWI"][d] = isi, bui, F.fire_weather_index(isi, bui)
    out.update(fw)
    # days since rain >= 1 mm, rain sums
    dsr = np.zeros((D, P), np.float32)
    for d in range(1, D):
        dsr[d] = np.where(P_[d] >= 1.0, 0, dsr[d - 1] + 1)
    out["DSR"] = dsr
    cs = np.vstack([np.zeros((1, P)), np.cumsum(P_, 0)])
    out["RAIN7"] = (cs[7:] - cs[:-7])[np.r_[np.zeros(6, int), np.arange(D - 6)]].astype(np.float32)
    out["RAIN30"] = (cs[30:] - cs[:-30])[np.r_[np.zeros(29, int), np.arange(D - 29)]].astype(np.float32)
    return out


class Builder:
    def __init__(self):
        self.cells, self.pts = load_static()
        self.F, self.N, self.gap = fire_arrays(self.cells)
        self.W = weather_arrays(self.pts)
        C = len(self.cells)
        self.cumF = np.vstack([np.zeros((1, C), np.int32), np.cumsum(self.F, 0, dtype=np.int32)])
        mk = self.cells.muni_k.to_numpy()
        M = mk.max() + 1
        Fm = np.zeros((D, M), np.int32)
        np.add.at(Fm.T, mk, self.F.T)
        self.cumM = np.vstack([np.zeros((1, M), np.int32), np.cumsum(Fm, 0)])
        # usual fire frequency per cell and month, training years only
        tr = (DAYS.year >= TRAIN[0]) & (DAYS.year <= TRAIN[1])
        self.clim = np.zeros((12, C), np.float32)
        for m in range(1, 13):
            sel = tr & (DAYS.month == m)
            self.clim[m - 1] = self.F[sel].mean(0)
        self.clim_all = self.F[tr].mean(0).astype(np.float32)
        # fire in the 3x3 neighbourhood (~15 km) of each cell, cumulative over days
        from scipy import sparse
        ga, gb = self.cells.ga.to_numpy(), self.cells.gb.to_numpy()
        lut = {(a, g): i for i, (a, g) in enumerate(zip(ga, gb))}
        r, cidx = [], []
        for i, (a, g) in enumerate(zip(ga, gb)):
            for da in (-1, 0, 1):
                for db in (-1, 0, 1):
                    j = lut.get((a + da, g + db))
                    if j is not None:
                        r.append(j); cidx.append(i)
        A = sparse.csr_matrix((np.ones(len(r), np.int32), (r, cidx)), shape=(C, C))
        Fn = (sparse.csr_matrix(self.F.astype(np.int32)) @ A).toarray().astype(np.int32)
        self.cumN = np.vstack([np.zeros((1, C), np.int32), np.cumsum(Fn, 0, dtype=np.int32)])

    def X(self, d, c, lead, forecast=True):
        """Feature matrix for target days d and cells c (int arrays), lead in days."""
        p = self.cells.p.to_numpy()[c]
        k = d - lead                                       # last day known at issue
        W = self.W
        f = {}
        if forecast:
            for v in ["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "VPD", "FFMC", "DMC", "DC", "ISI", "BUI", "FWI"]:
                f["wx_" + v] = W[v][d, p]
        for v in ["DSR", "RAIN7", "RAIN30", "GWETTOP", "GWETROOT", "DC", "FWI"]:
            f["dry_" + v] = W[v][k, p]
        cf = self.cumF
        f["hist_cell1"] = (cf[k + 1, c] - cf[np.maximum(k, 0), c]).astype(np.float32)
        f["hist_cell3"] = (cf[k + 1, c] - cf[np.maximum(k - 2, 0), c]).astype(np.float32)
        f["hist_cell7"] = (cf[k + 1, c] - cf[np.maximum(k - 6, 0), c]).astype(np.float32)
        cn = self.cumN
        f["hist_nbr3"] = (cn[k + 1, c] - cn[np.maximum(k - 2, 0), c]).astype(np.float32)
        f["hist_nbr7"] = (cn[k + 1, c] - cn[np.maximum(k - 6, 0), c]).astype(np.float32)
        f["hist_nbr30"] = (cn[k + 1, c] - cn[np.maximum(k - 29, 0), c]).astype(np.float32)
        # same calendar window last year (+-15 days around the target date): farm burning follows the calendar
        f["hist_lastyear_cell"] = (cf[np.maximum(d - 365 + 16, 0), c] - cf[np.maximum(d - 365 - 15, 0), c]).astype(np.float32)
        f["hist_lastyear_nbr"] = (cn[np.maximum(d - 365 + 16, 0), c] - cn[np.maximum(d - 365 - 15, 0), c]).astype(np.float32)
        f["hist_cell30"] = (cf[k + 1, c] - cf[np.maximum(k - 29, 0), c]).astype(np.float32)
        f["hist_cell365"] = (cf[k + 1, c] - cf[np.maximum(k - 364, 0), c]).astype(np.float32)
        m = self.cells.muni_k.to_numpy()[c]
        f["hist_muni7"] = (self.cumM[k + 1, m] - self.cumM[np.maximum(k - 6, 0), m]).astype(np.float32)
        f["clim_month"] = self.clim[DAYS.month.to_numpy()[d] - 1, c]
        f["clim_all"] = self.clim_all[c]
        doy = DAYS.dayofyear.to_numpy()[d]
        f["doy_sin"], f["doy_cos"] = np.sin(2 * np.pi * doy / 365.25), np.cos(2 * np.pi * doy / 365.25)
        return pd.DataFrame(f).astype(np.float32)
