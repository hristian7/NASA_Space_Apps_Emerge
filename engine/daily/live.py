"""Live 1-3 day fire-danger outlook for Bulgaria, one spot per municipality per day.

Issued at the end of ISSUE (local date). Inputs:
  weather     NASA POWER observed to its last day; MET Norway Locationforecast for
              the next days (10 m wind, temperature, humidity, rain). Days between
              the two (POWER lag) repeat the last observed day: the slow moisture
              codes barely move in two days; the fast one recovers within a day.
  fire        NOAA-20 VIIRS near-real-time, last 7 days (keyless FIRMS file). No
              'type' column, so cells that were mostly industrial heat in the
              archive are masked.
  last year   S-NPP archive, same calendar window.
Models: the LIVE variants (no 30/365-day history), lead 1, 2, 3 days.
Output: outlook_bg_<ISSUE>.csv and .geojson: per municipality and day, the top
5 km cell, its fire chance, the municipality's chance of any fire, national
rank, and the main reasons (feature contributions).
"""
import json
import pickle
import sys
import time
import urllib.request
import numpy as np
import pandas as pd
import xgboost as xgb
import duckdb
from xclim.compute.fire import _cffwis as F
import features as ft

ISSUE = pd.Timestamp(sys.argv[1] if len(sys.argv) > 1 else "2026-11-14")
TARGETS = [ISSUE + pd.Timedelta(days=L) for L in (1, 2, 3)]
UA = {"User-Agent": "Emerge-NASA-Space-Apps-2026/1.0 (hackathon prototype)"}
b = pickle.load(open("builder.pkl", "rb"))
cells, pts = b.cells, b.pts
C, P = len(cells), len(pts)


# ------------------------------------------------------------- weather ---------
def metno(lat, lon):
    url = f"https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={lat:.3f}&lon={lon:.3f}"
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                ts = json.load(r)["properties"]["timeseries"]
            break
        except Exception:
            time.sleep(2 * (k + 1))
    rows = []
    for t in ts:
        det = t["data"]["instant"]["details"]
        rain = t["data"].get("next_1_hours", {}).get("details", {}).get("precipitation_amount")
        rain6 = t["data"].get("next_6_hours", {}).get("details", {}).get("precipitation_amount")
        rows.append({"time": pd.Timestamp(t["time"]).tz_convert("Europe/Sofia"), "T": det["air_temperature"],
                     "RH": det["relative_humidity"], "W10": det["wind_speed"], "r1": rain, "r6": rain6})
    d = pd.DataFrame(rows)
    d["date"] = d.time.dt.tz_localize(None).dt.normalize()
    # rain: hourly where given, else 6-hourly totals (counted once per 6 h step)
    d["rain"] = d.r1.where(d.r1.notna(), np.where(d.time.dt.hour % 6 == 0, d.r6, 0)).fillna(0)
    g = d.groupby("date").agg(T2M_MAX=("T", "max"), RH2M=("RH", "mean"), W10=("W10", "mean"), PRECTOTCORR=("rain", "sum"))
    g["WS2M"] = g.W10 / 1.38                               # 10 m -> 2 m (as in training)
    return g.drop(columns="W10")


fc = {}
for i, r in pts.iterrows():
    fc[i] = metno(r.wlat, r.wlon)
    time.sleep(0.2)
last_obs = ft.DAYS[-1]
while np.isnan(b.W["T2M_MAX"][ft.DAYS.get_loc(last_obs)]).all():
    last_obs -= pd.Timedelta(days=1)
w_raw = pd.read_parquet("weather_daily.parquet")
last_obs = w_raw[w_raw.T2M_MAX > -900].date.max()
days = pd.date_range(last_obs + pd.Timedelta(days=1), TARGETS[-1], freq="D")
ext = {v: np.zeros((len(days), P), np.float32) for v in ["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR"]}
li = ft.DAYS.get_loc(last_obs)
for p in range(P):
    for j, day in enumerate(days):
        # forecast only for whole days after the issue day; earlier gap days repeat the last observation
        src = fc[p].loc[day] if day in fc[p].index and day > ISSUE else None
        for v in ext:
            ext[v][j, p] = src[v] if src is not None else b.W[v][li, p]   # gap days repeat the last observation
lat = pts.wlat.to_numpy()
ffmc, dmc, dc = b.W["FFMC"][li].astype(float), b.W["DMC"][li].astype(float), b.W["DC"][li].astype(float)
dsr = b.W["DSR"][li].copy()
rain_hist = list(b.W["PRECTOTCORR"][li - 29:li + 1])
wx = {v: {} for v in ["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "VPD", "FFMC", "DMC", "DC", "ISI", "BUI", "FWI",
                      "DSR", "RAIN7", "RAIN30"]}
