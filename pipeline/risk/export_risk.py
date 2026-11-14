#!/usr/bin/env python3
"""Export the current model's research estimates in the app's static contract."""
import argparse
import datetime as dt
import json
from collections import defaultdict
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from features import FEATURES, feature_sql

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
WEB = ROOT / 'web/public/data/risk'
DAYS = ('2026-11-14', '2026-11-15')
WEATHER_URL = 'https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/2026/{run}00/FWI.GEOS-5.Daily.Default.{run}00.{day}.nc'


def scalar(value):
    if pd.isna(value):
        return None
    return float(value)


def explanations(row, mean, model):
    if pd.isna(row.p):
        return []
    weights = np.asarray(model['coefficients']) * model['calibration_slope'] / np.asarray(model['scale'])
    contributions = (row[list(FEATURES)].to_numpy(dtype=float) - mean) * weights
    sums = defaultdict(float)
    for name, value in zip(FEATURES, contributions):
        if not np.isfinite(value) or value <= 0:
            continue
        if name in ('fwi', 'ffmc', 'dmc', 'dc', 'bui', 'dsr', 'fwi_x_forest'):
            sums['very_dry'] += value
        elif name == 'forest' and row.fuel_class == 'forest':
            sums['mostly_forest'] += value
        elif name == 'shrub_grass' and row.fuel_class == 'shrub_grass':
            sums['mostly_grass'] += value
        elif name in ('hist_p', 'last_year_same_month', 'days_since_log', 'no_previous_fire'):
            sums['history'] += value
        elif name == 'fire_near_3d' and row.fire_near_3d:
            sums['nearby_fire'] += value
    return [key for key, _ in sorted(sums.items(), key=lambda item: (-item[1], item[0]))[:4]]


