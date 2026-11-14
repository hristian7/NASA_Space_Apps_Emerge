"""Static layers per 0.05 deg cell: land cover (ESA WorldCover 10 m, 2021), terrain
(Copernicus DEM 90 m) and province (geoBoundaries ADM1). All open, no login.

Writes static.parquet: one row per cell (ga, gb) with
  lc_tree, lc_shrub, lc_grass, lc_crop, lc_built, lc_bare, lc_water, lc_wetland (shares 0-1)
  dist_built_km (to the nearest cell with >= 5% built-up), dist_forest_km
  elev_mean, elev_std, slope_mean (deg), south_share (slopes facing 135-225 deg, > 5 deg)
  province
"""
import json, os, subprocess
import numpy as np, pandas as pd, rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from scipy import ndimage
from shapely.geometry import shape, Point
from shapely.prepared import prep

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
cells = pd.read_csv(os.path.join(os.path.dirname(HERE), "cells.csv"))
os.makedirs("static", exist_ok=True)


def fetch(url, path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        subprocess.run(["curl", "-sS", "-C", "-", "--retry", "30", "--retry-all-errors",
                        "-o", path, url], check=True)
    return path


# ---------------------------------------------------------------- land cover
WC = {10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built", 60: "bare",
      80: "water", 90: "wetland"}
lc = {k: np.full(len(cells), np.nan) for k in WC.values()}
for la in (39, 42):
    for lo in (21, 24, 27):
        name = f"ESA_WorldCover_10m_2021_v200_N{la:02d}E{lo:03d}_Map.tif"
        p = fetch(f"https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/{name}",
                  f"static/{name}")
        with rasterio.open(p) as src:
            sel = cells[(cells.lat >= la) & (cells.lat < la + 3) & (cells.lon >= lo) & (cells.lon < lo + 3)]
            # read at 50 m (factor 5): about 12,000 pixels per 5 km cell, enough for shares
            h, w = src.height // 5, src.width // 5
            a = src.read(1, out_shape=(h, w), resampling=Resampling.nearest)
            res = 3.0 / h
            for i, r in sel.iterrows():
                r0 = int((la + 3 - (r.lat + 0.025)) / res); c0 = int((r.lon - 0.025 - lo) / res)
                n = int(round(0.05 / res))
                blk = a[max(r0, 0):r0 + n, max(c0, 0):c0 + n]
                if blk.size == 0:
                    continue
                vals, cnt = np.unique(blk, return_counts=True)
                tot = cnt[vals != 0].sum()
                for code, key in WC.items():
                    lc[key][i] = cnt[vals == code].sum() / tot if tot else np.nan
        print("worldcover", name, flush=True)
out = cells[["ga", "gb"]].copy()
for k, v in lc.items():
    out["lc_" + k] = v

# distances on the cell grid (5 km steps, latitude-corrected)
ga0, gb0 = cells.ga.min(), cells.gb.min()
H, W = cells.ga.max() - ga0 + 1, cells.gb.max() - gb0 + 1
kmy, kmx = 0.05 * 111.2, 0.05 * 111.2 * np.cos(np.radians(42.7))
for key, col in [("built", "lc_built"), ("forest", "lc_tree")]:
    thr = 0.05 if key == "built" else 0.3
    grid = np.ones((H, W), bool)
    m = out[col].fillna(0).to_numpy() >= thr
    grid[cells.ga[m] - ga0, cells.gb[m] - gb0] = False
    d = ndimage.distance_transform_edt(grid, sampling=(kmy, kmx))
    out[f"dist_{key}_km"] = d[cells.ga - ga0, cells.gb - gb0]

# ---------------------------------------------------------------- terrain
for k in ("elev_mean", "elev_std", "slope_mean", "south_share"):
    out[k] = np.nan
for la in range(41, 45):
    for lo in range(22, 29):
        name = f"Copernicus_DSM_COG_30_N{la:02d}_00_E{lo:03d}_00_DEM"
        p = f"static/{name}.tif"
        try:
            fetch(f"https://copernicus-dem-90m.s3.amazonaws.com/{name}/{name}.tif", p)
        except subprocess.CalledProcessError:
            continue
        with rasterio.open(p) as src:
            z = src.read(1).astype("f4")
            res_y = 1.0 / src.height; res_x = 1.0 / src.width
            dy = res_y * 111200; dx = res_x * 111200 * np.cos(np.radians(la + 0.5))
            gy, gx = np.gradient(z, dy, dx)          # gy: change per metre going south (rows)
            slope = np.degrees(np.arctan(np.hypot(gx, gy)))
            aspect = (np.degrees(np.arctan2(-gx, gy)) + 360) % 360  # direction the slope faces
            south = (aspect >= 135) & (aspect <= 225) & (slope > 5)
            sel = cells[(cells.lat >= la) & (cells.lat < la + 1) & (cells.lon >= lo) & (cells.lon < lo + 1)]
            for i, r in sel.iterrows():
                r0 = int((la + 1 - (r.lat + 0.025)) / res_y); c0 = int((r.lon - 0.025 - lo) / res_x)
                ny, nx = int(round(0.05 / res_y)), int(round(0.05 / res_x))
                blk = (slice(max(r0, 0), r0 + ny), slice(max(c0, 0), c0 + nx))
                zz = z[blk]
                if zz.size == 0:
                    continue
                out.loc[i, ["elev_mean", "elev_std", "slope_mean", "south_share"]] = [
                    zz.mean(), zz.std(), slope[blk].mean(), south[blk].mean()]
        print("dem", name, flush=True)

# ---------------------------------------------------------------- province
fetch("https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/BGR/ADM1/geoBoundaries-BGR-ADM1.geojson", "bgr_adm1.geojson")
g = json.load(open("bgr_adm1.geojson"))
polys = [(f["properties"]["shapeName"], prep(shape(f["geometry"]))) for f in g["features"]]
prov = []
for r in cells.itertuples():
    pt = Point(r.lon, r.lat)
    prov.append(next((n for n, p in polys if p.contains(pt)), None))
out["province"] = prov
if out.province.isna().any():          # border cells: nearest province centroid of its municipality
    mp = pd.Series(prov, index=cells.index).groupby(cells.muni).agg(lambda s: s.mode().iat[0] if s.notna().any() else None)
    out.loc[out.province.isna(), "province"] = cells.muni[out.province.isna()].map(mp)
out.to_parquet("static.parquet")
print(out.describe().T.round(3).to_string())
print("cells without province:", out.province.isna().sum())
