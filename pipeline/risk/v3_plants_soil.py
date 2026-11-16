#!/usr/bin/env python3
"""Plan 3 plants and soil inputs: list, download and grid NASA VIIRS greenness and SMAP.

Needs EARTHDATA_TOKEN in the environment (never written to disk or printed).

Publication rule (PROTOCOL.md, plan 3): an input counts for prediction day D
only if it was published by the end of D-2 UTC. NASA reprocessed both archives,
so the catalogue insert dates of 2021 to 2025 files are re-release dates, not
the day the data first appeared. For those years a fixed lag measured on recent
forward-processed files stands in for the publication date:

  VIIRS VNP13C1: composite start date + VIIRS_LAG_FROM_START_DAYS <= D-2
  SMAP:          measured day + SMAP_LAG_DAYS <= D-2
  (MOD13C1, kept for reference: composite end + MODIS_LAG_DAYS <= D-2)

`lags` re-measures both lags from the catalogue; update the constants only by
a dated note in PROTOCOL.md, never after seeing settings-year scores.

Commands:
  manifest  list granules from NASA CMR into data/raw/<product>/manifest.csv
  lags      print the measured publication lags for the last 12 months
  download  fetch files. VIIRS: each composite (about 150 MB) is gridded to
            0.25 degrees and deleted; --every 2 keeps one composite in two,
            used for the normal years. SMAP: OPeNDAP subset of the AM and PM
            soil moisture layers only, about 4 MB a day
  grid-smap average SMAP onto the 0.25 degree grid, one parquet per month
  ndvi-normal month-by-month greenness normal per spot from 2013 to 2020
"""
import argparse
import csv
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw'
DATA = ROOT / 'data/derived/risk'
CMR = 'https://cmr.earthdata.nasa.gov/search/granules.umm_json'

PRODUCTS = {
    'modis': {'short_name': 'MOD13C1', 'version': '061', 'folder': RAW / 'mod13c1'},
    'smap': {'short_name': 'SPL3SMP_E', 'version': '006', 'folder': RAW / 'smap_l3e'},
    'viirs': {'short_name': 'VNP13C1', 'version': '002', 'folder': RAW / 'vnp13c1'},
}
# Greenness source chosen 2026-11-15: VIIRS VNP13C1 (HDF5, readable with the
# installed GDAL; MOD13C1 is HDF4). Composites start every 8 days and span 16.
# Their catalogue end dates are unreliable (one was inserted before its window
# ended), so the rule counts from the window start. Largest delay from window
# start to catalogue insert among composites starting 2025-11 to 2026-11,
# measured 2026-11-15: 37 days (median 18, 90th percentile 25).
VIIRS_LAG_FROM_START_DAYS = 37
VIIRS_NDVI = '//HDFEOS/GRIDS/VIIRS_Grid_16Day_VI_CMG/Data_Fields/CMG_0.05_Deg_16_days_NDVI'
# Years whose composites form the month-by-month normal; all precede training.
NORMAL_YEARS = range(2013, 2021)
# Largest lag among MOD13C1 composites ending 2025-11 to 2026-11, measured
# 2026-11-15 from CMR insert dates (median 3 days). Conservative by design.
MODIS_LAG_DAYS = 12
# SMAP L3 daily files usually appear the next day (14 Nov 2026 appeared on
# 15 Nov 2026). Measured 2026-11-15 from CMR insert dates.
SMAP_LAG_DAYS = 1
# Oldest SMAP day still used, counted back from the newest usable day [U].
SMAP_LOOKBACK_DAYS = 3
# Last day of the registered plan 3 test period (PROTOCOL.md).
TEST_END = dt.date(2026, 10, 31)
SMAP_LAYERS = ('/Soil_Moisture_Retrieval_Data_AM/soil_moisture',
               '/Soil_Moisture_Retrieval_Data_PM/soil_moisture_pm')
