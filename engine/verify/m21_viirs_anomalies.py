"""V-M21 differential test of the engine's key assumption.

The engine learns from Aqua MODIS ANOMALIES (this month vs the same place's normal)
and claims they carry over to VIIRS, because a sensor factor cancels out of an
anomaly. Test it where both flew, 2012-2021: per unit, compare monthly log
anomalies (each sensor against its own 2012-2021 normal) in the fire season.
Expected if the claim holds: high correlation, slope near 1.
usage: python3 m21_viirs_anomalies.py <viirs_raw_dir> Country [Country ...]
"""
import sys
from pathlib import Path
import duckdb
import numpy as np
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import engine as e

ENG = Path(__file__).resolve().parents[1]
RAW = ENG.parent / "data" / "raw" / "modis"
VRAW = Path(sys.argv[1])
con = duckdb.connect()
rows = []
for c in sys.argv[2:]:
    con.execute(f"""CREATE OR REPLACE TABLE m AS SELECT DISTINCT floor(latitude*100) a, floor(longitude*100) b,
        CAST(acq_date AS DATE) d FROM read_csv('{RAW}/*/modis_*_{c}.csv', union_by_name=true,
        types={{'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}})
        WHERE type=0 AND TRY_CAST(confidence AS INT)>=30 AND satellite IN ('Aqua','A')""")
    con.execute("""CREATE OR REPLACE TABLE cls5 AS SELECT floor(a/5) ga, floor(b/5) gb,
        CASE WHEN count(DISTINCT year(d)) >= 10 THEN 'recurrent' ELSE 'episodic' END cls
        FROM m WHERE year(d) BETWEEN 2003 AND 2021 GROUP BY 1, 2""")
    con.execute(f"""CREATE OR REPLACE TABLE v AS SELECT DISTINCT floor(latitude*100) a, floor(longitude*100) b,
        CAST(acq_date AS DATE) d FROM read_csv('{VRAW}/viirs-snpp_*_{c}.csv', union_by_name=true,
        types={{'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}})
        WHERE type=0 AND confidence IN ('n','h')""")
    q = """SELECT CAST(floor(a/500)*5 AS INT) || '_' || CAST(floor(b/500)*5 AS INT) AS unit,
               coalesce(cls5.cls, 'episodic') AS cls, year(d) y, month(d) mo, count(*) cd
           FROM {t} LEFT JOIN cls5 ON floor(a/5) = ga AND floor(b/5) = gb
           WHERE year(d) BETWEEN 2012 AND 2021 GROUP BY ALL"""
    A = con.execute(q.format(t="m")).df()
    V = con.execute(q.format(t="v")).df()
    fire = pd.read_csv(ENG / "fire" / f"{c}.csv")
    for (unit, cls), g in fire.groupby(["unit", "cls"]):
        if g[g.y.isin(e.TRAIN_YEARS)].cd.sum() < 1900:
            continue
        for season, (months, _) in e.fire_seasons(g).items():
            grid = pd.MultiIndex.from_product([range(2012, 2022), months], names=["y", "mo"])
            grid = grid[~grid.isin(list(e.NO_DATA))]
            def anom(T):
                s = T[(T.unit == unit) & (T.cls == cls)].set_index(["y", "mo"]).cd.reindex(grid).fillna(0)
                l = np.log1p(s)
                return l - l.groupby(level="mo").transform("mean")
            a, v = anom(A), anom(V)
            if a.std() == 0 or v.std() == 0:
                continue
            rows.append({"country": c, "unit": unit, "cls": cls, "season": season,
                         "r": float(np.corrcoef(a, v)[0, 1]),
                         "slope_viirs_on_modis": float(np.polyfit(a, v, 1)[0]),
                         "modis_cd_per_year": int(g[g.y.isin(e.TRAIN_YEARS)].cd.sum() / 19)})
out = pd.DataFrame(rows)
out.to_csv("m21_viirs_anomalies.csv", index=False)
print(out.round(2).to_string(index=False))
print(f"\nUnits {len(out)} | median r {out.r.median():.2f} | median slope {out.slope_viirs_on_modis.median():.2f}"
      f" | units with r > 0.7: {100 * (out.r > 0.7).mean():.0f}%")
