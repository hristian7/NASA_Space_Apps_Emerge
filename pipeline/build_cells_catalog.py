#!/usr/bin/env python3
"""Fire cell-days from the firms-catalog mirror, in the same shape as build_cells.py.

Why a second builder: NASA's yearly country files stop at 31 Dec 2025, so the
record cannot reach today from them. The firms-catalog mirror holds one
GeoParquet file per year, updated hourly, and covers 2000 to today. It also
carries NOAA-21, which has no FIRMS yearly files at all.

Three things differ from the country files, and this script handles each:

1. No latitude or longitude columns. They come from the point geometry with
   ST_Y (latitude) and ST_X (longitude).
2. Near-real-time rows have no `type`, so static industrial heat (gas flares,
   plants, which NASA labels type 2) cannot be dropped by label. A mask of
   0.01 degree cells that history shows are mostly static is built once from
   the yearly country files, and a row with no `type` is dropped when it falls
   in a masked cell. The mirror's own `quality` column says which rows those
   are: `nrt` near-real-time, `sp` science quality. Measured on the 2026 file,
   `type IS NULL` and `quality = 'nrt'` are the same set of rows, and `quality`
   is the explicit marker, so the output's `provisional` column uses it.
3. No country column. Each row is given the country of its 0.25 degree cell,
   from the conversion's cell-to-country table. A cell that table does not
   know gives the country `Unassigned`.

Cleaning is otherwise identical to build_cells.py: vegetation fires only,
MODIS confidence 30 or more, VIIRS confidence `n` or `h`, valid coordinates,
FRP 0 or more; a 0.01 degree cell counts once per day per satellite.

Needs the duckdb command-line tool with its `spatial` extension.

Usage (--data points at the data folder; it defaults to data/ beside this
repo, which is where a plain checkout keeps it, and a separate working copy
has to name it):
  # once: the static-source mask, from the raw yearly country files
  python3 pipeline/build_cells_catalog.py mask
  # then: one mirror year, to cell-days
  python3 pipeline/build_cells_catalog.py year --year 2026
"""

import argparse
import datetime as dt
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CELL = 100  # cells per degree: 0.01 degrees, about 1.1 km north-south
G = 0.25  # the 0.25 degree grid the country table uses
COLS = 1440  # columns in that grid

# a cell is called a static source when history gives it at least this many
# detections and more than half of them are NASA type 2, "other static land
# source". Both are our choice; see docs/research/data-2026.md for the numbers
# the choice produces.
MIN_DETECTIONS = 10
STATIC_SHARE = 0.5

SENSOR_DIRS = ["modis", "viirs-snpp", "viirs-jpss1"]
# the mirror spells platforms out; our table uses short names
SAT_SQL = """CASE satellite
               WHEN 'Terra' THEN 'Terra' WHEN 'Aqua' THEN 'Aqua'
               WHEN 'Suomi-NPP' THEN 'SNPP' WHEN 'NOAA-20' THEN 'NOAA20'
               WHEN 'NOAA-21' THEN 'NOAA21' ELSE satellite END"""


def duck(sql: str, label: str) -> None:
    """Run SQL in the duckdb command-line tool; stop the script if it fails."""
    start = time.time()
    r = subprocess.run(["duckdb", "-c", sql])
    print(f"[{label}] {time.time() - start:.0f} s, exit {r.returncode}", flush=True)
    if r.returncode != 0:
        sys.exit(r.returncode)


def settings(tmp: Path, threads: int, memory: str) -> str:
    tmp.mkdir(parents=True, exist_ok=True)
    return f"""
    SET threads = {threads};
    SET memory_limit = '{memory}';
    SET temp_directory = '{tmp / "duck"}';
    SET preserve_insertion_order = false;
    """