# EASE-Grid 2.0 global 9 km (EPSG:6933) corner coordinates. Checked 2026-11-15 on
# the 14 Nov 2026 file: 96% of gridded cells fall on land spots and values agree
# (r = 0.97) with binning by the file's own latitude and longitude layers.
# GDAL must open the layers with the HDF5 driver; the netCDF driver misplaces them.
EASE2_9KM = (-17367530.44516138, 7314540.83011594, 17367530.44516138, -7314540.83011594)


def newest_modis_end(day):
    """Latest composite end date that may be used for prediction day D."""
    return day - dt.timedelta(days=2 + MODIS_LAG_DAYS)


def newest_viirs_start(day):
    """Latest VIIRS composite start date that may be used for prediction day D."""
    return day - dt.timedelta(days=2 + VIIRS_LAG_FROM_START_DAYS)


def smap_days(day):
    """SMAP measurement days usable for prediction day D, newest first."""
    newest = day - dt.timedelta(days=2 + SMAP_LAG_DAYS)
    return [newest - dt.timedelta(days=k) for k in range(SMAP_LOOKBACK_DAYS)]


def token():
    value = os.environ.get('EARTHDATA_TOKEN')
    if not value:
        raise SystemExit('EARTHDATA_TOKEN is not set; run: source ~/.env.global 2>/dev/null')
    return value


def cmr_granules(product, start, end):
    spec = PRODUCTS[product]
    items, page = [], 1
    while True:
        query = urllib.parse.urlencode({'short_name': spec['short_name'], 'version': spec['version'],
                                        'temporal': f'{start}T00:00:00Z,{end}T23:59:59Z',
                                        'page_size': 2000, 'page_num': page, 'sort_key': 'start_date'})
        with urllib.request.urlopen(f'{CMR}?{query}', timeout=120) as response:
            batch = json.load(response)['items']
        items.extend(batch)
        if len(batch) < 2000:
            return items
        page += 1


