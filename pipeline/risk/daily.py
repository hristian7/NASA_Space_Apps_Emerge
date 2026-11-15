#!/usr/bin/env python3
"""Refresh the fixed lead-three forecast and its NOAA-20 detection state."""
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
import urllib.parse
from pathlib import Path

import duckdb
import score_daily

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
WORLD = ROOT / 'data/derived/world'
WEB = ROOT / 'web/public/data/risk'
SCRIPTS = Path(__file__).resolve().parent


def weather_url(run):
    day = run + dt.timedelta(days=3)
    return (f'https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/'
            f'Default/GEOS-5/{run:%Y}/{run:%Y%m%d}00/'
            f'FWI.GEOS-5.Daily.Default.{run:%Y%m%d}00.{day:%Y%m%d}.nc')


def find_latest(today, probe=None, lookback=14):
    def head(url):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=30):
                return True
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return False
            raise
    probe = probe or head
    for age in range(lookback):
        run = today - dt.timedelta(days=age)
        if probe(weather_url(run)):
            return run, run + dt.timedelta(days=3)
    raise RuntimeError('No GFWED lead-three run found in the search window')


def refresh_state(firms, world, data):
    """Replace the observed window and retain earlier complete UTC spot-days."""
    con = duckdb.connect()
    con.execute('SET threads=4')
    first, newest = score_daily.detection_spots(con, firms, world / 'static_mask.parquet', world / 'cell_days_2026.parquet')
    complete = newest - dt.timedelta(days=1)
    state = data / 'daily_detections.parquet'
    info = data / 'daily_detections.json'
    if state.exists() != info.exists():
        raise ValueError('Incomplete saved detection state')
    if state.exists():
        previous = json.loads(info.read_text())
        start = dt.date.fromisoformat(previous['start'])
        last = dt.date.fromisoformat(previous['complete_through'])
        if first > last + dt.timedelta(days=1):
            raise ValueError('FIRMS window does not cover the gap in saved detections')
        if complete < last:
            raise ValueError('FIRMS file is older than the saved detection state')
        con.execute('CREATE TEMP TABLE previous AS SELECT * FROM read_parquet(?)', [str(state)])
    else:
        baseline_end = con.execute("SELECT max(day) FROM read_parquet(?) WHERE sat='NOAA20'", [str(world / 'cell_days_2026.parquet')]).fetchone()[0]
        if baseline_end is None or first > baseline_end + dt.timedelta(days=1):
            raise ValueError('FIRMS window does not overlap the initial catalog')
        start = first
        con.execute('CREATE TEMP TABLE previous(spot_id INTEGER, day DATE)')
    data.mkdir(parents=True, exist_ok=True)
    temp = state.with_suffix('.parquet.tmp')
    con.execute("""COPY (SELECT DISTINCT spot_id,day FROM (
        SELECT spot_id,day FROM previous WHERE day < ?
        UNION ALL SELECT spot_id,day FROM detections WHERE day BETWEEN ? AND ?
        ) ORDER BY day,spot_id) TO ? (FORMAT parquet, COMPRESSION zstd)""",
        [first, first, complete, str(temp)])
    # Identical observations do not rewrite the state or its metadata.
    if state.exists() and con.execute('''SELECT count(*) FROM (
        (SELECT * FROM read_parquet(?) EXCEPT SELECT * FROM read_parquet(?))
        UNION ALL (SELECT * FROM read_parquet(?) EXCEPT SELECT * FROM read_parquet(?)))''',
        [str(state), str(temp), str(temp), str(state)]).fetchone()[0] == 0 and last == complete:
        temp.unlink()
    else:
        temp.replace(state)
        info_temp = info.with_suffix('.json.tmp')
        info_temp.write_text(json.dumps({'start': start.isoformat(), 'complete_through': complete.isoformat()}) + '\n')
        info_temp.replace(info)
    return start, complete


def command(script, *args):
    subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)], check=True)


