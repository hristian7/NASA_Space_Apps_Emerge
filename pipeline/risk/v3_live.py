#!/usr/bin/env python3
"""Live model v3 inputs and predictions for the daily run.

For prediction day D the weather comes from the 00 UTC GFS run of D-2, as in
training. The dry spell needs the last wet day of every spot; it is kept in a
small state file (data/derived/risk/v3_last_wet.parquet) and brought forward
one run at a time, fetching only the first-day rain of any run it missed.

`bootstrap` builds that state from the stored GFS archive; the daily run then
calls `prepare_day` and `predict_day`. Nothing here publishes anything.
"""
import argparse
import datetime as dt
from pathlib import Path
import shutil
import subprocess
import sys

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

import v3_inputs
import v3_weather

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
STATE = 'v3_last_wet.parquet'
CELLS = 720 * 1440


class WeatherUnavailable(RuntimeError):
    """The GFS run needed for this day is not available."""


def read_state(data):
    path = data / STATE
    if not path.exists():
        raise WeatherUnavailable(f'{STATE} is missing; run v3_live.py bootstrap first')
    table = pq.read_table(path)
    through = dt.date.fromisoformat(table.schema.metadata[b'through'].decode())
    last_wet = np.full(CELLS, np.nan)
    ids = table.column('spot_id').to_numpy()
    values = table.column('last_wet').to_numpy(zero_copy_only=False)
    last_wet[ids] = np.where(np.isnan(values), np.nan, values)
    return last_wet, through


def write_state(path, last_wet, through, ids):
    values = last_wet[ids]
    table = pa.table({'spot_id': pa.array(ids), 'last_wet': pa.array(values, mask=~np.isfinite(values))})
    table = table.replace_schema_metadata({b'through': through.isoformat().encode()})
    tmp = path.with_suffix('.tmp')
    pq.write_table(table, tmp, compression='zstd')
    tmp.replace(path)


def land_ids(data):
    return duckdb.execute('SELECT spot_id FROM read_parquet(?) ORDER BY spot_id',
                          [str(data / 'grid_0.25.parquet')]).fetchnumpy()['spot_id']


def first_day_rain(run):
    """Rain in the first 24 hours of a run, for every grid cell, or None when the run is missing."""
    prefix = v3_weather.run_base(run)
    if prefix is None:
        return None
    url, wanted = v3_weather.messages(prefix, 24)
    blob, _ = v3_weather.get(url, wanted['APCP_total'])
    if blob is None or blob[:4] != b'GRIB' or blob[-4:] != b'7777':
        return None
    return np.clip(v3_weather.to_spots(v3_weather.decode(blob, check_origin=True)), 0, None)


def bootstrap(data=DATA):
    """Last wet day per spot from the stored GFS archive, through its newest run."""
    last_wet, through = None, None
    for path in sorted((data / 'v3/gfs_0.25').glob('*.parquet')):
        table = pq.read_table(path, columns=['spot_id', 'run', 'rain_r0'])
        for run in sorted(set(table.column('run').to_pylist())):
            part = table.filter(pc.equal(table.column('run'), pa.scalar(run, pa.date32())))
            ids = part.column('spot_id').to_numpy()
            if last_wet is None:
                last_wet = np.full(CELLS, np.nan)
            wet = ids[part.column('rain_r0').to_numpy() >= v3_inputs.WET_MM]
            last_wet[wet] = run.toordinal()
            through = run
    write_state(data / STATE, last_wet, through, land_ids(data))
    print('dry-spell state through run', through, flush=True)


def prepare_day(day, data, out):
    """Write out/v3/weather_0.25/<day>.parquet and out/v3_last_wet.parquet for prediction day D.

    Raises WeatherUnavailable when the run of D-2 is missing or broken; the
    caller then keeps v2 for that day.
    """
    run = day - dt.timedelta(days=2)
    last_wet, through = read_state(data)
    try:
        result = v3_weather.fetch_run(run)
    except (v3_weather.BadIndex, FileNotFoundError) as error:
        raise WeatherUnavailable(f'GFS run {run}: {error}') from error
    if result is None:
        raise WeatherUnavailable(f'GFS run {run} is not available yet')
    missed = []
    current = through + dt.timedelta(days=1)
    while current < run:
        rain = first_day_rain(current)
        if rain is None:
            missed.append(current.isoformat())
        else:
            last_wet[rain >= v3_inputs.WET_MM] = current.toordinal()
        current += dt.timedelta(days=1)
    if run > through:
        last_wet[result['rain_r0'] >= v3_inputs.WET_MM] = run.toordinal()
    ids = land_ids(data)
    fields = {name: result[name][ids] for name in v3_inputs.RUN_FIELDS}
    table = v3_inputs.derive(ids, day, fields, last_wet[ids])
    folder = out / 'v3' / 'weather_0.25'
    folder.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, folder / f'{day}.parquet', compression='zstd')
    write_state(out / STATE, last_wet, max(run, through), ids)
    return {'gfs_run': run.isoformat(), 'gfs_uploaded': result['last_modified'].isoformat(),
            'missed_rain_runs': missed}


def predict_day(day, data, stage, out_file):
    """v3 predictions for one day from staged v2 inputs plus staged v3 inputs."""
    v3_dir = stage / 'v3'
    shutil.copyfile(data / 'v3' / 'people_0.25.parquet', v3_dir / 'people_0.25.parquet')
    for name in ('model_v3.json', 'model_v3.txt'):
        shutil.copyfile(data / name, stage / name)
    subprocess.run([sys.executable, str(Path(__file__).with_name('v3_predict.py')),
                    '--start', str(day), '--end', str(day), '--model', str(stage / 'model_v3.json'),
                    '--data', str(stage), '--v3-dir', str(v3_dir), '--out', str(out_file)], check=True)


def build_usual(data=DATA):
    """Median v3 chance per spot and calendar month, from the v3 predictions of 2025 and 2026.

    Same rule as build_usual.py for v2 (median when at least 10 days have a value).
    2025 is the settings year and 2026 the test period; neither was used to fit v3.
    """
    files = [str(data / 'v3' / f'predictions_{year}_v3.parquet') for year in (2025, 2026)]
    out = data / 'usual_v3.parquet'
    duckdb.execute("""COPY (SELECT spot_id, month(day)::INTEGER AS month,
        CASE WHEN count(p) >= 10 THEN median(p) ELSE NULL END AS usual
        FROM read_parquet(?) GROUP BY spot_id, month(day)) TO ? (FORMAT parquet, COMPRESSION zstd)""", [files, str(out)])
    print('wrote', out, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('step', choices=('bootstrap', 'usual', 'seed'))
    ap.add_argument('--out', type=Path, help='seed archive path')
    ap.add_argument('--data', type=Path, default=DATA)
    args = ap.parse_args()
    if args.step == 'bootstrap':
        bootstrap(args.data)
    elif args.step == 'usual':
        build_usual(args.data)
    else:
        import daily_v3
        daily_v3.make_seed(args.data, args.out or args.data / 'v3' / 'v3_seed.tar.gz')


if __name__ == '__main__':
    main()