def ready_from_scorecard(card):
    # Both comparisons must pass for the shipped world grid and the Europe slice.
    for scope in ('world', 'europe'):
        boot = card['scopes'][scope]['years']['2025']['selections']['forest_wildland']['bootstrap']
        if not all(boot.get(b, {}).get('claim_permitted', False) for b in ('fwi', 'history')):
            return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', type=Path, default=DATA / 'model_v1.json')
    ap.add_argument('--predictions', type=Path, default=DATA / 'predictions_live.parquet')
    ap.add_argument('--scorecard', type=Path, default=WEB / 'scorecard.json')
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--dest', type=Path, default=WEB)
    args = ap.parse_args()
    model = json.loads(args.model.read_text())
    card = json.loads(args.scorecard.read_text())
    ready = ready_from_scorecard(card)
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='8GB'")
    con.execute('CREATE TEMP TABLE grid AS SELECT * FROM read_parquet(?)', [str(args.data / 'grid_0.25.parquet')])
    con.execute('CREATE TEMP TABLE predictions AS SELECT * FROM read_parquet(?)', [str(args.predictions)])
    country_regions = defaultdict(lambda: defaultdict(dict))
    total_null_country = 0
    for day in DAYS:
        weather = args.data / 'fwi_0.25' / f'month={day[:7]}' / f'{day}.parquet'
        history = args.data / 'history_0.25' / f'month={day[:7]}' / 'history.parquet'
        rows = con.execute(f'''SELECT g.spot_id,g.lat::DOUBLE AS lat,g.lon::DOUBLE AS lon,
           g.precision_radius_km,g.region_id,g.country,g.fuel_class,f.day,p.p,
           hash(g.spot_id,f.day,20261114) AS tie_order,{feature_sql()}
           FROM read_parquet(?) f JOIN grid g USING(spot_id)
           JOIN read_parquet(?) h ON h.spot_id=f.spot_id AND h.day=f.day
           LEFT JOIN predictions p ON p.spot_id=f.spot_id AND p.day=f.day
           WHERE f.day=?''', [str(weather), str(history), day]).fetchdf()
        expected = con.execute('SELECT count(*) FROM grid').fetchone()[0]
        if len(rows) != expected:
            raise ValueError(f'{day}: expected {expected} inputs, got {len(rows)}')
        duplicates, prediction_count = con.execute('SELECT count(*)-count(distinct spot_id),count(*) FROM predictions WHERE day=?', [day]).fetchone()
        if duplicates or prediction_count != expected:
            raise ValueError(f'{day}: predictions must contain exactly one row per land spot')
        means = rows.groupby('region_id', sort=False)[list(FEATURES)].mean()
        chosen = rows[rows.fuel_class.isin(['forest', 'shrub_grass'])].copy()
        total_null_country += int(chosen.country.isna().sum())
        chosen = chosen[chosen.country.notna()]
        chosen = chosen.sort_values(['region_id', 'p', 'hist_p', 'tie_order', 'spot_id'],
                                    ascending=[True, False, False, True, True], na_position='last')
        chosen = chosen.groupby('region_id', sort=False).head(10)
        for (country, region), group in chosen.groupby(['country', 'region_id'], sort=False):
            spots = []
            mean = means.loc[region].to_numpy(dtype=float)
            for rank, (_, row) in enumerate(group.iterrows(), 1):
                p = scalar(row.p)
                level = 1 if p is None else int(np.searchsorted(model['level_probability_limits'], p, side='right') + 1)
                record = {'type': 'fire_risk', 'spot_id': int(row.spot_id), 'lat': float(row.lat), 'lon': float(row.lon),
                          'precision_radius_km': float(row.precision_radius_km), 'region_id': region, 'day': day,
                          'rank': rank, 'p': p, 'level': level,
                          'fire_type': 'forest' if row.fuel_class == 'forest' else 'grass_shrub',
                          'inputs': {'fwi': scalar(row.fwi), 'ffmc': scalar(row.ffmc), 'dmc': scalar(row.dmc), 'dc': scalar(row.dc),
                                     't_max_c': None, 'rh_min': None, 'wind_max_kmh': None, 'wind_dir_deg': None,
                                     'rain_3d_mm': None, 'ndvi_diff': None, 'forest': None, 'farm': None, 'grass_shrub': None,
                                     'hist_p': scalar(row.hist_p), 'fire_near_3d': bool(row.fire_near_3d)},
                          'why': explanations(row, mean, model)}
                spots.append(record)
            country_regions[country][region][day] = spots
        print(day, 'selected regions', chosen.region_id.nunique(), 'spots', len(chosen), flush=True)
    folder = args.dest / 'latest'
    folder.mkdir(parents=True, exist_ok=True)
    for country, regions in country_regions.items():
        if len(country) != 3 or not country.isalpha() or not country.isupper():
            raise ValueError(f'invalid country code {country}')
        obj = {'country': country, 'days': list(DAYS), 'regions': regions}
        (folder / f'{country}.json').write_text(json.dumps(obj, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n')
    meta = {'engine_ready': ready, 'example': False, 'model_version': model['model_version'],
            'made_at': dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z'), 'grid_g': 0.25,
            'days': {'today': DAYS[0], 'tomorrow': DAYS[1]}, 'fire_weather_run': '2026-11-12',
            'sources': [
                {'name': 'NASA GFWED lead +3 forecast for today', 'url': WEATHER_URL.format(run='20261111', day='20261114'), 'date': '2026-11-11'},
                {'name': 'NASA GFWED lead +3 forecast for tomorrow', 'url': WEATHER_URL.format(run='20261112', day='20261115'), 'date': '2026-11-12'},
                {'name': 'NASA FIRMS NOAA-20 detections', 'url': 'https://firms.modaps.eosdis.nasa.gov/', 'date': '2026-11-13'},
                {'name': 'MODIS MCD12Q1 2021 land class mosaic, CC BY-SA 4.0', 'url': 'https://zenodo.org/records/8367523', 'date': '2021-01-01'},
                {'name': 'Natural Earth administrative regions', 'url': 'https://www.naturalearthdata.com/', 'date': '2026-11-14'}]}
    args.dest.mkdir(parents=True, exist_ok=True)
    (args.dest / 'meta.json').write_text(json.dumps(meta, indent=2, allow_nan=False) + '\n')
    print('countries', len(country_regions), 'vegetation spot-days without ISO country', total_null_country, 'engine_ready', ready, flush=True)


if __name__ == '__main__':
    main()
