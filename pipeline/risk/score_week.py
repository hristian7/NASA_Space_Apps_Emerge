#!/usr/bin/env python3
"""Score each forecast lead with the registered next-day ranking protocol."""
import argparse
import datetime as dt
import json
from pathlib import Path

import duckdb

import backtest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', type=Path, default=backtest.DATA)
    ap.add_argument('--scorecard', type=Path, default=backtest.ROOT / 'web/public/data/risk/scorecard.json')
    ap.add_argument('--lead', type=int, action='append', choices=range(3, 9))
    ap.add_argument('--results', type=Path, default=backtest.DATA / 'week_scores')
    args = ap.parse_args()
    args.results.mkdir(parents=True, exist_ok=True)
    for lead in args.lead or range(3, 9):
        for scope in ('europe', 'world'):
            con = duckdb.connect()
            con.execute('SET threads=4')
            con.execute("SET memory_limit='6GB'")
            con.execute('SET temp_directory=?', [str(args.data / 'duckdb_tmp')])
            folder = 'fwi_0.25' if lead == 3 else f'fwi_lead{lead}_0.25'
            print('preparing', lead, scope, flush=True)
            days = backtest.prepare_candidates(con, args.data, 2025, None, None, scope == 'world', folder, monthly_history=True)
            if not days or len(set(days)) != len(days):
                raise ValueError(f'missing or duplicate dates for lead {lead}')
            results = {}
            for selection in ('forest_wildland', 'all_vegetation'):
                print('scoring', lead, scope, selection, flush=True)
                result = backtest.selection_scores(con, selection, 2025, bootstrap_primary='fwi')
                results[selection] = {key: result[key] for key in ('coverage', 'pooled', 'region_days_without_scores', 'bootstrap')}
            con.close()
            output = {'weather_days': len(days), 'missing_weather_days': 365-len(days),
                      'first_day': min(days).isoformat(), 'last_day': max(days).isoformat(), 'selections': results}
            path = args.results / f'lead{lead}_{scope}.json'
            path.write_text(json.dumps(output, allow_nan=False, separators=(',', ':')) + '\n')
            print('wrote', path.name, flush=True)
    paths = [args.results / f'lead{lead}_{scope}.json' for lead in range(3, 9) for scope in ('europe', 'world')]
    if not all(path.exists() for path in paths):
        print('partial results only; scorecard unchanged', flush=True)
        return
    leads = {}
    for lead in range(3, 9):
        scopes = {scope: json.loads((args.results / f'lead{lead}_{scope}.json').read_text()) for scope in ('europe', 'world')}
        methods = scopes['world']['selections']['forest_wildland']['pooled']['methods']
        fwi, history = methods['fwi']['capture_rate'], methods['history']['capture_rate']
        verdict = (f'Lead {lead}: the fire-weather ranking caught {fwi:.1%} of new fires and history caught {history:.1%} worldwide in 2025 [V].'
                   if fwi is not None and history is not None else f'Lead {lead}: capture is unavailable [V].')
        leads[str(lead)] = {'verdict': verdict, 'scopes': scopes}
    card = json.loads(args.scorecard.read_text())
    card['week'] = {'test_year': 2025, 'leads': leads}
    temp = args.scorecard.with_suffix('.tmp')
    temp.write_text(json.dumps(card, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    temp.replace(args.scorecard)
    print('updated week section', flush=True)


if __name__ == '__main__':
    main()