for j, day in enumerate(days):
    T, H, Wd, R = ext["T2M_MAX"][j], ext["RH2M"][j], ext["WS2M"][j] * 3.6 * 1.38, ext["PRECTOTCORR"][j]
    for p in range(P):
        ffmc[p] = F._fine_fuel_moisture_code(float(T[p]), float(R[p]), float(Wd[p]), float(min(max(H[p], 0), 100)), ffmc[p])
        dmc[p] = F._duff_moisture_code(float(T[p]), float(R[p]), float(min(max(H[p], 0), 100)), day.month, float(lat[p]), dmc[p])
        dc[p] = F._drought_code(float(T[p]), float(R[p]), day.month, float(lat[p]), dc[p])
    isi = F.initial_spread_index(Wd, ffmc); bui = F.build_up_index(dmc, dc)
    dsr = np.where(R >= 1, 0, dsr + 1)
    rain_hist.append(R)
    es = 0.6108 * np.exp(17.27 * T / (T + 237.3))
    vals = {"T2M_MAX": T, "RH2M": H, "WS2M": ext["WS2M"][j], "PRECTOTCORR": R, "VPD": es * (1 - H / 100),
            "FFMC": ffmc.copy(), "DMC": dmc.copy(), "DC": dc.copy(), "ISI": isi, "BUI": bui,
            "FWI": F.fire_weather_index(isi, bui), "DSR": dsr.copy(),
            "RAIN7": np.sum(rain_hist[-7:], 0), "RAIN30": np.sum(rain_hist[-30:], 0)}
    for v in wx:
        wx[v][day] = np.asarray(vals[v], np.float32)
gwet_top, gwet_root = b.W["GWETTOP"][li], b.W["GWETROOT"][li]       # last observed soil wetness

# ------------------------------------------------------------- fire history ----
nrt = pd.read_csv("J1_VIIRS_C2_Europe_7d.csv")
nrt["d"] = pd.to_datetime(nrt.acq_date)
# NRT files spell confidence out ('nominal', 'high'); the archive uses 'n', 'h'
nrt = nrt[nrt.confidence.astype(str).str[0].str.lower().isin(["n", "h"])]
nrt["ga"], nrt["gb"] = np.floor(nrt.latitude / 0.05).astype(int), np.floor(nrt.longitude / 0.05).astype(int)
cidx = {(a, g): i for i, (a, g) in enumerate(zip(cells.ga, cells.gb))}
nrt["c"] = np.array([cidx.get((a, g), -1) for a, g in zip(nrt.ga, nrt.gb)], dtype=np.int64)
nrt = nrt[nrt.c >= 0].drop_duplicates(["c", "d"])
# industrial mask: 5 km cells whose archive detections were mostly type 2 (static sources)
con = duckdb.connect()
st = con.execute("""SELECT floor(latitude/0.05)::INT ga, floor(longitude/0.05)::INT gb,
    avg(CASE WHEN type=2 THEN 1.0 ELSE 0 END) share2, count(*) n FROM read_csv('viirs/*.csv', union_by_name=true,
    types={'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}) GROUP BY 1, 2""").df()
static = set(cidx[(a, g)] for a, g, s, n in zip(st.ga, st.gb, st.share2, st.n) if s > 0.5 and n >= 10 and (a, g) in cidx)
nrt = nrt[~nrt.c.isin(static)]
ga, gbv = cells.ga.to_numpy(), cells.gb.to_numpy()
nbr = [[cidx.get((ga[i] + da, gbv[i] + db)) for da in (-1, 0, 1) for db in (-1, 0, 1)] for i in range(C)]
nbr = [[j for j in n if j is not None] for n in nbr]
mk = cells.muni_k.to_numpy()


def counts(since, until):
    s = nrt[(nrt.d >= since) & (nrt.d <= until)]
    v = np.zeros(C, np.float32)
    np.add.at(v, s.c.to_numpy(), 1)
    return v


def nbr_sum(v):
    return np.array([v[n].sum() for n in nbr], np.float32)


