"""Independent fixtures run against the risk pipeline and its SQL."""
import ast
import csv
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[2]
ORACLE = ROOT / 'tests/expected/risk'
sys.path.insert(0, str(ROOT / 'pipeline/risk'))
import backtest
import build_grid
import build_labels
spec = importlib.util.spec_from_file_location('build_cells', ROOT / 'pipeline/build_cells.py')
build_cells = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_cells)


# Each strict xfail records an observed disagreement or unavailable implementation.
# Unexpected passes fail the suite and require a fresh oracle review.
OBSERVED = {'test_leakage[same day input]': 'expected training allowed=False, got no training admission function',
 'test_leakage[test date in training]': 'expected training allowed=False, got no training admission function',
 'test_leakage[training cutoff violated]': 'expected training allowed=False, got no training admission function',
 'test_leakage[training older input]': 'expected training allowed=True, got no training admission function',
 'test_leakage[training permitted]': 'expected training allowed=True, got no training admission function',
 'test_leakage[validation date in training]': 'expected training allowed=False, got no training admission function',
 'test_ranking[full]': 'expected [1, 4, 3, 2, 6, 5, 7, 8, 10], got [1, 3, 4, 2, 6, 5, 7, 8, 10]',
 'test_ranking[top]': 'expected [1, 4, 3, 2, 6], got [1, 3, 4, 2, 6]',
 'test_scores[A-brier_mean]': 'expected 0.21555556, got 0.23999999999999996',
 'test_scores[A-brier_skill]': 'expected -0.24358974, got -0.1999999999999993',
 'test_scores[A-history_brier_mean]': 'expected 0.17333333, got 0.2000000000000001',
 'test_scores[B-brier_mean]': 'expected 0.20444444, got 0.22666666666666668',
 'test_scores[B-brier_skill]': 'expected -0.30496454, got -0.25925925925925886',
 'test_scores[B-history_brier_mean]': 'expected 0.15666667, got 0.18000000000000008',
 'test_scores[pooled-brier_mean]': 'expected 0.19703704, got 0.21777777777777776',
 'test_scores[pooled-brier_skill]': 'expected -0.25768322, got -0.20987654320987792',
 'test_scores[pooled-history_brier_mean]': 'expected 0.15666667, got 0.1799999999999998',
 'test_scores[small-brier_mean]': 'expected 0.17111111, got 0.18666666666666665',
 'test_scores[small-brier_skill]': 'expected -0.22222222, got -0.16666666666666607',
 'test_scores[small-history_brier_mean]': 'expected 0.14, got 0.16000000000000006',
 'test_spot_id[Rila-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[Rila-0.25-precision_radius_km]': 'precision_radius_km: expected 17.305077, got 17.30511969269677',
 'test_spot_id[Strandzha-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[Strandzha-0.25-precision_radius_km]': 'precision_radius_km: expected 17.305077, got 17.30511969269677',
 'test_spot_id[east antimeridian-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[east antimeridian-0.25-center_lat]': 'center_lat: expected -0.125, got 0.125',
 'test_spot_id[east antimeridian-0.25-precision_radius_km]': 'precision_radius_km: expected 19.65664, got '
                                                             '19.656675427213738',
 'test_spot_id[east antimeridian-0.25-row]': 'row: expected 360, got 359',
 'test_spot_id[east antimeridian-0.25-spot_id]': 'spot_id: expected 518400, got 516960',
 'test_spot_id[edge-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[edge-0.25-center_lat]': 'center_lat: expected 42.125, got 42.375',
 'test_spot_id[edge-0.25-precision_radius_km]': 'precision_radius_km: expected 17.305077, got 17.28085900666964',
 'test_spot_id[edge-0.25-row]': 'row: expected 191, got 190',
 'test_spot_id[edge-0.25-spot_id]': 'spot_id: expected 275854, got 274414',
 'test_spot_id[equator-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[equator-0.25-center_lat]': 'center_lat: expected -0.125, got 0.125',
 'test_spot_id[equator-0.25-precision_radius_km]': 'precision_radius_km: expected 19.65664, got 19.656675427213738',
 'test_spot_id[equator-0.25-row]': 'row: expected 360, got 359',
 'test_spot_id[equator-0.25-spot_id]': 'spot_id: expected 519120, got 517680',
 'test_spot_id[near north pole-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[near north pole-0.25-precision_radius_km]': 'precision_radius_km: expected 13.899366, got '
                                                           '13.899418107184182',
 'test_spot_id[near south pole-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[near south pole-0.25-precision_radius_km]': 'precision_radius_km: expected 13.899366, got '
                                                           '13.899418107184182',
 'test_spot_id[north pole-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[north pole-0.25-precision_radius_km]': 'precision_radius_km: expected 13.899366, got 13.899418107184182',
 'test_spot_id[northeast-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[northeast-0.25-precision_radius_km]': 'precision_radius_km: expected 17.95632, got 17.95636133372332',
 'test_spot_id[northwest of edge-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[northwest of edge-0.25-precision_radius_km]': 'precision_radius_km: expected 17.280816, got '
                                                             '17.28085900666964',
 'test_spot_id[northwest-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[northwest-0.25-precision_radius_km]': 'precision_radius_km: expected 17.449426, got 17.44946806269967',
 'test_spot_id[prime meridian east-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[prime meridian east-0.25-center_lat]': 'center_lat: expected -0.125, got 0.125',
 'test_spot_id[prime meridian east-0.25-precision_radius_km]': 'precision_radius_km: expected 19.65664, got '
                                                               '19.656675427213738',
 'test_spot_id[prime meridian east-0.25-row]': 'row: expected 360, got 359',
 'test_spot_id[prime meridian east-0.25-spot_id]': 'spot_id: expected 519120, got 517680',
 'test_spot_id[prime meridian west-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[prime meridian west-0.25-center_lat]': 'center_lat: expected -0.125, got 0.125',
 'test_spot_id[prime meridian west-0.25-precision_radius_km]': 'precision_radius_km: expected 19.65664, got '
                                                               '19.656675427213738',
 'test_spot_id[prime meridian west-0.25-row]': 'row: expected 360, got 359',
 'test_spot_id[prime meridian west-0.25-spot_id]': 'spot_id: expected 519119, got 517679',
 'test_spot_id[south pole-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[south pole-0.25-precision_radius_km]': 'precision_radius_km: expected 13.899366, got 13.899418107184182',
 'test_spot_id[southeast of edge-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[southeast of edge-0.25-precision_radius_km]': 'precision_radius_km: expected 17.305077, got '
                                                             '17.30511969269677',
 'test_spot_id[southeast-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[southeast-0.25-precision_radius_km]': 'precision_radius_km: expected 18.065547, got 18.06558798687279',
 'test_spot_id[southwest-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[southwest-0.25-precision_radius_km]': 'precision_radius_km: expected 18.850933, got 18.85097079681576',
 'test_spot_id[west antimeridian-0.1-grid_support]': 'expected grid support, got rejected grid',
 'test_spot_id[west antimeridian-0.25-center_lat]': 'center_lat: expected -0.125, got 0.125',
 'test_spot_id[west antimeridian-0.25-precision_radius_km]': 'precision_radius_km: expected 19.65664, got '
                                                             '19.656675427213738',
 'test_spot_id[west antimeridian-0.25-row]': 'row: expected 360, got 359',
 'test_spot_id[west antimeridian-0.25-spot_id]': 'spot_id: expected 518400, got 516960'}