def build_usual_months(data, output, months):
    """Use the registered monthly builder without a world-year memory spike."""
    with tempfile.TemporaryDirectory(prefix='risk-usual-') as tmp:
        files = []
        for month in sorted(set(months)):
            part = Path(tmp) / f'usual-{month:02}.parquet'
            print(f'Building usual values for month {month}', flush=True)
            command('build_usual.py', '--data', data, '--month', month, '--output', part)
            files.append(str(part))
        con = duckdb.connect()
        temp = output.with_suffix('.parquet.tmp')
        con.execute('COPY (SELECT * FROM read_parquet(?)) TO ? (FORMAT parquet, COMPRESSION zstd)', [files, str(temp)])
        temp.replace(output)


def ensure_usual(data, output, months):
    wanted = set(months)
    con = duckdb.connect()
    present = {row[0] for row in con.execute('SELECT DISTINCT month FROM read_parquet(?)', [str(output)]).fetchall()} if output.exists() else set()
    missing = wanted - present
    if not missing:
        return
    for year in (2024, 2025):
        if not (data / f'predictions_{year}_v2.parquet').exists():
            raise FileNotFoundError(f'usual values missing for months {sorted(missing)} and version 2 historical predictions are unavailable')
    with tempfile.TemporaryDirectory(prefix='risk-usual-merge-') as tmp:
        part = Path(tmp) / 'missing.parquet'
        build_usual_months(data, part, missing)
        if output.exists():
            merged = output.with_suffix('.parquet.tmp')
            con.execute('COPY (SELECT * FROM read_parquet(?) UNION ALL SELECT * FROM read_parquet(?)) TO ? (FORMAT parquet, COMPRESSION zstd)',
                        [str(output), str(part), str(merged)])
            merged.replace(output)
        else:
            shutil.copyfile(part, output)
    present = {row[0] for row in con.execute('SELECT DISTINCT month FROM read_parquet(?)', [str(output)]).fetchall()}
    if not wanted <= present:
        raise ValueError(f'No historical usual values for months {sorted(wanted - present)}')


def prepare_history(data, stage, first, day, previous_day):
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("""COPY (SELECT spot_id,day,label FROM read_parquet(?) WHERE day < ?
        UNION ALL SELECT spot_id,day,'observed' AS label FROM read_parquet(?)
        WHERE day <= ?) TO ? (FORMAT parquet, COMPRESSION zstd)""",
        [str(data / 'labels_0.25.parquet'), first, str(data / 'daily_detections.parquet'),
         day - dt.timedelta(days=2), str(stage / 'labels_0.25.parquet')])
    command('build_history.py', '--start', day, '--end', day, '--data', stage)
    new_history = stage / 'history_0.25' / f'month={day:%Y-%m}' / 'history.parquet'
    previous_history = data / 'history_0.25' / f'month={previous_day:%Y-%m}' / 'history.parquet'
    if not previous_history.exists():
        raise FileNotFoundError(f'history missing for published day {previous_day}')
    if previous_day.month == day.month and previous_day.year == day.year:
        temp = new_history.with_suffix('.parquet.tmp')
        con.execute('''COPY (SELECT * EXCLUDE (month) FROM read_parquet(?, hive_partitioning=true) WHERE day=?
            UNION ALL BY NAME SELECT * EXCLUDE (month) FROM read_parquet(?, hive_partitioning=true))
            TO ? (FORMAT parquet, COMPRESSION zstd)''', [str(previous_history), previous_day, str(new_history), str(temp)])
        temp.replace(new_history)
    else:
        dest = stage / 'history_0.25' / f'month={previous_day:%Y-%m}' / 'history.parquet'
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(previous_history, dest)


def copy_inputs(data, stage, previous_day):
    for name in ('grid_0.25.parquet', 'model_v2.json', 'model_v2.txt'):
        shutil.copyfile(data / name, stage / name)
    weather = data / 'fwi_0.25' / f'month={previous_day:%Y-%m}' / f'{previous_day}.parquet'
    dest = stage / 'fwi_0.25' / f'month={previous_day:%Y-%m}' / weather.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(weather, dest)


def validate_predictions(con, combined, grid, previous_day, day):
    expected = con.execute('SELECT count(*) FROM read_parquet(?)', [str(grid)]).fetchone()[0]
    counts = con.execute('SELECT day,count(*) FROM read_parquet(?) GROUP BY day ORDER BY day', [str(combined)]).fetchall()
    if counts != [(previous_day, expected), (day, expected)]:
        raise ValueError(f'Incomplete version 2 predictions: {counts}')
    available = con.execute('SELECT count(p) FROM read_parquet(?) WHERE day=?', [str(combined), day]).fetchone()[0]
    if not available:
        raise ValueError(f'{day}: no version 2 forecast inputs are available')


