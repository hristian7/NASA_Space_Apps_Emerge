#!/usr/bin/env python3
"""Plan 3 raw weather inputs from the NOAA GFS forecast archive on AWS (open data).

Prediction day D uses the 00 UTC GFS run of D-2, the newest run issued by the
end of D-2. Its files appear about four hours after the run starts (S3
last-modified 03:56 UTC for 1 July 2021 [V]); each run's latest last-modified
time is recorded so the cutoff can be audited. Files uploaded long after the
run (archive backfill before the AWS feed began in 2021) are flagged, not used
as publication dates.

Only the needed GRIB2 messages are fetched by byte range (about 17 MB a run).
Values are averaged from the four 0.25 degree GFS grid nodes around each
0.25 degree spot centre and stored for land spots only.

Per run R (valid day D = R + 2), columns:
  tmax_c          highest 2 m temperature on D (four 6-hour maxima, Celsius)
  rh_min          lowest 2 m relative humidity at 06, 12, 18, 24 UTC on D (%)
  wind_max        highest 10 m wind speed at those times (m/s)
  wind_u, wind_v  mean 10 m wind components on D (direction comes from these)
  gust_max        highest surface gust at those times (m/s)
  rain_d          forecast rain on D (mm)
  rain_next3      forecast rain on D+1 to D+3 (mm)
  rain_r0         forecast rain on R, the first 24 hours of the run (mm)
  rain_r1         forecast rain on R + 1 (mm)
A dry-spell count is built later from rain_r0 of earlier runs, which are all
issued by the end of D-2.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import email.utils
import json
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
OUT = DATA / 'v3/gfs_0.25'
BUCKET = 'https://noaa-gfs-bdp-pds.s3.amazonaws.com'
STEPS = (54, 60, 66, 72)
STATE = ('TMAX:2 m above ground', 'RH:2 m above ground', 'UGRD:10 m above ground',
         'VGRD:10 m above ground', 'GUST:surface')
TOTAL_RAIN_HOURS = (24, 48, 72, 144)
# Last day of the registered plan 3 test period (PROTOCOL.md).
TEST_END = dt.date(2026, 10, 31)


def get(url, byte_range=None, attempts=5):
    headers = {'Range': f'bytes={byte_range[0]}-{byte_range[1]}'} if byte_range else {}
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
                return response.read(), response.headers.get('Last-Modified')
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None, None
            if attempt == attempts - 1:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == attempts - 1:
                raise
        time.sleep(5 * (attempt + 1))


class BadIndex(ValueError):
    """The archive's index points outside whole GRIB messages for this run."""


def run_base(run):
    for prefix in (f'gfs.{run:%Y%m%d}/00/atmos', f'gfs.{run:%Y%m%d}/00'):
        index, _ = get(f'{BUCKET}/{prefix}/gfs.t00z.pgrb2.0p25.f024.idx')
        if index:
            return prefix
    return None


def messages(prefix, hour):
    """Byte ranges of the wanted messages in one forecast-hour file."""
    url = f'{BUCKET}/{prefix}/gfs.t00z.pgrb2.0p25.f{hour:03d}'
    index, _ = get(url + '.idx')
    if index is None:
        raise FileNotFoundError(url)
    lines = [line.split(':') for line in index.decode().splitlines()]
    wanted = {}
    for i, parts in enumerate(lines):
        key = f'{parts[3]}:{parts[4]}'
        end = int(lines[i + 1][1]) - 1 if i + 1 < len(lines) else None
        if hour in STEPS and key in STATE:
            wanted[key] = (int(parts[1]), end)
        if hour in TOTAL_RAIN_HOURS and key == 'APCP:surface' and parts[5].startswith('0-'):
            wanted['APCP_total'] = (int(parts[1]), end)
    need = (STATE if hour in STEPS else ()) + (('APCP_total',) if hour in TOTAL_RAIN_HOURS else ())
    missing = [k for k in need if k not in wanted]
    if missing:
        raise ValueError(f'{url}: missing {missing}')
    return url, wanted


# GDAL's GRIB driver re-centres GFS longitudes to start at -180 and, unless
# told not to, converts Kelvin to Celsius; units are kept as stored here.
GDAL_GRIB = ['--config', 'GRIB_NORMALIZE_UNITS', 'NO']
EXPECTED_ORIGIN = (-180.125, 90.125, 0.25, -0.25)


def decode(blob, check_origin=False):
    with tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp) / 'm.grb2', Path(tmp) / 'm.bin'
        src.write_bytes(blob)
        if check_origin:
            info = json.loads(subprocess.run(['gdalinfo', '-json', *GDAL_GRIB, str(src)], check=True,
                                             capture_output=True, text=True).stdout)
            gt = info['geoTransform']
            if (gt[0], gt[3], gt[1], gt[5]) != EXPECTED_ORIGIN:
                raise ValueError(f'unexpected GFS grid origin {gt}')
        subprocess.run(['gdal_translate', '-q', *GDAL_GRIB, '-of', 'ENVI', '-ot', 'Float32', str(src), str(out)], check=True)
        values = np.fromfile(out, dtype=np.float32)
    if values.size != 721 * 1440:
        raise ValueError('unexpected GFS grid size')
    return values.reshape(721, 1440).astype(np.float64)


