#!/usr/bin/env python3
"""Unattended plan 3 run on the 2025 settings year, gentle on a shared laptop.

1. Waits for the GFS weather download, then builds the weather inputs.
2. Waits until the machine is quiet: processes working inside the folder
   named by RISK_QUIET_WATCH (optional) use little processor time and enough
   memory is free.
3. Fits the v2 refit and each input group, applies the PROTOCOL.md rule
   (capture higher and alarm precision at 1,000 a day not lower than the
   v2 refit), combines the passing groups and keeps the better final set.
4. Searches model settings on that set, one configuration at a time.

Never reads 2026 and never scores the test period. Before each heavy step it
pauses while the machine is busy again. It stops itself if its own memory
passes MAX_RSS_GB. Progress is saved after every step, so a rerun resumes.
Run it at low priority:  caffeinate -i nice -n 15 python v3_auto.py
"""
import argparse
import datetime as dt
import itertools
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import time

import v3_inputs
import v3_select as sel

V3 = sel.V3
STATE = V3 / 'auto_2025.json'
LOG_PREFIX = '[v3-auto]'
# Other work on the same machine to give way to: a folder path, or unset.
WATCH = os.environ.get('RISK_QUIET_WATCH', '')
QUIET_CPU_PERCENT = 25.0
MIN_FREE_MEMORY_PERCENT = 30
GATE = {'min_free_memory': MIN_FREE_MEMORY_PERCENT, 'run_now': False}
QUIET_MINUTES_TO_START = 20
QUIET_MINUTES_TO_RESUME = 10
MAX_RSS_GB = 12
GROUPS = ('calendar', 'people', 'plants_soil', 'weather')
GUARD_K = '1000'


def log(*parts):
    print(LOG_PREFIX, dt.datetime.now().strftime('%Y-%m-%d %H:%M'), *parts, flush=True)


def watched_cpu():
    """Total processor use of processes whose working folder is inside RISK_QUIET_WATCH."""
    if not WATCH:
        return 0.0
    listing = subprocess.run(['lsof', '-d', 'cwd', '-Fpn'], capture_output=True, text=True).stdout
    pids, pid = set(), None
    for line in listing.splitlines():
        if line.startswith('p'):
            pid = line[1:]
        elif line.startswith('n') and line[1:].startswith(WATCH):
            pids.add(pid)
    if not pids:
        return 0.0
    out = subprocess.run(['ps', '-o', '%cpu=', '-p', ','.join(sorted(pids))], capture_output=True, text=True).stdout
    return sum(float(v) for v in out.split())


def free_memory_percent():
    out = subprocess.run(['memory_pressure'], capture_output=True, text=True).stdout
    match = re.search(r'free percentage:\s*(\d+)%', out)
    return int(match.group(1)) if match else 0


def quiet():
    if GATE['run_now']:
        return True, 0.0, 100
    cpu, free = watched_cpu(), free_memory_percent()
    return cpu < QUIET_CPU_PERCENT and free >= GATE['min_free_memory'], cpu, free


def wait_until_quiet(minutes, reason):
    if GATE['run_now']:
        return
    needed, streak, announced = minutes * 60, 0, False
    while streak < needed:
        ok, cpu, free = quiet()
        if ok:
            streak += 120
        else:
            streak = 0
            if not announced:
                log(f'waiting ({reason}): watched processes {cpu:.0f}% CPU, memory free {free}%')
                announced = True
        if streak < needed:
            time.sleep(120)
    if announced:
        log('machine quiet, continuing')


def pause_if_busy():
    ok, _, _ = quiet()
    if not ok:
        wait_until_quiet(QUIET_MINUTES_TO_RESUME, 'paused')


def memory_watchdog():
    while True:
        rss_kb = subprocess.run(['ps', '-o', 'rss=', '-p', str(os.getpid())], capture_output=True, text=True).stdout
        if rss_kb.strip() and int(rss_kb) / 1048576 > MAX_RSS_GB:
            log(f'stopping: memory use passed {MAX_RSS_GB} GB; progress so far is saved in {STATE.name}')
            os._exit(3)
        time.sleep(10)