def observed(test, case_id, *args):
    reason = OBSERVED.get(f'{test}[{case_id}]')
    if reason:
        return pytest.param(*args, id=case_id, marks=pytest.mark.xfail(strict=True, reason=reason))
    return pytest.param(*args, id=case_id)


def data(name):
    return json.loads((ORACLE / (name + '.json')).read_text())


def statement(module, text):
    """Take literal SQL from the implementation, keeping its rules authoritative."""
    tree = ast.parse(Path(module.__file__).read_text())
    matches = [n.value for n in ast.walk(tree) if isinstance(n, ast.Constant)
               and isinstance(n.value, str) and text in n.value]
    assert len(matches) == 1
    return matches[0]


def ids(cases):
    return [c.get('name', str(i)) for i, c in enumerate(cases)]


SPOTS = data('spot_id')['cases']
SPOT_FIELDS = [(c, field) for c in SPOTS for field in (('grid_support',) if c['g'] != .25 else ('row','col','spot_id','center_lat','center_lon','precision_radius_km'))]
@pytest.mark.parametrize('case,field', [observed('test_spot_id', f"{c['name']}-{c['g']}-{field}", c, field) for c,field in SPOT_FIELDS])
def test_spot_id(case, field, monkeypatch):
    if case['g'] != .25:
        monkeypatch.setattr(sys, 'argv', ['build_grid.py', '--grid', str(case['g'])])
        try:
            build_grid.main()
        except SystemExit:
            pytest.fail('expected grid support, got rejected grid')
    # build_labels consumes 0.01-degree cell indices produced by build_cells.
    c = duckdb.connect()
    c.execute('CREATE TABLE source(cy INTEGER,cx INTEGER,day DATE,sat VARCHAR)')
    c.execute('INSERT INTO source VALUES (floor(? * 100),floor(? * 100),DATE \'2025-01-01\',\'NOAA20\')', [case['lat'],case['lon']])
    c.execute('CREATE TABLE mask(cy INTEGER,cx INTEGER)')
    sql = statement(build_labels, 'CREATE TEMP TABLE fire AS')
    sql = sql.replace('read_parquet(?) d', 'source d').replace('read_parquet(?) m', 'mask m')
    c.execute(sql)
    row, col = c.execute('SELECT row,col FROM fire').fetchone()
    # Expressions are lifted verbatim from build_grid's matched and COPY queries.
    sql = statement(build_grid, 'sqrt(pow(6371.0088')
    expr = sql.split('sqrt(pow(6371.0088', 1)[1].split(' AS precision_radius_km', 1)[0]
    radius = c.execute('SELECT sqrt(pow(6371.0088' + expr + ' FROM (SELECT ? AS lat) m', [89.875-row*.25]).fetchone()[0]
    got = {'row':row, 'col':col, 'spot_id':row*1440+col,
           'center_lat':89.875-row*.25, 'center_lon':-179.875+col*.25,
           'precision_radius_km':radius}
    expected = case.get('alternative_wrapped_or_clamped', case)
    assert got[field] == pytest.approx(expected[field], abs=1e-6, rel=0), f'{field}: expected {expected[field]}, got {got[field]}'


