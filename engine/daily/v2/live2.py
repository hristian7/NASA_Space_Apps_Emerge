"""Live version-2 outlook for Bulgaria: issued at the end of ISSUE for ISSUE+1..+3.

Inputs, all as they stand on the issue evening (nothing from after it):
  weather   NASA GFWED GEOS-5: the run of ISSUE-2 (leads +3..+5) and the analysis of
            ISSUE-2, the newest both posted on the evening of 14 Nov 2026
  fires     NOAA-20 VIIRS for 2026 from the public firms-catalog mirror plus the FIRMS
            7-day near-real-time file (no 'type' field live, so cells that were mostly
            industrial heat in the archive are masked); the 2012-2025 archive for history
  static    land cover, terrain, provinces, municipalities
Models: the version-2 ensemble (trees + 10-epoch neural network) per lead, trained
2019-2023 on all fires ("all") and on new fires ("new").

usage: python3 live2.py 2026-11-14
Writes outlook2_bg_<ISSUE>.csv and .geojson (per municipality and day: the top spot,
its chance, the municipality's chance, province rank, plain reasons) and
outlook2_bg_<ISSUE>_provinces.csv (top 5 spots per province and day, team protocol).
"""
import json, os, pickle, sys, subprocess
import numpy as np, pandas as pd, duckdb, xgboost as xgb, torch
HERE = os.path.dirname(os.path.abspath(__file__))     # engine/daily/v2
V1 = os.path.dirname(HERE)                             # engine/daily (version 1: grid, fire CSVs)
os.chdir(HERE)
sys.path.insert(0, V1)
import features as v1
ISSUE = pd.Timestamp(os.environ.get("ISSUE") or (sys.argv[1] if len(sys.argv) > 1 else "2026-11-14"))
END = ISSUE + pd.Timedelta(days=3)
# extend the calendar so the target days exist; the archive arrays simply have no data there
v1.END, v1.DAYS = END, pd.date_range(v1.START, END, freq="D")
v1.D = len(v1.DAYS)
import features2 as f2
f2.DAYS, f2.D = v1.DAYS, v1.D

# ---------------------------------------------------------- 2026 NOAA-20 fires as CSV
os.makedirs("live_viirs", exist_ok=True)
for f in os.listdir(f"{V1}/viirs"):
    dst = f"live_viirs/{f}"
    if not os.path.exists(dst):
        os.symlink(f"{V1}/viirs/{f}", dst)
con = duckdb.connect()
cat = con.execute(f"""SELECT latitude, longitude, acq_date, confidence, satellite FROM (
    SELECT lat latitude, lon longitude, acq_date, lower(substr(confidence,1,1)) confidence, satellite
    FROM '{HERE}/cat2026/bg_viirs_2026.parquet' WHERE type IS NULL OR type = 0)
    WHERE satellite IN ('N20','NOAA-20','J1','NOAA20','N')""").df()
nrt_path = f"{HERE}/J1_VIIRS_C2_Europe_7d.csv"
subprocess.run(["curl", "-sS", "--retry", "10", "--retry-all-errors", "-o", nrt_path,
                "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_7d.csv"])
try:
    nrt = pd.read_csv(nrt_path)
except Exception:                      # the 7-day file is optional: the catalog already reaches the issue day
    nrt = pd.DataFrame(columns=["latitude", "longitude", "acq_date", "confidence"])
nrt = nrt[(nrt.latitude.between(41.2, 44.25)) & (nrt.longitude.between(22.3, 28.7))]
nrt = pd.DataFrame({"latitude": nrt.latitude, "longitude": nrt.longitude, "acq_date": nrt.acq_date,
                    "confidence": nrt.confidence.astype(str).str[0].str.lower()})
