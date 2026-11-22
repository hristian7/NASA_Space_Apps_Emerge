"""Ordering follows the registered history, model and seeded tie rules."""
import datetime as dt
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from export_week import rank, export, ranking_method, find_run, live_inputs
from features import FEATURES, WEATHER


def toy_grid():
    return pa.table({'spot_id': [1, 2, 3, 4, 5], 'lat': [42.] * 5, 'lon': [23.] * 5,
                     'precision_radius_km': [17.] * 5, 'region_id': ['BG-01'] * 5,
                     'country': ['BGR'] * 5, 'fuel_class': ['forest', 'shrub_grass', 'forest', 'farmland', 'forest']})


def test_history_and_model_ranking_and_missing_values():
    grid = toy_grid()
    history = pa.table({'spot_id': [1, 2, 3, 4, 5], 'hist_p': [.1, .9, .2, 1., .3]})
    values = pa.array([10., 10., 12., 100., None])
    day = dt.date(2026, 11, 16)
    rows = rank(grid, values, day, history)
    assert [row['spot_id'] for row in rows] == [2, 3, 1]
    assert rank(grid, values, day, history) == rows
    predictions = pa.table({'spot_id': [1, 2, 3, 4, 5], 'p': [.8, .2, .8, .99, .9]})
    assert [row['spot_id'] for row in rank(grid, values, day, history, 'model', predictions)] == [3, 1, 2]


def test_export_records_run_lead_and_method(tmp_path):
    grid = toy_grid()
    history = pa.table({'spot_id': [1, 2, 3, 4, 5], 'hist_p': [.9, .3, .2, 1., .1]})
    day = dt.date(2026, 11, 16)
    out = tmp_path / 'week'
    out.mkdir()
    (out / 'USA.json').write_text('{}')
    result = export(grid, [(day, pa.array([10., 9., 8., 99., None]), history, None, 'history')], '2026111200', out)
    spot = result['BGR']['regions']['BG-01']['2026-11-16'][0]
    assert spot['p'] is None and spot['inputs']['fwi'] == 10
    assert spot['lead_days'] == 4 and spot['run_date'] == '2026-11-12'
    assert result['BGR']['ranking'][str(day)] == 'history'
    assert (tmp_path / 'week/BGR.json').exists()
    assert not (out / 'USA.json').exists()


def test_method_requires_positive_shipped_world_bootstrap():
    comparison = {'claim_permitted': True, 'bootstrap_passed': True, 'valid_draws': 2000,
                  'difference': .1, 'interval_95': [.01, .2]}
    selection = {'bootstrap': {'history': comparison}, 'pooled': {'methods': {
        'model': {'capture_rate': .3}, 'history': {'capture_rate': .2}}}}
    card = {'grid_g': .25, 'week': {'test_year': 2025, 'leads': {'4': {'scopes': {
        'world': {'selections': {'forest_wildland': selection}}}}}}}
    assert ranking_method(card, 4) == 'model'
    comparison['interval_95'][0] = 0
    assert ranking_method(card, 4) == 'history'
    assert ranking_method(card, 5) == 'history'


def test_newest_run_can_have_fewer_than_five_future_days(monkeypatch):
    def listing(url):
        if url.endswith('/2026/'):
            return 'href="2026111200/" href="2026111100/"'
        if url.endswith('/2026111200/'):
            return 'href="FWI.GEOS-5.Daily.Default.2026111200.20261117.nc"'
        raise AssertionError('Older runs should not be preferred over the newest available run')
    monkeypatch.setattr('export_week.listing', listing)
    run, files = find_run(dt.date(2026, 11, 15))
    assert run == '2026111200'
    assert files == ['FWI.GEOS-5.Daily.Default.2026111200.20261117.nc']


def test_live_model_uses_cutoff_safe_history(tmp_path):
    day = dt.date(2026, 11, 17)
    grid = toy_grid()
    pq.write_table(grid, tmp_path / 'grid_0.25.parquet')
    pq.write_table(pa.table({'spot_id': [1, 1], 'day': [day - dt.timedelta(days=5), day - dt.timedelta(days=4)]}),
                   tmp_path / 'labels_0.25.parquet')
    (tmp_path / 'duckdb_tmp').mkdir()
    weather = pa.table({'spot_id': grid['spot_id'], 'day': [day] * 5,
                        **{field: [1.] * 5 for field in WEATHER}})
    model = {'mean': [0.] * len(FEATURES), 'scale': [1.] * len(FEATURES),
             'coefficients': [0.] * len(FEATURES), 'intercept': 0.,
             'calibration_slope': 1., 'calibration_intercept': 0.}
    history, predictions = live_inputs(grid, weather, day, 5, tmp_path, model, None)
    row = next(row for row in history.to_pylist() if row['spot_id'] == 1)
    assert row['days_since_last_fire'] == 5
    assert predictions.num_rows == 5
    assert predictions['p'].to_pylist() == [.5] * 5


def test_country_without_ranked_spots_still_gets_its_fire_weather(tmp_path):
    grid = pa.table({'spot_id': [1, 2, 3, 4, 5, 6], 'lat': [42.] * 5 + [64.], 'lon': [23.] * 5 + [-19.],
                     'precision_radius_km': [17.] * 6, 'region_id': ['BG-01'] * 5 + ['IS-1'],
                     'country': ['BGR'] * 5 + ['ISL'],
                     'fuel_class': ['forest', 'shrub_grass', 'forest', 'farmland', 'forest', None]})
    history = pa.table({'spot_id': [1, 2, 3, 4, 5, 6], 'hist_p': [.9, .3, .2, 1., .1, None]})
    day = dt.date(2026, 11, 23)
    out = tmp_path / 'week'
    result = export(grid, [(day, pa.array([10., 9., 8., 99., None, 4.25]), history, None, 'history')], '2026111900', out)
    assert result['ISL']['regions'] == {}
    assert result['ISL']['days'] == ['2026-11-23']
    assert result['ISL']['fwi']['2026-11-23'] == [[6, 4.2]] or result['ISL']['fwi']['2026-11-23'] == [[6, 4.3]]
    assert (out / 'ISL.json').exists()
    assert [6, 4.2] not in result['BGR']['fwi']['2026-11-23'] and [6, 4.3] not in result['BGR']['fwi']['2026-11-23']
