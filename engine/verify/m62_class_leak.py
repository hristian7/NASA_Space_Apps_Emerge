"""V-M62 leakage audit for the fire-kind split.

The recurrent/episodic class uses all training years 2003-2021, including each
held-out year: a mild leak. Measure it: rebuild the class from 2003-2011 only
(>= 5 of 9 years, the same 53% share as >= 10 of 19) and count how much of
2012-2021 fire changes class. If little changes, the leak cannot matter much.
"""
import sys
from pathlib import Path
import duckdb

RAW = Path(__file__).resolve().parents[2] / "data" / "raw" / "modis"
countries = open(Path(__file__).resolve().parents[1] / "countries.txt").read().split()
con = duckdb.connect()
tot = same = 0
rows = []
for c in countries:
    con.execute(f"""CREATE OR REPLACE TABLE cd AS SELECT DISTINCT floor(latitude*100) a, floor(longitude*100) b,
        CAST(acq_date AS DATE) d FROM read_csv('{RAW}/*/modis_*_{c}.csv', union_by_name=true,
        types={{'confidence':'VARCHAR','acq_time':'VARCHAR','satellite':'VARCHAR'}})
        WHERE type=0 AND TRY_CAST(confidence AS INT)>=30 AND satellite IN ('Aqua','A')""")
    r = con.execute("""
        WITH full_ AS (SELECT floor(a/5) ga, floor(b/5) gb, count(DISTINCT year(d)) >= 10 AS rec
                       FROM cd WHERE year(d) BETWEEN 2003 AND 2021 GROUP BY 1,2),
             early AS (SELECT floor(a/5) ga, floor(b/5) gb, count(DISTINCT year(d)) >= 5 AS rec
                       FROM cd WHERE year(d) BETWEEN 2003 AND 2011 GROUP BY 1,2),
             late AS (SELECT floor(a/5) ga, floor(b/5) gb FROM cd WHERE year(d) BETWEEN 2012 AND 2021)
        SELECT count(*), sum(CASE WHEN f.rec = coalesce(e.rec, false) THEN 1 ELSE 0 END)
        FROM late l JOIN full_ f USING (ga, gb) LEFT JOIN early e USING (ga, gb)""").fetchone()
    tot += r[0]; same += r[1]
    rows.append((c, round(100 * r[1] / r[0], 1)))
print("Share of 2012-2021 fire cell-days with the same kind either way, by country:")
print(", ".join(f"{c} {p}%" for c, p in rows))
print(f"ALL: {100 * same / tot:.1f}% of {tot:,} cell-days keep their kind")
