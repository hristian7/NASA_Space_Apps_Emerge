#!/usr/bin/env python3
"""Plan 3 input-group selection: train on 2021 to 2024, compare on the 2025 settings year.

Never reads 2026. Ranking, candidates and capture follow the plan 2 rules in
PROTOCOL.md (same tie order and seed). Every vegetation spot-day is predicted,
so false alarms on days without fires are measured too: the share of the K
highest-ranked spot-days worldwide each day that had a new fire, at equal K
for every model. The v2 refit on 2021 to 2024 is the reference each group
must beat.
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import duckdb
from lightgbm import LGBMClassifier
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
from sklearn.metrics import log_loss

from features import FEATURES as BASE, feature_sql
from features_v3 import extra_sql, features, from_sql

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
V3 = DATA / 'v3'
SEED = 20261114
DRAWS = 2000
YEAR = 2025
VEGETATION = "('forest','shrub_grass','farmland')"
SELECTIONS = {'forest_wildland': "('forest','shrub_grass')", 'all_vegetation': VEGETATION}
LIMITS = {'threads': 8, 'memory_gb': 16}
BASE_PARAMS = {'n_estimators': 120, 'max_depth': 6, 'learning_rate': 0.08}
DEFAULT_CONFIGS = ({'num_leaves': 15}, {'num_leaves': 31})


def connect(data):
    con = duckdb.connect()
    con.execute(f"SET threads={LIMITS['threads']}")
    con.execute(f"SET memory_limit='{LIMITS['memory_gb']}GB'")
    con.execute('SET temp_directory=?', [str(data / 'duckdb_tmp')])
    return con


def build_eval(con, data, out, months=range(1, 13)):
    """Every vegetation spot-day of the settings year, with v2 inputs."""
    con.execute('CREATE OR REPLACE TEMP TABLE grid AS SELECT * FROM read_parquet(?)', [str(data / 'grid_0.25.parquet')])
    con.execute(f"""CREATE OR REPLACE TEMP TABLE labels AS SELECT l.spot_id,l.day,l.label
                   FROM read_parquet(?) l WHERE year(l.day)={YEAR}""", [str(data / 'labels_0.25.parquet')])
    out.mkdir(parents=True, exist_ok=True)
    for month in months:
        ym = f'{YEAR}-{month:02d}'
        weather = sorted((data / 'fwi_0.25' / f'month={ym}').glob('*.parquet'))
        history = data / 'history_0.25' / f'month={ym}' / 'history.parquet'
        if not weather or not history.exists():
            raise SystemExit(f'missing weather or history for {ym}')
        dest = out / f'{ym}.parquet'
        con.execute(f"""COPY (
            SELECT f.spot_id, f.day, g.region_id, g.country, g.fuel_class,
                   coalesce(lb.label,'none') AS label, f.fwi AS rank_fwi, h.hist_p AS rank_hist_p,
                   {feature_sql()}
            FROM read_parquet(?, hive_partitioning=false) f
            JOIN grid g USING(spot_id)
            JOIN read_parquet(?) h ON h.spot_id=f.spot_id AND h.day=f.day
            LEFT JOIN labels lb ON lb.spot_id=f.spot_id AND lb.day=f.day
            WHERE g.fuel_class IN {VEGETATION}
            ORDER BY f.day, f.spot_id) TO ? (FORMAT parquet, COMPRESSION zstd)""",
            [[str(p) for p in weather], str(history), str(dest)])
        print('eval', ym, con.execute('SELECT count(*), count(*) FILTER (WHERE label=?) FROM read_parquet(?)',
                                      ['new', str(dest)]).fetchone(), flush=True)


def load(con, source, groups, names, extras=('target', 'sample_weight'), v3_dir=None):
    """Rows with every v2 input present, streamed into a float32 matrix plus extra columns.

    Added inputs may be missing (NaN). A fixed row order keeps fits identical
    from run to run; streaming keeps memory near the size of the result.
    """
    valid = ' AND '.join(f't.{n} IS NOT NULL AND isfinite(t.{n})' for n in BASE)
    select = ', '.join(f't.{n}' for n in BASE) + extra_sql(groups) + ''.join(f', t.{e}' for e in extras)
    reader = con.execute(f"""SELECT {select}
        {from_sql(groups, v3_dir or V3)}
        WHERE {valid}
        ORDER BY t.day, t.spot_id""", [source]).to_arrow_reader(500_000)
    matrix, other = [], {e: [] for e in extras}
    for batch in reader:
        matrix.append(np.column_stack([pc.cast(batch.column(n), pa.float64()).to_numpy(zero_copy_only=False)
                                       for n in names]).astype(np.float32))
        for e in extras:
            column = batch.column(e)
            if pa.types.is_decimal(column.type):
                column = pc.cast(column, pa.float64())
            other[e].append(column.to_numpy(zero_copy_only=False))
    x = np.concatenate(matrix) if matrix else np.empty((0, len(names)), np.float32)
    del matrix
    return x, {e: np.concatenate(v) for e, v in other.items()}


TRAIN_CACHE = {}


TRAIN_PARTS = ('x', 'y', 'w', 'vx', 'vy', 'vw')


def training_arrays(con, groups, names, train, settings):
    """Training and settings-year arrays for one input set, cached in memory and on disk.

    Reading the cached files avoids the database join, whose working memory
    stays with the process after it finishes.
    """
    key = tuple(groups)
    folder = V3 / f'train_cache_{YEAR}' / ('+'.join(groups) or 'base')
    if key not in TRAIN_CACHE:
        TRAIN_CACHE.clear()
        if all((folder / f'{part}.npy').exists() for part in TRAIN_PARTS):
            TRAIN_CACHE[key] = tuple(np.load(folder / f'{part}.npy') for part in TRAIN_PARTS)
        else:
            x, other = load(con, train, groups, names)
            vx, vother = load(con, settings, groups, names)
            arrays = (x, other['target'].astype(np.int8), other['sample_weight'] / 20.0,
                      vx, vother['target'].astype(np.int8), vother['sample_weight'] / 20.0)
            folder.mkdir(parents=True, exist_ok=True)
            for part, array in zip(TRAIN_PARTS, arrays):
                np.save(folder / f'{part}.npy', array)
            TRAIN_CACHE[key] = arrays
    return TRAIN_CACHE[key]


def eval_month(con, month_file, groups, names):
    """Settings-year inputs for one month, cached on disk per input set."""
    cache = V3 / f'cache_{YEAR}' / ('+'.join(groups) or 'base') / month_file.name
    if cache.exists():
        table = pq.read_table(cache)
        x = np.column_stack([table.column(n).to_numpy(zero_copy_only=False) for n in names])
        return x, table.column('spot_id').to_numpy(), table.column('day')
    x, other = load(con, str(month_file), groups, names, extras=('spot_id', 'day'))
    cache.parent.mkdir(parents=True, exist_ok=True)
    columns = {'spot_id': pa.array(other['spot_id']), 'day': pa.array(other['day'], type=pa.date32()),
               **{n: pa.array(x[:, i]) for i, n in enumerate(names)}}
    pq.write_table(pa.table(columns), cache.with_suffix('.tmp'), compression='zstd')
    cache.with_suffix('.tmp').replace(cache)
    return x, other['spot_id'], pa.array(other['day'], type=pa.date32())


def fit_variant(con, name, groups, data, eval_glob, configs=DEFAULT_CONFIGS, wait=lambda: None):
    """Fit each config, keep the lowest settings-year log loss, predict every eval spot-day.

    `wait` is called before each heavy step so a shared machine can pause the work.
    """
    names = features(groups)
    train = [str(p) for p in sorted((data / 'training_0.25').glob('202[1234]-*.parquet'))]
    settings = [str(p) for p in sorted((data / 'training_0.25').glob(f'{YEAR}-*.parquet'))]
    if len(train) != 48 or len(settings) != 12:
        raise SystemExit('expected 48 training months and 12 settings months')
    lo, hi = con.execute('SELECT min(day),max(day) FROM read_parquet(?)', [train]).fetchone()
    if lo < dt.date(2021, 1, 1) or hi >= dt.date(YEAR, 1, 1):
        raise SystemExit('training rows leak into the settings year')
    wait()
    x, y, w, vx, vy, vw = training_arrays(con, groups, names, train, settings)
    print(name, 'training rows', len(y), 'settings rows', len(vy), flush=True)
    best, trials = None, []
    for config in configs:
        params = {**BASE_PARAMS, **config}
        wait()
        fit = LGBMClassifier(**params, n_jobs=LIMITS['threads'], verbosity=-1, random_state=SEED,
                             deterministic=True, force_col_wise=True)
        fit.fit(x, y, sample_weight=w, feature_name=names)
        loss = float(log_loss(vy, fit.predict_proba(vx)[:, 1], sample_weight=vw, labels=[0, 1]))
        trials.append({'params': params, 'settings_log_loss': loss})
        print(name, params, 'settings log loss', loss, flush=True)
        if best is None or loss < best[0]:
            best = (loss, fit, params)
    loss, fit, chosen = best
    gain = dict(zip(names, fit.booster_.feature_importance('gain').tolist()))
    out = V3 / f'pred_{YEAR}_{name}'
    out.mkdir(exist_ok=True)
    for month_file in sorted(Path(eval_glob).parent.glob('*.parquet')):
        wait()
        ex, spot_id, day = eval_month(con, month_file, groups, names)
        raw = fit.booster_.predict(ex, raw_score=True, num_threads=LIMITS['threads'])
        p = 1 / (1 + np.exp(-np.clip(raw, -700, 700)))
        pq.write_table(pa.table({'spot_id': pa.array(spot_id), 'day': day, 'p': pa.array(p)}),
                       out / month_file.name, compression='zstd')
        del ex, raw, p
    fit.booster_.save_model(str(V3 / f'model_{name}.txt'))
    return {'features': names, 'trials': trials, 'selected_params': chosen,
            'settings_log_loss': loss, 'gain': gain, 'predictions': out.name + '/*.parquet'}


def continents():
    raw = json.loads((ROOT / 'data/raw/naturalearth/ne_10m_admin_0_countries.geojson').read_text())['features']
    table = {}
    for feature in raw:
        p = feature['properties']
        for key in ('ISO_A3_EH', 'ISO_A3', 'ADM0_A3'):
            code = p.get(key)
            if code and code != '-99':
                table.setdefault(code, p['CONTINENT'])
    return table


def score(con, eval_glob, methods, selection):
    """Per region-day captures for every method on common candidates."""
    classes = SELECTIONS[selection]
    joins = ''.join(f" LEFT JOIN read_parquet('{path}') m_{m} ON m_{m}.spot_id=e.spot_id AND m_{m}.day=e.day"
                    for m, path in methods.items())
    common = ' AND '.join(f'm_{m}.p IS NOT NULL' for m in methods)
    con.execute(f"""CREATE OR REPLACE TEMP TABLE cand AS
        SELECT e.spot_id, e.day, e.region_id, e.country, e.label, e.rank_fwi, e.rank_hist_p,
               {', '.join(f'm_{m}.p AS p_{m}' for m in methods)},
               e.rank_fwi IS NOT NULL AND e.rank_hist_p IS NOT NULL AND {common} AS scored
        FROM read_parquet(?) e {joins} WHERE e.fuel_class IN {classes}""", [eval_glob])
    all_methods = ['fwi', 'history', 'random'] + list(methods)
    order = {'fwi': 'rank_fwi DESC, rank_hist_p DESC', 'history': 'rank_hist_p DESC', 'random': ''}
    order.update({m: f'p_{m} DESC, rank_hist_p DESC' for m in methods})
    ranks = ', '.join(
        f"row_number() OVER (PARTITION BY region_id,day ORDER BY {order[m] + ', ' if order[m] else ''}hash(spot_id,day,{SEED}), spot_id) AS r_{m}"
        for m in all_methods)
    captures = ', '.join(f"count(*) FILTER (WHERE label='new' AND r_{m}<=5) AS c_{m}" for m in all_methods)
    rows = con.execute(f"""
        WITH ranked AS (SELECT *, {ranks} FROM cand WHERE scored),
        per AS (SELECT region_id, day, count(*) AS n, {captures} FROM ranked GROUP BY 1,2),
        fires AS (SELECT region_id, day, any_value(country) AS country, count(*) FILTER (WHERE label='new') AS new
                  FROM cand GROUP BY 1,2 HAVING new > 0)
        SELECT f.region_id, f.day, f.country, f.new, coalesce(p.n,0) AS n,
               {', '.join(f'coalesce(p.c_{m},0) AS c_{m}' for m in all_methods)}
        FROM fires f LEFT JOIN per p USING(region_id, day) ORDER BY f.day, f.region_id""").fetchdf()
    return rows, all_methods


ALARM_COUNTS = (100, 1000, 5000)


def alarms(con, methods, reference='v2_refit'):
    """Share of the K highest-ranked spot-days worldwide each day that had a new fire.

    Uses the candidate table of the last score() call; every model flags the
    same number of spots, so a higher share means fewer false alarms.
    """
    order = {'fwi': 'rank_fwi DESC, rank_hist_p DESC', 'history': 'rank_hist_p DESC', 'random': ''}
    order.update({m: f'p_{m} DESC, rank_hist_p DESC' for m in methods if m not in order})
    top = max(ALARM_COUNTS)
    per_day = {}
    for m in methods:
        key = (order[m] + ', ' if order[m] else '') + f'hash(spot_id,day,{SEED}), spot_id'
        counts = ', '.join(f"count(*) FILTER (WHERE label='new' AND rk<={k}) AS f{k}" for k in ALARM_COUNTS)
        frame = con.execute(f"""SELECT day, {counts} FROM (
            SELECT day, label, row_number() OVER (PARTITION BY day ORDER BY {key}) AS rk
            FROM cand WHERE scored) WHERE rk <= {top} GROUP BY day ORDER BY day""").fetchdf()
        per_day[m] = frame.set_index('day')
    days = per_day[reference].index
    week = ((pd.to_datetime(pd.Series(days)) - pd.Timestamp(YEAR, 1, 1)).dt.days // 7).to_numpy()
    blocks = int(week.max()) + 1
    rng = np.random.default_rng(SEED)
    draws = rng.integers(0, blocks, size=(DRAWS, blocks))
    slots = np.bincount(week, minlength=blocks)
    out = {}
    for k in ALARM_COUNTS:
        entry = {'methods': {}, f'versus_{reference}': {}}
        ref = np.bincount(week, per_day[reference].loc[days, f'f{k}'].to_numpy(), blocks)
        for m in methods:
            hits = np.bincount(week, per_day[m].loc[days, f'f{k}'].to_numpy(), blocks)
            entry['methods'][m] = {'alarms': int(k * len(days)), 'alarms_with_fire': int(hits.sum()),
                                   'precision': float(hits.sum() / (k * len(days)))}
            if m != reference:
                diff = (hits[draws].sum(axis=1) - ref[draws].sum(axis=1)) / (k * slots[draws].sum(axis=1))
                entry[f'versus_{reference}'][m] = {
                    'difference': float((hits.sum() - ref.sum()) / (k * len(days))),
                    'interval_95': np.quantile(diff, [0.025, 0.975]).tolist()}
        out[str(k)] = entry
    return out


def summarise(rows, methods, reference):
    new = int(rows['new'].sum())
    expected = float((rows['new'] * np.minimum(5, rows['n']) / rows['n'].where(rows['n'] > 0)).sum())
    out = {'region_days': len(rows), 'new_fires': new, 'methods': {}}
    for m in methods:
        captured = int(rows[f'c_{m}'].sum())
        out['methods'][m] = {'captured_new': captured, 'capture_rate': captured / new if new else None,
                             'lift_over_random': captured / expected if expected else None}
    if reference in methods:
        days = ((pd.to_datetime(rows['day']) - pd.Timestamp(YEAR, 1, 1)).dt.days // 7).to_numpy()
        blocks = int(days.max()) + 1 if len(days) else 0
        rng = np.random.default_rng(SEED)
        draws = rng.integers(0, blocks, size=(DRAWS, blocks)) if blocks else None
        fires = np.bincount(days, rows['new'], blocks) if blocks else None
        ref = np.bincount(days, rows[f'c_{reference}'], blocks) if blocks else None
        out['versus_' + reference] = {}
        for m in methods:
            if m == reference or not blocks:
                continue
            mine = np.bincount(days, rows[f'c_{m}'], blocks)
            total = fires[draws].sum(axis=1)
            ok = total > 0
            diff = (mine[draws].sum(axis=1) - ref[draws].sum(axis=1))[ok] / total[ok]
            low, high = np.quantile(diff, [0.025, 0.975]).tolist()
            out['versus_' + reference][m] = {'difference': float((mine.sum() - ref.sum()) / fires.sum()),
                                             'interval_95': [low, high]}
    return out


def score_all(con, eval_glob, methods, data=DATA, reference='v2_refit', selections=tuple(SELECTIONS)):
    """Capture (pooled and per continent) and alarm precision for each prediction set."""
    methods = {'v2_shipped': data / f'predictions_{YEAR}_v2.parquet', **methods}
    lookup = continents()
    scores = {}
    for selection in selections:
        rows, all_methods = score(con, eval_glob, {k: str(v) for k, v in methods.items()}, selection)
        rows['continent'] = rows['country'].map(lambda c: lookup.get(c, 'Unknown') if c else 'Unknown')
        entry = {'pooled': summarise(rows, all_methods, reference), 'continents': {}}
        for continent, part in rows.groupby('continent'):
            entry['continents'][continent] = summarise(part, all_methods, reference)
        if selection == 'forest_wildland':
            entry['alarms_per_day_worldwide'] = alarms(con, all_methods, reference)
            print('alarms', {k: {m: round(v['precision'], 4) for m, v in e['methods'].items()}
                             for k, e in entry['alarms_per_day_worldwide'].items()}, flush=True)
        scores[selection] = entry
        print(selection, {m: round(v['capture_rate'], 4) for m, v in entry['pooled']['methods'].items()}, flush=True)
    return scores


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--variants', default='v2_refit:,calendar:calendar,people:people,calendar_people:calendar+people')
    ap.add_argument('--rebuild-eval', action='store_true')
    ap.add_argument('--threads', type=int, default=LIMITS['threads'])
    ap.add_argument('--memory-gb', type=int, default=LIMITS['memory_gb'])
    ap.add_argument('--score-only', action='store_true')
    ap.add_argument('--out', type=Path, default=V3 / f'select_{YEAR}.json')
    args = ap.parse_args()
    LIMITS.update(threads=args.threads, memory_gb=args.memory_gb)
    con = connect(args.data)
    eval_dir = V3 / f'evalall_{YEAR}'
    if args.rebuild_eval or not eval_dir.exists():
        build_eval(con, args.data, eval_dir)
    eval_glob = str(eval_dir / '*.parquet')
    result = json.loads(args.out.read_text()) if args.out.exists() else {'variants': {}}
    variants = [v.split(':') for v in args.variants.split(',')]
    if not args.score_only:
        for name, spec in variants:
            groups = [g for g in spec.split('+') if g]
            result['variants'][name] = {'groups': groups, **fit_variant(con, name, groups, args.data, eval_glob)}
            args.out.write_text(json.dumps(result, indent=1, default=str) + '\n')
    methods = {name: V3 / result['variants'][name]['predictions'] for name in result['variants']}
    result['scores'] = score_all(con, eval_glob, methods, args.data)
    result['note'] = ('Settings year 2025 only; ranking-only comparison (no calibration). '
                      'alarms_per_day_worldwide: precision of the K highest spot-days each day, all days included. '
                      'v2_shipped is lightgbm-v2 as served (trained 2021 to 2023).')
    args.out.write_text(json.dumps(result, indent=1, default=str) + '\n')
    print('wrote', args.out, flush=True)


if __name__ == '__main__':
    main()
