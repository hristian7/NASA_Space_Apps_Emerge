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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--europe', type=Path, default=DATA / 'scorecard_model_europe.json')
    ap.add_argument('--world', type=Path, default=DATA / 'scorecard_model_world.json')
    ap.add_argument('--out', type=Path, default=WEB / 'scorecard.json')
    ap.add_argument('--model', type=Path, help='selected model metadata')
    ap.add_argument('--selection', type=Path, help='2024-only model selection record')
    args = ap.parse_args()
    scopes = {name: json.loads(path.read_text()) for name, path in [('europe', args.europe), ('world', args.world)]}
    verdict = []
    for name, card in scopes.items():
        if card['grid_g'] != 0.25 or list(card['years']) != ['2025']:
            raise ValueError(f'{name} is not the shipped-grid 2025 hold-out')
        if card['scope']['name'].lower() != name:
            raise ValueError(f'{name} scorecard has the wrong geographic scope')
        year = card['years']['2025']
        if not year['weather_days'] or not year['first_day'].startswith('2025-') or not year['last_day'].startswith('2025-'):
            raise ValueError(f'{name} has invalid test dates or no forecast days')
        result = year['selections']['forest_wildland']
        for baseline, display in [('fwi', 'NASA fire-weather index as shown in GWIS'), ('history', 'earlier-years history')]:
            b = result['bootstrap'][baseline]
            allowed = bool(b['claim_permitted'])
            verdict.append(f"{name.title()}: the model {'met' if allowed else 'did not meet'} the claim rule against {display} for forest and wildland [V].")
        compact_regions(card)
    obj = {'schema': 'emerge-risk-scorecard-1', 'grid_g': 0.25, 'test_year': 2025,
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