def publish_forecast(run, day, previous_day, first, data, web):
    """Stage the whole export; only publish after all inputs and output checks pass."""
    import export_risk
    with tempfile.TemporaryDirectory(prefix='risk-daily-') as tmp:
        root = Path(tmp)
        stage, raw, out = root / 'data', root / 'raw', root / 'out'
        stage.mkdir()
        raw.mkdir()
        copy_inputs(data, stage, previous_day)
        source = raw / f'FWI.GEOS-5.Daily.Default.{run:%Y%m%d}00.{day:%Y%m%d}.nc'
        with urllib.request.urlopen(weather_url(run), timeout=120) as response, source.open('wb') as dest:
            shutil.copyfileobj(response, dest)
        command('fwi_to_parquet.py', '--raw', raw, '--grid', stage / 'grid_0.25.parquet', '--out', stage / 'fwi_0.25')
        prepare_history(data, stage, first, day, previous_day)
        predicted = stage / 'new_predictions_v2.parquet'
        command('predict.py', '--start', day, '--end', day, '--model', stage / 'model_v2.json', '--data', stage, '--out', predicted)
        combined = stage / 'predictions_live_v2.parquet'
        con = duckdb.connect()
        con.execute('''COPY (SELECT * FROM read_parquet(?) WHERE day=? UNION ALL BY NAME
            SELECT * FROM read_parquet(?)) TO ? (FORMAT parquet, COMPRESSION zstd)''',
            [str(data / 'predictions_live_v2.parquet'), previous_day, str(predicted), str(combined)])
        validate_predictions(con, combined, stage / 'grid_0.25.parquet', previous_day, day)
        usual = data / 'usual_v2.parquet'
        if not usual.exists():
            usual = stage / 'usual_v2.parquet'
        ensure_usual(data, usual, [previous_day.month, day.month])
        export_risk.DAYS = (previous_day.isoformat(), day.isoformat())
        old_argv = sys.argv
        try:
            sys.argv = ['export_risk.py', '--model', str(stage / 'model_v2.json'), '--predictions', str(combined),
                        '--usual', str(usual), '--scorecard', str(web / 'scorecard.json'), '--data', str(stage), '--dest', str(out)]
            export_risk.main()
        finally:
            sys.argv = old_argv
        meta_path = out / 'meta.json'
        meta = json.loads(meta_path.read_text())
        meta['fire_weather_run'] = run.isoformat()
        for source_meta, valid in zip(meta['sources'][:2], (previous_day, day)):
            issued = valid - dt.timedelta(days=3)
            source_meta.update(url=weather_url(issued), date=issued.isoformat())
        meta['sources'][2]['date'] = (day - dt.timedelta(days=2)).isoformat()
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n')
        # Retain days leaving the public two-day window for delayed scoring.
        outgoing = set(json.loads((web / 'meta.json').read_text())['days'].values()) - {previous_day.isoformat(), day.isoformat()}
        for old_day in outgoing:
            archive = data / 'daily_archive' / old_day
            for folder in ('scores', 'latest'):
                shutil.copytree(web / folder, archive / folder, dirs_exist_ok=True)
        for folder in ('scores', 'latest'):
            shutil.copytree(out / folder, web / folder, dirs_exist_ok=True)
        shutil.copyfile(meta_path, web / 'meta.json')
        shutil.copyfile(combined, data / 'predictions_live_v2.parquet')
        for folder in ('fwi_0.25', 'history_0.25'):
            for path in (stage / folder).rglob('*.parquet'):
                dest = data / folder / path.relative_to(stage / folder)
                dest.parent.mkdir(parents=True, exist_ok=True)
                if folder == 'history_0.25' and dest.exists():
                    # Retain earlier days for the daily score archive.
                    temp = dest.with_suffix('.parquet.tmp')
                    con.execute('''COPY (SELECT * EXCLUDE(month) FROM read_parquet(?,hive_partitioning=true)
                        WHERE day NOT IN (?,?) UNION ALL BY NAME
                        SELECT * EXCLUDE(month) FROM read_parquet(?,hive_partitioning=true))
                        TO ? (FORMAT parquet, COMPRESSION zstd)''',
                        [str(dest), previous_day, day, str(path), str(temp)])
                    temp.replace(dest)
                else:
                    shutil.copyfile(path, dest)
        if usual.parent == stage:
            shutil.copyfile(usual, data / 'usual_v2.parquet')
    print(f'Published {previous_day} and {day} using model_v2', flush=True)