def build_mask(a: argparse.Namespace) -> None:
    """Write the static-source mask from the raw yearly country files.

    Two steps so the expensive one can be reused. Step one reads every raw
    file once and keeps the 0.01 degree cells that ever held a type 2
    detection, with that cell's total detections; it reads all years and all
    sensors, before any cleaning, because the question is what the cell has
    always been, not what passed a confidence test. Step two applies the two
    thresholds. --from-candidates skips step one.
    """
    tmp = Path(a.tmp)
    cand = Path(a.from_candidates) if a.from_candidates else tmp / "mask_candidates.parquet"
    out = Path(a.out)
    if not a.from_candidates:
        files = ",".join(f"'{a.raw}/{s}/*/*.csv'" for s in SENSOR_DIRS)
        duck(
            settings(tmp, a.threads, a.memory)
            + f"""
        COPY (
          SELECT * FROM (
            SELECT CAST(floor(latitude * {CELL}) AS INTEGER) AS cy,
                   CAST(floor(longitude * {CELL}) AS INTEGER) AS cx,
                   count(*) AS n_all,
                   count(*) FILTER (type = 2) AS n_static
            FROM read_csv([{files}], union_by_name = true,
                          types = {{'confidence': 'VARCHAR', 'acq_time': 'VARCHAR',
                                   'satellite': 'VARCHAR'}})
            WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
            GROUP BY 1, 2
          ) WHERE n_static > 0
        ) TO '{cand}' (FORMAT parquet, COMPRESSION zstd);
        """,
            "mask scan",
        )

    duck(
        settings(tmp, a.threads, a.memory)
        + f"""
    COPY (
      SELECT cy, cx, n_all, n_static FROM '{cand}'
      WHERE n_all >= {MIN_DETECTIONS} AND n_static > {STATIC_SHARE} * n_all
      ORDER BY cy, cx
    ) TO '{out}' (FORMAT parquet, COMPRESSION zstd);

    SELECT 'candidate cells (any type 2)' AS what, count(*) AS cells,
           sum(n_static) AS static_detections, sum(n_all) AS all_detections
      FROM '{cand}'
    UNION ALL
    SELECT 'masked cells', count(*), sum(n_static), sum(n_all) FROM '{out}';
    """,
        "mask filter",
    )


def year_sql(a: argparse.Namespace, src: Path, out: Path) -> str:
    """The one statement that turns a mirror year file into cell-days."""
    groups = Path(a.groups)
    mask = Path(a.mask)
    return (
        settings(Path(a.tmp), a.threads, a.memory)
        + f"""
    LOAD spatial;

    CREATE TEMP TABLE hot AS
    WITH raw AS (
      SELECT CASE WHEN sensor = 'MODIS' THEN 'modis' ELSE 'viirs' END AS sensor,
             {SAT_SQL} AS sat,
             acq_date AS day,
             ST_Y(geometry) AS lat, ST_X(geometry) AS lon,
             daynight, frp, type, quality, confidence
      FROM read_parquet('{src}')
    ), kept AS (
      SELECT sensor, sat, day, lat, lon, daynight, frp,
             quality = 'nrt' AS provisional, type IS NULL AS no_type
      FROM raw
      WHERE (type = 0 OR type IS NULL)
        AND ((sensor = 'modis' AND TRY_CAST(confidence AS INTEGER) >= 30)
          OR (sensor = 'viirs' AND confidence IN ('n', 'h')))
        AND lat BETWEEN -90 AND 90 AND lon BETWEEN -180 AND 180
        AND frp >= 0
    )
    SELECT k.sensor, k.sat, k.day, k.daynight, k.frp, k.provisional,
           CAST(floor(k.lat * {CELL}) AS INTEGER) AS cy,
           CAST(floor(k.lon * {CELL}) AS INTEGER) AS cx,
           -- the 0.25 degree cell id of the conversion's country table:
           -- row 0 is the top, longitude 180 wraps to -180, latitude -90 clamps
           LEAST(CAST(floor((90 - k.lat) / {G}) AS INTEGER), 719) * {COLS}
             + CAST(floor((CASE WHEN k.lon >= 180 THEN k.lon - 360 ELSE k.lon END + 180)
                          / {G}) AS INTEGER) % {COLS} AS cell025
    FROM kept k
    WHERE NOT k.no_type
       OR NOT EXISTS (SELECT 1 FROM '{mask}' m
                      WHERE m.cy = CAST(floor(k.lat * {CELL}) AS INTEGER)
                        AND m.cx = CAST(floor(k.lon * {CELL}) AS INTEGER));

    COPY (
      SELECT h.sensor, h.sat,
             CAST(coalesce(g.country, 'Unassigned') AS VARCHAR) AS country,
             h.day,
             h.cy, h.cx,
             count(*) AS detections,
             sum(h.frp) AS frp,
             bool_or(h.daynight = 'D') AS seen_day,
             bool_or(h.daynight = 'N') AS seen_night,
             bool_or(h.provisional) AS provisional
      FROM hot h LEFT JOIN '{groups}' g ON g.cell = h.cell025
      GROUP BY ALL
    ) TO '{out}' (FORMAT parquet, COMPRESSION zstd);

    SELECT 'rows kept after cleaning' AS what, count(*) AS n FROM hot
    UNION ALL SELECT 'cell-days written', count(*) FROM '{out}';
    """
    )


