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
    ap.add_argument('--results', type=Path, default=backtest.DATA / 'week_model_scores')
    ap.add_argument('--predictions-dir', type=Path, help='defaults to --data')
    args = ap.parse_args()
    args.results.mkdir(parents=True, exist_ok=True)
    for lead in args.lead or range(4, 9):
        predictions = (args.predictions_dir or args.data) / f'week_predictions_lead{lead}.parquet'
        if not predictions.exists():
            raise ValueError(f'Missing predictions for lead {lead}: {predictions}')
        for scope in ('europe', 'world'):
            con = duckdb.connect()
            con.execute('SET threads=4')
            con.execute("SET memory_limit='6GB'")
            con.execute('SET temp_directory=?', [str(args.data / 'duckdb_tmp')])
            folder = 'fwi_0.25' if lead == 3 else f'fwi_lead{lead}_0.25'
            print('preparing', lead, scope, flush=True)
            days = backtest.prepare_candidates(con, args.data, 2025, None, predictions, scope == 'world', folder, monthly_history=True)
            if not days or len(set(days)) != len(days):
                raise ValueError(f'missing or duplicate dates for lead {lead}')
            results = {}
            for selection in ('forest_wildland', 'all_vegetation'):
                print('scoring', lead, scope, selection, flush=True)
                result = backtest.selection_scores(con, selection, 2025, has_model=True)
                # The app ships the same 0.25-degree grid as this experiment.
                for comparison in result['bootstrap'].values():
                    comparison['claim_permitted'] = comparison['bootstrap_passed']
                results[selection] = {key: result[key] for key in ('coverage', 'pooled', 'region_days_without_scores', 'bootstrap')}
                methods = result['pooled']['methods']
                intervals = {name: result['bootstrap'][name]['interval_95'] for name in ('history', 'fwi')}
                print('TABLE', lead, scope, selection,
                      ' '.join(f'{name}={methods[name]["capture_rate"]}' for name in ('model', 'fwi', 'history', 'random')),
                      'model_minus_history_95=', intervals['history'], 'model_minus_fwi_95=', intervals['fwi'], flush=True)
            con.close()
            output = {'weather_days': len(days), 'missing_weather_days': 365-len(days),
                      'first_day': min(days).isoformat(), 'last_day': max(days).isoformat(), 'selections': results}
            path = args.results / f'lead{lead}_{scope}.json'
            path.write_text(json.dumps(output, allow_nan=False, separators=(',', ':')) + '\n')
            print('wrote', path.name, flush=True)
        # Update only a completely scored lead, preserving all other scorecard data.
        scopes = {scope: json.loads((args.results / f'lead{lead}_{scope}.json').read_text()) for scope in ('europe', 'world')}
        methods = scopes['world']['selections']['forest_wildland']['pooled']['methods']
        model, history = methods['model']['capture_rate'], methods['history']['capture_rate']
        verdict = (f'Lead {lead}: the model caught {model:.1%} of new fires and history caught {history:.1%} worldwide in 2025 [V].'
                   if model is not None and history is not None else f'Lead {lead}: capture is unavailable [V].')
        card = json.loads(args.scorecard.read_text())
        if card['grid_g'] != 0.25 or card['week']['test_year'] != 2025:
            raise ValueError('Scorecard grid or test year does not match the scored run')
        card['week']['leads'][str(lead)] = {'verdict': verdict, 'scopes': scopes}
        temp = args.scorecard.with_suffix('.tmp')
        temp.write_text(json.dumps(card, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
        temp.replace(args.scorecard)
        print('updated week section for lead', lead, flush=True)


if __name__ == '__main__':
    main()
