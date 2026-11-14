#!/usr/bin/env python3
"""Clean FIRMS hot spots and count fire cell-days, per satellite.

Implements step 1 of docs/harmonization-plan.md:
  - keep vegetation fires only (type == 0)
  - MODIS confidence >= 30; VIIRS confidence 'n' or 'h'
  - a cell (0.01 degrees, about 1 km) counts once per day per satellite

Needs the duckdb command-line tool. Outputs Parquet files in data/derived/<name>/:
  cell_days.parquet      one row per cell, day and satellite
  monthly.parquet        cell-days, detections and FRP per country, satellite and month

Usage:
  python3 pipeline/build_cells.py --name bg_us --countries Bulgaria United_States
  python3 pipeline/build_cells.py --name world --all
"""

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
CELL = 100  # cells per degree: 0.01 degrees, about 1.1 km north-south


def globs(sensor: str, countries: list[str] | None) -> str:
    if not countries:
        return f"['{RAW}/{sensor}/*/*.csv']"
    return "[" + ",".join(f"'{RAW}/{sensor}/*/{sensor}_*_{c}.csv'" for c in countries) + "]"


def sql(out: Path, countries: list[str] | None) -> str:
    def read(sensor: str) -> str:
        return f"""
        SELECT '{'modis' if sensor == 'modis' else 'viirs'}' AS sensor,
               CASE satellite WHEN 'N' THEN 'SNPP' WHEN 'N20' THEN 'NOAA20'
                              WHEN '1' THEN 'NOAA20' ELSE satellite END AS sat,
               regexp_extract(filename, '_\\d{{4}}_(.+)\\.csv$', 1) AS country,
               latitude, longitude, CAST(acq_date AS DATE) AS day, daynight,
               CAST(confidence AS VARCHAR) AS conf, frp, type
        FROM read_csv({globs(sensor, countries)}, filename = true, union_by_name = true,
                      types = {{'confidence': 'VARCHAR', 'acq_time': 'VARCHAR', 'satellite': 'VARCHAR'}})"""

    return f"""
    SET threads = 8;
    CREATE TEMP TABLE hot AS
    SELECT * FROM ({read('modis')} UNION ALL {read('viirs-snpp')} UNION ALL {read('viirs-jpss1')})
    WHERE type = 0
      AND ((sensor = 'modis' AND TRY_CAST(conf AS INTEGER) >= 30)
        OR (sensor = 'viirs' AND conf IN ('n', 'h')))
      AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
      AND frp >= 0;

    COPY (
      SELECT sensor, sat, country, day,
             CAST(floor(latitude * {CELL}) AS INTEGER) AS cy,
             CAST(floor(longitude * {CELL}) AS INTEGER) AS cx,
             count(*) AS detections,
             sum(frp) AS frp,
             bool_or(daynight = 'D') AS seen_day,
             bool_or(daynight = 'N') AS seen_night
      FROM hot GROUP BY ALL
    ) TO '{out}/cell_days.parquet' (FORMAT parquet, COMPRESSION zstd);

    COPY (
      SELECT sensor, sat, country, year(day) AS year, month(day) AS month,
             count(*) AS cell_days, sum(detections) AS detections, sum(frp) AS frp
      FROM '{out}/cell_days.parquet' GROUP BY ALL ORDER BY ALL
    ) TO '{out}/monthly.parquet' (FORMAT parquet);

    SELECT 'raw rows kept' AS what, count(*) AS n FROM hot
    UNION ALL SELECT 'cell-days', count(*) FROM '{out}/cell_days.parquet';
    """


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--countries", nargs="*", default=[])
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    if not a.all and not a.countries:
        ap.error("give --countries or --all")
    out = ROOT / "data" / "derived" / a.name
    out.mkdir(parents=True, exist_ok=True)
    start = time.time()
    r = subprocess.run(["duckdb", "-c", sql(out, None if a.all else a.countries)])
    print(f"finished in {time.time() - start:.0f} s, exit {r.returncode}", flush=True)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