def to_spots(field):
    """GFS nodes (rows 90 to -90, columns -180 to 179.75) to the four-node mean at each spot centre."""
    right = np.roll(field, -1, axis=1)
    centre = (field + right)[:-1] + (field + right)[1:]
    return (centre / 4).ravel()


def fetch_run(run):
    prefix = run_base(run)
    if prefix is None:
        return None
    jobs = []
    for hour in sorted(set(STEPS) | set(TOTAL_RAIN_HOURS)):
        url, wanted = messages(prefix, hour)
        jobs.extend((hour, key, url, rng) for key, rng in wanted.items())
    with ThreadPoolExecutor(8) as pool:
        blobs = list(pool.map(lambda job: get(job[2], job[3]), jobs))
    fields, modified = {}, []
    for i, ((hour, key, _, _), (blob, last_modified)) in enumerate(zip(jobs, blobs)):
        if blob is None:
            raise FileNotFoundError(f'{run} f{hour:03d} {key}')
        if blob[:4] != b'GRIB' or blob[-4:] != b'7777':
            raise BadIndex(f'{run} f{hour:03d} {key}')
        fields[(hour, key)] = to_spots(decode(blob, check_origin=i == 0))
        modified.append(email.utils.parsedate_to_datetime(last_modified))
    step = lambda key: np.stack([fields[(h, key)] for h in STEPS])
    speed = np.hypot(step('UGRD:10 m above ground'), step('VGRD:10 m above ground'))
    total = {h: fields[(h, 'APCP_total')] for h in TOTAL_RAIN_HOURS}
    rain = lambda a, b: np.clip(total[b] - (total[a] if a else 0), 0, None)
    return {'tmax_c': step('TMAX:2 m above ground').max(axis=0) - 273.15,
            'rh_min': step('RH:2 m above ground').min(axis=0),
            'wind_max': speed.max(axis=0),
            'wind_u': step('UGRD:10 m above ground').mean(axis=0),
            'wind_v': step('VGRD:10 m above ground').mean(axis=0),
            'gust_max': step('GUST:surface').max(axis=0),
            'rain_d': rain(48, 72), 'rain_next3': rain(72, 144),
            'rain_r0': rain(None, 24), 'rain_r1': rain(24, 48),
            'last_modified': max(modified)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=dt.date.fromisoformat, default=dt.date(2021, 1, 1),
                    help='first run date (valid day is two days later)')
    ap.add_argument('--end', type=dt.date.fromisoformat, default=dt.date(2025, 12, 29))
    ap.add_argument('--data', type=Path, default=DATA)
    args = ap.parse_args()
    if args.end + dt.timedelta(days=2) > TEST_END:
        raise SystemExit(f'valid days after {TEST_END} are outside the registered plan 3 periods')
    spots = duckdb.execute('SELECT spot_id FROM read_parquet(?) ORDER BY spot_id',
                           [str(args.data / 'grid_0.25.parquet')]).fetchnumpy()['spot_id']
    OUT.mkdir(parents=True, exist_ok=True)
    month = dt.date(args.start.year, args.start.month, 1)
    while month <= args.end:
        nxt = (month.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        dest = OUT / f'{month:%Y-%m}.parquet'
        if dest.exists():
            month = nxt
            continue
        tables, audit = [], []
        run = max(month, args.start)
        while run < nxt and run <= args.end:
            started = time.time()
            try:
                result = fetch_run(run)
            except BadIndex as error:
                # A missing run stays missing; it is never filled from another run.
                print('bad archive index, run left missing:', error, flush=True)
                audit.append(f'{run},,bad_index')
                result = None
            if result is None:
                print('missing run', run, flush=True)
            else:
                modified = result.pop('last_modified')
                issued_by = dt.datetime.combine(run, dt.time(23, 59, 59), dt.timezone.utc)
                audit.append(f'{run},{modified.isoformat()},{"on_time" if modified <= issued_by else "uploaded_later"}')
                columns = {'spot_id': pa.array(spots), 'run': pa.array([run] * len(spots), type=pa.date32()),
                           'day': pa.array([run + dt.timedelta(days=2)] * len(spots), type=pa.date32())}
                columns.update({k: pa.array(v[spots].astype(np.float32)) for k, v in result.items()})
                tables.append(pa.table(columns))
                print('run', run, round(time.time() - started, 1), 's', flush=True)
            run += dt.timedelta(days=1)
        if tables:
            tmp = dest.with_suffix('.tmp')
            pq.write_table(pa.concat_tables(tables), tmp, compression='zstd')
            tmp.replace(dest)
            with open(OUT / 'publication_audit.csv', 'a') as handle:
                handle.write('\n'.join(audit) + '\n')
        month = nxt


if __name__ == '__main__':
    main()
