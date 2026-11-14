"""Daily weather 2012-2026 at the NASA POWER (MERRA-2) grid points covering Bulgaria.
One call per point. Variables: Tmax, mean RH, mean wind at 2 m, precipitation,
topsoil and root-zone wetness."""
import json, os, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import pandas as pd

URL = ("https://power.larc.nasa.gov/api/temporal/daily/point?parameters="
       "T2M_MAX,RH2M,WS2M,PRECTOTCORR,GWETTOP,GWETROOT&community=AG"
       "&longitude={lon}&latitude={lat}&start=20120101&end=20261112&format=JSON")
cells = pd.read_csv("cells.csv")
# nearest MERRA-2 centre (0.5 deg lat x 0.625 deg lon)
cells["wlat"] = (np.round(cells.lat / 0.5) * 0.5).round(3)
cells["wlon"] = (np.round(cells.lon / 0.625) * 0.625).round(3)
cells.to_csv("cells.csv", index=False)
pts = cells[["wlat", "wlon"]].drop_duplicates().to_numpy()
os.makedirs("wx", exist_ok=True)


def get(p):
    lat, lon = p
    path = f"wx/{lat:+.3f}_{lon:+.3f}.json"
    if not os.path.exists(path):
        for k in range(5):
            try:
                with urllib.request.urlopen(URL.format(lat=lat, lon=lon), timeout=120) as r:
                    open(path, "wb").write(r.read())
                break
            except Exception:
                time.sleep(3 * (k + 1))
    d = pd.DataFrame(json.load(open(path))["properties"]["parameter"]).replace(-999.0, np.nan)
    d.index = pd.to_datetime(d.index, format="%Y%m%d")
    return d.assign(wlat=lat, wlon=lon)


with ThreadPoolExecutor(4) as ex:
    frames = list(ex.map(get, pts))
w = pd.concat(frames).rename_axis("date").reset_index()
w.to_parquet("weather_daily.parquet")
print(len(pts), "points;", len(w), "rows;", w.date.min().date(), "->", w.date.max().date(),
      "; missing share", w[["T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "GWETROOT"]].isna().mean().round(3).to_dict())
