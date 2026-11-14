#!/usr/bin/env python3
"""Score plug-in probabilities and the registered baselines on common candidates."""
import argparse
import datetime as dt
import json
from collections import defaultdict
from pathlib import Path

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
SEED = 20261114
DRAWS = 2000


def ratio(a, b):
    return a / b if b else None


def aggregate(rows, methods):
    """Pool region-day counts, preserving a fire-weighted random expectation."""
    result = {'region_days': len(rows), 'new_fires': sum(r['new'] for r in rows),
              'continuing_fires': sum(r['continuing'] for r in rows), 'methods': {}}
    expected = sum(r['new'] * min(5, r['n']) / r['n'] for r in rows if r['n'])
    for method in methods:
        captured = sum(r[f'capture_{method}'] for r in rows)
        hits = sum(r[f'hit_{method}'] for r in rows)
        continuing = sum(r[f'continuing_{method}'] for r in rows)
        result['methods'][method] = {
            'captured_new': captured, 'capture_rate': ratio(captured, result['new_fires']),
            'hit_rate': ratio(hits, len(rows)), 'lift_over_random': ratio(captured, expected),
            'captured_continuing': continuing,
            'continuing_capture_rate': ratio(continuing, result['continuing_fires'])}
    return result


def bootstrap(rows, year, methods):
    """Resample calendar-week blocks, keeping all regions together."""
    if 'model' not in methods or not rows:
        return {}
    start = dt.date(year, 1, 1)
    blocks = (dt.date(year + 1, 1, 1) - start).days
    count = (blocks + 6) // 7
    totals = np.zeros((count, 1 + len(methods)), dtype=np.float64)
    for r in rows:
        b = (r['day'] - start).days // 7
        totals[b, 0] += r['new']
        for i, method in enumerate(methods):
            totals[b, i+1] += r[f'capture_{method}']
    rng = np.random.default_rng(SEED)
    samples = rng.integers(0, count, size=(DRAWS, count))
    drawn = totals[samples].sum(axis=1)
    result = {}
    model_index = methods.index('model') + 1
    for method in methods:
        if method == 'model':
            continue
        index = methods.index(method) + 1
        valid = drawn[:, 0] > 0
        differences = (drawn[valid, model_index] - drawn[valid, index]) / drawn[valid, 0]
        actual = ratio(totals[:, model_index].sum() - totals[:, index].sum(), totals[:, 0].sum())
        low, high = (np.quantile(differences, [0.025, 0.975]).tolist() if len(differences) else (None, None))
        result[method] = {'difference': actual, 'interval_95': [low, high], 'valid_draws': int(valid.sum()),
                          'bootstrap_passed': bool(actual is not None and actual > 0 and low is not None and low > 0), 'claim_permitted': False}
    return result


