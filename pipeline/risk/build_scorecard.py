#!/usr/bin/env python3
"""Combine the once-scored Europe and world hold-out results for the app."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
WEB = ROOT / 'web/public/data/risk'


def compact_regions(card):
    """Keep readable field names once and compact per-region hold-out slices."""
    fields = ['land_spots', 'new_fires', 'fire_positive_region_days', 'min_scored_spots',
              'max_scored_spots', 'model_capture', 'fwi_capture', 'history_capture',
              'random_capture', 'model_hit', 'model_lift']
    for year in card['years'].values():
        for name, selection in year['selections'].items():
            regions = selection.pop('regions')
            if name not in ('forest_wildland', 'all_vegetation'):
                continue
            rows = {}
            for region_id, region in regions.items():
                methods = region['methods']
                rows[region_id] = [region['land_spots'], region['new_fires'], region['region_days'],
                    region['min_scored_spots'], region['max_scored_spots'],
                    *[methods[m]['capture_rate'] for m in ('model', 'fwi', 'history', 'random')],
                    methods['model']['hit_rate'], methods['model']['lift_over_random']]
            selection['region_fields'] = fields
            selection['regions'] = rows


def versus_previous(test):
    """The frozen model against the version it replaces, from v3_test.py (worldwide)."""
    main = test['selections']['forest_wildland']
    capture = main['pooled_vs_v2']
    alarms = main['alarms']['1000']
    prob = test['probability']

    def pair(new, old, compare):
        return {'new': new, 'previous': old, 'difference': compare['difference'], 'interval_95': compare['interval_95']}
    continents = {}
    for name, part in main['continents'].items():
        if name == 'Unknown':
            continue
        m = part['methods']
        continents[name] = {'new_fires': part['new_fires'],
                            **pair(m['v3']['capture_rate'], m['v2_served']['capture_rate'], part['versus_v2_served']['v3'])}
    record = test['freeze_record'] or {}
    return {'previous_model': 'lightgbm-v2', 'scope': 'world', 'selection': 'forest_wildland',
            'test_period': record.get('test_period'), 'frozen_at': record.get('frozen_at'),
            'new_fires': capture['new_fires'], 'region_days': capture['region_days'],
            'capture': pair(capture['methods']['v3']['capture_rate'], capture['methods']['v2_served']['capture_rate'],
                            capture['versus_v2_served']['v3']),
            'alarm_precision_1000': pair(alarms['methods']['v3']['precision'], alarms['methods']['v2_served']['precision'],
                                         alarms['versus_v2_served']['v3']),
            'brier': {'new': prob['brier_v3'], 'previous': prob['brier_v2'], 'difference': prob['brier_v3_minus_v2'],
                      'interval_95': prob['brier_interval_95']},
            'continents': continents, 'claim': test['claim']}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--europe', type=Path, default=DATA / 'scorecard_model_europe.json')
    ap.add_argument('--world', type=Path, default=DATA / 'scorecard_model_world.json')
    ap.add_argument('--out', type=Path, default=WEB / 'scorecard.json')
    ap.add_argument('--model', type=Path, help='selected model metadata')
    ap.add_argument('--selection', type=Path, help='2024-only model selection record')
    ap.add_argument('--test-year', type=int, default=2025, help='the registered held-out year of these scorecards')
    ap.add_argument('--previous', type=Path, help='v3_test.py result: the frozen model against the previous version')
    ap.add_argument('--keep', type=Path, help='earlier app scorecard whose daily log and week outlook are kept')
    args = ap.parse_args()
    year_key = str(args.test_year)
    scopes = {name: json.loads(path.read_text()) for name, path in [('europe', args.europe), ('world', args.world)]}
    verdict = []
    for name, card in scopes.items():
        if card['grid_g'] != 0.25 or list(card['years']) != [year_key]:
            raise ValueError(f'{name} is not the shipped-grid {year_key} hold-out')
        if card['scope']['name'].lower() != name:
            raise ValueError(f'{name} scorecard has the wrong geographic scope')
        year = card['years'][year_key]
        if not year['weather_days'] or not year['first_day'].startswith(year_key + '-') or not year['last_day'].startswith(year_key + '-'):
            raise ValueError(f'{name} has invalid test dates or no forecast days')
        result = year['selections']['forest_wildland']
        for baseline, display in [('fwi', 'NASA fire-weather index as shown in GWIS'), ('history', 'earlier-years history')]:
            b = result['bootstrap'][baseline]
            allowed = bool(b['claim_permitted'])
            verdict.append(f"{name.title()}: the model {'met' if allowed else 'did not meet'} the claim rule against {display} for forest and wildland [V].")
        compact_regions(card)
    obj = {'schema': 'emerge-risk-scorecard-1', 'grid_g': 0.25, 'test_year': args.test_year,
           'verdict': verdict, 'scopes': scopes,
           'notes': ['NOAA-20 detected new fires are the outside test data [V].',
                     'The test ranks the top five land spots per region and day [U].',
                     'Weather gaps and null scores remain visible in the coverage counts [V].',
                     'Majority land classes are not fuel shares; no NDVI input was available [V].',
                     'Aggregated detections cannot distinguish exact latitude-boundary points from points immediately north [V].',
                     'Registered reliability and Brier skill use scored spots on fire-positive region-days [U]. Additional all-scored-day results include no-fire days [U].',
                     'The world and Europe tests use the same single held-out prediction run [V].']}
    if args.model:
        obj['model_version'] = json.loads(args.model.read_text())['model_version']
    if args.previous:
        obj['versus_previous'] = versus_previous(json.loads(args.previous.read_text()))
        obj['notes'][3] = ('Land type uses majority classes, not fuel shares. Version 3 adds people maps and the NOAA GFS '
                           'forecast of D-2; plant greenness and soil moisture were tested on 2025 and not kept [V].')
    if args.keep and args.keep.exists():
        earlier = json.loads(args.keep.read_text())
        for key in ('daily_log', 'week'):
            if key in earlier:
                obj[key] = earlier[key]
    if args.selection:
        obj['validation_selection'] = json.loads(args.selection.read_text())
        if args.model and not obj['model_version'].endswith('-' + obj['validation_selection']['winner']):
            raise ValueError('Selected model does not match validation winner')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix('.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    tmp.replace(args.out)
    print('wrote', args.out, 'bytes', args.out.stat().st_size, flush=True)


if __name__ == '__main__':
    main()
