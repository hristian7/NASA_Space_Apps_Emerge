#!/usr/bin/env python3
"""Build the v3 people inputs on the 0.25 degree grid: one fixed map per input.

Sources and licences (checked 2026-11-15):
  GPW v4.11 population density 2020, 15 arc-minute, NASA SEDAC, CC BY 4.0.
  GRIP4 total road density, 5 arc-minute, PBL Netherlands, CC0.
  GHSL GHS-BUILT-S R2023A epoch 2020, 30 arc-second, European Commission JRC, CC BY 4.0.
The GHSL release is from 2023, after the first training days; the gap is
recorded in the plan 3 protocol. Evaluation days are all after publication.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw'
DATA = ROOT / 'data/derived/risk'
GPW = RAW / 'gpw/gpw_v4_population_density_rev11_2020_15_min.asc'
GRIP_DENSITY = RAW / 'grip4/grip4_total_dens_m_km2.asc'
GRIP_AREA = RAW / 'grip4/grip4_area_land_km2.asc'
GHSL_ZIP = RAW / 'ghsl/ghs_built_s_2020_30ss.zip'


def read_ascii(path):
    """Arc ASCII grid, north row first, with its header checked against the world extent."""
    header = {}
    with open(path) as handle:
        for _ in range(6):
            key, value = handle.readline().split()
            header[key.lower()] = float(value)
        values = np.loadtxt(handle, dtype=np.float64)
    if header['xllcorner'] != -180 or header['yllcorner'] != -90:
        raise ValueError(f'{path.name} is not a world grid')
    if values.shape != (int(header['nrows']), int(header['ncols'])):
        raise ValueError(f'{path.name} has an unexpected shape')
    values[values == header['nodata_value']] = np.nan
    return values


def block(values, factor):
    rows, cols = values.shape
    return values.reshape(rows // factor, factor, cols // factor, factor)


def cell_area_km2(rows=720, size=0.25):
    radius = 6371.0072
    top = np.radians(90 - np.arange(rows) * size)
    bottom = np.radians(90 - (np.arange(rows) + 1) * size)
    band = radius ** 2 * np.radians(size) * (np.sin(top) - np.sin(bottom))
    return np.repeat(band[:, None], 1440, axis=1)


def built_share():
    if not GHSL_ZIP.exists():
        return None
    inner = 'GHS_BUILT_S_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif'
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'built.asc'
        warped = Path(tmp) / 'built.tif'
        # Built-up surface is square metres per source cell, so summing keeps the total.
        subprocess.run(['gdalwarp', '-q', '-ovr', 'NONE', '-r', 'sum', '-te', '-180', '-90', '180', '90',
                        '-tr', '0.25', '0.25', '-ot', 'Float64', '-dstnodata', '-9999',
                        f'/vsizip/{GHSL_ZIP}/{inner}', str(warped)], check=True)
        subprocess.run(['gdal_translate', '-q', '-of', 'AAIGrid', str(warped), str(out)], check=True)
        built_m2 = read_ascii(out)
    return np.clip(built_m2 / (cell_area_km2() * 1e6), 0, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', type=Path, default=DATA / 'v3/people_0.25.parquet')
    args = ap.parse_args()
    population = read_ascii(GPW)
    if population.shape != (720, 1440):
        raise ValueError('GPW grid must be 0.25 degrees')
    density = read_ascii(GRIP_DENSITY)
    land = read_ascii(GRIP_AREA)
    weight = np.where(np.isfinite(density) & np.isfinite(land), land, 0.0)
    total = np.nansum(block(np.nan_to_num(density) * weight, 3), axis=(1, 3))
    area = block(weight, 3).sum(axis=(1, 3))
    roads = np.where(area > 0, total / np.where(area > 0, area, 1), np.nan)
    built = built_share()
    flat = {'spot_id': np.arange(720 * 1440, dtype=np.int64),
            'pop_density_log': np.log1p(population).ravel(),
            'road_density_log': np.log1p(roads).ravel()}
    if built is not None:
        flat['built_share'] = built.ravel()
    table = pa.table({k: (pa.array(v, mask=~np.isfinite(v)) if v.dtype.kind == 'f' else pa.array(v))
                      for k, v in flat.items()})
    con = duckdb.connect()
    con.register('people', table)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    con.execute("""COPY (SELECT p.* FROM people p JOIN read_parquet(?) g USING(spot_id) ORDER BY spot_id)
                   TO ? (FORMAT parquet, COMPRESSION zstd)""", [str(DATA / 'grid_0.25.parquet'), str(args.out)])
    columns = [c for c in flat if c != 'spot_id']
    summary = con.execute('SELECT count(*), ' + ', '.join(f'count({c}), avg({c})' for c in columns)
                          + ' FROM read_parquet(?)', [str(args.out)]).fetchone()
    print('wrote', args.out, 'rows', summary[0], dict(zip(columns, zip(summary[1::2], summary[2::2]))))


if __name__ == '__main__':
    main()
