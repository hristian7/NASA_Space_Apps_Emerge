#!/usr/bin/env python3
"""Build a reproducible case-control table without sampling away new fires."""
import argparse
from pathlib import Path
import duckdb
from features import feature_sql

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
SEED = 20261114


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--start-year', type=int, default=2021)
    parser.add_argument('--end-year', type=int, default=2025)
    parser.add_argument('--data', type=Path, default=DATA)
    args = parser.parse_args()
    if not 2021 <= args.start_year <= args.end_year <= 2025:
        parser.error('years must be within 2021 to 2025')
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='8GB'")
    con.execute('SET temp_directory=?', [str(args.data / 'duckdb_tmp')])
    con.execute('CREATE TEMP TABLE grid AS SELECT * FROM read_parquet(?)', [str(args.data / 'grid_0.25.parquet')])
    con.execute("CREATE TEMP TABLE labels AS SELECT spot_id,day FROM read_parquet(?) WHERE label='new'", [str(args.data / 'labels_0.25.parquet')])
    out = args.data / 'training_0.25'
    for year in range(args.start_year, args.end_year + 1):
        for month in range(1, 13):
            ym = f'{year:04d}-{month:02d}'
            weather = sorted((args.data / 'fwi_0.25' / f'month={ym}').glob('*.parquet'))
            history = args.data / 'history_0.25' / f'month={ym}' / 'history.parquet'
            if not weather:
                print('no forecast', ym, flush=True)
                continue
            if not history.exists():
                raise SystemExit(f'missing history for {ym}')
            dest = out / f'{ym}.parquet'
            out.mkdir(parents=True, exist_ok=True)
            temp = dest.with_suffix('.tmp')
            # Sampling is keyed by spot and date, independent of scan order.
            sql = f"""COPY (SELECT f.spot_id, f.day, (l.spot_id IS NOT NULL)::INTEGER AS target,
                CASE WHEN l.spot_id IS NOT NULL THEN 1.0 ELSE 20.0 END AS sample_weight,
                {feature_sql()}
              FROM read_parquet(?, hive_partitioning=false) f
              JOIN grid g USING (spot_id)
              JOIN read_parquet(?) h ON h.spot_id=f.spot_id AND h.day=f.day
              LEFT JOIN labels l ON l.spot_id=f.spot_id AND l.day=f.day
              WHERE l.spot_id IS NOT NULL OR hash(f.spot_id,f.day,{SEED}) % 20 = 0
              ORDER BY f.day,f.spot_id)
              TO ? (FORMAT parquet, COMPRESSION zstd, KV_METADATA {{grid_g: '0.25', sample_seed: '{SEED}'}})"""
            con.execute(sql, [[str(p) for p in weather], str(history), str(temp)])
            temp.replace(dest)
            print('built', ym, con.execute('SELECT count(*),sum(target) FROM read_parquet(?)', [str(dest)]).fetchone(), flush=True)


if __name__ == '__main__':
    main()