def selection_scores(con, selection, year, has_model=False):
    """Input table candidates has one row per region, spot and available day."""
    classes = {'forest_wildland': "('forest','shrub_grass')",
               'all_vegetation': "('forest','shrub_grass','farmland')",
               'forest_only': "('forest')",
               'other_vegetation': "('shrub_grass','farmland')"}[selection]
    model_filter = 'AND p IS NOT NULL' if has_model else ''
    methods = ['fwi', 'history', 'random'] + (['model'] if has_model else [])
    coverage = con.execute(f"""
      SELECT count(*), count(*) FILTER (WHERE fwi IS NOT NULL AND hist_p IS NOT NULL {model_filter}),
             count(*) FILTER (WHERE label='new'),
             count(*) FILTER (WHERE label='new' AND fwi IS NOT NULL AND hist_p IS NOT NULL {model_filter})
      FROM candidates WHERE fuel_class IN {classes}
    """).fetchone()
    rankings = ["row_number() OVER (PARTITION BY region_id,day ORDER BY fwi DESC, hist_p DESC, hash(spot_id,day,20261114), spot_id) AS rank_fwi",
                "row_number() OVER (PARTITION BY region_id,day ORDER BY hist_p DESC, hash(spot_id,day,20261114), spot_id) AS rank_history",
                "row_number() OVER (PARTITION BY region_id,day ORDER BY hash(spot_id,day,20261114), spot_id) AS rank_random"]
    if has_model:
        rankings.append("row_number() OVER (PARTITION BY region_id,day ORDER BY p DESC, hist_p DESC, hash(spot_id,day,20261114), spot_id) AS rank_model")
    con.execute(f"""
      CREATE OR REPLACE TEMP TABLE ranked AS
      SELECT *, {', '.join(rankings)} FROM candidates
      WHERE fuel_class IN {classes} AND fwi IS NOT NULL AND hist_p IS NOT NULL {model_filter}
    """)
    con.execute(f"""
      CREATE OR REPLACE TEMP TABLE eligible_days AS
      SELECT day,region_id,count(*) FILTER (WHERE label='new') AS new,
             count(*) FILTER (WHERE label='continuing') AS continuing
      FROM candidates WHERE fuel_class IN {classes} GROUP BY day,region_id
      HAVING count(*) FILTER (WHERE label IN ('new','continuing'))>0
    """)
    per_method = ', '.join(
        f"count(*) FILTER (WHERE label='new' AND rank_{m}<=5) AS capture_{m}, "
        f"(count(*) FILTER (WHERE label='new' AND rank_{m}<=5)>0)::INTEGER AS hit_{m}, "
        f"count(*) FILTER (WHERE label='continuing' AND rank_{m}<=5) AS continuing_{m}, "
        f"(count(*) FILTER (WHERE label='continuing' AND rank_{m}<=5)>0)::INTEGER AS continuing_hit_{m}" for m in methods)
    selected = ', '.join(
        f"coalesce(r.capture_{m},0) AS capture_{m}, coalesce(r.hit_{m},0) AS hit_{m}, "
        f"coalesce(r.continuing_{m},0) AS continuing_{m}, coalesce(r.continuing_hit_{m},0) AS continuing_hit_{m}" for m in methods)
    query = con.execute(f"""
      WITH per_rank AS (SELECT day,region_id,count(*) AS n,{per_method}
                        FROM ranked GROUP BY day,region_id)
      SELECT e.day,e.region_id,coalesce(r.n,0) AS n,e.new,e.continuing,{selected}
      FROM eligible_days e LEFT JOIN per_rank r USING(day,region_id)
      ORDER BY e.day,e.region_id
    """)
    columns = [x[0] for x in query.description]
    all_fire_rows = [dict(zip(columns, row)) for row in query.fetchall()]
    rows = [r for r in all_fire_rows if r['new'] > 0]
    continuing_rows = [r for r in all_fire_rows if r['continuing'] > 0]
    continuing = {'region_days': len(continuing_rows),
                  'fires': sum(r['continuing'] for r in continuing_rows), 'methods': {}}
    for method in methods:
        captured = sum(r[f'continuing_{method}'] for r in continuing_rows)
        continuing['methods'][method] = {
            'captured': captured, 'capture_rate': ratio(captured, continuing['fires']),
            'hit_rate': ratio(sum(r[f'continuing_hit_{method}'] for r in continuing_rows), len(continuing_rows))}
    by_region, by_month, small, large = defaultdict(list), defaultdict(list), [], []
    land_spots = dict(con.execute('SELECT region_id, count(DISTINCT spot_id) FROM candidates GROUP BY region_id').fetchall())
    for r in rows:
        by_region[r['region_id']].append(r)
        by_month[r['day'].strftime('%Y-%m')].append(r)
        (small if land_spots[r['region_id']] < 20 else large).append(r)
    regions = {}
    for region in sorted(land_spots):
        items = by_region[region]
        regions[region] = {'land_spots': land_spots[region],
                           'min_scored_spots': min((r['n'] for r in items), default=None),
                           'max_scored_spots': max((r['n'] for r in items), default=None),
                           **aggregate(items, methods)}
    months = [r[0] for r in con.execute("SELECT DISTINCT strftime(day, '%Y-%m') FROM candidates ORDER BY 1").fetchall()]
    result = {'coverage': dict(zip(['eligible_spot_days', 'scored_spot_days', 'eligible_new_fires', 'scored_new_fires'], coverage)),
              'pooled': aggregate(rows, methods), 'continuing': continuing,
              'region_days_without_scores': sum(r['n'] == 0 for r in rows),
              'regions_under_20': aggregate(small, methods), 'regions_20_or_more': aggregate(large, methods),
              'regions': regions, 'months': {k: aggregate(by_month[k], methods) for k in months},
              'bootstrap': bootstrap(rows, year, methods)}
    # The same fire-positive region-days as the ranking are used for probability metrics.
    query = con.execute("""
      WITH active AS (SELECT region_id,day FROM eligible_days WHERE new>0),
      scored AS (SELECT r.*, (label='new')::INTEGER AS actual FROM ranked r JOIN active USING(region_id,day))
      SELECT count(*), avg(pow(p-actual,2)), avg(pow(hist_p-actual,2)) FROM scored
    """).fetchone()
    n, model_brier, history_brier = query
    history_bins = con.execute("""
      WITH active AS (SELECT region_id,day FROM eligible_days WHERE new>0)
      SELECT least(9, floor(hist_p*10)::INTEGER) AS bin, count(*) AS n, avg(hist_p), avg((label='new')::INTEGER)
      FROM ranked JOIN active USING(region_id,day) GROUP BY 1 ORDER BY 1
    """).fetchall()
    probability = {'n': n, 'history_brier': history_brier,
                   'history_brier_skill': 0.0 if history_brier else None,
                   'history_reliability': [{'bin': b, 'n': count, 'predicted': p, 'observed': obs}
                                           for b,count,p,obs in history_bins]}
    if has_model:
        bins = con.execute("""
          WITH active AS (SELECT region_id,day FROM eligible_days WHERE new>0)
          SELECT least(9, floor(p*10)::INTEGER) AS bin, count(*) AS n, avg(p), avg((label='new')::INTEGER)
          FROM ranked JOIN active USING(region_id,day) GROUP BY 1 ORDER BY 1
        """).fetchall()
        probability.update({'brier': model_brier,
                            'brier_skill': 1-model_brier/history_brier if history_brier else None,
                            'reliability': [{'bin': b, 'n': count, 'predicted': p, 'observed': obs}
                                            for b,count,p,obs in bins]})
    result['probability'] = probability
    return result


