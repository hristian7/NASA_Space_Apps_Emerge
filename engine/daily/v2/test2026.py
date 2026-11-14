"""Out-of-sample check on 2026 so far (1 Jan to the last day with NOAA-20 data), a year
the models never saw: not in training (2019-2023), validation (2024) or test (2025).

Same inputs as the live outlook (live2.py): GEOS-5 run and analysis of t-2, NOAA-20
fires from the firms-catalog mirror, the committed models. Same scorecard as the
2025 test (score2.py). Days when NOAA-20 was down (no detections while NOAA-21 saw
at least 3 in Bulgaria) are skipped.

usage: python3 test2026.py [all|new]   -> res2026_<lead>_<label>.json and a summary
"""
import json, os, sys
import numpy as np, pandas as pd, duckdb
os.environ.setdefault("ISSUE", "2026-11-14")
import live2                      # builds the live builder (fires to ISSUE)
import score2
f2, b = live2.f2, live2.b
C = len(b.cells)
HERE = live2.HERE

con = duckdb.connect()
q = con.execute(f"""SELECT acq_date, satellite, count(*) n FROM '{HERE}/cat2026/bg_viirs_2026.parquet'
    WHERE lower(substr(confidence,1,1)) IN ('n','h') AND lat BETWEEN 41.2 AND 44.25 AND lon BETWEEN 22.3 AND 28.7
    GROUP BY ALL""").df()
piv = q.pivot_table(index="acq_date", columns="satellite", values="n", fill_value=0)
out_days = {pd.Timestamp(d) for d, r in piv.iterrows() if r.get("NOAA-20", 0) == 0 and r.get("NOAA-21", 0) >= 3}
first, last = pd.Timestamp("2026-01-01"), live2.ISSUE
summary = {}
LABELS = [a for a in sys.argv[1:] if a in ("all", "new")] or ["all", "new"]
sys.argv = sys.argv[:1]
for LAB_NAME in LABELS:
    LAB = b.NEW if LAB_NAME == "new" else (b.F == 1)
    for L in (1, 2, 3):
        days = np.array([f2.DAYS.get_loc(d) for d in pd.date_range(first + pd.Timedelta(days=L + 2), last)
                         if d not in out_days and (d - pd.Timedelta(days=1)) not in out_days
                         and (d - pd.Timedelta(days=2)) not in out_days])
        P = np.zeros((len(days), C), np.float32)
        base = {k: np.zeros((len(days), C), np.float32) for k in ("fwi", "history", "last_week")}
        for chunk in np.array_split(np.arange(len(days)), max(1, len(days) // 20)):
            d = np.repeat(days[chunk], C); c = np.tile(np.arange(C), len(chunk))
            X = b.X(d, c, L)
            px, _, _ = live2.predict(f"L{L}_{LAB_NAME}_xgb", X)
            pm, _, _ = live2.predict(f"L{L}_{LAB_NAME}_mlp", X)
            P[chunk] = ((px + pm) / 2).reshape(len(chunk), C)
            base["fwi"][chunk] = np.nan_to_num(X.fc_FWI.to_numpy(), nan=-1).reshape(len(chunk), C)
            base["history"][chunk] = (X.clim_month + 1e-3 * X.years_burned_month + 1e-6 * X.clim_all).to_numpy().reshape(len(chunk), C)
            base["last_week"][chunk] = (X.hist_nbr7 + 1e-3 * X.clim_month).to_numpy().reshape(len(chunk), C)
        r = score2.score(b, days, P, base, LAB)
        r["period"] = [f2.DAYS[days[0]].strftime("%Y-%m-%d"), f2.DAYS[days[-1]].strftime("%Y-%m-%d")]
        r["noaa20_outage_days_skipped"] = len(out_days)
        json.dump(r, open(f"res2026_L{L}_{LAB_NAME}.json", "w"), indent=1, default=float)
        k = r["k_spots_per_municipality_15km"]; c5 = r["top5_per_province_spot10"]; a = r["municipality_ranking_auc"]
        summary[f"L{L}_{LAB_NAME}"] = {
            "days": r["days"], "fires": r["target_fires_cells"],
            "1spot": k["model"]["top1"], "3spots": k["model"]["top3"], "1spot_lastweek": k["last_week"]["top1"],
            "1spot_random": k["random"]["top1"], "top5prov_11km": c5["model"]["capture"],
            "top5prov_11km_history": c5["history"]["capture"], "top5prov_11km_fwi": c5["fwi"]["capture"],
            "ci_vs_history": c5["model_minus_baseline_capture_95ci"]["history"],
            "muni_auc": a["model"]["any"], "muni_auc_fwi": a["fwi"]["any"]}
        print(L, LAB_NAME, summary[f"L{L}_{LAB_NAME}"], flush=True)
json.dump(summary, open(f"res2026_summary_{'_'.join(LABELS)}.json", "w"), indent=1, default=float)