REGIONS = data('regions')
@pytest.fixture(scope='module')
def region_db():
    path = ROOT / 'data/raw/naturalearth/ne_10m_admin_1_states_provinces.geojson'
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != REGIONS['sha256']:
        pytest.skip('Natural Earth admin-1 missing or checksum differs from oracle')
    c = duckdb.connect()
    c.execute('LOAD spatial')
    c.execute('CREATE TABLE regions AS SELECT iso_3166_2 AS region_id, name, geom FROM ST_Read(?)', [str(path)])
    return c


@pytest.mark.parametrize('case', REGIONS['cases'], ids=ids(REGIONS['cases']))
def test_regions(case, region_db):
    # Same ST_Intersects and ordering as build_grid, with the oracle point supplied directly.
    sql = statement(build_grid, 'CREATE TEMP TABLE matched AS')
    assert 'ST_Intersects(geom, ST_Point(' in sql and 'ORDER BY region_id, country' in sql
    row = region_db.execute('SELECT region_id,name FROM regions WHERE ST_Intersects(geom,ST_Point(?,?)) ORDER BY region_id LIMIT 1', [case['lon'],case['lat']]).fetchone()
    assert row == (case['expected']['iso_3166_2'], case['expected']['name'])


LABELS = data('labels')
LABEL_CASES = LABELS['cases'] + [dict(name=f"neighbour {x['prior_detection']['spot']} day {x['prior_detection']['day']}", detections=[x['prior_detection'],x['current_detection']], target_spot=[1,1], expected=x['expected']) for x in LABELS['neighbour_probes']]
@pytest.mark.parametrize('case', LABEL_CASES, ids=ids(LABEL_CASES))
def test_labels(case):
    c = duckdb.connect()
    c.execute('CREATE TABLE raw(cy INTEGER,cx INTEGER,day DATE,sat VARCHAR,sensor VARCHAR,conf VARCHAR,type INTEGER,latitude DOUBLE,longitude DOUBLE,frp DOUBLE)')
    c.execute('CREATE TABLE mask(cy INTEGER,cx INTEGER)')
    # Toy 4-column wrap maps its last column to global column 1439.
    def coords(spot):
        r, col = spot
        if case['name'] == 'wrap neighbour' and col == 3:
            col = 1439
        return 8999-r*25, col*25-18000
    for detection in case['detections']:
        cy,cx = coords(detection['spot'])
        if detection['static_source']:
            c.execute('INSERT INTO mask VALUES (?,?)', [cy,cx])
        sat = {'NOAA-20':'NOAA20','S-NPP':'SNPP','NOAA-21':'NOAA21'}[detection['satellite']]
        c.execute("INSERT INTO raw VALUES (?,?,DATE '2025-07-03' + ?::INTEGER,?,'viirs',?,0,0,0,1)", [cy,cx,detection['day'],sat,detection['confidence']])
    # Use the upstream filter from build_cells.sql, which creates cell_days.
    upstream = build_cells.sql(Path('/unused'), None)
    predicate = upstream.split('    WHERE type = 0',1)[1].split(';',1)[0]
    c.execute('CREATE TABLE source AS SELECT cy,cx,day,sat FROM raw WHERE type = 0' + predicate)
    sql = statement(build_labels, 'CREATE TEMP TABLE fire AS').replace('read_parquet(?) d','source d').replace('read_parquet(?) m','mask m')
    c.execute(sql)
    c.execute(statement(build_labels, 'CREATE TEMP TABLE continuing AS'))
    row,col = case['target_spot']
    result = c.execute("SELECT CASE WHEN c.day IS NULL THEN 'new' ELSE 'continuing' END FROM fire f LEFT JOIN continuing c USING(row,col,day) WHERE f.row=? AND f.col=? AND f.day=DATE '2025-07-03'", [row,col]).fetchone()
    assert (result[0] if result else None) == case['expected']