def clean_tar_owner(info):
    """Public state must not expose the build machine's user or group."""
    info.uid = info.gid = 0
    info.uname = info.gname = ''
    return info


def make_bundle(output, data, world, web):
    """Package only the inputs and published files needed by the next job."""
    usual = data / 'usual_v2.parquet'
    ensure_usual(data, usual, range(1, 13))
    meta = json.loads((web / 'meta.json').read_text())
    days = [dt.date.fromisoformat(value) for value in meta['days'].values()]
    state_info = data / 'daily_detections.json'
    first_year = dt.date.fromisoformat(json.loads(state_info.read_text())['start']).year if state_info.exists() else min(d.year for d in days)
    with tempfile.TemporaryDirectory(prefix='risk-bundle-') as tmp:
        trimmed = Path(tmp) / 'cell_days_2026.parquet'
        con = duckdb.connect()
        con.execute("""COPY (SELECT cy,cx,day,sat FROM read_parquet(?) WHERE sat='NOAA20')
            TO ? (FORMAT parquet, COMPRESSION zstd)""", [str(world / 'cell_days_2026.parquet'), str(trimmed)])
        output.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(output, 'w:gz', compresslevel=4) as bundle:
            bundle.add(trimmed, arcname='data/derived/world/cell_days_2026.parquet', filter=clean_tar_owner)
            bundle.add(world / 'static_mask.parquet', arcname='data/derived/world/static_mask.parquet', filter=clean_tar_owner)
            for name in ('grid_0.25.parquet', 'model_v2.json', 'model_v2.txt', 'labels_0.25.parquet',
                         'predictions_live_v2.parquet', 'usual_v2.parquet', 'daily_detections.parquet', 'daily_detections.json', '.blob_initialized'):
                path = data / name
                if path.exists():
                    bundle.add(path, arcname=f'data/derived/risk/{name}', filter=clean_tar_owner)
            for day in days:
                file = data / 'fwi_0.25' / f'month={day:%Y-%m}' / f'{day}.parquet'
                bundle.add(file, arcname=f'data/derived/risk/{file.relative_to(data)}', filter=clean_tar_owner)
            for file in sorted((data / 'history_0.25').glob('month=*/history.parquet')):
                if int(file.parent.name[6:10]) >= first_year:
                    bundle.add(file, arcname=f'data/derived/risk/{file.relative_to(data)}', filter=clean_tar_owner)
            archive = data / 'daily_archive'
            if archive.exists():
                bundle.add(archive, arcname='data/derived/risk/daily_archive', filter=clean_tar_owner)
            for name in ('meta.json', 'scorecard.json', 'regions.json', 'scores', 'latest', 'week'):
                path = web / name
                if path.exists():
                    bundle.add(path, arcname=f'web/public/data/risk/{name}', filter=clean_tar_owner)
    print(f'Prepared daily state bundle: {output.stat().st_size} bytes', flush=True)


def public_files(web):
    for name in ('regions.json', 'scorecard.json', 'meta.json', 'latest', 'scores', 'week'):
        path = web / name
        if path.is_file():
            yield path
        elif path.is_dir():
            yield from sorted(file for file in path.rglob('*') if file.is_file())


def manifest(web):
    result = {}
    for file in public_files(web):
        digest = hashlib.sha256()
        with file.open('rb') as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
        result[file.relative_to(web).as_posix()] = digest.hexdigest()
    return result


