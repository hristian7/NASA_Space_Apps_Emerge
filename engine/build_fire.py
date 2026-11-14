"""Stage 1 of the Emerge prediction engine: fire targets and weather sample points.

For each country: Aqua MODIS only (one sensor, one overpass time; stable orbit
2003-2021), vegetation fires (type 0), confidence >= 30, fire cell-days on a
0.01-degree grid (about 1 km), summed per month.

Fire is split by KIND, using a physical signature instead of a land-cover map:
  recurrent  the ~5 km cell burned in >= 10 of the 19 years 2003-2021: a landscape
             that burns most years. Fuel that regrows within a year: cropland
             residue, pasture, savanna grass. (At 1 km, crop rotation moves the
             burning field between cells, so the class is judged at 5 km.)
  episodic   the cell burned in fewer years. Fuel that takes years to decades to
             recover: forest, shrubland, peat. Wildfire-like.
The rule has no ground truth here; a land-cover map (MCD12C1) is the upgrade.
(Caveat: the class uses the same years as the training data, a mild leak.)

Weather is sampled at the 1-degree cells holding most of each class's fire
(fire-weighted, not area-weighted).

usage: python3 build_fire.py Country [Country ...]   (country names as in the FIRMS file names)
"""
import os
import sys
from pathlib import Path
import duckdb

RAW = Path(__file__).resolve().parent.parent / "data" / "raw" / "modis"   # pipeline/download_firms.py

TOP_CELLS = 6
TILE = 5                # degrees: the modelling unit (conditions are local)
RECURRENT_YEARS = 10
CLASS_CELL = 5          # in 0.01-degree units: 0.05 degrees, about 5 km


def build(country):
    con = duckdb.connect()
    con.execute(f"""
        CREATE TABLE cd AS
        SELECT DISTINCT floor(latitude * 100) AS a, floor(longitude * 100) AS b,
               CAST(acq_date AS DATE) AS d
        FROM read_csv('{RAW}/*/modis_*_{country}.csv', union_by_name = true,
                      types = {{'confidence': 'VARCHAR', 'acq_time': 'VARCHAR', 'satellite': 'VARCHAR'}})
        WHERE type = 0 AND TRY_CAST(confidence AS INT) >= 30
          AND satellite IN ('Aqua', 'A')""")
    con.execute(f"""
        CREATE TABLE cls5 AS
        SELECT floor(a / {CLASS_CELL}) AS ga, floor(b / {CLASS_CELL}) AS gb,
               CASE WHEN count(DISTINCT year(d)) >= {RECURRENT_YEARS}
                    THEN 'recurrent' ELSE 'episodic' END AS cls
        FROM cd WHERE year(d) BETWEEN 2003 AND 2021 GROUP BY 1, 2""")
    con.execute(f"""
        CREATE TABLE cls AS SELECT DISTINCT a, b, cls5.cls FROM cd
        JOIN cls5 ON floor(cd.a / {CLASS_CELL}) = cls5.ga AND floor(cd.b / {CLASS_CELL}) = cls5.gb""")
    # Cells that burn only outside 2003-2021 get no class; count them as episodic.
    con.execute(f"""
        COPY (SELECT year(d) AS y, month(d) AS mo,
                     CAST(floor(a / {100 * TILE}) * {TILE} AS INT) || '_' ||
                     CAST(floor(b / {100 * TILE}) * {TILE} AS INT) AS unit,
                     coalesce(cls, 'episodic') AS cls, count(*) AS cd, '{country}' AS country
              FROM cd LEFT JOIN cls USING (a, b) GROUP BY ALL ORDER BY ALL)
        TO 'fire/{country}.csv' (HEADER)""")
    con.execute(f"""
        COPY (SELECT * FROM (
                SELECT *, row_number() OVER (PARTITION BY unit, cls ORDER BY n DESC) AS rk FROM (
                  SELECT CAST(floor(a / {100 * TILE}) * {TILE} AS INT) || '_' ||
                         CAST(floor(b / {100 * TILE}) * {TILE} AS INT) AS unit,
                         cls, floor(a / 100) + 0.5 AS lat, floor(b / 100) + 0.5 AS lon, count(*) AS n
                  FROM cd JOIN cls USING (a, b) WHERE year(d) BETWEEN 2003 AND 2021
                  GROUP BY 1, 2, 3, 4)) WHERE rk <= {TOP_CELLS})
        TO 'fire/{country}_points.csv' (HEADER)""")
    return con.execute("""SELECT cls, count(*) FROM cd JOIN cls USING (a, b)
                          WHERE year(d) BETWEEN 2003 AND 2021 GROUP BY cls ORDER BY cls""").fetchall()


if __name__ == "__main__":
    os.makedirs("fire", exist_ok=True)
    for c in sys.argv[1:]:
        print(c, build(c), flush=True)
