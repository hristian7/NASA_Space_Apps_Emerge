#!/usr/bin/env python3
"""Regrid downloaded lead-three GFWED files to the land grid, one file per day."""
import argparse
import datetime as dt
import hashlib
from pathlib import Path
import re

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import xarray as xr

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
PATTERN = re.compile(r'^FWI\.GEOS-5\.Daily\.Default\.(\d{8})00\.(\d{8})\.nc$')
FIELDS = ('fwi', 'ffmc', 'dmc', 'dc', 'isi', 'bui', 'dsr')


def nearest(sorted_values, values):
    right = np.clip(np.searchsorted(sorted_values, values), 0, len(sorted_values)-1)
    left = np.maximum(right-1, 0)
    return np.where(np.abs(values-sorted_values[left]) < np.abs(sorted_values[right]-values), left, right)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw', type=Path, default=DATA / 'raw/gfwed')
    parser.add_argument('--grid', type=Path, default=DATA / 'derived/risk/grid_0.25.parquet')
    parser.add_argument('--out', type=Path, default=DATA / 'derived/risk/fwi_0.25')
    args = parser.parse_args()
    grid_bytes = args.grid.read_bytes()
    grid_hash = hashlib.sha256(grid_bytes).hexdigest()
    grid = pq.read_table(args.grid, columns=['spot_id', 'lat', 'lon'])
    ids = grid['spot_id'].combine_chunks()
    lats = grid['lat'].to_numpy().astype(np.float64)
    lons = ((grid['lon'].to_numpy().astype(np.float64) + 180) % 360) - 180
    processed = skipped = failed = 0
    for source in sorted(args.raw.glob('*.nc')):
        match = PATTERN.fullmatch(source.name)
        if not match:
            print('skip unrecognised name:', source.name, flush=True)
            continue
        run, day = (dt.datetime.strptime(x, '%Y%m%d').date() for x in match.groups())
        if (day-run).days != 3:
            print('skip non-lead-three file:', source.name, flush=True)
            continue
        folder = args.out / f'month={day:%Y-%m}'
        dest = folder / f'{day.isoformat()}.parquet'
        stat = source.stat()
        fingerprint = f'nearest-north-east-v1:{source.name}:{stat.st_size}:{stat.st_mtime_ns}:{grid_hash}'
        if dest.exists():
            metadata = pq.read_metadata(dest).metadata or {}
            if metadata.get(b'input_fingerprint', b'').decode() == fingerprint:
                skipped += 1
                continue
        folder.mkdir(parents=True, exist_ok=True)
        temp = dest.with_suffix('.parquet.tmp')
        try:
            with xr.open_dataset(source, engine='scipy') as ds:
                lat = ds['lat'].values
                lon = ds['lon'].values
                if ds.sizes['time'] != 1 or not (np.all(np.diff(lat) > 0) and np.all(np.diff(lon) > 0)):
                    raise ValueError('unexpected forecast grid')
                yi = nearest(lat, lats)
                # The extra endpoints make the nearest-point search cyclic.
                lon_ext = np.r_[lon[-1]-360, lon, lon[0]+360]
                xi = (nearest(lon_ext, lons)-1) % len(lon)
                cols = {'spot_id': ids,
                        'day': pa.array([day] * len(ids), type=pa.date32()),
                        'run_date': pa.array([run] * len(ids), type=pa.date32())}
                for field in FIELDS:
                    values = ds['GEOS-5_' + field.upper()].transpose('time','lat','lon').values[0, yi, xi]
                    cols[field] = pa.array(values, mask=~np.isfinite(values), type=pa.float32())
            if source.stat().st_size != stat.st_size or source.stat().st_mtime_ns != stat.st_mtime_ns:
                raise ValueError('source changed while reading')
            table = pa.table(cols).replace_schema_metadata({b'input_fingerprint': fingerprint.encode(), b'grid_g': b'0.25'})
            pq.write_table(table, temp, compression='zstd')
            temp.replace(dest)
            processed += 1
            print('processed', day, flush=True)
        except (OSError, ValueError, KeyError, EOFError) as exc:
            temp.unlink(missing_ok=True)
            failed += 1
            print('could not process', source.name, str(exc), flush=True)
    print(f'processed={processed} skipped={skipped} failed={failed}', flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
