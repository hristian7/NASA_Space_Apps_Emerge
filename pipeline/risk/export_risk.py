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
from features import feature_sql
from features_v3 import extra_sql

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
WEB = ROOT / 'web/public/data/risk'
DAYS = ('2026-11-14', '2026-11-15')
LEVEL_BANDS = [0.01, 0.02, 0.05, 0.10]
WEATHER_URL = 'https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/2026/{run}00/FWI.GEOS-5.Daily.Default.{run}00.{day}.nc'


def scalar(value):
    if pd.isna(value):
        return None
    return float(value)


def usual_category(p, usual):
    if p is None or usual is None:
        return None
    return 0 if p < 0.67 * usual else 1 if p <= 1.5 * usual else 2


def fwi_category(fwi):
    return None if fwi is None else int(np.searchsorted([11.2, 21.3, 38], fwi, side='right'))


# Model v3 weather inputs, grouped under the reasons the app already words.
WEATHER_REASONS = {'tmax_c': 'very_hot', 'wind_max': 'strong_wind', 'gust_max': 'strong_wind',
                   'rain_d': 'little_rain', 'rain_d1': 'little_rain', 'rain_next3': 'little_rain',
                   'days_since_rain': 'little_rain', 'rh_min': 'very_dry'}
# A weather reason is shown only when its words are also true in plain terms;
# a contribution above the regional mean alone (9 C in November) is not "hot".
HOT_C, WINDY_MS, GUSTY_MS, DRY_SPELL_DAYS, WET_DAY_MM, DRY_AIR_RH = 30.0, 30 / 3.6, 50 / 3.6, 7, 1.0, 35.0


def weather_reason_holds(reason, name, row):
    value = lambda key: row.get(key) if key in row and pd.notna(row.get(key)) else None
    if reason == 'very_hot':
        return (value('tmax_c') or -99) >= HOT_C
    if reason == 'strong_wind':
        return (value('wind_max') or 0) >= WINDY_MS or (value('gust_max') or 0) >= GUSTY_MS
    if reason == 'little_rain':
        dry = value('days_since_rain')
        return dry is not None and dry >= DRY_SPELL_DAYS and (value('rain_d') or 0) < WET_DAY_MM
    if reason == 'very_dry' and name == 'rh_min':
        return (value('rh_min') or 100) <= DRY_AIR_RH
    return True


def explanations(row, mean, model):
    if pd.isna(row.p):
        return []
    names = model['features']
    if model.get('kind') == 'lightgbm':
        contributions = row[[f'contrib_{name}' for name in names]].to_numpy(dtype=float) - mean
    else:
        weights = np.asarray(model['coefficients']) * model['calibration_slope'] / np.asarray(model['scale'])
        contributions = (row[list(names)].to_numpy(dtype=float) - mean) * weights
    sums = defaultdict(float)
    for name, value in zip(names, contributions):
        if not np.isfinite(value) or value <= 0:
            continue
        if name in WEATHER_REASONS:
            if weather_reason_holds(WEATHER_REASONS[name], name, row):
                sums[WEATHER_REASONS[name]] += value
        elif name in ('fwi', 'ffmc', 'dmc', 'dc', 'bui', 'dsr', 'fwi_x_forest'):
            sums['very_dry'] += value
        elif name == 'forest' and row.fuel_class == 'forest':
            sums['mostly_forest'] += value
        elif name == 'shrub_grass' and row.fuel_class == 'shrub_grass':
            sums['mostly_grass'] += value
        elif name in ('hist_p', 'last_year_same_month', 'days_since_log', 'no_previous_fire') and not row.no_previous_fire:
            sums['history'] += value
        elif name == 'fire_near_3d' and row.fire_near_3d:
            sums['nearby_fire'] += value
    return [key for key, _ in sorted(sums.items(), key=lambda item: (-item[1], item[0]))[:4]]


def weather_inputs(row):
    """Model v3 forecast weather for a spot, in the app's units; empty for v2."""
    def value(name, scale=1.0, digits=1):
        v = scalar(row.get(name)) if name in row else None
        return None if v is None else round(v * scale, digits)
    direction = None
    if 'wind_dir_sin' in row and scalar(row.wind_dir_sin) is not None and scalar(row.wind_dir_cos) is not None:
        direction = round(float(np.degrees(np.arctan2(row.wind_dir_sin, row.wind_dir_cos)) % 360))
    return {'t_max_c': value('tmax_c'), 'rh_min': value('rh_min', digits=0),
            'wind_max_kmh': value('wind_max', 3.6, 0), 'wind_dir_deg': direction}


def ready_from_scorecard(card):
    # Both comparisons must pass for the shipped world grid and the Europe slice.
    for scope in ('world', 'europe'):
        boot = card['scopes'][scope]['years'][str(card['test_year'])]['selections']['forest_wildland']['bootstrap']
        if not all(boot.get(b, {}).get('claim_permitted', False) for b in ('fwi', 'history')):
            return False
    return True


