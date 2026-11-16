"""Model v3 in the daily run, controlled by RISK_V3_MODE.

  off     (default) v2 only; nothing in this module runs.
  shadow  v3 is computed and saved every day next to v2; the app still shows v2.
  on      the app shows v3 when it is available for both published days;
          otherwise that run publishes v2, exactly as before.

v3 needs the 00 UTC NOAA GFS run of D-2. When it is missing or broken, or
any v3 step fails, the day keeps v2. The first time v3 runs, its starting
files (frozen model, people map, usual values, dry-spell state) come from the
seed archive at RISK_V3_SEED_URL, checked against RISK_V3_SEED_SHA256.
"""
import datetime as dt
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.error
import urllib.request

import duckdb

MODES = ('off', 'shadow', 'on')
SEED_FILES = ('model_v3.json', 'model_v3.txt', 'usual_v3.parquet', 'v3_last_wet.parquet', 'v3/people_0.25.parquet')
LIVE_WEATHER = Path('v3/weather_live')
SHADOW = Path('v3/shadow')
KEEP_WEATHER_DAYS = 4


def mode():
    value = os.environ.get('RISK_V3_MODE', 'off').strip().lower() or 'off'
    if value not in MODES:
        raise ValueError(f'RISK_V3_MODE must be one of {MODES}')
    return value


def seed_present(data):
    return all((data / name).exists() for name in SEED_FILES)


def ensure_seed(data):
    """Unpack the v3 starting files once; later runs carry them in the saved state."""
    if seed_present(data):
        return True
    url, expected = os.environ.get('RISK_V3_SEED_URL'), os.environ.get('RISK_V3_SEED_SHA256')
    if not url or not expected:
        print('model v3 starting files are missing and no seed is configured', flush=True)
        return False
    with tempfile.TemporaryDirectory(prefix='risk-v3-seed-') as tmp:
        archive = Path(tmp) / 'seed.tar.gz'
        with urllib.request.urlopen(url, timeout=180) as response, archive.open('wb') as out:
            shutil.copyfileobj(response, out)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != expected.lower():
            print('model v3 seed does not match its SHA-256; v3 not started', flush=True)
            return False
        with tarfile.open(archive) as bundle:
            names = bundle.getnames()
            if sorted(names) != sorted(SEED_FILES):
                print(f'model v3 seed has unexpected files {names}', flush=True)
                return False
            bundle.extractall(data, filter='data')
    return seed_present(data)


def stage(data, stage_dir, previous_day, day):
    """Compute v3 for `day` inside the staging folder; None keeps v2.

    Returns the combined two-day predictions when the previous day also has v3,
    so the export can switch only when both published days come from v3.
    """
    import v3_live
    if not ensure_seed(data):
        return None
    try:
        info = v3_live.prepare_day(day, data, stage_dir)
        new = stage_dir / 'new_predictions_v3.parquet'
        v3_live.predict_day(day, data, stage_dir, new)
    except (v3_live.WeatherUnavailable, OSError, ValueError, subprocess.CalledProcessError,
            urllib.error.URLError) as error:
        print(f'{day}: model v3 unavailable ({error}); version 2 stays in use', flush=True)
        return None
    con = duckdb.connect()
    expected = con.execute('SELECT count(*) FROM read_parquet(?)', [str(stage_dir / 'grid_0.25.parquet')]).fetchone()[0]
    rows, available = con.execute('SELECT count(*), count(p) FROM read_parquet(?) WHERE day=?', [str(new), day]).fetchone()
    if rows != expected or not available:
        print(f'{day}: model v3 output incomplete ({rows} rows, {available} with a value); version 2 stays in use', flush=True)
        return None
    combined = stage_dir / 'predictions_live_v3.parquet'
    previous = data / 'predictions_live_v3.parquet'
    previous_weather = data / LIVE_WEATHER / f'{previous_day}.parquet'
    has_previous = previous.exists() and previous_weather.exists() and con.execute(
        'SELECT count(*) FROM read_parquet(?) WHERE day=?', [str(previous), previous_day]).fetchone()[0] == expected
    if has_previous:
        con.execute('''COPY (SELECT * FROM read_parquet(?) WHERE day=? UNION ALL BY NAME SELECT * FROM read_parquet(?))
                       TO ? (FORMAT parquet, COMPRESSION zstd)''', [str(previous), previous_day, str(new), str(combined)])
        shutil.copyfile(previous_weather, stage_dir / 'v3' / 'weather_0.25' / previous_weather.name)
    else:
        shutil.copyfile(new, combined)
    return {'day': day, 'combined': combined, 'new': new, 'both_days': has_previous, **info}


def save(data, stage_dir, result):
    """Keep v3 state after a successful publish: predictions, weather, dry spell, shadow log."""
    day = result['day']
    shutil.copyfile(result['combined'], data / 'predictions_live_v3.parquet')
    shutil.copyfile(stage_dir / 'v3_last_wet.parquet', data / 'v3_last_wet.parquet')
    weather = data / LIVE_WEATHER
    weather.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(stage_dir / 'v3' / 'weather_0.25' / f'{day}.parquet', weather / f'{day}.parquet')
    for old in sorted(weather.glob('*.parquet'))[:-KEEP_WEATHER_DAYS]:
        old.unlink()
    shadow = data / SHADOW
    shadow.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(result['new'], shadow / f'{day}.parquet')


def meta_note(result, shown):
    return {'mode': mode(), 'shown': shown, 'computed_for': result['day'].isoformat() if result else None,
            'gfs_run': result['gfs_run'] if result else None,
            'missed_rain_runs': result['missed_rain_runs'] if result else []}


GFS_SOURCE = {'name': 'NOAA GFS 00 UTC forecast run of D-2 (NOAA Open Data Dissemination)',
              'url': 'https://registry.opendata.aws/noaa-gfs-bdp-pds/'}
PEOPLE_SOURCES = [
    {'name': 'NASA SEDAC GPW v4.11 population density 2020, CC BY 4.0',
     'url': 'https://doi.org/10.7927/H49C6VHW', 'date': '2018-12-31'},
    {'name': 'GRIP4 global roads database (PBL), CC0', 'url': 'https://www.globio.info/download-grip-dataset',
     'date': '2018-04-24'},
    {'name': 'GHSL GHS-BUILT-S R2023A 2020 (European Commission JRC), CC BY 4.0',
     'url': 'https://human-settlement.emergency.copernicus.eu/', 'date': '2023-01-01'}]


def bundle_paths(data):
    """v3 files the next scheduled job needs, relative to the risk data folder."""
    paths = [name for name in SEED_FILES + ('predictions_live_v3.parquet',) if (data / name).exists()]
    for folder in (LIVE_WEATHER, SHADOW):
        if (data / folder).exists():
            paths.extend(str(p.relative_to(data)) for p in sorted((data / folder).glob('*.parquet')))
    return paths


def make_seed(data, out):
    """Pack the v3 starting files for a one-time upload next to the saved state."""
    missing = [name for name in SEED_FILES if not (data / name).exists()]
    if missing:
        raise SystemExit(f'missing {missing}')
    with tarfile.open(out, 'w:gz', compresslevel=6) as bundle:
        for name in SEED_FILES:
            info = bundle.gettarinfo(str(data / name), arcname=name)
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            with (data / name).open('rb') as handle:
                bundle.addfile(info, handle)
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f'wrote {out} ({out.stat().st_size} bytes) sha256 {digest}', flush=True)
    return digest
