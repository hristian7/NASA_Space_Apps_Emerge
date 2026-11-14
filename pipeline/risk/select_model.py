#!/usr/bin/env python3
"""Select a model using only the registered 2024 world validation scores."""
import argparse
import json
from pathlib import Path
from train import DATA


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--v1', type=Path, default=DATA / 'scorecard_validation_world_v1.json')
    ap.add_argument('--v2', type=Path, default=DATA / 'scorecard_validation_world_v2.json')
    ap.add_argument('--out', type=Path, default=DATA / 'model_selection_2024.json')
    args = ap.parse_args()
    results = {}
    for version in ('v1', 'v2'):
        card = json.loads(getattr(args, version).read_text())
        if card['scope']['name'] != 'world' or list(card['years']) != ['2024'] or card['grid_g'] != .25:
            raise ValueError('Selection requires world validation at the shipped grid, 2024 only')
        year = card['years']['2024']
        s = year['selections']['forest_wildland']
        results[version] = {'capture': s['pooled']['methods']['model']['capture_rate'],
                            'coverage': s['coverage'], 'weather_days': year['weather_days']}
    if results['v1']['coverage'] != results['v2']['coverage'] or results['v1']['weather_days'] != results['v2']['weather_days']:
        raise ValueError('Validation comparisons require identical coverage')
    if any(results[v]['capture'] is None for v in results):
        raise ValueError('Validation capture is unavailable')
    winner = 'v2' if results['v2']['capture'] > results['v1']['capture'] else 'v1'
    result = {'rule': 'world forest/wildland top-5 pooled capture, higher wins; tie selects v1',
              'results': results, 'winner': winner}
    args.out.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print('2024 world forest/wildland capture:', results['v1']['capture'], results['v2']['capture'], 'winner:', winner)


if __name__ == '__main__':
    main()