def checks_sql(out: Path, year: int) -> str:
    """The hard limits. Any row printed here is a failure."""
    today = dt.date.today().isoformat()
    return f"""
    SET threads = 4;
    SELECT 'future dates' AS check, count(*) AS bad_rows FROM '{out}' WHERE day > DATE '{today}'
    UNION ALL SELECT 'day outside its year', count(*) FROM '{out}'
      WHERE day < DATE '{year}-01-01' OR day > DATE '{year}-12-31'
    UNION ALL SELECT 'detections not positive', count(*) FROM '{out}' WHERE detections < 1
    UNION ALL SELECT 'frp negative or null', count(*) FROM '{out}' WHERE frp < 0 OR frp IS NULL
    UNION ALL SELECT 'cell off the map', count(*) FROM '{out}'
      WHERE cy < -9000 OR cy > 8999 OR cx < -18000 OR cx > 17999
    UNION ALL SELECT 'sat not one of ours', count(*) FROM '{out}'
      WHERE sat NOT IN ('Terra', 'Aqua', 'SNPP', 'NOAA20', 'NOAA21')
    UNION ALL SELECT 'sensor not one of ours', count(*) FROM '{out}'
      WHERE sensor NOT IN ('modis', 'viirs')
    UNION ALL SELECT 'seen neither day nor night', count(*) FROM '{out}'
      WHERE NOT seen_day AND NOT seen_night
    ORDER BY 1;
    """


def build_year(a: argparse.Namespace) -> None:
    src = Path(a.src) if a.src else a.raw / "firms-catalog" / f"detections_{a.year}.parquet"
    out = Path(a.out) if a.out else a.derived / f"cell_days_{a.year}.parquet"
    if not src.exists():
        sys.exit(f"missing mirror file: {src}")
    for p in (Path(a.mask), Path(a.groups)):
        if not p.exists():
            sys.exit(f"missing input: {p} (run the mask step first)")
    duck(year_sql(a, src, out), f"year {a.year}")
    duck(checks_sql(out, a.year), f"checks {a.year}")
    print(f"wrote {out}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("step", choices=["mask", "year"])
    ap.add_argument("--year", type=int, default=dt.date.today().year)
    ap.add_argument("--src", help="mirror year file; default data/raw/firms-catalog/detections_<year>.parquet")
    ap.add_argument("--out", help="output file; the mask step defaults to static_mask.parquet")
    ap.add_argument("--data", default=str(ROOT / "data"), help="the data folder holding raw/ and derived/")
    ap.add_argument("--mask", help="static-source mask; default derived/world/static_mask.parquet")
    ap.add_argument("--groups", help="cell-to-country table; default derived/world/harmonized/cell_groups.parquet")
    ap.add_argument("--from-candidates", help="reuse a saved candidate-cell file, skipping the raw scan")
    ap.add_argument("--tmp", help="scratch folder; default derived/world/y2026_tmp")
    ap.add_argument("--threads", type=int, default=12)
    ap.add_argument("--memory", default="32GB")
    a = ap.parse_args()
    a.raw = Path(a.data) / "raw"
    a.derived = Path(a.data) / "derived" / "world"
    a.mask = a.mask or str(a.derived / "static_mask.parquet")
    a.groups = a.groups or str(a.derived / "harmonized" / "cell_groups.parquet")
    a.tmp = a.tmp or str(a.derived / "y2026_tmp")
    if a.step == "mask":
        a.out = a.out or a.mask
        build_mask(a)
    else:
        build_year(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
