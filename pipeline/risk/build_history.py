#!/usr/bin/env python3
"""Build cutoff-safe spot-day history for the available forecast days."""
import argparse
import calendar
import datetime as dt
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--start', type=dt.date.fromisoformat, default=dt.date(2024, 1, 1))
    p.add_argument('--end', type=dt.date.fromisoformat, default=dt.date(2025, 12, 31))
    p.add_argument('--data', type=Path, default=DATA)
    args = p.parse_args()
    if args.end < args.start:
        p.error('end precedes start')
    by_month = {}
    for f in sorted((args.data / 'fwi_0.25').glob('month=*/*.parquet')):
        day = dt.date.fromisoformat(f.stem)
        if args.start <= day <= args.end:
            by_month.setdefault(day.strftime('%Y-%m'), []).append(day)
    if not by_month:
        raise SystemExit('No forecast days found in the requested range')
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='6GB'")
    con.execute('SET temp_directory=?', [str(args.data / 'duckdb_tmp')])
    labels = str(args.data / 'labels_0.25.parquet')
    grid = str(args.data / 'grid_0.25.parquet')
    con.execute('CREATE TEMP TABLE fire AS SELECT spot_id, day FROM read_parquet(?)', [labels])
    con.execute('CREATE TEMP TABLE grid AS SELECT spot_id FROM read_parquet(?)', [grid])
    for month, days in by_month.items():
        year, mon = map(int, month.split('-'))
        first, last = min(days), max(days)
        first_cutoff = first - dt.timedelta(days=2)
        last_cutoff = last - dt.timedelta(days=2)
        eligible_years = year - (2018 if mon >= 4 else 2019)
        if eligible_years < 0:
            eligible_years = 0
        print('building history', month, 'days', len(days), flush=True)
        con.execute('CREATE OR REPLACE TEMP TABLE days(day DATE)')
        con.executemany('INSERT INTO days VALUES (?)', [(d,) for d in days])
        con.execute("""
          CREATE OR REPLACE TEMP TABLE annual AS
          SELECT spot_id, count(DISTINCT year(day)) AS fire_years,
                 bool_or(year(day) = ?) AS last_year_same_month
          FROM fire WHERE year(day) < ? AND month(day)=? GROUP BY spot_id
        """, [year-1, year, mon])
        # Preserve just the last event before the month and all events during it.
        con.execute("""
          CREATE OR REPLACE TEMP TABLE recent AS
          SELECT spot_id, max(day) AS fire_day FROM fire WHERE day <= ? GROUP BY spot_id
          UNION ALL
          SELECT spot_id, day AS fire_day FROM fire WHERE day > ? AND day <= ?
        """, [first_cutoff, first_cutoff, last_cutoff])
        con.execute("""
          CREATE OR REPLACE TEMP TABLE nearby AS
          SELECT DISTINCT (floor(f.spot_id/1440)::INTEGER + dr) * 1440 +
                          ((f.spot_id%1440 + dc + 1440)%1440) AS spot_id,
                          f.day + lag::INTEGER AS day
          FROM fire f
          CROSS JOIN range(-1,2) r(dr) CROSS JOIN range(-1,2) c(dc)
          CROSS JOIN range(2,5) l(lag)
          WHERE f.day BETWEEN ?::DATE - 4 AND ?::DATE - 2
            AND floor(f.spot_id/1440)::INTEGER + dr BETWEEN 0 AND 719
        """, [first, last])
        folder = args.data / 'history_0.25' / f'month={month}'
        folder.mkdir(parents=True, exist_ok=True)
        temp = folder / 'history.parquet.tmp'
        con.execute("""
          COPY (
            WITH base AS (
              SELECT g.spot_id,d.day,d.day-2 AS cutoff,
                     CASE WHEN ? = 0 THEN NULL ELSE coalesce(a.fire_years,0)::DOUBLE / ? END AS hist_p,
                     coalesce(a.last_year_same_month,FALSE) AS last_year_same_month
              FROM grid g CROSS JOIN days d LEFT JOIN annual a USING (spot_id)
            ), recent_base AS (
              SELECT b.*,r.fire_day FROM base b
              ASOF LEFT JOIN recent r ON b.spot_id=r.spot_id AND b.cutoff>=r.fire_day
            )
            SELECT b.spot_id,b.day,b.hist_p,b.last_year_same_month,
                   date_diff('day',b.fire_day,b.day) AS days_since_last_fire,
                   n.spot_id IS NOT NULL AS fire_near_3d
            FROM recent_base b LEFT JOIN nearby n ON b.spot_id=n.spot_id AND b.day=n.day
            ORDER BY b.day,b.spot_id
          ) TO ? (FORMAT parquet, COMPRESSION zstd)
        """, [eligible_years, max(eligible_years, 1), str(temp)])
        temp.replace(folder / 'history.parquet')
        print('finished history', month, flush=True)


if __name__ == '__main__':
    main()
