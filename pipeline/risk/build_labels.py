#!/usr/bin/env python3
"""Build NOAA-20 spot-day labels after applying the static-source mask."""
from pathlib import Path
import duckdb

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT / 'data/derived/world'
OUT = ROOT / 'data/derived/risk'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute('SET threads=6')
    con.execute("SET memory_limit='12GB'")
    con.execute('SET temp_directory=?', [str(OUT / 'duckdb_tmp')])
    files = [str(WORLD / 'cell_days.parquet'), str(WORLD / 'cell_days_2026.parquet')]
    mask = str(WORLD / 'static_mask.parquet')
    print('Aggregating unmasked NOAA20 detections', flush=True)
    con.execute("""
      CREATE TEMP TABLE fire AS
      SELECT CAST(greatest(0, least(719, floor((8999-cy)/25))) AS INTEGER) AS row,
             CAST(((floor((cx+18000)/25)::INTEGER % 1440) + 1440) % 1440 AS INTEGER) AS col,
             CAST(day AS DATE) AS day
      FROM read_parquet(?) d
      ANTI JOIN read_parquet(?) m USING (cy,cx)
      WHERE sat='NOAA20' AND day BETWEEN DATE '2018-04-01' AND DATE '2026-11-14'
      GROUP BY ALL
    """, [files, mask])
    print('spot-days:', con.execute('SELECT count(*) FROM fire').fetchone()[0], flush=True)
    print('Finding previous neighbouring detections', flush=True)
    con.execute("""
      CREATE TEMP TABLE continuing AS
      SELECT DISTINCT f.row, f.col, f.day
      FROM fire f
      CROSS JOIN range(-1,2) a(dr)
      CROSS JOIN range(-1,2) b(dc)
      CROSS JOIN range(1,3) c(lag)
      SEMI JOIN fire p ON p.row=f.row+a.dr
                        AND p.col=(f.col+b.dc+1440)%1440
                        AND p.day=f.day-c.lag::INTEGER
    """)
    temp = OUT / 'labels_0.25.parquet.tmp'
    con.execute("""
      COPY (SELECT f.row * 1440 + f.col AS spot_id, f.day,
                   CASE WHEN c.day IS NULL THEN 'new' ELSE 'continuing' END AS label
            FROM fire f LEFT JOIN continuing c USING (row,col,day)
            ORDER BY spot_id, day)
      TO ? (FORMAT parquet, COMPRESSION zstd)
    """, [str(temp)])
    temp.replace(OUT / 'labels_0.25.parquet')
    print('labels:', con.execute("SELECT label,count(*) FROM read_parquet(?) GROUP BY 1 ORDER BY 1", [str(OUT / 'labels_0.25.parquet')]).fetchall(), flush=True)


if __name__ == '__main__':
    main()
