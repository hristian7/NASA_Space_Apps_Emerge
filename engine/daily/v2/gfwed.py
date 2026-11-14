"""Bulgaria subset of NASA GFWED fire-weather (GEOS-5 weather model), by HTTP byte ranges.

Files are NetCDF-3 with seven float32 (time=1, lat=533, lon=1152) variables laid out one
after another (DC, DMC, FFMC, ISI, BUI, FWI, DSR), so each Bulgaria row is one small
byte range. One multipart request per file instead of a 17 MB download. Each slab is
checked against value ranges; a file that fails is downloaded whole and read properly.

usage: python3 gfwed.py analysis 2018 2026      (daily analysis files)
       python3 gfwed.py forecast 2018 2026      (runs: leads +1..+5 kept)
"""
import io, os, sys, time, urllib.request, email, datetime as dt
import numpy as np, pandas as pd
from concurrent.futures import ThreadPoolExecutor
from scipy.io import netcdf_file

B = "https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/"
VARS = ["DC", "DMC", "FFMC", "ISI", "BUI", "FWI", "DSR"]
NLAT, NLON, OFF0 = 533, 1152, 17792
SLAB = NLAT * NLON * 4
R0, R1 = 395, 411                 # lat 40.75 .. 44.75
C0, C1 = 646, 669                 # lon 21.875 .. 29.0625
LAT = -58 + 0.25 * np.arange(R0, R1 + 1)
LON = -180 + 0.3125 * np.arange(C0, C1 + 1)
LIMITS = {"DC": (0, 3000), "DMC": (0, 1500), "FFMC": (0, 101.1), "ISI": (0, 300),
          "BUI": (0, 1500), "FWI": (0, 500), "DSR": (0, 3000)}


def ranges():
    out = []
    for k in range(len(VARS)):
        for r in range(R0, R1 + 1):
            a = OFF0 + k * SLAB + (r * NLON + C0) * 4
            out.append((a, a + (C1 - C0 + 1) * 4 - 1))
    return out


RANGES = ranges()


def get(url, headers=None, tries=8):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 404, None, b""
            time.sleep(1 + i)
        except Exception:
            time.sleep(1 + i)
    raise RuntimeError("failed " + url)


def check(arr):
    if not np.isfinite(arr).any():
        return False
    for k, v in enumerate(VARS):
        x = arr[k][np.isfinite(arr[k]) & (arr[k] > -1e20)]
        lo, hi = LIMITS[v]
        if x.size and (x.min() < lo - 1e-3 or x.max() > hi):
            return False
    return True


def by_ranges(url):
    hdr = {"Range": "bytes=" + ",".join(f"{a}-{b}" for a, b in RANGES)}
    st, h, body = get(url, hdr)
    if st == 404:
        return None
    if st != 206 or "multipart" not in h.get("Content-Type", ""):
        raise ValueError("no multipart")
    msg = email.message_from_bytes(b"Content-Type: " + h["Content-Type"].encode() + b"\r\n\r\n" + body)
    parts = {}
    for p in msg.get_payload():
        a = int(p["Content-Range"].split()[1].split("-")[0])
        parts[a] = p.get_payload(decode=True)
    vals = [np.frombuffer(parts[a], ">f4") for a, _ in RANGES]
    return np.array(vals).reshape(len(VARS), R1 - R0 + 1, C1 - C0 + 1).astype("f4")


def whole(url):
    for _ in range(3):                      # truncated transfers are retried; a broken file is skipped
        st, h, body = get(url)
        if st == 404:
            return None
        try:
            f = netcdf_file(io.BytesIO(body), "r", mmap=False)
            a = np.array([f.variables["GEOS-5_" + v][0, R0:R1 + 1, C0:C1 + 1] for v in VARS], "f4")
            if check(a):
                return a
        except Exception:
            pass
    return None


def fetch(url):
    try:
        a = by_ranges(url)
        if a is None or check(a):
            return a, "range"
    except Exception:
        pass
    return whole(url), "whole"


if __name__ == "__main__":
    kind, y0, y1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    days = pd.date_range(f"{y0}-01-01", min(pd.Timestamp(f"{y1}-12-31"), pd.Timestamp("2026-11-13")))
    jobs = []
    if kind == "analysis":
        for d in days:
            jobs.append(((d, 0), f"{B}{d.year}/FWI.GEOS-5.Daily.Default.{d:%Y%m%d}.nc"))
    else:                                    # runs issued on day d, valid d+lead
        for d in days:
            for L in range(1, 6):
                v = d + pd.Timedelta(days=L)
                jobs.append(((d, L), f"{B}{d.year}/{d:%Y%m%d}00/FWI.GEOS-5.Daily.Default.{d:%Y%m%d}00.{v:%Y%m%d}.nc"))
    res, how = {}, {"range": 0, "whole": 0, "missing": 0}
    t0 = time.time()
    with ThreadPoolExecutor(16) as ex:
        for i, ((key, url), (a, h)) in enumerate(zip(jobs, ex.map(lambda j: fetch(j[1]), jobs))):
            if a is None:
                how["missing"] += 1
                continue
            how[h] += 1
            res[key] = a
            if i % 500 == 0:
                print(i, len(jobs), how, f"{time.time()-t0:.0f}s", flush=True)
    keys = sorted(res)
    arr = np.stack([res[k] for k in keys])
    np.savez_compressed(f"gfwed_{kind}_{y0}_{y1}.npz", data=arr,
                        issue=np.array([k[0].strftime("%Y-%m-%d") for k in keys]),
                        lead=np.array([k[1] for k in keys]), lat=LAT, lon=LON, vars=np.array(VARS))
    print("done", how, arr.shape)
