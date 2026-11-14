#!/usr/bin/env python3
"""Export the latest available GFWED week outlook to static country files."""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from urllib.request import urlopen

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import xarray as xr

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fwi_to_parquet import nearest, PATTERN
from build_grid import ROOT

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
            if len(days) >= 5:
                return run, days
    url = f'{BASE}{FALLBACK[:4]}/{FALLBACK}/'
    names = set(re.findall(r'href="(FWI\.GEOS-5\.Daily\.Default\.\d{10}\.\d{8}\.nc)"', listing(url)))
    days = sorted(name for name in names if (m := PATTERN.fullmatch(name)) and m.group(1) == FALLBACK[:8] and dt.datetime.strptime(m.group(2), '%Y%m%d').date() > cutoff)
    if len(days) < 5:
        raise ValueError('No run has five available days after tomorrow')
    return FALLBACK, days


def regrid(path, grid):
    lats = grid['lat'].to_numpy().astype(np.float64)
    lons = (grid['lon'].to_numpy().astype(np.float64) + 180) % 360 - 180
    with xr.open_dataset(path, engine='scipy') as ds:
        lat, lon = ds['lat'].values, ds['lon'].values
        if ds.sizes['time'] != 1 or not (np.all(np.diff(lat) > 0) and np.all(np.diff(lon) > 0)):
            raise ValueError('unexpected forecast grid')
        yi = nearest(lat, lats)
        xi = (nearest(np.r_[lon[-1]-360, lon, lon[0]+360], lons)-1) % len(lon)
        values = ds['GEOS-5_FWI'].transpose('time', 'lat', 'lon').values[0, yi, xi]
    return pa.array(values, mask=~np.isfinite(values), type=pa.float32())


def rank(grid, values, day, history=None):
    con = duckdb.connect()
    con.register('grid', grid)
    con.register('weather', pa.table({'spot_id': grid['spot_id'], 'fwi': values}))
    if history is not None:
        con.register('hist', history)
        history_join = 'LEFT JOIN hist h ON h.spot_id=g.spot_id'
        hist = 'h.hist_p'
    else:
        history_join, hist = '', 'NULL::DOUBLE'
    return con.execute(f'''
      SELECT * EXCLUDE (pos) FROM (
        SELECT g.*, w.fwi, {hist} AS hist_p,
          row_number() OVER (PARTITION BY g.region_id ORDER BY w.fwi DESC, {hist} DESC NULLS LAST,
            hash(g.spot_id, ?::DATE, 20261114), g.spot_id) AS pos
        FROM grid g JOIN weather w USING (spot_id) {history_join}
        WHERE g.fuel_class IN ('forest','shrub_grass') AND g.region_id IS NOT NULL
          AND regexp_full_match(g.country, '[A-Z]{{3}}') AND w.fwi IS NOT NULL AND isfinite(w.fwi)
      ) WHERE pos <= 10 ORDER BY country, region_id, pos
    ''', [day]).to_arrow_table().to_pylist()


def history_for(data, day):
    path = data / 'history_0.25' / f'month={day:%Y-%m}' / 'history.parquet'
    if not path.exists():
        return None
    con = duckdb.connect()
    # History is an earlier-years, same-month value and is constant within a month.
    return con.execute('SELECT spot_id, hist_p FROM read_parquet(?) WHERE day=(SELECT min(day) FROM read_parquet(?) WHERE year(day)=? AND month(day)=?)', [str(path), str(path), day.year, day.month]).to_arrow_table()


def export(grid, forecasts, run, out, data):
    countries = {}
    inputs = ('fwi', 'ffmc', 'dmc', 'dc', 't_max_c', 'rh_min', 'wind_max_kmh', 'wind_dir_deg', 'rain_3d_mm', 'ndvi_diff', 'forest', 'farm', 'grass_shrub', 'hist_p', 'fire_near_3d')
    run_day = dt.datetime.strptime(run[:8], '%Y%m%d').date()
    for day, values in forecasts:
        for row in rank(grid, values, day, history_for(data, day)):
            country, region = row['country'], row['region_id']
            result = countries.setdefault(country, {'country': country, 'run_date': run_day.isoformat(), 'days': [], 'regions': {}})
            if day.isoformat() not in result['days']:
                result['days'].append(day.isoformat())
            spots = result['regions'].setdefault(region, {}).setdefault(day.isoformat(), [])
            spot_inputs = dict.fromkeys(inputs)
            spot_inputs['fwi'], spot_inputs['hist_p'] = row['fwi'], row['hist_p']
            spots.append({'type':'fire_risk', 'spot_id':row['spot_id'], 'lat':float(row['lat']), 'lon':float(row['lon']), 'precision_radius_km':row['precision_radius_km'], 'region_id':region, 'day':day.isoformat(), 'rank':len(spots)+1, 'p':None, 'level':1, 'fire_type':'forest' if row['fuel_class']=='forest' else 'grass_shrub', 'inputs':spot_inputs, 'why':[], 'lead_days':(day-run_day).days, 'run_date':run_day.isoformat()})
    out.mkdir(parents=True, exist_ok=True)
    for country, obj in countries.items():
        (out / f'{country}.json').write_text(json.dumps(obj, separators=(',', ':'), allow_nan=False) + '\n')
    return countries


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--today', type=dt.date.fromisoformat, default=dt.datetime.now(dt.timezone.utc).date())
    args = p.parse_args()
    run, names = find_run(args.today)
    raw = ROOT / 'data/raw/gfwed-live'
    raw.mkdir(parents=True, exist_ok=True)
    grid = pq.read_table(ROOT / 'data/derived/risk/grid_0.25.parquet')
    forecasts = []
    for name in names:
        path = raw / name
        if not path.exists():
            print('Downloading', name, flush=True)
            with urlopen(f'{BASE}{run[:4]}/{run}/{name}', timeout=120) as response:
                temp = path.with_suffix('.tmp')
                temp.write_bytes(response.read())
                temp.replace(path)
        day = dt.datetime.strptime(PATTERN.fullmatch(name).group(2), '%Y%m%d').date()
        forecasts.append((day, regrid(path, grid)))
    countries = export(grid, forecasts, run, ROOT / 'web/public/data/risk/week', ROOT / 'data/derived/risk')
    example = ROOT / 'web/public/data/risk/example/week'
    example.mkdir(parents=True, exist_ok=True)
    if 'BGR' in countries:
        # Example values come from the existing hand-made example, not a real forecast.
        source = json.loads((ROOT / 'web/public/data/risk/example/latest/BGR.json').read_text())
        sample = {'country': 'BGR', 'run_date': dt.datetime.strptime(run[:8], '%Y%m%d').date().isoformat(), 'days': [d.isoformat() for d, _ in forecasts], 'regions': {}}
        for region, by_day in source['regions'].items():
            original = next(iter(by_day.values()))[:3]
            sample['regions'][region] = {}
            for day, _ in forecasts:
                spots = []
                for item in original:
                    item = dict(item)
                    item.update(day=day.isoformat(), p=None, lead_days=(day-dt.datetime.strptime(run[:8], '%Y%m%d').date()).days, run_date=sample['run_date'])
                    spots.append(item)
                sample['regions'][region][day.isoformat()] = spots
        (example / 'BGR.json').write_text(json.dumps(sample, separators=(',', ':'), allow_nan=False) + '\n')
    print('run', run, 'days', len(names), 'countries', len(countries), flush=True)


if __name__ == '__main__':
    main()
