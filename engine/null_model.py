"""Null distribution of Shapley weights: same fire record, weather and ocean years
shuffled (2001-2021 shuffled among themselves, so lags stay inside real data).
A real weight must beat what shuffled data produces (verification method M123)."""
import sys
import warnings
import numpy as np
import pandas as pd
import engine as e
import run_all as ra

warnings.filterwarnings("ignore", category=RuntimeWarning)   # empty lag windows in shuffled years
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 11)
ocean = e.ocean_indices()
res = pd.read_csv("results.csv")
units = res[["country", "unit", "cls", "season"]].drop_duplicates()
rows = []
for k in range(int(sys.argv[1]) if len(sys.argv) > 1 else 3):
    years = list(range(2001, 2022))
    perm = dict(zip(years, rng.permutation(years)))
    for r in units.itertuples():
        fire = pd.read_csv(f"fire/{r.country}.csv")
        fire = fire[(fire.unit == r.unit) & (fire.cls == r.cls)]
        w = pd.read_csv(f"weather/{r.country}.csv").drop(columns="country")
        w = w[(w.unit == r.unit) & (w.cls == r.cls)].drop(columns=["unit", "cls"]).set_index(["y", "mo"])
        months, _ = e.fire_seasons(fire)[r.season]
        lat = res[(res.unit == r.unit) & (res.country == r.country)].lat.iloc[0]
        for lead in e.LEADS:
            out = e.shapley(fire, w, ocean, lead, months, lat, perm)
            rows.append({"perm": k, "country": r.country, "unit": r.unit, "cls": r.cls,
                         "season": r.season, "lead": str(lead), "skill": out["skill"],
                         **{f"phi_{g}": v for g, v in out["phi"].items()}})
    print("permutation", k, "done", flush=True)
pd.DataFrame(rows).to_csv(sys.argv[3] if len(sys.argv) > 3 else "null.csv", index=False)
