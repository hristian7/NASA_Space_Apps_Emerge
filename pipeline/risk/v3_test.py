#!/usr/bin/env python3
"""Score frozen model v3 against lightgbm-v2 as served (PROTOCOL.md, plan 3).

The 2026 test period (1 Jan to 31 Oct) is scored once: the run refuses to
start unless the freeze record is committed and unchanged, and refuses to
overwrite an existing test result. --year 2025 is a dry run on the settings
year, used only to check this script.

Claim (all three needed): v3 capture higher than v2 with the weekly-block
bootstrap interval above zero; alarm precision at 1,000 a day not lower;
Brier score over all scored spot-days not higher.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import subprocess

import numpy as np
import pandas as pd

import v3_select as sel

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
V3 = DATA / 'v3'
RECORD = Path(__file__).resolve().parent / 'v3_frozen.json'
BANDS = (0.02, 0.05, 0.10)


def check_frozen():
    rel = RECORD.relative_to(ROOT)
    tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', str(rel)], cwd=ROOT, capture_output=True)
    changed = subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--', str(rel)], cwd=ROOT)
    if tracked.returncode != 0 or changed.returncode != 0:
        raise SystemExit('the freeze record must be committed and unchanged before the test is scored')
    record = json.loads(RECORD.read_text())
    model = DATA / 'model_v3.json'
    if sel_sha(model) != record['model_json_sha256'] or sel_sha(DATA / 'model_v3.txt') != record['booster_sha256']:
        raise SystemExit('model files differ from the freeze record')
    return record


def sel_sha(path):
    import hashlib
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def weekly_interval(week, a, b, n, draws):
    """Bootstrap interval of sum(a - b) / sum(n) over seven-day blocks."""
    blocks = int(week.max()) + 1
    sa, sb, sn = (np.bincount(week, v, blocks) for v in (a, b, n))
    pick = draws(blocks)
    total = sn[pick].sum(axis=1)
    ok = total > 0
    diff = (sa[pick].sum(axis=1) - sb[pick].sum(axis=1))[ok] / total[ok]
    return float((sa.sum() - sb.sum()) / sn.sum()), np.quantile(diff, [0.025, 0.975]).tolist()


def probability_checks(con, eval_glob, v2, v3, year):
    """Brier score and chance bands on common scored forest and wildland spot-days, all days."""
    frame = con.execute(f"""
        SELECT e.day, (e.label = 'new')::INTEGER AS y, a.p AS p2, b.p AS p3
        FROM read_parquet(?) e
        JOIN read_parquet(?) a ON a.spot_id = e.spot_id AND a.day = e.day
        JOIN read_parquet(?) b ON b.spot_id = e.spot_id AND b.day = e.day
        WHERE e.fuel_class IN ('forest','shrub_grass') AND e.rank_fwi IS NOT NULL AND e.rank_hist_p IS NOT NULL
          AND a.p IS NOT NULL AND b.p IS NOT NULL""", [eval_glob, str(v2), str(v3)]).fetchdf()
    week = ((pd.to_datetime(frame['day']) - pd.Timestamp(year, 1, 1)).dt.days // 7).to_numpy()
    y = frame['y'].to_numpy(np.float64)
    e2, e3 = (frame['p2'].to_numpy() - y) ** 2, (frame['p3'].to_numpy() - y) ** 2
    rng = np.random.default_rng(sel.SEED)
    draws = lambda blocks: rng.integers(0, blocks, size=(sel.DRAWS, blocks))
    diff, interval = weekly_interval(week, e3, e2, np.ones_like(y), draws)
    days = frame['day'].nunique()
    fires = y.sum()
    bands = {}
    for model, p in (('v2', frame['p2'].to_numpy()), ('v3', frame['p3'].to_numpy())):
        bands[model] = {f'{lo:.2f}': {'flagged_per_day': float((p >= lo).sum() / days),
                                      'share_with_new_fire': float(y[p >= lo].mean()) if (p >= lo).any() else None,
                                      'share_of_all_new_fires': float(y[p >= lo].sum() / fires)} for lo in BANDS}
    return {'spot_days': len(frame), 'days': int(days), 'new_fires': int(fires),
            'brier_v2': float(e2.mean()), 'brier_v3': float(e3.mean()),
            'brier_v3_minus_v2': diff, 'brier_interval_95': interval, 'bands': bands}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--year', type=int, choices=(2025, 2026), required=True)
    ap.add_argument('--threads', type=int, default=4)
    args = ap.parse_args()
    sel.YEAR = args.year
    sel.LIMITS.update(threads=args.threads, memory_gb=4)
    if args.year == 2026:
        record = check_frozen()
        out = V3 / 'test_2026.json'
        if out.exists():
            raise SystemExit(f'{out.name} exists: the test period is scored once')
        eval_dir, months = V3 / 'evalall_2026', range(1, 11)
        v2, v3 = V3 / 'predictions_2026_v2.parquet', V3 / 'predictions_2026_v3.parquet'
    else:
        record = None
        out = V3 / 'test_dryrun_2025.json'
        eval_dir, months = V3 / 'evalall_2025', range(1, 13)
        v2, v3 = DATA / 'predictions_2025_v2.parquet', V3 / 'predictions_2025_v3.parquet'
    con = sel.connect(DATA)
    if not eval_dir.exists():
        sel.build_eval(con, DATA, eval_dir, months)
    eval_glob = str(eval_dir / '*.parquet')
    methods = {'v2_served': str(v2), 'v3': str(v3)}
    lookup = sel.continents()
    result = {'year': args.year, 'freeze_record': record, 'selections': {}}
    for selection in sel.SELECTIONS:
        rows, all_methods = sel.score(con, eval_glob, methods, selection)
        rows['continent'] = rows['country'].map(lambda c: lookup.get(c, 'Unknown') if c else 'Unknown')
        entry = {'pooled_vs_v2': sel.summarise(rows, all_methods, 'v2_served'),
                 'pooled_vs_v3': sel.summarise(rows, all_methods, 'v3'),
                 'continents': {c: sel.summarise(part, all_methods, 'v2_served')
                                for c, part in rows.groupby('continent')}}
        if selection == 'forest_wildland':
            entry['alarms'] = sel.alarms(con, all_methods, 'v2_served')
        result['selections'][selection] = entry
    result['probability'] = probability_checks(con, eval_glob, v2, v3, args.year)
    main_entry = result['selections']['forest_wildland']
    capture = main_entry['pooled_vs_v2']['versus_v2_served']['v3']
    alarm = main_entry['alarms']['1000']['versus_v2_served']['v3']
    brier = result['probability']['brier_v3_minus_v2']
    result['claim'] = {'capture_higher_with_interval_above_zero': capture['difference'] > 0 and capture['interval_95'][0] > 0,
                       'alarm_precision_not_lower': alarm['difference'] >= 0,
                       'brier_not_higher': brier <= 0}
    result['claim']['v3_beats_v2'] = all(result['claim'].values())
    result['scored_at'] = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    out.write_text(json.dumps(result, indent=1, default=str) + '\n')
    m = main_entry['pooled_vs_v2']['methods']
    print('capture', {k: round(v['capture_rate'], 4) for k, v in m.items()})
    print('capture v3 - v2', capture)
    print('alarm@1000', {k: round(v['precision'], 4) for k, v in main_entry['alarms']['1000']['methods'].items()})
    print('brier', result['probability']['brier_v2'], result['probability']['brier_v3'])
    print('claim', result['claim'])
    print('wrote', out)


if __name__ == '__main__':
    main()