def manifest(product, start, end):
    rows = []
    for item in cmr_granules(product, start, end):
        umm = item['umm']
        rng = umm['TemporalExtent']['RangeDateTime']
        urls = {r.get('Subtype') or r['Type']: r['URL'] for r in umm.get('RelatedUrls', [])
                if r['Type'] in ('GET DATA', 'USE SERVICE API')}
        inserted = min(p['Date'] for p in umm.get('ProviderDates', []) if p['Type'] == 'Insert')
        rows.append({'granule': umm['GranuleUR'], 'begin': rng['BeginningDateTime'][:10],
                     'end': rng['EndingDateTime'][:10], 'inserted': inserted[:10],
                     'data_url': urls.get('GET DATA', ''), 'opendap_url': urls.get('OPENDAP DATA', '')})
    folder = PRODUCTS[product]['folder']
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'manifest.csv'
    with open(path, 'w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print('wrote', path, len(rows), 'granules')
    return rows


def lags():
    today = dt.date.today()
    for product in PRODUCTS:
        rows = manifest(product, today - dt.timedelta(days=365), today)
        anchor = 'begin' if product == 'viirs' else 'end'
        delays = [(dt.date.fromisoformat(r['inserted']) - dt.date.fromisoformat(r[anchor])).days for r in rows]
        recent = [v for r, v in zip(rows, delays)
                  if dt.date.fromisoformat(r[anchor]) >= today - dt.timedelta(days=90)]
        values = sorted(delays)
        print(product, 'delay measured from window', anchor)
        print(product, 'last 12 months: n', len(values), 'median', values[len(values) // 2],
              'p90', values[int(len(values) * .9)], 'max', values[-1],
              '| last 90 days median', sorted(recent)[len(recent) // 2] if recent else None)


def fetch(url, dest, params=None):
    if dest.exists() and dest.stat().st_size > 0:
        return False
    if params:
        url = f'{url}?{urllib.parse.urlencode(params)}'
    request = urllib.request.Request(url, headers={'Authorization': f'Bearer {token()}'})
    tmp = dest.with_suffix(dest.suffix + '.part')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=300) as response, open(tmp, 'wb') as handle:
                while chunk := response.read(1 << 20):
                    handle.write(chunk)
            if tmp.read_bytes()[:4] != b'\x89HDF' and tmp.read_bytes()[:4] != b'\x0e\x03\x13\x01':
                raise ValueError('response is not an HDF file')
            tmp.replace(dest)
            return True
        except Exception as error:
            tmp.unlink(missing_ok=True)
            if attempt == 3:
                raise
            print('retry', dest.name, type(error).__name__, flush=True)
            time.sleep(10 * (attempt + 1))


def viirs_to_grid(path):
    """Mean of valid 0.05 degree NDVI cells in each 0.25 degree spot (5 x 5 blocks)."""
    values, _ = read_band(f'HDF5:"{path}":{VIIRS_NDVI}')
    if values.size != 3600 * 7200:
        raise ValueError(f'{path.name}: unexpected NDVI grid size')
    raw = values.reshape(3600, 7200)
    ndvi = np.where((raw >= -10000) & (raw <= 10000), raw * 1e-4, np.nan).reshape(720, 5, 1440, 5)
    count = np.isfinite(ndvi).sum(axis=(1, 3))
    total = np.nansum(ndvi, axis=(1, 3))
    return np.where(count > 0, total / np.maximum(count, 1), np.nan).ravel()


def download_viirs(rows, every):
    """Fetch, grid and delete each composite; only the 0.25 degree table is kept."""
    import pyarrow as pa
    import pyarrow.parquet as pq
    out = DATA / 'v3/ndvi_0.25'
    out.mkdir(parents=True, exist_ok=True)
    scratch = PRODUCTS['viirs']['folder'] / 'scratch'
    scratch.mkdir(parents=True, exist_ok=True)
    got = 0
    for i, row in enumerate(rows):
        dest = out / f"{row['begin']}.parquet"
        if i % every or dest.exists():
            continue
        raw = scratch / Path(row['data_url']).name
        fetch(row['data_url'], raw)
        ndvi = viirs_to_grid(raw)
        keep = np.flatnonzero(np.isfinite(ndvi))
        start = dt.date.fromisoformat(row['begin'])
        table = pa.table({'spot_id': pa.array(keep.astype(np.int64)),
                          'start': pa.array([start] * len(keep), type=pa.date32()),
                          'ndvi': pa.array(ndvi[keep])})
        pq.write_table(table, dest.with_suffix('.tmp'), compression='zstd')
        dest.with_suffix('.tmp').replace(dest)
        raw.unlink()
        got += 1
        print('gridded VIIRS', row['begin'], len(keep), 'spots', flush=True)
    print('viirs gridded', got, 'new composites', flush=True)


def ndvi_normal():
    """Month-by-month normal per spot from composites starting in NORMAL_YEARS only."""
    import duckdb
    folder = DATA / 'v3/ndvi_0.25'
    files = [str(p) for p in sorted(folder.glob('*.parquet')) if int(p.stem[:4]) in NORMAL_YEARS]
    if not files:
        raise SystemExit('no normal-year composites gridded yet')
    out = DATA / 'v3/ndvi_normal_0.25.parquet'
    duckdb.execute("""COPY (SELECT spot_id, month(start) AS month, avg(ndvi) AS ndvi_normal, count(*) AS composites
                   FROM read_parquet(?) GROUP BY 1,2 ORDER BY 1,2) TO ? (FORMAT parquet, COMPRESSION zstd)""",
                   [files, str(out)])
    print('wrote', out, 'from', len(files), 'composites')


def download(product, start, end, every=1):
    folder = PRODUCTS[product]['folder']
    rows = manifest(product, start, end)
    if product == 'viirs':
        return download_viirs(rows, every)
    got = 0
    for row in rows:
        if product == 'smap':
            dest = folder / row['begin'][:4] / f"{row['begin']}.nc4"
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not row['opendap_url']:
                print('no OPeNDAP link', row['granule'], flush=True)
                continue
            got += fetch(row['opendap_url'] + '.dap.nc4', dest, {'dap4.ce': ';'.join(SMAP_LAYERS)})
        else:
            dest = folder / row['begin'][:4] / Path(row['data_url']).name
            dest.parent.mkdir(parents=True, exist_ok=True)
            got += fetch(row['data_url'], dest)
        if got and got % 50 == 0:
            print('downloaded', got, 'latest', dest.name, flush=True)
    print(product, 'downloaded', got, 'new files of', len(rows), flush=True)


def read_band(source):
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'band.bin'
        subprocess.run(['gdal_translate', '-q', '-of', 'ENVI', '-ot', 'Float32', source, str(out)], check=True)
        size = out.stat().st_size // 4
        return np.fromfile(out, dtype=np.float32), size


def smap_to_grid(path):
    """Mean of valid AM and PM soil moisture on the 0.25 degree world grid (720 x 1440)."""
    total = np.zeros(720 * 1440)
    count = np.zeros(720 * 1440)
    ulx, uly, lrx, lry = EASE2_9KM
    with tempfile.TemporaryDirectory() as tmp:
        for layer in SMAP_LAYERS:
            placed = Path(tmp) / 'placed.tif'
            warped = Path(tmp) / 'warped.tif'
            subprocess.run(['gdal_translate', '-q', '-a_srs', 'EPSG:6933', '-a_ullr', str(ulx), str(uly), str(lrx), str(lry),
                            '-a_nodata', '-9999', f'HDF5:"{path}":/{layer}', str(placed)], check=True)
            subprocess.run(['gdalwarp', '-q', '-overwrite', '-t_srs', 'EPSG:4326', '-te', '-180', '-90', '180', '90',
                            '-tr', '0.25', '0.25', '-r', 'average', '-dstnodata', '-9999', str(placed), str(warped)], check=True)
            values, _ = read_band(str(warped))
            ok = values >= 0
            total[ok] += values[ok]
            count[ok] += 1
    return np.where(count > 0, total / np.maximum(count, 1), np.nan)


def grid_smap(start, end):
    import pyarrow as pa
    import pyarrow.parquet as pq
    folder = PRODUCTS['smap']['folder']
    out = DATA / 'v3/smap_0.25'
    out.mkdir(parents=True, exist_ok=True)
    month = dt.date(start.year, start.month, 1)
    while month <= end:
        nxt = (month.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        dest = out / f'{month:%Y-%m}.parquet'
        if not dest.exists():
            tables = []
            day = month
            while day < nxt:
                path = folder / str(day.year) / f'{day}.nc4'
                if path.exists():
                    sm = smap_to_grid(path)
                    keep = np.flatnonzero(np.isfinite(sm))
                    tables.append(pa.table({'spot_id': pa.array(keep.astype(np.int64)),
                                            'day': pa.array([day] * len(keep), type=pa.date32()),
                                            'soil_moisture': pa.array(sm[keep])}))
                day += dt.timedelta(days=1)
            if tables:
                pq.write_table(pa.concat_tables(tables), dest, compression='zstd')
                print('gridded SMAP', month.strftime('%Y-%m'), len(tables), 'days', flush=True)
        month = nxt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('command', choices=('manifest', 'lags', 'download', 'grid-smap', 'ndvi-normal'))
    ap.add_argument('--every', type=int, default=1, help='VIIRS only: keep one composite in N')
    ap.add_argument('--product', choices=tuple(PRODUCTS), default='smap')
    ap.add_argument('--start', type=dt.date.fromisoformat, default=dt.date(2020, 12, 1))
    ap.add_argument('--end', type=dt.date.fromisoformat, default=dt.date(2025, 12, 31))
    args = ap.parse_args()
    if args.end > TEST_END and args.command in ('download', 'grid-smap'):
        raise SystemExit(f'inputs after {TEST_END} are outside the registered plan 3 periods')
    if args.command == 'manifest':
        manifest(args.product, args.start, args.end)
    elif args.command == 'lags':
        lags()
    elif args.command == 'download':
        download(args.product, args.start, args.end, args.every)
    elif args.command == 'ndvi-normal':
        ndvi_normal()
    else:
        grid_smap(args.start, args.end)


if __name__ == '__main__':
    main()
