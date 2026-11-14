"""Stage 3: from raw Shapley weights to rules.

1. Null thresholds: per factor group and lead, the 95th percentile of the weight
   that year-shuffled weather/ocean data produces (null.csv). A real weight must
   exceed it (verification method M123: thousands of tests, few false alarms).
2. Gates: which groups each unit may use at each lead -> gates.csv
3. Regimes: units grouped by climate (annual rain, latitude) and fire kind;
   the share of units where each factor earns weight, and its median weight.
4. Signs: does more rain last year mean MORE fire (fuel-limited) or LESS?
5. Calibration of the gated forecasts (M112) and Brier skill vs history.
"""
import json
import numpy as np
import pandas as pd
import engine as e
import forecast as fc

G = ["dryness_now", "dryness_memory", "fuel_growth", "ocean", "trend"]
res = pd.read_csv("results.csv")
null = pd.read_csv("null.csv")
res["lead"] = res["lead"].astype(str)
null["lead"] = null["lead"].astype(str)
report = {}

# 1. null thresholds
thr = {}
for lead in res.lead.unique():
    nl = null[null.lead == lead]
    thr[lead] = {g: max(0.02, float(nl[f"phi_{g}"].quantile(0.95))) for g in G if f"phi_{g}" in nl
                 and nl[f"phi_{g}"].notna().any()}
    # The shuffle moves weather and ocean data but not the calendar year, so it
    # cannot give a null for the trend. Fixed bar instead: +0.05 held-out skill.
    thr[lead]["trend"] = 0.05
report["null_thresholds"] = thr
real_vs_null = []
for lead in res.lead.unique():
    for g in thr[lead]:
        r, n = res[res.lead == lead][f"phi_{g}"].dropna(), null[null.lead == lead][f"phi_{g}"].dropna()
        real_vs_null.append({"lead": lead, "group": g, "units_passing_%": round(100 * (r > thr[lead][g]).mean(), 1),
                             "expected_by_chance_%": (None if g == "trend" else
                                                      round(100 * (n > thr[lead][g]).mean(), 1))})
report["pass_rates"] = real_vs_null

# 2. gates
def gate(row):
    return [g for g in G if g in thr[row.lead] and pd.notna(row[f"phi_{g}"]) and row[f"phi_{g}"] > thr[row.lead][g]]
res["gated"] = res.apply(gate, axis=1)
res[["country", "unit", "cls", "season", "lead", "skill", "gated", "lat", "rain_mm_yr"]].to_csv("gates.csv", index=False)

# 3. regimes
res["aridity"] = pd.cut(res.rain_mm_yr, [0, 500, 1000, 1600, 1e9],
                        labels=["arid <500 mm", "semi-arid 500-1000", "sub-humid 1000-1600", "humid >1600"])
res["zone"] = np.where(res.abs_lat < 23.5, "tropics", np.where(res.abs_lat < 40, "subtropics", "mid/high latitudes"))
regimes = []
for keys, d in res.groupby(["lead", "zone", "aridity", "cls"], observed=True):
    if len(d) < 3:
        continue
    row = dict(zip(["lead", "zone", "aridity", "kind"], keys), units=len(d),
               median_skill=round(float(d.skill.median()), 2))
    for g in G:
        if f"phi_{g}" in d and d[f"phi_{g}"].notna().any() and g in thr[keys[0]]:
            row[f"{g}_%pass"] = round(100 * float((d[f"phi_{g}"] > thr[keys[0]][g]).mean()))
            row[f"{g}_w"] = round(float(d[f"phi_{g}"].clip(lower=0).mean()), 3)
    regimes.append(row)
regimes = pd.DataFrame(regimes)
regimes.to_csv("regimes.csv", index=False)

# 4. fuel sign by aridity (lead 0 model, full-fit coefficient)
fs = res[res.lead == "0"].groupby("aridity", observed=True)["b_fuel_growth:rain_12m"].agg(
    ["count", "median", lambda s: round(float((s > 0).mean()), 2)])
fs.columns = ["units", "median_coef", "share_positive"]
report["fuel_sign_by_aridity"] = fs.round(3).reset_index().astype(str).to_dict("records")
dm = res[res.lead == "0"].groupby("aridity", observed=True)["b_dryness_memory:soil_k"].agg(
    ["median", lambda s: round(float((s < 0).mean()), 2)])
