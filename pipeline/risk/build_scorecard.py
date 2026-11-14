#!/usr/bin/env python3
"""Combine the once-scored Europe and world hold-out results for the app."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
WEB = ROOT / 'web/public/data/risk'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--europe', type=Path, default=DATA / 'scorecard_model_europe.json')
    ap.add_argument('--world', type=Path, default=DATA / 'scorecard_model_world.json')
    ap.add_argument('--out', type=Path, default=WEB / 'scorecard.json')
    args = ap.parse_args()
    scopes = {name: json.loads(path.read_text()) for name, path in [('europe', args.europe), ('world', args.world)]}
    verdict = []
    for name, card in scopes.items():
        if card['grid_g'] != 0.25 or list(card['years']) != ['2025']:
            raise ValueError(f'{name} is not the shipped-grid 2025 hold-out')
        result = card['years']['2025']['selections']['forest_wildland']
        for baseline, display in [('fwi', 'NASA fire-weather index as shown in GWIS'), ('history', 'earlier-years history')]:
            b = result['bootstrap'][baseline]
            allowed = bool(b['claim_permitted'])
            verdict.append(f"{name.title()}: the model {'met' if allowed else 'did not meet'} the claim rule against {display} for forest and wildland [V].")
    obj = {'schema': 'emerge-risk-scorecard-1', 'grid_g': 0.25, 'test_year': 2025,
           'verdict': verdict, 'scopes': scopes,
           'notes': ['NOAA-20 detected new fires are the outside test data [V].',
                     'The test ranks the top five land spots per region and day [U].',
                     'Weather gaps and null scores remain visible in the coverage counts [V].',
                     'Majority land classes are not fuel shares; no NDVI input was available [V].',
                     'Registered reliability and Brier skill use scored spots on fire-positive region-days [U]. Additional all-scored-day results include no-fire days [U].',
                     'The world and Europe tests use the same single held-out prediction run [V].']}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix('.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    tmp.replace(args.out)
    print('wrote', args.out, 'bytes', args.out.stat().st_size, flush=True)


if __name__ == '__main__':
    main()
