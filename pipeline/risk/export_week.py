#!/usr/bin/env python3
"""Export the latest available GFWED week outlook to static country files."""
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import xarray as xr

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fwi_to_parquet import nearest, PATTERN, FIELDS
from build_grid import ROOT
from features import FEATURES, feature_sql
from predict import probabilities

BASE = 'https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/'
FALLBACK = '2026111200'


def listing(url):
    with urlopen(url, timeout=30) as response:
        return response.read().decode('utf-8')


def find_run(today):
    cutoff = today + dt.timedelta(days=1)
    for year in (today.year, today.year - 1):
        try:
            runs = sorted(set(re.findall(r'href="(\d{8}00)/"', listing(f'{BASE}{year}/'))), reverse=True)
        except OSError:
            runs = []
        for run in runs:
            if run[:8] > today.strftime('%Y%m%d'):
                continue
            url = f'{BASE}{year}/{run}/'
            try:
                names = set(re.findall(r'href="(FWI\.GEOS-5\.Daily\.Default\.\d{10}\.\d{8}\.nc)"', listing(url)))
            except OSError:
                continue
            days = sorted(name for name in names if (m := PATTERN.fullmatch(name)) and m.group(1) == run[:8] and dt.datetime.strptime(m.group(2), '%Y%m%d').date() > cutoff)
            if days:
                return run, days
    url = f'{BASE}{FALLBACK[:4]}/{FALLBACK}/'
    names = set(re.findall(r'href="(FWI\.GEOS-5\.Daily\.Default\.\d{10}\.\d{8}\.nc)"', listing(url)))
    days = sorted(name for name in names if (m := PATTERN.fullmatch(name)) and m.group(1) == FALLBACK[:8] and dt.datetime.strptime(m.group(2), '%Y%m%d').date() > cutoff)
    if not days:
        raise ValueError('No run has available days after tomorrow')
    return FALLBACK, days


def regrid(path, grid, day):
    lats = grid['lat'].to_numpy().astype(np.float64)
    lons = (grid['lon'].to_numpy().astype(np.float64) + 180) % 360 - 180
    with xr.open_dataset(path, engine='scipy') as ds:
        lat, lon = ds['lat'].values, ds['lon'].values
        if ds.sizes['time'] != 1 or not (np.all(np.diff(lat) > 0) and np.all(np.diff(lon) > 0)):
            raise ValueError('unexpected forecast grid')
        yi = nearest(lat, lats)
        xi = (nearest(np.r_[lon[-1]-360, lon, lon[0]+360], lons)-1) % len(lon)
        columns = {'spot_id': grid['spot_id'], 'day': pa.array([day] * len(grid), type=pa.date32())}
        for field in FIELDS:
            values = ds['GEOS-5_' + field.upper()].transpose('time', 'lat', 'lon').values[0, yi, xi]
            columns[field] = pa.array(values, mask=~np.isfinite(values), type=pa.float32())
    return pa.table(columns)


def rank(grid, values, day, history, method='history', predictions=None):
    con = duckdb.connect()
    con.register('grid', grid)
    con.register('weather', pa.table({'spot_id': grid['spot_id'], 'fwi': values}))
    con.register('hist', history)
    if method not in ('model', 'history'):
        raise ValueError('Unknown week ranking method')
    if method == 'model':
        if predictions is None:
            raise ValueError('Model ranking needs predictions')
        con.register('predictions', predictions)
        prediction_join = 'JOIN predictions p USING (spot_id)'
        probability = 'p.p'
        available = 'AND p.p IS NOT NULL AND isfinite(p.p)'
        ordering = 'p.p DESC, h.hist_p DESC'
    else:
        prediction_join, probability, available, ordering = '', 'NULL::DOUBLE', '', 'h.hist_p DESC'
    return con.execute(f'''
      SELECT * EXCLUDE (pos) FROM (
        SELECT g.*, w.fwi, h.hist_p, {probability} AS p,
          row_number() OVER (PARTITION BY g.region_id ORDER BY {ordering},
            hash(g.spot_id, ?::DATE, 20261114), g.spot_id) AS pos
        FROM grid g JOIN weather w USING (spot_id) JOIN hist h USING (spot_id) {prediction_join}
        WHERE g.fuel_class IN ('forest','shrub_grass') AND g.region_id IS NOT NULL
          AND regexp_full_match(g.country, '[A-Z]{{3}}') AND w.fwi IS NOT NULL AND isfinite(w.fwi)
          AND h.hist_p IS NOT NULL AND isfinite(h.hist_p) {available}
      ) WHERE pos <= 10 ORDER BY country, region_id, pos
    ''', [day]).to_arrow_table().to_pylist()


def ranking_method(card, lead):
    """Choose globally using the shipped grid's forest and wildland comparison."""
    if card.get('grid_g') != 0.25 or card.get('week', {}).get('test_year') != 2025:
        raise ValueError('Unexpected week scorecard grid or test year')
    try:
        result = card['week']['leads'][str(lead)]['scopes']['world']['selections']['forest_wildland']
        boot = result['bootstrap']['history']
        model = result['pooled']['methods']['model']['capture_rate']
        history = result['pooled']['methods']['history']['capture_rate']
        if (boot['claim_permitted'] and boot['bootstrap_passed'] and boot['valid_draws'] > 0
                and boot['difference'] > 0 and boot['interval_95'][0] > 0 and model > history):
            return 'model'
    except (KeyError, TypeError, IndexError):
        pass
    return 'history'