dm.columns = ["median_coef_soil", "share_wetter_means_less_fire"]
report["soil_sign_by_aridity"] = dm.round(3).reset_index().astype(str).to_dict("records")

# 5. calibration of gated forecasts
ocean = e.ocean_indices()
cal = []
for r in res[res.lead.isin(["0", "1", "3"])].itertuples():
    fire = pd.read_csv(f"fire/{r.country}.csv")
    fire = fire[(fire.unit == r.unit) & (fire.cls == r.cls)]
    w = pd.read_csv(f"weather/{r.country}.csv").drop(columns="country")
    w = w[(w.unit == r.unit) & (w.cls == r.cls)].drop(columns=["unit", "cls"]).set_index(["y", "mo"])
    months, _ = e.fire_seasons(fire)[r.season]
    groups = [g for g in r.gated if g != "dryness_now"]
    h = fc.hindcast(fire, w, ocean, int(r.lead), months, r.lat, groups)
    h["lead"], h["gated_any"] = r.lead, len(groups) > 0
    cal.append(h)
cal = pd.concat(cal, ignore_index=True)
cal.to_csv("hindcast.csv", index=False)
calib = []
for lead, d in cal.groupby("lead"):
    for name, dd in (("all units", d), ("units with a gated factor", d[d.gated_any])):
        bs = np.mean((dd.p_above - dd.above) ** 2)
        bs_ref = np.mean((1 / 3 - dd.above) ** 2)
        bins = pd.cut(dd.p_above, [0, .2, .33, .5, .7, 1.0], include_lowest=True)
        rel = dd.groupby(bins, observed=True).agg(forecast=("p_above", "mean"), observed=("above", "mean"),
                                                  n=("above", "size")).round(2)
        calib.append({"lead": lead, "set": name, "n": len(dd), "brier_skill_above_normal": round(1 - bs / bs_ref, 3),
                      "reliability": rel.reset_index(drop=True).to_dict("records")})
report["calibration"] = calib
# 6. forward test 2022-2025 (gates chosen on 2003-2021 only)
fw = []
for r in res[res.lead.isin(["0", "1", "3"])].itertuples():
    fire = pd.read_csv(f"fire/{r.country}.csv")
    fire = fire[(fire.unit == r.unit) & (fire.cls == r.cls)]
    w = pd.read_csv(f"weather/{r.country}.csv").drop(columns="country")
    w = w[(w.unit == r.unit) & (w.cls == r.cls)].drop(columns=["unit", "cls"]).set_index(["y", "mo"])
    months, _ = e.fire_seasons(fire)[r.season]
    groups = [g for g in r.gated if g != "dryness_now"]
    if not groups:
        continue
    out = fc.forward(fire, w, ocean, int(r.lead), months, r.lat, groups)
    base = fc.forward(fire, w, ocean, int(r.lead), months, r.lat, [])
    out = out.merge(base[["y", "mo", "p_above"]].rename(columns={"p_above": "p_hist"}), on=["y", "mo"])
    out["lead"] = r.lead
    fw.append(out)
fw = pd.concat(fw, ignore_index=True)
fw.to_csv("forward.csv", index=False)
fwd = []
for lead, d in fw.groupby("lead"):
    bs, bh = np.mean((d.p_above - d.above) ** 2), np.mean((d.p_hist - d.above) ** 2)
    fwd.append({"lead": lead, "n": len(d), "brier_engine": round(bs, 4), "brier_history": round(bh, 4),
                "skill_vs_history": round(1 - bs / bh, 3),
                "corr_pred_obs": round(float(np.corrcoef(d.pred, d.obs)[0, 1]), 3),
                "observed_above_rate": round(float(d.above.mean()), 2)})
report["forward_test"] = fwd
print(pd.DataFrame(fwd).to_string(index=False))
json.dump(report, open("report.json", "w"), indent=1, default=str)
print(json.dumps({k: report[k] for k in ("null_thresholds", "pass_rates", "fuel_sign_by_aridity",
                                          "soil_sign_by_aridity")}, indent=1, default=str))
for c in calib:
    print(c["lead"], c["set"], "n", c["n"], "BSS", c["brier_skill_above_normal"])
    print("   ", c["reliability"])