def blob_put(base_url, pathname, file, token):
    """Use the Vercel Blob put protocol without adding an SDK dependency."""
    base = urllib.parse.urlparse(base_url)
    if base.scheme != 'https' or not base.hostname or not base.hostname.endswith('.public.blob.vercel-storage.com'):
        raise ValueError('The risk data URL must be a public Vercel Blob URL')
    token_parts = token.split('_')
    if len(token_parts) < 5 or token_parts[:3] != ['vercel', 'blob', 'rw'] or token_parts[3].lower() != base.hostname.split('.')[0].lower():
        raise ValueError('Blob token and configured URL must identify the same store')
    name = '/'.join(part for part in (base.path.strip('/'), pathname) if part)
    url = 'https://vercel.com/api/blob/?' + urllib.parse.urlencode({'pathname': name})
    content_type = 'application/json' if file.suffix == '.json' else 'application/octet-stream'
    request = urllib.request.Request(url, data=file.read_bytes(), method='PUT', headers={
        'authorization': f'Bearer {token}', 'x-api-version': '13', 'x-vercel-blob-store-id': token_parts[3],
        'x-vercel-blob-access': 'public',
        'x-add-random-suffix': '0', 'x-allow-overwrite': '1',
        'x-cache-control-max-age': '60', 'x-content-type': content_type})
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.load(response)
    actual = urllib.parse.urlparse(result['url'])
    if actual.hostname != base.hostname or actual.path.lstrip('/') != name:
        raise ValueError('Blob token and configured public URL do not identify the same store and path')


def publish_changes(before_path, data, world, web):
    token = os.environ['BLOB_READ_WRITE_TOKEN']
    base_url = os.environ['NEXT_PUBLIC_RISK_DATA_URL'].rstrip('/')
    before = json.loads(before_path.read_text())
    after = manifest(web)
    initialized = (data / '.blob_initialized').exists()
    changed = [name for name, digest in after.items() if not initialized or before.get(name) != digest]
    # Metadata is last, so readers normally see the new files before new dates.
    changed.sort(key=lambda name: (name in ('scorecard.json', 'meta.json'), name == 'meta.json', name))
    for name in changed:
        blob_put(base_url, name, web / name, token)
    (data / '.blob_initialized').touch()
    with tempfile.TemporaryDirectory(prefix='risk-upload-') as tmp:
        bundle = Path(tmp) / 'bundle.tar.gz'
        make_bundle(bundle, data, world, web)
        blob_put(base_url, '_state/bundle.tar.gz', bundle, token)
    print(f'Published {len(changed)} changed risk files and the saved state', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--firms', type=Path)
    parser.add_argument('--bundle', type=Path, help='prepare the saved inputs and outputs for the scheduled job')
    parser.add_argument('--manifest', type=Path, help='record output hashes before the daily run')
    parser.add_argument('--publish', type=Path, help='publish changed output since the manifest and save state')
    parser.add_argument('--data', type=Path, default=DATA)
    parser.add_argument('--world', type=Path, default=WORLD)
    parser.add_argument('--web', type=Path, default=WEB)
    args = parser.parse_args()
    if sum(value is not None for value in (args.bundle, args.manifest, args.publish)) > 1:
        parser.error('choose only one of --bundle, --manifest, or --publish')
    if args.bundle:
        make_bundle(args.bundle, args.data, args.world, args.web)
        return
    if args.manifest:
        args.manifest.write_text(json.dumps(manifest(args.web), sort_keys=True) + '\n')
        return
    if args.publish:
        publish_changes(args.publish, args.data, args.world, args.web)
        return
    run, day = find_latest(dt.datetime.now(dt.timezone.utc).date())
    meta = json.loads((args.web / 'meta.json').read_text())
    days = sorted(dt.date.fromisoformat(value) for value in meta['days'].values())
    print(f'Newest GFWED run {run} gives {day} at lead +3', flush=True)
    with tempfile.TemporaryDirectory(prefix='risk-firms-') as tmp:
        firms = args.firms or Path(tmp) / 'firms.csv'
        if not args.firms:
            score_daily.download_firms(firms)
        first, complete = refresh_state(firms, args.world, args.data)
        print(f'NOAA-20 detection state complete through {complete}', flush=True)
        if day <= days[-1]:
            print(f'{day} is already published; forecast files unchanged', flush=True)
            return
        if complete < day - dt.timedelta(days=2):
            print(f'{day}: observations through the required cutoff are missing; no forecast', flush=True)
            return
        publish_forecast(run, day, days[-1], first, args.data, args.web)


if __name__ == '__main__':
    main()
