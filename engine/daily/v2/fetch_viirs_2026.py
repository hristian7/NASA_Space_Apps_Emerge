"""NOAA-20 / S-NPP / NOAA-21 VIIRS detections for Bulgaria in 2026 from the public firms-catalog
mirror (CC0), for the live outlook's fire history. About 1 minute.

usage: python3 fetch_viirs_2026.py
"""
import os
import duckdb, time
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cat2026'), exist_ok=True)
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cat2026'))
t=time.time()
con=duckdb.connect(); con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET threads=8;")
u='https://data.source.coop/portolan-mirrors/firms-catalog/detections/year=2026/detections.parquet'
con.execute(f"""COPY (SELECT acq_date, satellite, instrument, confidence, type, ST_Y(geometry) lat, ST_X(geometry) lon
  FROM read_parquet('{u}') WHERE ST_X(geometry) BETWEEN 22.3 AND 28.7 AND ST_Y(geometry) BETWEEN 41.2 AND 44.25
  AND instrument='VIIRS') TO 'bg_viirs_2026.parquet' (FORMAT parquet)""")
print(con.execute("SELECT satellite, min(acq_date), max(acq_date), count(*), count(type) FROM 'bg_viirs_2026.parquet' GROUP BY 1").df())
print(time.time()-t)