def prepare_candidates(con, data, year, regions, predictions):
    fwi = sorted((data / 'fwi_0.25').glob(f'month={year}-*/*.parquet'))
    if not fwi:
        return []
    history = sorted((data / 'history_0.25').glob(f'month={year}-*/history.parquet'))
    if not history:
        raise ValueError(f'No history for {year}')
    days = [dt.date.fromisoformat(p.stem) for p in fwi]
    con.execute('CREATE OR REPLACE TEMP TABLE weather AS SELECT spot_id,day,fwi FROM read_parquet(?, hive_partitioning=false)', [[str(x) for x in fwi]])
    con.execute('CREATE OR REPLACE TEMP TABLE history AS SELECT spot_id,day,hist_p FROM read_parquet(?, hive_partitioning=false)', [[str(x) for x in history]])
    missing = con.execute('SELECT count(*) FROM (SELECT DISTINCT day FROM weather EXCEPT SELECT DISTINCT day FROM history)').fetchone()[0]
    if missing:
        raise ValueError(f'{missing} weather days lack history; rerun build_history.py')
    con.execute('CREATE OR REPLACE TEMP TABLE grid AS SELECT spot_id,region_id,fuel_class,lat,lon FROM read_parquet(?)', [str(data / 'grid_0.25.parquet')])
    if regions:
        con.execute('DELETE FROM grid WHERE region_id NOT IN (SELECT unnest(?::VARCHAR[]))', [regions])
    else:
        con.execute('DELETE FROM grid WHERE lon NOT BETWEEN -25 AND 45 OR lat NOT BETWEEN 34 AND 72')
    if predictions:
        reader = 'read_parquet' if predictions.suffix.lower() == '.parquet' else 'read_csv_auto'
        con.execute(f'''CREATE OR REPLACE TEMP TABLE predictions AS
                       SELECT grid_g,spot_id,day::DATE AS day,try_cast(p AS DOUBLE) AS p,
                              p IS NOT NULL AND try_cast(p AS DOUBLE) IS NULL AS invalid_p
                       FROM {reader}(?)''', [str(predictions)])
        invalid = con.execute('SELECT count(*) FROM predictions WHERE grid_g IS NULL OR grid_g<>0.25 OR spot_id IS NULL OR day IS NULL OR invalid_p OR (p IS NOT NULL AND (NOT isfinite(p) OR p<0 OR p>1))').fetchone()[0]
        duplicates = con.execute('SELECT count(*) FROM (SELECT spot_id,day FROM predictions GROUP BY 1,2 HAVING count(*)>1)').fetchone()[0]
        if invalid or duplicates:
            raise ValueError(f'Invalid prediction rows: {invalid}; duplicate spot-days: {duplicates}')
        join = 'LEFT JOIN predictions p ON f.spot_id=p.spot_id AND f.day=p.day'
        model = 'p.p'
    else:
        join, model = '', 'NULL::DOUBLE AS p'
    con.execute(f"""
      CREATE OR REPLACE TEMP TABLE candidates AS
      SELECT g.region_id,g.spot_id,g.fuel_class,f.day,f.fwi,h.hist_p,
             coalesce(l.label,'none') AS label,{model}
      FROM grid g JOIN weather f USING (spot_id)
      JOIN history h ON h.spot_id=f.spot_id AND h.day=f.day
      LEFT JOIN read_parquet(?) l ON l.spot_id=f.spot_id AND l.day=f.day
      {join}
    """, [str(data / 'labels_0.25.parquet')])
    expected = con.execute('SELECT count(*) FROM grid').fetchone()[0] * len(days)
    actual, distinct = con.execute('SELECT count(*), count(DISTINCT (spot_id,day)) FROM candidates').fetchone()
    if actual != expected or distinct != expected:
        raise ValueError(f'Weather/history coverage is incomplete or duplicated: expected {expected}, rows {actual}, unique {distinct}')
    return days


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, action='append', required=True)
    parser.add_argument('--regions', help='comma-separated Natural Earth region IDs, anywhere in the world; default is Europe')
    parser.add_argument('--predictions', type=Path)
    parser.add_argument('--data', type=Path, default=DATA)
    parser.add_argument('--out', type=Path, default=DATA / 'scorecard_baselines_europe.json')
    args = parser.parse_args()
    if args.predictions and args.out == DATA / 'scorecard_baselines_europe.json':
        parser.error('use a separate --out for a model scorecard')
    con = duckdb.connect()
    con.execute('SET threads=4')
    con.execute("SET memory_limit='6GB'")
    con.execute('SET temp_directory=?', [str(args.data / 'duckdb_tmp')])
    card = {'schema': 'emerge-risk-baseline-scorecard-1', 'grid_g': 0.25,
            'scope': {'name': 'selected regions' if args.regions else 'Europe', 'bounds': None if args.regions else [-25,34,45,72], 'region_ids': args.regions.split(',') if args.regions else None},
            'seed': SEED, 'bootstrap_draws': DRAWS, 'years': {},
            'notes': ['Rankings use common available candidate spots; all eligible fires on forecast days remain in the capture denominator, even when their spots have missing scores.',
                      'Fuel categories are 2021 majority land classes, not land-cover shares.',
                      'The 0.25 degree grid is a development grid and cannot support a shipped-grid claim.']}
    for year in args.year:
        print('preparing', year, flush=True)
        days = prepare_candidates(con, args.data, year, args.regions.split(',') if args.regions else None, args.predictions)
        entry = {'weather_days': len(days), 'first_day': min(days).isoformat() if days else None,
                 'last_day': max(days).isoformat() if days else None, 'selections': {}}
        if days:
            for selection in ('forest_wildland','all_vegetation','forest_only','other_vegetation'):
                print('scoring', year, selection, flush=True)
                entry['selections'][selection] = selection_scores(con, selection, year, bool(args.predictions))
        card['years'][str(year)] = entry
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temp = args.out.with_suffix(args.out.suffix + '.tmp')
    temp.write_text(json.dumps(card, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    temp.replace(args.out)
    print('wrote', args.out, flush=True)


if __name__ == '__main__':
    main()