def live_inputs(grid, weather, day, lead, scratch, model, booster):
    """Use the same builder, features and calibration as the hold-out run."""
    folder = scratch / ('fwi_0.25' if lead == 3 else f'fwi_lead{lead}_0.25') / f'month={day:%Y-%m}'
    folder.mkdir(parents=True, exist_ok=True)
    pq.write_table(weather, folder / f'{day}.parquet')
    subprocess.run([sys.executable, str(Path(__file__).with_name('build_history.py')),
                    '--start', str(day), '--end', str(day), '--lead', str(lead), '--data', str(scratch)], check=True)
    history_path = scratch / f'history_lead{lead}_0.25' / f'month={day:%Y-%m}' / 'history.parquet'
    history = pq.read_table(history_path)
    if model is None:
        return history, None
    con = duckdb.connect()
    con.register('grid', grid)
    con.register('weather', weather)
    con.register('history', history)
    frame = con.execute(f'''SELECT f.spot_id,{feature_sql()}
      FROM weather f JOIN grid g USING(spot_id) JOIN history h USING(spot_id,day)''').fetchdf()
    values = probabilities(frame[list(FEATURES)].to_numpy(dtype=np.float64), model, booster)
    return history, pa.table({'spot_id': pa.array(frame['spot_id']), 'p': pa.array(values, mask=~np.isfinite(values))})


def export(grid, forecasts, run, out):
    countries = {}
    inputs = ('fwi', 'ffmc', 'dmc', 'dc', 't_max_c', 'rh_min', 'wind_max_kmh', 'wind_dir_deg', 'rain_3d_mm', 'ndvi_diff', 'forest', 'farm', 'grass_shrub', 'hist_p', 'fire_near_3d')
    run_day = dt.datetime.strptime(run[:8], '%Y%m%d').date()
    for day, values, history, predictions, method in forecasts:
        for row in rank(grid, values, day, history, method, predictions):
            country, region = row['country'], row['region_id']
            result = countries.setdefault(country, {'country': country, 'run_date': run_day.isoformat(), 'days': [], 'ranking': {}, 'regions': {}})
            result['ranking'][day.isoformat()] = method
            if day.isoformat() not in result['days']:
                result['days'].append(day.isoformat())
            spots = result['regions'].setdefault(region, {}).setdefault(day.isoformat(), [])
            spot_inputs = dict.fromkeys(inputs)
            spot_inputs['fwi'], spot_inputs['hist_p'] = row['fwi'], row['hist_p']
            spots.append({'type':'fire_risk', 'spot_id':row['spot_id'], 'lat':float(row['lat']), 'lon':float(row['lon']), 'precision_radius_km':row['precision_radius_km'], 'region_id':region, 'day':day.isoformat(), 'rank':len(spots)+1, 'p':row['p'], 'level':1, 'fire_type':'forest' if row['fuel_class']=='forest' else 'grass_shrub', 'inputs':spot_inputs, 'why':[], 'lead_days':(day-run_day).days, 'run_date':run_day.isoformat()})
    if not countries:
        raise ValueError('No countries have available ranked spots')
    out.mkdir(parents=True, exist_ok=True)
    for country, obj in countries.items():
        (out / f'{country}.json').write_text(json.dumps(obj, separators=(',', ':'), allow_nan=False) + '\n')
    for old in out.glob('*.json'):
        if re.fullmatch(r'[A-Z]{3}', old.stem) and old.stem not in countries:
            old.unlink()
    return countries


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--today', type=dt.date.fromisoformat, default=dt.datetime.now(dt.timezone.utc).date())
    args = p.parse_args()
    run, names = find_run(args.today)
    raw = ROOT / 'data/raw/gfwed-live'
    raw.mkdir(parents=True, exist_ok=True)
    data = ROOT / 'data/derived/risk'
    grid = pq.read_table(data / 'grid_0.25.parquet')
    card = json.loads((ROOT / 'web/public/data/risk/scorecard.json').read_text())
    run_day = dt.datetime.strptime(run[:8], '%Y%m%d').date()
    selected = [ranking_method(card, (dt.datetime.strptime(PATTERN.fullmatch(name).group(2), '%Y%m%d').date() - run_day).days) for name in names]
    model = booster = None
    if 'model' in selected:
        import lightgbm as lgb
        model_path = data / 'model_v2.json'
        model = json.loads(model_path.read_text())
        if model['features'] != list(FEATURES):
            raise ValueError('Model feature schema differs from pipeline')
        booster = lgb.Booster(model_file=str(model_path.parent / model['booster_file']))
    forecasts = []
    with tempfile.TemporaryDirectory(prefix='week-live-', dir=data) as directory:
        scratch = Path(directory)
        for name in ('grid_0.25.parquet', 'labels_0.25.parquet'):
            (scratch / name).symlink_to((data / name).resolve())
        (scratch / 'duckdb_tmp').mkdir()
        for name, method in zip(names, selected):
            path = raw / name
            if not path.exists():
                print('Downloading', name, flush=True)
                with urlopen(f'{BASE}{run[:4]}/{run}/{name}', timeout=120) as response:
                    temp = path.with_suffix('.tmp')
                    temp.write_bytes(response.read())
                    temp.replace(path)
            day = dt.datetime.strptime(PATTERN.fullmatch(name).group(2), '%Y%m%d').date()
            weather = regrid(path, grid, day)
            history, predictions = live_inputs(grid, weather, day, (day-run_day).days, scratch,
                                               model if method == 'model' else None, booster)
            forecasts.append((day, weather['fwi'], history, predictions, method))
        countries = export(grid, forecasts, run, ROOT / 'web/public/data/risk/week')
    print('run', run, 'days', len(names), 'countries', len(countries), flush=True)


if __name__ == '__main__':
    main()
