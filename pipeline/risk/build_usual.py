#!/usr/bin/env python3
"""Build model chance medians by land square and calendar month."""
import argparse
from pathlib import Path
import duckdb

DATA = Path(__file__).resolve().parents[2] / 'data/derived/risk'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=DATA)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--month', type=int, choices=range(1, 13))
    args = parser.parse_args()
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='8GB'")
    paths = [str(args.data / f'predictions_{year}_v2.parquet') for year in (2024, 2025)]
    # The month filter allows a live export to build only the months it needs.
    where = 'WHERE month(day) = ?' if args.month else ''
    query = f'''COPY (SELECT spot_id, month(day)::INTEGER AS month,
        CASE WHEN count(p) >= 10 THEN median(p) ELSE NULL END AS usual
        FROM read_parquet(?) {where} GROUP BY spot_id, month(day)) TO ? (FORMAT PARQUET)'''
    con.execute(query, [paths, *([args.month] if args.month else []), str(args.output)])


if __name__ == '__main__':
    main()
