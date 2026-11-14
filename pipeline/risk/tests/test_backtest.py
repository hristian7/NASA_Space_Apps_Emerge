import datetime as dt
import importlib.util
from pathlib import Path

import duckdb
import pytest

spec = importlib.util.spec_from_file_location('risk_backtest', Path(__file__).parents[1] / 'backtest.py')
risk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(risk)


@pytest.fixture
def candidates():
    c = duckdb.connect()
    c.execute('''CREATE TABLE candidates(region_id VARCHAR,spot_id INTEGER,fuel_class VARCHAR,
                 day DATE,fwi DOUBLE,hist_p DOUBLE,label VARCHAR,p DOUBLE)''')
    day = dt.date(2025, 7, 1)
    rows = [('A', i, 'forest', day, float(i), (7-i)/10, 'new' if i == 1 else 'none', (7-i)/10)
            for i in range(1,7)]
    rows += [('B', 10+i, 'forest', day, float(i), 0.2, 'new' if i == 1 else 'none', 0.2)
             for i in range(1,4)]
    rows += [('C', 30, 'farmland', day, None, 0.1, 'new', None)]
    c.executemany('INSERT INTO candidates VALUES (?,?,?,?,?,?,?,?)', rows)
    return c


def test_pooled_capture_hits_and_small_region_lift(candidates):
    result = risk.selection_scores(candidates, 'forest_wildland', 2025)
    pooled = result['pooled']
    assert pooled['new_fires'] == 2
    assert pooled['region_days'] == 2
    assert pooled['methods']['fwi']['capture_rate'] == pytest.approx(0.5)
    assert pooled['methods']['fwi']['hit_rate'] == pytest.approx(0.5)
    assert pooled['methods']['history']['capture_rate'] == 1
    assert result['regions']['A']['methods']['history']['lift_over_random'] == pytest.approx(1.2)
    assert pooled['methods']['history']['lift_over_random'] == pytest.approx(12/11)
    assert result['regions_under_20']['region_days'] == 2


def test_missing_fwi_is_excluded_and_reported(candidates):
    result = risk.selection_scores(candidates, 'all_vegetation', 2025)
    assert result['coverage'] == {'eligible_spot_days': 10, 'scored_spot_days': 9,
                                  'eligible_new_fires': 3, 'scored_new_fires': 2}


def test_ties_use_history_before_seed(candidates):
    candidates.execute("UPDATE candidates SET fwi=1 WHERE region_id='A'")
    result = risk.selection_scores(candidates, 'forest_wildland', 2025)
    assert result['regions']['A']['methods']['fwi']['captured_new'] == 1


def test_model_brier_and_bootstrap_are_repeatable(candidates):
    first = risk.selection_scores(candidates, 'forest_wildland', 2025, True)
    second = risk.selection_scores(candidates, 'forest_wildland', 2025, True)
    assert first['probability']['brier'] == pytest.approx(first['probability']['history_brier'])
    assert first['probability']['brier_skill'] == pytest.approx(0)
    assert first['bootstrap'] == second['bootstrap']
    assert sum(row['n'] for row in first['probability']['reliability']) == 9


def test_continuing_only_days_are_scored_separately(candidates):
    candidates.execute("UPDATE candidates SET label='continuing' WHERE region_id='A' AND spot_id=1")
    result = risk.selection_scores(candidates, 'forest_wildland', 2025)
    assert result['pooled']['region_days'] == 1
    assert result['continuing']['region_days'] == 1
    assert result['continuing']['methods']['history']['capture_rate'] == 1
    assert result['continuing']['methods']['fwi']['capture_rate'] == 0


def test_plugin_csv_and_region_outside_europe(tmp_path):
    import pyarrow as pa
    import pyarrow.parquet as pq

    day = dt.date(2024, 1, 1)
    weather = tmp_path / 'fwi_0.25' / 'month=2024-01'
    history = tmp_path / 'history_0.25' / 'month=2024-01'
    weather.mkdir(parents=True)
    history.mkdir(parents=True)
    pq.write_table(pa.table({'spot_id': [1, 2], 'region_id': ['X', 'X'],
                             'fuel_class': ['forest', 'forest'], 'lat': [0., 0.], 'lon': [80., 80.]}),
                   tmp_path / 'grid_0.25.parquet')
    pq.write_table(pa.table({'spot_id': [1, 2], 'day': [day, day], 'fwi': [3., 2.]}), weather / '2024-01-01.parquet')
    pq.write_table(pa.table({'spot_id': [1, 2], 'day': [day, day], 'hist_p': [0.4, 0.1]}), history / 'history.parquet')
    pq.write_table(pa.table({'spot_id': [1], 'day': [day], 'label': ['new']}), tmp_path / 'labels_0.25.parquet')
    pred = tmp_path / 'pred.csv'
    pred.write_text('grid_g,spot_id,day,p\n0.25,1,2024-01-01,0.4\n0.25,2,2024-01-01,\n')
    con = duckdb.connect()
    assert risk.prepare_candidates(con, tmp_path, 2024, ['X'], pred) == [day]
    result = risk.selection_scores(con, 'all_vegetation', 2024, True)
    assert result['coverage']['eligible_spot_days'] == 2
    assert result['coverage']['scored_spot_days'] == 1
    assert result['probability']['brier_skill'] == pytest.approx(0)
    pred.write_text('grid_g,spot_id,day,p\n0.25,1,2024-01-01,0.4\n0.25,1,2024-01-01,0.5\n')
    with pytest.raises(ValueError, match='duplicate'):
        risk.prepare_candidates(con, tmp_path, 2024, ['X'], pred)


def test_small_region_classification_uses_all_land_spots(candidates):
    day = dt.date(2025, 7, 1)
    candidates.executemany('INSERT INTO candidates VALUES (?,?,?,?,?,?,?,?)',
                           [('A', 100+i, None, day, None, 0., 'none', None) for i in range(20)])
    result = risk.selection_scores(candidates, 'forest_wildland', 2025)
    assert result['regions']['A']['land_spots'] == 26
    assert result['regions_20_or_more']['region_days'] == 1
    assert result['regions_under_20']['region_days'] == 1


def test_missing_scores_do_not_remove_eligible_fires_from_capture(candidates):
    result = risk.selection_scores(candidates, 'all_vegetation', 2025)
    assert result['pooled']['new_fires'] == 3
    assert result['pooled']['region_days'] == 3
    assert result['region_days_without_scores'] == 1
    assert result['pooled']['methods']['history']['captured_new'] == 2
    assert result['pooled']['methods']['history']['capture_rate'] == pytest.approx(2/3)
    assert result['regions']['C']['min_scored_spots'] == 0


def test_history_baseline_has_brier_and_reliability(candidates):
    result = risk.selection_scores(candidates, 'forest_wildland', 2025)
    probability = result['probability']
    assert probability['history_brier'] > 0
    assert probability['history_brier_skill'] == 0
    assert sum(row['n'] for row in probability['history_reliability']) == 9