def ranked_spots(rows):
    """Rank only available probabilities, retaining the registered tie order."""
    chosen = rows[rows.p.notna()].sort_values(
        ['region_id', 'p', 'hist_p', 'tie_order', 'spot_id'],
        ascending=[True, False, False, True, True], na_position='last')
    return chosen.groupby(['country', 'region_id'], sort=False).head(10)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', type=Path, default=DATA / 'model_v3.json')
    ap.add_argument('--predictions', type=Path, default=DATA / 'predictions_live_v3.parquet')
    ap.add_argument('--usual', type=Path, required=True)
    ap.add_argument('--scorecard', type=Path, default=WEB / 'scorecard.json')
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--dest', type=Path, default=WEB)
    ap.add_argument('--v3-dir', type=Path, default=DATA / 'v3',
                    help='people map and the day weather files (weather_0.25/ or weather_live/<day>.parquet) for model v3')
    args = ap.parse_args()
    model = json.loads(args.model.read_text())
    groups = model.get('input_groups', [])
    FEATURES = model['features']
    if groups and args.v3_dir is None:
        ap.error('--v3-dir is required for a model with added inputs')
    card = json.loads(args.scorecard.read_text())
    ready = ready_from_scorecard(card)
    booster = None
    if model.get('kind') == 'lightgbm':
        import lightgbm as lgb
        booster = lgb.Booster(model_file=str(args.model.parent / model['booster_file']))
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='8GB'")
    con.execute('CREATE TEMP TABLE grid AS SELECT * FROM read_parquet(?)', [str(args.data / 'grid_0.25.parquet')])
    con.execute('CREATE TEMP TABLE predictions AS SELECT * FROM read_parquet(?)', [str(args.predictions)])
    country_regions = defaultdict(lambda: defaultdict(dict))
    # Represent regions without eligible vegetation explicitly as empty lists.
    for country, region in con.execute('SELECT DISTINCT country,region_id FROM grid WHERE country IS NOT NULL').fetchall():
        country_regions[country][region] = {day: [] for day in DAYS}
    all_regions = defaultdict(lambda: defaultdict(dict))
    for country, regions in country_regions.items():
        for region in regions:
            all_regions[country][region] = {day: [] for day in DAYS}
    total_null_country = 0
    scores = defaultdict(dict)
    corrections = defaultdict(dict)
    for day in DAYS:
        weather = args.data / 'fwi_0.25' / f'month={day[:7]}' / f'{day}.parquet'
        history = args.data / 'history_0.25' / f'month={day[:7]}' / 'history.parquet'
        added, joins, params = '', '', []
        if groups:
            # The v3 expressions name the row `t`; here the forecast row is `f`.
            added = extra_sql(groups).replace('t.day', 'f.day')
            if 'people' in groups:
                joins += ' LEFT JOIN read_parquet(?) pp ON pp.spot_id=f.spot_id'
                params.append(str(args.v3_dir / 'people_0.25.parquet'))
            if 'weather' in groups:
                joins += ' LEFT JOIN read_parquet(?) wx ON wx.spot_id=f.spot_id AND wx.day=f.day'
                weather_day = args.v3_dir / 'weather_0.25' / f'{day}.parquet'
                if not weather_day.exists():
                    weather_day = args.v3_dir / 'weather_live' / f'{day}.parquet'
                params.append(str(weather_day))
            if set(groups) - {'people', 'weather', 'calendar'}:
                raise ValueError(f'export does not support input groups {groups}')
        rows = con.execute(f'''SELECT g.spot_id,g.lat::DOUBLE AS lat,g.lon::DOUBLE AS lon,
           g.precision_radius_km,g.region_id,g.country,g.fuel_class,f.day,p.p,u.usual,
           hash(g.spot_id,f.day,20261114) AS tie_order,{feature_sql()}{added}
           FROM read_parquet(?) f JOIN grid g USING(spot_id)
           JOIN read_parquet(?) h ON h.spot_id=f.spot_id AND h.day=f.day
           LEFT JOIN predictions p ON p.spot_id=f.spot_id AND p.day=f.day
           LEFT JOIN read_parquet(?) u ON u.spot_id=f.spot_id AND u.month=month(f.day){joins}
           WHERE f.day=?''', [str(weather), str(history), str(args.usual), *params, day]).fetchdf()
        expected = con.execute('SELECT count(*) FROM grid').fetchone()[0]
        if len(rows) != expected:
            raise ValueError(f'{day}: expected {expected} inputs, got {len(rows)}')
        duplicates, prediction_count = con.execute('SELECT count(*)-count(distinct spot_id),count(*) FROM predictions WHERE day=?', [day]).fetchone()
        if duplicates or prediction_count != expected:
            raise ValueError(f'{day}: predictions must contain exactly one row per land spot')
        for country, group in rows[rows.country.notna()].sort_values('spot_id').groupby('country', sort=False):
            records = []
            fixes = {}
            for spot_id, probability, usual, fwi in zip(group.spot_id, group.p, group.usual, group.fwi):
                p = scalar(probability)
                level = None if p is None else int(np.searchsorted(LEVEL_BANDS, p, side='right') + 1)
                usual, fwi = scalar(usual), scalar(fwi)
                rounded_p = None if p is None else round(p, 4)
                rounded_usual = None if usual is None else round(usual, 4)
                rounded_fwi = None if fwi is None else round(fwi, 1)
                records.append([int(spot_id), rounded_p, level, rounded_usual, rounded_fwi])
                u, w = usual_category(p, usual), fwi_category(fwi)
                if u != usual_category(rounded_p, rounded_usual) or w != fwi_category(rounded_fwi):
                    fixes[str(int(spot_id))] = [u, w]
            scores[country][day] = records
            corrections[country][day] = fixes
        if booster is not None:
            available = rows.p.notna().to_numpy()
            contributions = np.full((len(rows), len(FEATURES)), np.nan)
            if available.any():
                x = rows.loc[available, list(FEATURES)].to_numpy(dtype=float)
                values = booster.predict(x, pred_contrib=True, num_threads=4)
                contributions[available] = values[:, :-1] * model['calibration_slope']
            contribution_names = [f'contrib_{name}' for name in FEATURES]
            rows = pd.concat([rows, pd.DataFrame(contributions, columns=contribution_names, index=rows.index)], axis=1)
            means = rows.groupby('region_id', sort=False)[contribution_names].mean()
        else:
            means = rows.groupby('region_id', sort=False)[list(FEATURES)].mean()
        for selection, classes, target in (
            ('forest_wildland', ['forest', 'shrub_grass'], country_regions),
            ('all_vegetation', ['forest', 'shrub_grass', 'farmland'], all_regions),
        ):
            chosen = rows[rows.fuel_class.isin(classes)].copy()
            if selection == 'forest_wildland':
                total_null_country += int(chosen.country.isna().sum())
            chosen = chosen[chosen.country.notna()]
            chosen = ranked_spots(chosen)
            for (country, region), group in chosen.groupby(['country', 'region_id'], sort=False):
                spots = []
                mean = means.loc[region].to_numpy(dtype=float)
                for rank, (_, row) in enumerate(group.iterrows(), 1):
                    p = scalar(row.p)
                    level = 1 if p is None else int(np.searchsorted(LEVEL_BANDS, p, side='right') + 1)
                    record = {'type': 'fire_risk', 'spot_id': int(row.spot_id), 'lat': float(row.lat), 'lon': float(row.lon),
                              'precision_radius_km': float(row.precision_radius_km), 'region_id': region, 'day': day,
                              'rank': rank, 'p': p, 'level': level, 'usual': scalar(row.usual),
                              'fire_type': {'forest': 'forest', 'shrub_grass': 'grass_shrub', 'farmland': 'farmland'}[row.fuel_class],
                              'inputs': {'fwi': scalar(row.fwi), 'ffmc': scalar(row.ffmc), 'dmc': scalar(row.dmc), 'dc': scalar(row.dc),
                                         **weather_inputs(row),
                                         'rain_3d_mm': None, 'ndvi_diff': None, 'forest': None, 'farm': None, 'grass_shrub': None,
                                         'hist_p': scalar(row.hist_p), 'fire_near_3d': bool(row.fire_near_3d)},
                              'why': explanations(row, mean, model)}
                    spots.append(record)
                target[country][region][day] = spots
            print(day, selection, 'selected regions', chosen.region_id.nunique(), 'spots', len(chosen), flush=True)
    folder = args.dest / 'latest'
    folder.mkdir(parents=True, exist_ok=True)
    for country, regions in country_regions.items():
        if len(country) != 3 or not country.isalpha() or not country.isupper():
            raise ValueError(f'invalid country code {country}')
        obj = {'country': country, 'days': list(DAYS), 'regions': regions, 'all_vegetation': all_regions[country]}
        (folder / f'{country}.json').write_text(json.dumps(obj, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n')
    scores_folder = args.dest / 'scores'
    scores_folder.mkdir(parents=True, exist_ok=True)
    for country, days in scores.items():
        obj = {'grid_g': 0.25, 'columns': ['spot_id', 'p', 'level', 'usual', 'fwi'], 'days': days, 'context_corrections': corrections[country]}
        (scores_folder / f'{country}.json').write_text(json.dumps(obj, separators=(',', ':'), allow_nan=False) + '\n')
    meta = {'engine_ready': ready, 'example': False, 'model_version': model['model_version'],
            'made_at': dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z'), 'grid_g': 0.25,
            'level_bands': LEVEL_BANDS, 'usual_bands': [0.67, 1.5], 'fwi_words': [11.2, 21.3, 38],
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