live = pd.concat([cat[["latitude", "longitude", "acq_date", "confidence"]], nrt]).drop_duplicates()
live["acq_date"] = pd.to_datetime(live.acq_date)
live = live[live.acq_date <= ISSUE]
# static-source mask: cells whose archive detections were mostly type 2 (industrial)
arch = con.execute(f"""SELECT floor(latitude/0.05)::INT ga, floor(longitude/0.05)::INT gb,
    avg(CASE WHEN type=2 THEN 1 ELSE 0 END) s2, count(*) n FROM read_csv('{V1}/viirs/*.csv',
    union_by_name=true, types={{'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}}) GROUP BY ALL""").df()
ind = set(map(tuple, arch[(arch.s2 > 0.5) & (arch.n >= 5)][["ga", "gb"]].to_numpy()))
live["ga"], live["gb"] = np.floor(live.latitude / 0.05).astype(int), np.floor(live.longitude / 0.05).astype(int)
masked = live[[(a, g) in ind for a, g in zip(live.ga, live.gb)]]
live = live[[(a, g) not in ind for a, g in zip(live.ga, live.gb)]]
live["type"] = 0
live["acq_time"], live["satellite"] = "0000", "N"
live["acq_date"] = live.acq_date.dt.strftime("%Y-%m-%d")
live[["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "type"]].to_csv(
    "live_viirs/viirs-jpss1_2026_live.csv", index=False)
print("2026 NOAA-20 detections used", len(live), "| masked industrial", len(masked),
      "| last day", live.acq_date.max(), flush=True)


class LiveBuilder(f2.Builder2):
    pass


_fa = v1.fire_arrays
v1.fire_arrays = lambda cells, path, sat: _fa(cells, f"{HERE}/live_viirs/*.csv", sat)
b = LiveBuilder()
b.gap[:] = b.gap
iss = v1.DAYS.get_loc(ISSUE)
b.gap[f2.DAYS.get_loc(pd.Timestamp("2026-01-01")):iss + 1] = False
C = len(b.cells)
print("NOAA-20 fire cells on the last 3 days before issue:", [int(b.F[iss - k].sum()) for k in (2, 1, 0)], flush=True)
assert np.isfinite(b.FC["FWI"][3][iss - 2].astype(np.float32)).any(), "GEOS-5 run of ISSUE-2 missing"


def load_model(tag):
    base = f"{HERE}/models/model2_{tag}" if os.path.exists(f"{HERE}/models/model2_{tag}.prep.pkl") else f"model2_{tag}"
    prep = pickle.load(open(f"{base}.prep.pkl", "rb"))
    if tag.endswith("xgb"):
        m = xgb.Booster(); m.load_model(f"{base}.json")
        return prep, m
    l = prep["layers"]
    net = torch.nn.Sequential(torch.nn.Linear(prep["n_in"], l[0]), torch.nn.SiLU(), torch.nn.Dropout(0.2),
                              torch.nn.Linear(l[0], l[1]), torch.nn.SiLU(), torch.nn.Dropout(0.2),
                              torch.nn.Linear(l[1], l[2]), torch.nn.SiLU(), torch.nn.Linear(l[2], 1))
    net.load_state_dict(torch.load(f"{base}.pt")); net.eval()
    return prep, net


def predict(tag, X):
    prep, m = load_model(tag)
    X = X[prep["feats"]]
    if tag.endswith("xgb"):
        ps = m.predict(xgb.DMatrix(X), iteration_range=(0, prep["trees"]))
        contrib = m.predict(xgb.DMatrix(X), pred_contribs=True, iteration_range=(0, prep["trees"]))
    else:
        Z = X.copy()
        for c in prep["log"]:
            Z[c] = np.log1p(np.maximum(Z[c], 0))
        miss = Z.isna().any(axis=1).to_numpy()[:, None].astype(np.float32)
        Z = ((Z.fillna(prep["med"]) - prep["mu"]) / prep["sd"]).to_numpy(np.float32)
        with torch.no_grad():
            ps = torch.sigmoid(m(torch.from_numpy(np.hstack([Z, miss]))).squeeze(1)).numpy()
        contrib = None
    r = prep["rate"]
    return ps * r / (ps * r + 1 - ps), contrib, prep["feats"]


if __name__ == "__main__":
    WORDS = {"weather_fc": "fire weather forecast (GEOS-5)", "weather_now": "dry fuels now",
             "fuel": "land cover (fuel)", "terrain": "terrain", "history_recent": "recent fires nearby",
             "history_calendar": "burns at this time of year", "season": "season"}
    rows, prov_rows = [], []
    cl = b.cells
    for L in (1, 2, 3):
        d = iss + L
        c = np.arange(C)
        X = b.X(np.full(C, d), c, L)
        if L == 1:
            print("cells with a fire nearby in the last 3 days:", int((X.hist_nbr3 > 0).sum()),
                  "| GEOS-5 FWI range", float(np.nanmin(X.fc_FWI)), float(np.nanmax(X.fc_FWI)), flush=True)
        out = {}
        for lab in ("all", "new"):
            p_x, contrib, feats = predict(f"L{L}_{lab}_xgb", X)
            p_m, _, _ = predict(f"L{L}_{lab}_mlp", X)
            out[lab] = (p_x + p_m) / 2
            if lab == "all":
                g = {k: contrib[:, [feats.index(f) for f in v if f in feats]].sum(1) for k, v in f2.GROUPS.items()}
        p = out["all"]
        day = f2.DAYS[d].strftime("%Y-%m-%d")
        for m, cs in cl.groupby("muni_k").groups.items():
            cs = np.array(list(cs))
            top = cs[np.argmax(p[cs])]
            reasons = sorted(((g[k][top], k) for k in g), reverse=True)
            rows.append({"issued": ISSUE.strftime("%Y-%m-%d"), "date": day, "lead_days": L,
                         "municipality": cl.muni[top], "province": cl.province[top],
                         "spot_lat": round(cl.lat[top], 3), "spot_lon": round(cl.lon[top], 3),
                         "spot_fire_chance": float(p[top]), "spot_new_fire_chance": float(out["new"][top]),
                         "municipality_fire_chance": float(1 - np.prod(1 - p[cs])),
                         "fwi_geos5": float(X.fc_FWI[top]) if np.isfinite(X.fc_FWI[top]) else None,
                         "land_cover": max(["tree", "shrub", "grass", "crop", "built"], key=lambda k: cl["lc_" + k][top]),
                         "main_reasons": ", ".join(WORDS[k] for v, k in reasons[:2] if v > 0),
                         "precision_radius_km": 7.5})
        for pr, cs in cl.groupby("province").groups.items():
            cs = np.array(list(cs))
            for rank, j in enumerate(cs[np.argsort(-out["new"][cs])[:5]], 1):
                prov_rows.append({"issued": ISSUE.strftime("%Y-%m-%d"), "date": day, "lead_days": L, "province": pr,
                                  "rank": rank, "lat": round(cl.lat[j], 3), "lon": round(cl.lon[j], 3),
                                  "municipality": cl.muni[j], "new_fire_chance": float(out["new"][j]),
                                  "precision_radius_km": 3.5})
    R = pd.DataFrame(rows)
    R["national_rank"] = R.groupby("date").municipality_fire_chance.rank(ascending=False, method="first").astype(int)
    R = R.sort_values(["date", "national_rank"])
    tag = ISSUE.strftime("%Y-%m-%d")
    R.to_csv(f"outlook2_bg_{tag}.csv", index=False)
    pd.DataFrame(prov_rows).to_csv(f"outlook2_bg_{tag}_provinces.csv", index=False)
    gj = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [r.spot_lon, r.spot_lat]},
         "properties": {k: (None if (isinstance(v, float) and not np.isfinite(v)) else v)
                        for k, v in r.items() if k not in ("spot_lat", "spot_lon")}} for _, r in R.iterrows()]}
    json.dump(gj, open(f"outlook2_bg_{tag}.geojson", "w"))
    print(R.groupby("date").municipality_fire_chance.agg(["mean", "max", "sum"]))
    print(R[R.national_rank <= 5][["date", "municipality", "municipality_fire_chance", "land_cover", "main_reasons"]].to_string())
