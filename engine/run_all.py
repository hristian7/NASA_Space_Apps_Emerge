"""Run the engine for every country whose files are complete; one row per
country x fire season x lead, with Shapley weights and climate descriptors."""
import json
import os
import subprocess
import sys
import numpy as np
import pandas as pd
import engine as e

from build_fire import RAW


def complete(c):
    """All yearly MODIS files 2001-2025 for the country are on disk."""
    return all((RAW / str(y) / f"modis_{y}_{c}.csv").exists() for y in range(2001, 2026))


def descriptors(w, months, pts):
    clim = w[w.index.get_level_values("y").isin(e.TRAIN_YEARS)].groupby("mo").mean()
    return {"rain_mm_yr": float(clim.PRECTOTCORR.mean() * 365),
            "soil_wet_season": float(clim.GWETROOT.loc[months].mean()),
            "tmax_season_C": float(clim.T2M_MAX.loc[months].mean()),
            "vpd_season_kPa": float(clim.VPD.loc[months].mean()),
            "abs_lat": float(np.average(abs(pts.lat), weights=pts.w)),
            "lat": float(np.average(pts.lat, weights=pts.w))}


def run(c, ocean):
    if not os.path.exists(f"fire/{c}.csv"):
        subprocess.run([sys.executable, "build_fire.py", c], check=True, capture_output=True)
    if not os.path.exists(f"weather/{c}.csv"):
        subprocess.run([sys.executable, "fetch_power.py", c], check=True, capture_output=True)
    fire_all = pd.read_csv(f"fire/{c}.csv")
    if not os.path.exists(f"weather/{c}.csv"):
        return []
    w_all = pd.read_csv(f"weather/{c}.csv").drop(columns="country")
    pts_all = pd.read_csv(f"fire/{c}_points.csv")
    rows = []
    for (unit, cls), w in w_all.groupby(["unit", "cls"]):
        fire = fire_all[(fire_all.unit == unit) & (fire_all.cls == cls)]
        w = w.drop(columns=["unit", "cls"]).set_index(["y", "mo"])
        pts = pts_all[(pts_all.unit == unit) & (pts_all.cls == cls)].assign(w=lambda d: d.n / d.n.sum())
        cd_yr = fire[fire.y.isin(e.TRAIN_YEARS)].cd.sum() / len(e.TRAIN_YEARS)
        for season, (months, share) in e.fire_seasons(fire).items():
            if share < 0.15:
                continue
            d = descriptors(w, months, pts)
            for lead in e.LEADS:
                r = e.shapley(fire, w, ocean, lead, months, d["lat"])
                rows.append({"country": c, "unit": unit, "cls": cls, "cd_per_year": round(cd_yr),
                             "season": season, "season_share": round(share, 2),
                             "lead": str(lead), "n": r["n"], "skill": r["skill"],
                             **{f"phi_{k}": v for k, v in r["phi"].items()},
                             **{f"b_{k}": v for k, v in r["beta"].items()}, **d})
    return rows


if __name__ == "__main__":
    ocean = e.ocean_indices()
    done = pd.read_csv("results.csv") if os.path.exists("results.csv") else pd.DataFrame()
    have = set(done.country) if len(done) else set()
    todo = [c for c in sys.argv[1:] if c not in have and complete(c)]
    rows = []
    for c in todo:
        try:
            rows += run(c, ocean)
            print("done", c, flush=True)
        except Exception as ex:  # noqa: BLE001
            print("ERROR", c, ex, flush=True)
    if rows:
        pd.concat([done, pd.DataFrame(rows)], ignore_index=True).to_csv("results.csv", index=False)
    if os.path.exists("results.csv"):
        print("countries in results:", sorted(set(pd.read_csv("results.csv").country)))
