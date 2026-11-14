"""V-M124 slices, V-M114/V-M46 range coverage, V-M44 per year, V-M58 sensitivity.
Reads hindcast.csv and forward.csv from analyze.py (and forward_notrend.csv if run
with NO_TREND=1 FWD_OUT=forward_notrend.csv)."""
import os
import numpy as np
import pandas as pd
from scipy.stats import norm

ENG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fw = pd.read_csv(f"{ENG}/forward.csv")
hc = pd.read_csv(f"{ENG}/hindcast.csv")


def bss(d):
    bh = np.mean((d.p_hist - d.above) ** 2)
    return 1 - np.mean((d.p_above - d.above) ** 2) / bh if bh > 0 else np.nan


def zone(a):
    return np.where(a < 23.5, "tropics", np.where(a < 40, "subtropics", "mid/high lat"))


fw["zone"] = zone(fw.abs_lat)
fw["climate"] = pd.cut(fw.rain_mm_yr, [0, 500, 1000, 1600, 1e9], labels=["arid", "semi-arid", "sub-humid", "humid"])
fw["size"] = pd.cut(fw.cd_per_year, [0, 300, 1000, 5000, 1e9], labels=["<300", "300-1k", "1k-5k", ">5k"])
fw["main"] = fw.groups.str.split("+").str[0]
out = []
for col in ["lead", "y", "zone", "climate", "cls", "size", "mo"]:
    for k, d in fw.groupby(col, observed=True):
        out.append({"slice": col, "value": k, "n": len(d), "brier_skill_vs_history": round(bss(d), 3),
                    "corr": round(float(np.corrcoef(d.pred, d.obs)[0, 1]), 2)})
sl = pd.DataFrame(out)
sl.to_csv("m124_slices.csv", index=False)
print("FORWARD TEST 2022-2025 BY SLICE (gates and fit from 2003-2021 only)")
print(sl.to_string(index=False))
bad = sl[(sl.n >= 200) & (sl.brier_skill_vs_history < 0)]
print("\nSlices with n >= 200 where the engine is WORSE than history:", "none" if bad.empty else bad.to_string(index=False))

# Range coverage: does the stated 90% range contain 90% of outcomes?
print("\nRANGE COVERAGE (nominal 90%)")
for name, d in (("held-out years 2003-2021", hc), ("forward 2022-2025", fw)):
    for lead, g in d.groupby("lead"):
        # residual spread per unit from the hindcast, same rule as forecast.py (x1.15)
        sd = hc[hc.lead == lead].groupby(["country", "unit", "cls", "season"]).apply(
            lambda x: np.std(x.obs - x.pred) * 1.15, include_groups=False).rename("sd")
        g = g.join(sd, on=["country", "unit", "cls", "season"])
        inside = (g.obs - g.pred).abs() <= 1.645 * g.sd
        print(f"  {name}, lead {lead}: {100 * inside.mean():.1f}% inside")

if os.path.exists(f"{ENG}/forward_notrend.csv"):
    nt = pd.read_csv(f"{ENG}/forward_notrend.csv")
    print("\nPRE-REGISTRATION SENSITIVITY: trend never allowed (V-M58)")
    for lead, d in nt.groupby("lead"):
        print(f"  lead {lead}: Brier skill vs history {bss(d):.3f} (n {len(d)})")