def save(state):
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, indent=1, default=str) + '\n')
    tmp.replace(STATE)


def wait_for_weather():
    needed = (V3 / 'gfs_0.25/2025-12.parquet', V3 / 'smap_0.25/2025-12.parquet', V3 / 'ndvi_normal_0.25.parquet')
    announced = False
    while any(subprocess.run(['pgrep', '-f', name], capture_output=True).returncode == 0
              for name in ('v3_weather.py', 'v3_plants_soil.py')) or not all(p.exists() for p in needed):
        if not announced:
            log('waiting for the weather, greenness and soil moisture downloads')
            announced = True
        time.sleep(600)
    if not (V3 / 'weather_0.25/2025-12.parquet').exists():
        v3_inputs.weather()


def judge(scores, name, reference='v2_refit'):
    pooled = scores['forest_wildland']['pooled']['methods']
    guard = scores['forest_wildland']['alarms_per_day_worldwide'][GUARD_K]['methods']
    capture = pooled[name]['capture_rate'] - pooled[reference]['capture_rate']
    alarm = guard[name]['precision'] - guard[reference]['precision']
    return {'capture_vs_v2_refit': capture, 'alarm_precision_vs_v2_refit': alarm,
            'capture': pooled[name]['capture_rate'], 'alarm_precision': guard[name]['precision'],
            'passes': capture > 0 and alarm >= 0}


def fit(con, state, name, groups, eval_glob, configs=sel.DEFAULT_CONFIGS):
    if name not in state['fits']:
        log('fitting', name, groups)
        state['fits'][name] = {'groups': list(groups),
                               **sel.fit_variant(con, name, list(groups), sel.DATA, eval_glob, configs, pause_if_busy)}
        save(state)
    return V3 / state['fits'][name]['predictions']


def search_configs():
    grid = itertools.product((15, 31, 63), ((0.08, 120), (0.03, 400)), (20, 200), (1.0, 0.7))
    return [{'num_leaves': leaves, 'max_depth': 6 if leaves < 63 else 8, 'learning_rate': rate,
             'n_estimators': trees, 'min_child_samples': child, 'colsample_bytree': columns}
            for leaves, (rate, trees), child, columns in grid]