RANK = data('ranking')
@pytest.mark.parametrize('case,order', [observed('test_ranking', order, RANK, order) for order in ('top','full')])
def test_ranking(case, order):
    c = duckdb.connect()
    c.execute('CREATE TABLE candidates(region_id VARCHAR,spot_id INTEGER,fuel_class VARCHAR,day DATE,fwi DOUBLE,hist_p DOUBLE,label VARCHAR,p DOUBLE)')
    c.executemany("INSERT INTO candidates VALUES (?,?,'forest',DATE '2025-07-01',1,?,'none',?)", [(r['region'],r['spot_id'],r['history'],r['p']) for r in case['rows']])
    backtest.selection_scores(c, 'forest_wildland', 2025, True)
    got = [r[0] for r in c.execute('SELECT spot_id FROM ranked WHERE region_id=? ORDER BY rank_model',[case['region']]).fetchall()]
    expected = case['expected_spot_ids'] if order == 'top' else case['all_ranked_spot_ids']
    got = got[:case['top_n']] if order == 'top' else got
    assert got == expected, f'expected {expected}, got {got}'


LEAK = data('leakage')['cases']
@pytest.mark.parametrize('case', [observed('test_leakage', c['name'], c) for c in LEAK])
def test_leakage(case):
    # There is no model training/admission function in this pipeline.
    pytest.fail(f"expected training allowed={case['allowed_in_training']}, got no training admission function")


MODEL = data('model_file')['cases']
@pytest.mark.parametrize('case', MODEL, ids=ids(MODEL))
def test_model_file(case, tmp_path):
    c = duckdb.connect()
    day = dt.date(2025,1,1)
    for folder in ('fwi_0.25/month=2025-01','history_0.25/month=2025-01'):
        (tmp_path/folder).mkdir(parents=True)
    def parquet(query, path):
        c.execute('COPY ('+query+') TO ? (FORMAT PARQUET)', [str(path)])
    parquet("SELECT 1 AS spot_id,'X' AS region_id,'forest' AS fuel_class,0.0 AS lat,0.0 AS lon",tmp_path/'grid_0.25.parquet')
    parquet("SELECT 1 AS spot_id, DATE '2025-01-01' AS day,1.0 AS fwi",tmp_path/'fwi_0.25/month=2025-01/2025-01-01.parquet')
    parquet("SELECT 1 AS spot_id, DATE '2025-01-01' AS day,0.2 AS hist_p",tmp_path/'history_0.25/month=2025-01/history.parquet')
    parquet("SELECT 1 AS spot_id, DATE '2025-01-01' AS day,'new' AS label",tmp_path/'labels_0.25.parquet')
    pred = tmp_path/'model.csv'
    with pred.open('w', newline='') as f:
        w=csv.writer(f); w.writerow(case['columns']); w.writerows(case['rows'])
    try:
        backtest.prepare_candidates(c,tmp_path,2025,['X'],pred)
        valid = True
    except (ValueError, duckdb.Error):
        valid = False
    assert valid == case['valid']

SCORES = data('scores')
SCORE_CASES = [(scope, metric) for scope in ('pooled','A','B','small') for metric in
               ('new_fires','captured_new','eligible_days','hit_days','capture','hit_rate',
                'continuing_fires','captured_continuing','continuing_capture',
                'brier_mean','history_brier_mean','brier_skill')]