# ------------------------------------------------------------- score ---------
out = []
pidx = cells.p.to_numpy()
for L, day in zip((1, 2, 3), TARGETS):
    model = xgb.Booster()
    model.load_model(f"model_L{L}_fc_live.json")
    k = ISSUE
    f = {}
    for v in ["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "VPD", "FFMC", "DMC", "DC", "ISI", "BUI", "FWI"]:
        f["wx_" + v] = wx[v][day][pidx]
    for v in ["DSR", "RAIN7", "RAIN30", "DC", "FWI"]:
        f["dry_" + v] = wx[v][k][pidx]
    f["dry_GWETTOP"], f["dry_GWETROOT"] = gwet_top[pidx], gwet_root[pidx]
    c1, c3, c7 = counts(k, k), counts(k - pd.Timedelta(days=2), k), counts(k - pd.Timedelta(days=6), k)
    f["hist_cell1"], f["hist_cell3"], f["hist_cell7"] = c1, c3, c7
    f["hist_nbr3"], f["hist_nbr7"] = nbr_sum(c3), nbr_sum(c7)
    m7 = np.zeros(mk.max() + 1, np.float32)
    np.add.at(m7, mk, c7)
    f["hist_muni7"] = m7[mk]
    f["clim_month"] = b.clim[day.month - 1]
    f["clim_all"] = b.clim_all
    ly = ft.DAYS.get_loc(day - pd.Timedelta(days=365))
    f["hist_lastyear_cell"] = (b.cumF[ly + 16] - b.cumF[ly - 15]).astype(np.float32)
    f["hist_lastyear_nbr"] = (b.cumN[ly + 16] - b.cumN[ly - 15]).astype(np.float32)
    doy = day.dayofyear
    f["doy_sin"], f["doy_cos"] = np.full(C, np.sin(2 * np.pi * doy / 365.25), np.float32), np.full(C, np.cos(2 * np.pi * doy / 365.25), np.float32)
    X = pd.DataFrame(f)[model.feature_names].astype(np.float32)
    dm = xgb.DMatrix(X)
    rate = json.load(open(f"result_L{L}_fc_live.json"))["neg_sampling_rate"]
    ps = model.predict(dm)
    p = ps * rate / (ps * rate + (1 - ps))
    p[list(static)] = 0
    contrib = model.predict(dm, pred_contribs=True)[:, :-1]
    groups = {"weather": [i for i, n in enumerate(X.columns) if n.startswith("wx_")],
              "dryness": [i for i, n in enumerate(X.columns) if n.startswith("dry_")],
              "recent fires": [i for i, n in enumerate(X.columns) if n.startswith("hist_") and "lastyear" not in n],
              "same time last year": [i for i, n in enumerate(X.columns) if "lastyear" in n],
              "usual hot spot": [i for i, n in enumerate(X.columns) if n.startswith("clim")],
              "season": [i for i, n in enumerate(X.columns) if n.startswith("doy")]}
    for m in range(mk.max() + 1):
        cs = np.where(mk == m)[0]
        top = cs[np.argmax(p[cs])]
        gsum = {g: float(contrib[top, idx].sum()) for g, idx in groups.items()}
        reasons = [g for g, v in sorted(gsum.items(), key=lambda x: -x[1]) if v > 0][:2]
        out.append({"issued": str(ISSUE.date()), "date": str(day.date()), "lead_days": L,
                    "municipality": cells.muni.iloc[cs[0]], "spot_lat": float(cells.lat.iloc[top]),
                    "spot_lon": float(cells.lon.iloc[top]), "spot_fire_chance": float(p[top]),
                    "municipality_fire_chance": float(1 - np.prod(1 - p[cs])),
                    "fwi_at_spot": float(f["wx_FWI"][top]), "main_reasons": ", ".join(reasons)})
o = pd.DataFrame(out)
o["national_rank"] = o.groupby("date").municipality_fire_chance.rank(ascending=False, method="first").astype(int)
o = o.sort_values(["date", "national_rank"])
o.to_csv(f"outlook_bg_{ISSUE.date()}.csv", index=False)
gj = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [r.spot_lon, r.spot_lat]},
     "properties": {**{k: v for k, v in r._asdict().items() if k not in ("Index",)}, "precision_radius_km": 7.5}}
    for r in o.itertuples()]}
json.dump(gj, open(f"outlook_bg_{ISSUE.date()}.geojson", "w"))
print("weather: observed to", last_obs.date(), "| forecast days", [str(d.date()) for d in days],
      "| NOAA-20 detections used", len(nrt), "| industrial cells masked", len(static))
for day, g in o.groupby("date"):
    print(f"\n{day}: top municipalities")
    print(g.head(8)[["national_rank", "municipality", "municipality_fire_chance", "spot_fire_chance", "spot_lat", "spot_lon",
                     "fwi_at_spot", "main_reasons"]].round(3).to_string(index=False))
