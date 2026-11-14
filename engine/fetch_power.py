"""Stage 2: monthly weather and soil moisture at each country's fire points.

NASA POWER monthly point API (no account). Variables:
  T2M_MAX      daily maximum air temperature at 2 m, monthly mean (C)
  RH2M         relative humidity at 2 m (%)
  PRECTOTCORR  precipitation (mm/day)
  GWETROOT     root-zone soil wetness, 0-1 (MERRA-2): the slow, deep moisture store
  WS2M         wind speed at 2 m (m/s)
From these, vapour pressure deficit at Tmax: VPD = es(Tmax) * (1 - RH/100), the
evaporative demand that dries dead fuel.

usage: python3 fetch_power.py Country [Country ...]
"""
import json
import os
import sys
import time
import urllib.request
import numpy as np
import pandas as pd

URL = ("https://power.larc.nasa.gov/api/temporal/monthly/point?parameters="
       "T2M_MAX,RH2M,PRECTOTCORR,GWETROOT,WS2M&community=AG"
       "&longitude={lon}&latitude={lat}&start=2001&end=2025&format=JSON")


def point(lat, lon):
    path = f"power/{lat:+.1f}_{lon:+.1f}.json"
    if not os.path.exists(path):
        for attempt in range(5):
            try:
                with urllib.request.urlopen(URL.format(lat=lat, lon=lon), timeout=60) as r:
                    open(path, "wb").write(r.read())
                break
            except Exception as e:  # noqa: BLE001
                time.sleep(3 * (attempt + 1))
                if attempt == 4:
                    raise e
    p = json.load(open(path))["properties"]["parameter"]
    df = pd.DataFrame(p)
    df = df[~df.index.str.endswith("13")]                 # drop annual means
    df.index = pd.MultiIndex.from_tuples([(int(k[:4]), int(k[4:])) for k in df.index],
                                         names=["y", "mo"])
    df = df.replace(-999.0, np.nan)
    es = 0.6108 * np.exp(17.27 * df.T2M_MAX / (df.T2M_MAX + 237.3))   # kPa, Tetens
    df["VPD"] = es * (1 - df.RH2M / 100)
    return df


MIN_CD = 19 * 100      # skip units with fewer than ~100 fire cell-days a year


def country(c):
    from concurrent.futures import ThreadPoolExecutor
    fire = pd.read_csv(f"fire/{c}.csv")
    big = fire[fire.y.between(2003, 2021)].groupby(["unit", "cls"]).cd.sum()
    big = set(big[big >= MIN_CD].index)
    pts = pd.read_csv(f"fire/{c}_points.csv")
    pts = pts[[(u, k) in big for u, k in zip(pts.unit, pts.cls)]]
    with ThreadPoolExecutor(4) as ex:                    # fill the cache in parallel
        list(ex.map(lambda r: point(r[0], r[1]), zip(pts.lat, pts.lon)))
    out = []
    for (unit, cls), g in pts.groupby(["unit", "cls"]):
        w = g.n / g.n.sum()
        frame = sum(point(r.lat, r.lon) * wi for r, wi in zip(g.itertuples(), w))  # fire-weighted
        out.append(frame.reset_index().assign(unit=unit, cls=cls))
    if out:
        pd.concat(out).assign(country=c).to_csv(f"weather/{c}.csv", index=False)
    return len(out)


if __name__ == "__main__":
    os.makedirs("power", exist_ok=True)
    os.makedirs("weather", exist_ok=True)
    for c in sys.argv[1:]:
        print(c, country(c), flush=True)
