#!/usr/bin/env python3
"""Write the registered plug-in format, including nulls for unavailable data."""
import argparse
import datetime as dt
import json
from pathlib import Path

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from features import FEATURES, feature_sql

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'


def probabilities(x, model):
    valid = np.isfinite(x).all(axis=1)
    result = np.full(len(x), np.nan)
    if valid.any():
        z = ((x[valid] - np.asarray(model['mean'])) / np.asarray(model['scale'])) @ np.asarray(model['coefficients']) + model['intercept']
        z = np.clip(model['calibration_slope'] * z + model['calibration_intercept'], -700, 700)
        result[valid] = 1 / (1 + np.exp(-z))
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=dt.date.fromisoformat, required=True)
    ap.add_argument('--end', type=dt.date.fromisoformat, required=True)
    ap.add_argument('--model', type=Path, default=DATA / 'model_v1.json')
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    if args.end < args.start:
        ap.error('end precedes start')
    model = json.loads(args.model.read_text())
    if model['features'] != list(FEATURES):
        raise ValueError('model feature schema differs from pipeline')
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='8GB'")
    con.execute('SET temp_directory=?', [str(args.data / 'duckdb_tmp')])
    con.execute('CREATE TEMP TABLE grid AS SELECT * FROM read_parquet(?)', [str(args.data / 'grid_0.25.parquet')])
    schema = pa.schema([('grid_g', pa.float64()), ('spot_id', pa.int64()), ('day', pa.date32()), ('p', pa.float64())], metadata={b'grid_g': b'0.25'})
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix(args.out.suffix + '.tmp')
    writer = pq.ParquetWriter(tmp, schema, compression='zstd')
    try:
        day = args.start
        while day <= args.end:
            weather = args.data / 'fwi_0.25' / f'month={day:%Y-%m}' / f'{day}.parquet'
            hist = args.data / 'history_0.25' / f'month={day:%Y-%m}' / 'history.parquet'
            if weather.exists():
                if not hist.exists():
                    raise ValueError(f'history missing for {day}')
                query = con.execute(f'''SELECT f.spot_id,f.day,{feature_sql()}
                    FROM read_parquet(?) f JOIN grid g USING(spot_id)
                    JOIN read_parquet(?) h ON h.spot_id=f.spot_id AND h.day=f.day
                    WHERE f.day=?''', [str(weather), str(hist), day])
                reader = query.to_arrow_reader(100000)
                n = valid = 0
                for batch in reader:
                    frame = pa.Table.from_batches([batch]).to_pandas()
                    x = frame[list(FEATURES)].to_numpy(dtype=np.float64)
                    p = probabilities(x, model)
                    n += len(p)
                    valid += int(np.isfinite(p).sum())
                    writer.write_table(pa.table({'grid_g': pa.array(np.full(len(p), 0.25)),
                        'spot_id': batch.column(0), 'day': batch.column(1),
                        'p': pa.array(p, mask=~np.isfinite(p))}, schema=schema))
                expected = con.execute('SELECT count(*) FROM grid').fetchone()[0]
                if n != expected:
                    raise ValueError(f'{day}: expected {expected} land spots, got {n}')
            else:
                ids = con.execute('SELECT spot_id FROM grid').fetchnumpy()['spot_id']
                n, valid = len(ids), 0
                writer.write_table(pa.table({'grid_g': pa.array(np.full(n, .25)), 'spot_id': pa.array(ids),
                    'day': pa.array([day]*n, type=pa.date32()), 'p': pa.nulls(n, type=pa.float64())}, schema=schema))
            print(day, 'rows', n, 'available', valid, flush=True)
            day += dt.timedelta(days=1)
    except BaseException:
        writer.close()
        tmp.unlink(missing_ok=True)
        raise
    writer.close()
    tmp.replace(args.out)
    print('wrote', args.out, flush=True)


if __name__ == '__main__':
    main()
