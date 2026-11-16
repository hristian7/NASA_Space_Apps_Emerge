#!/usr/bin/env python3
"""Write model v3 predictions in the registered plug-in format (grid_g, spot_id, day, p).

Every land spot appears for every day; p is null where a v2 input is missing,
the same availability rule as lightgbm-v2. Added inputs may be missing.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import tempfile

import duckdb
import lightgbm as lgb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from features import feature_sql
import v3_select as sel

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
SCHEMA = pa.schema([('grid_g', pa.float64()), ('spot_id', pa.int64()), ('day', pa.date32()), ('p', pa.float64())],
                   metadata={b'grid_g': b'0.25'})


def months(start, end):
    month = dt.date(start.year, start.month, 1)
    while month <= end:
        yield month
        month = (month.replace(day=28) + dt.timedelta(days=4)).replace(day=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=dt.date.fromisoformat, required=True)
    ap.add_argument('--end', type=dt.date.fromisoformat, required=True)
    ap.add_argument('--model', type=Path, default=DATA / 'model_v3.json')
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--threads', type=int, default=4)
    ap.add_argument('--data', type=Path, default=DATA, help='folder with grid, fwi_0.25 and history_0.25')
    ap.add_argument('--v3-dir', type=Path, default=DATA / 'v3', help='folder with the people map and weather_0.25')
    args = ap.parse_args()
    model = json.loads(args.model.read_text())
    booster = lgb.Booster(model_file=str(args.model.parent / model['booster_file']))
    groups, names = model['input_groups'], model['features']
    if names != sel.features(groups) or booster.feature_name() != names:
        raise SystemExit('model inputs differ from the v3 feature definitions')
    sel.LIMITS.update(threads=args.threads, memory_gb=4)
    con = sel.connect(args.data)
    grid = str(args.data / 'grid_0.25.parquet')
    n_spots = con.execute('SELECT count(*) FROM read_parquet(?)', [grid]).fetchone()[0]
    tmp = args.out.with_suffix('.tmp')
    writer = pq.ParquetWriter(tmp, SCHEMA, compression='zstd')
    total = valid_total = 0
    try:
        with tempfile.TemporaryDirectory() as scratch:
            for month in months(args.start, args.end):
                weather = [p for p in sorted((args.data / 'fwi_0.25' / f'month={month:%Y-%m}').glob('*.parquet'))
                           if args.start <= dt.date.fromisoformat(p.stem) <= args.end]
                history = args.data / 'history_0.25' / f'month={month:%Y-%m}' / 'history.parquet'
                if not weather or not history.exists():
                    raise SystemExit(f'missing fire weather or history for {month:%Y-%m}')
                base = Path(scratch) / f'{month:%Y-%m}.parquet'
                con.execute(f"""COPY (SELECT f.spot_id, f.day, {feature_sql()}
                    FROM read_parquet(?, hive_partitioning=false) f JOIN read_parquet(?) g USING(spot_id)
                    JOIN read_parquet(?) h ON h.spot_id=f.spot_id AND h.day=f.day
                    ORDER BY f.day, f.spot_id) TO ? (FORMAT parquet)""",
                            [[str(p) for p in weather], grid, str(history), str(base)])
                x, other = sel.load(con, str(base), groups, names, extras=('spot_id', 'day'), v3_dir=args.v3_dir)
                raw = booster.predict(x, raw_score=True, num_threads=args.threads)
                z = np.clip(model['calibration_slope'] * raw + model['calibration_intercept'], -700, 700)
                scored = pa.table({'spot_id': pa.array(other['spot_id']),
                                   'day': pa.array(other['day'], type=pa.date32()),
                                   'p': pa.array(1 / (1 + np.exp(-z)))})
                con.register('scored', scored)
                table = con.execute("""SELECT 0.25::DOUBLE AS grid_g, f.spot_id::BIGINT AS spot_id, f.day::DATE AS day, s.p
                    FROM read_parquet(?) f LEFT JOIN scored s USING(spot_id, day)
                    ORDER BY f.day, f.spot_id""", [str(base)]).to_arrow_table()
                con.unregister('scored')
                days = len(weather)
                if table.num_rows != n_spots * days:
                    raise SystemExit(f'{month:%Y-%m}: expected {n_spots * days} rows, got {table.num_rows}')
                writer.write_table(table.cast(SCHEMA))
                total += table.num_rows
                valid_total += len(raw)
                print(f'{month:%Y-%m}', days, 'days, rows', table.num_rows, 'with p', len(raw), flush=True)
                base.unlink()
    except BaseException:
        writer.close()
        tmp.unlink(missing_ok=True)
        raise
    writer.close()
    tmp.replace(args.out)
    print('wrote', args.out, 'rows', total, 'with p', valid_total, flush=True)


if __name__ == '__main__':
    main()