def search_one(index):
    """One settings trial on the final input set, saved into the shared state file."""
    state = json.loads(STATE.read_text())
    config = search_configs()[index]
    con = sel.connect(sel.DATA)
    eval_glob = str(V3 / f'evalall_{sel.YEAR}/*.parquet')
    name = f'search_{index:02d}'
    pred = fit(con, state, name, state['final_groups'], eval_glob, configs=(config,))
    sel.TRAIN_CACHE.clear()
    refit = V3 / state['fits']['v2_refit']['predictions']
    scores = sel.score_all(con, eval_glob, {'v2_refit': refit, name: pred}, selections=('forest_wildland',))
    verdict = judge(scores, name)
    state = json.loads(STATE.read_text())
    state['fits'][name] = state['fits'].get(name) or {'selected_params': {**sel.BASE_PARAMS, **config}}
    state['search'].append({'config_index': index, 'params': {**sel.BASE_PARAMS, **config}, **verdict})
    save(state)
    log(name, f"capture {verdict['capture']:.4f}", f"alarm precision {verdict['alarm_precision']:.4f}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--threads', type=int, default=4)
    ap.add_argument('--memory-gb', type=int, default=4)
    ap.add_argument('--min-free-memory', type=int, default=MIN_FREE_MEMORY_PERCENT,
                    help='pause while free memory is below this percentage')
    ap.add_argument('--now', action='store_true', help='skip waiting for a quiet machine; other limits stay')
    ap.add_argument('--search-index', type=int, help=argparse.SUPPRESS)
    ap.add_argument('--build-train-cache', action='store_true', help=argparse.SUPPRESS)
    args = ap.parse_args()
    sel.LIMITS.update(threads=args.threads, memory_gb=args.memory_gb)
    GATE['min_free_memory'] = args.min_free_memory
    GATE['run_now'] = args.now
    threading.Thread(target=memory_watchdog, daemon=True).start()
    if args.search_index is not None:
        return search_one(args.search_index)
    if args.build_train_cache:
        state = json.loads(STATE.read_text())
        groups = state['final_groups']
        train = [str(p) for p in sorted((sel.DATA / 'training_0.25').glob('202[1234]-*.parquet'))]
        settings = [str(p) for p in sorted((sel.DATA / 'training_0.25').glob(f'{sel.YEAR}-*.parquet'))]
        sel.training_arrays(sel.connect(sel.DATA), groups, sel.features(groups), train, settings)
        log('training cache written for', groups)
        return 0
    state = json.loads(STATE.read_text()) if STATE.exists() else {'fits': {}, 'scores': {}, 'search': []}
    log('start; threads', args.threads, 'database memory', args.memory_gb, 'GB')
    wait_for_weather()
    wait_until_quiet(QUIET_MINUTES_TO_START, 'before starting')
    con = sel.connect(sel.DATA)
    eval_glob = str(V3 / f'evalall_{sel.YEAR}/*.parquet')

    preds = {'v2_refit': fit(con, state, 'v2_refit', (), eval_glob)}
    for group in GROUPS:
        preds[group] = fit(con, state, f'auto_{group}', (group,), eval_glob)
    if 'groups' not in state['scores']:
        pause_if_busy()
        state['scores']['groups'] = sel.score_all(con, eval_glob, preds)
        save(state)
    verdicts = {g: judge(state['scores']['groups'], g) for g in GROUPS}
    state['group_verdicts'] = verdicts
    passing = [g for g in GROUPS if verdicts[g]['passes']]
    final = passing
    if len(passing) > 1:
        combo = fit(con, state, 'auto_combined', passing, eval_glob)
        if 'combined' not in state['scores']:
            pause_if_busy()
            state['scores']['combined'] = sel.score_all(con, eval_glob, {'v2_refit': preds['v2_refit'], 'combined': combo})
            save(state)
        combined = judge(state['scores']['combined'], 'combined')
        best = max(passing, key=lambda g: verdicts[g]['capture'])
        state['combined_verdict'] = combined
        final = passing if combined['passes'] and combined['capture'] >= verdicts[best]['capture'] else [best]
    state['final_groups'] = final
    save(state)
    log('final input groups', final or 'none (v2 inputs only)')

    # Each settings trial runs in its own process, so all its memory returns to the system.
    # A first child only writes the training arrays to disk, so trials skip the database join.
    sel.TRAIN_CACHE.clear()
    con.close()
    if subprocess.run([sys.executable, __file__, '--build-train-cache']).returncode != 0:
        log('could not build the training cache')
        return 4
    for index, _ in enumerate(search_configs()):
        if index in {entry['config_index'] for entry in state['search']}:
            continue
        pause_if_busy()
        child = subprocess.run([sys.executable, __file__, '--search-index', str(index),
                                '--threads', str(args.threads), '--memory-gb', str(args.memory_gb),
                                '--min-free-memory', str(args.min_free_memory)] + (['--now'] if args.now else []))
        if child.returncode != 0:
            log(f'settings trial {index} stopped with exit code {child.returncode}; progress is saved')
            return child.returncode
        state = json.loads(STATE.read_text())
        best = max((e for e in state['search'] if e['passes']), key=lambda e: e['capture'], default=None)
        for entry in state['search']:
            folder = V3 / f"pred_{sel.YEAR}_search_{entry['config_index']:02d}"
            if folder.exists() and (best is None or entry['config_index'] != best['config_index']):
                shutil.rmtree(folder)
    best = max((e for e in state['search'] if e['passes']), key=lambda e: e['capture'], default=None)
    state['chosen'] = best
    state['finished'] = dt.datetime.now().isoformat(timespec='minutes')
    save(state)
    log('finished; chosen settings', best['params'] if best else 'none passed, keep the default')


if __name__ == '__main__':
    sys.exit(main())
