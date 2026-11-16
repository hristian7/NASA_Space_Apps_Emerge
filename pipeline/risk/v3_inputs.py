#!/usr/bin/env python3
"""Turn the stored GFS runs into the v3 weather inputs, one parquet per month.

Rows are keyed by valid day D (run D-2). The dry spell counts days from the
last day with at least 1 mm of rain to D, where each day's rain is the first
24 hours of that day's own run, so only runs issued by the end of D-2 are used.
Before the first wet day in the archive the dry spell is missing.
"""
import argparse
import datetime as dt
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
V3 = ROOT / 'data/derived/risk/v3'
WET_MM = 1.0
MAX_DRY_DAYS = 120


RUN_FIELDS = ('tmax_c', 'rh_min', 'wind_max', 'wind_u', 'wind_v', 'gust_max', 'rain_d', 'rain_r1', 'rain_next3')


def derive(ids, day, fields, last_wet):
    """Weather inputs for valid day D from the run of D-2 and the last wet day per spot (ordinal)."""
    dry = np.minimum(day.toordinal() - last_wet, MAX_DRY_DAYS)
    blowing_from = np.arctan2(-fields['wind_u'], -fields['wind_v'])
    return pa.table({
        'spot_id': pa.array(ids), 'day': pa.array([day] * len(ids), type=pa.date32()),
        'tmax_c': fields['tmax_c'], 'rh_min': fields['rh_min'], 'wind_max': fields['wind_max'],
        'wind_dir_sin': np.sin(blowing_from), 'wind_dir_cos': np.cos(blowing_from),
        'gust_max': fields['gust_max'], 'rain_d': fields['rain_d'], 'rain_d1': fields['rain_r1'],
        'rain_next3': fields['rain_next3'],
        'days_since_rain': pa.array(dry, mask=~np.isfinite(dry))})


def weather(source=V3 / 'gfs_0.25', out=V3 / 'weather_0.25'):
    out.mkdir(parents=True, exist_ok=True)
    last_wet = None
    spots = None
    for path in sorted(source.glob('*.parquet')):
        table = pq.read_table(path)
        pieces = []
        for run in sorted(set(table.column('run').to_pylist())):
            part = table.filter(pc.equal(table.column('run'), pa.scalar(run, pa.date32())))
            ids = part.column('spot_id').to_numpy()
            if spots is None:
                spots = ids
                last_wet = np.full(len(ids), np.nan)
            elif not np.array_equal(ids, spots):
                raise ValueError(f'{path.name} {run}: spot order changed')
            col = lambda name: part.column(name).to_numpy().astype(np.float64)
            last_wet[col('rain_r0') >= WET_MM] = run.toordinal()
            fields = {name: col(name) for name in RUN_FIELDS}
            pieces.append(derive(ids, run + dt.timedelta(days=2), fields, last_wet))
        dest = out / path.name
        tmp = dest.with_suffix('.tmp')
        pq.write_table(pa.concat_tables(pieces), tmp, compression='zstd')
        tmp.replace(dest)
        print('weather inputs', path.stem, len(pieces), 'days', flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('step', choices=('weather',))
    ap.parse_args()
    weather()


if __name__ == '__main__':
    main()