SCORE_CASES += [(scope, metric) for scope in ('A','B','small') for metric in ('land_spots','lift_over_random','report_separately')]

@pytest.fixture(scope='module')
def score_results():
    c = duckdb.connect()
    c.execute('CREATE TABLE candidates(region_id VARCHAR,spot_id INTEGER,fuel_class VARCHAR,day DATE,fwi DOUBLE,hist_p DOUBLE,label VARCHAR,p DOUBLE)')
    for d in SCORES['days']:
        for i,p,h in zip(SCORES['spot_ids'],SCORES['probabilities'],SCORES['history_probabilities']):
            label = 'new' if i in d['new'] else 'continuing' if i in d['continuing'] else 'none'
            c.execute('INSERT INTO candidates VALUES (?,?,\'forest\',?,1,?,?,?)', [d['region'],i,d['day'],h,label,p])
        # Unlisted land spots have no probabilities and count only toward land size.
        for i in range(7,SCORES['regions'][d['region']]['land_spots']+1):
            c.execute("INSERT INTO candidates VALUES (?,?,'forest',?,NULL,NULL,'none',NULL)", [d['region'],i,d['day']])
    results = {}
    for scope in ('pooled','A','B','small'):
        con = c if scope == 'pooled' else duckdb.connect()
        if scope != 'pooled':
            con.execute('CREATE TABLE candidates(region_id VARCHAR,spot_id INTEGER,fuel_class VARCHAR,day DATE,fwi DOUBLE,hist_p DOUBLE,label VARCHAR,p DOUBLE)')
            con.executemany('INSERT INTO candidates VALUES (?,?,?,?,?,?,?,?)', c.execute('SELECT * FROM candidates WHERE region_id=?',[scope]).fetchall())
        result = backtest.selection_scores(con,'forest_wildland',2025,True)
        # The oracle supplies top-five lists and separate overlapping event sets.
        # Translate those fixtures to the region-day records aggregate() consumes.
        days = [d for d in SCORES['days'] if scope == 'pooled' or d['region'] == scope]
        records = []
        for d in days:
            n, new, cont, captured, captured_cont = con.execute(
                'SELECT ?, len(?::INTEGER[]), len(?::INTEGER[]), len(list_intersect(?::INTEGER[],?::INTEGER[])), len(list_intersect(?::INTEGER[],?::INTEGER[]))',
                [SCORES['regions'][d['region']]['land_spots'],d['new'],d['continuing'],d['new'],d['top5'],d['continuing'],d['top5']]).fetchone()
            records.append({'n':n,'new':new,'continuing':cont,'capture_model':captured,
                            'hit_model':int(captured>0),'continuing_model':captured_cont})
        result['oracle_aggregate'] = backtest.aggregate([r for r in records if r['new']], ['model'])
        result['oracle_continuing'] = backtest.aggregate(records, ['model'])
        results[scope] = result
    return results

@pytest.mark.parametrize('scope,metric', [observed('test_scores', f'{scope}-{metric}', scope, metric) for scope,metric in SCORE_CASES])
def test_scores(scope, metric, score_results):
    result = score_results[scope]
    expected_obj = SCORES['pooled'] if scope == 'pooled' else SCORES['regions'][scope]
    expected = expected_obj[metric]
    if isinstance(expected, dict):
        expected = expected['value']
    pool = result['oracle_aggregate']; method = pool['methods']['model']; prob = result['probability']
    continuing = result['oracle_continuing']; cm = continuing['methods']['model']
    got = {'new_fires':pool['new_fires'], 'captured_new':method['captured_new'],
           'eligible_days':pool['region_days'], 'hit_days':round(method['hit_rate']*pool['region_days']),
           'capture':method['capture_rate'], 'hit_rate':method['hit_rate'],
           'continuing_fires':continuing['continuing_fires'], 'captured_continuing':cm['captured_continuing'],
           'continuing_capture':cm['continuing_capture_rate'], 'brier_mean':prob['brier'],
           'history_brier_mean':prob['history_brier'], 'brier_skill':prob['brier_skill']}
    if scope != 'pooled':
        region = result['regions'][scope]
        got.update(land_spots=region['land_spots'],lift_over_random=method['lift_over_random'],
                   report_separately=result['regions_under_20']['region_days'] > 0)
    assert got[metric] == pytest.approx(expected, abs=1e-7), f"expected {expected}, got {got[metric]}"
