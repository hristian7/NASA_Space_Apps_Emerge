"""The protocol supplies expected ordering: FWI, then history, then seed."""
import datetime as dt
import sys
from pathlib import Path

import pyarrow as pa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from export_week import rank, export


def toy_grid():
    return pa.table({'spot_id': [1, 2, 3, 4, 5], 'lat': [42.] * 5, 'lon': [23.] * 5,
                     'precision_radius_km': [17.] * 5, 'region_id': ['BG-01'] * 5,
                     'country': ['BGR'] * 5, 'fuel_class': ['forest', 'shrub_grass', 'forest', 'farmland', 'forest']})


def test_protocol_ranking_and_missing_values():
    grid = toy_grid()
    history = pa.table({'spot_id': [1, 2, 3, 4, 5], 'hist_p': [.1, .9, .2, 1., .3]})
    rows = rank(grid, pa.array([10., 10., 12., 100., None]), dt.date(2026, 11, 16), history)
    assert [row['spot_id'] for row in rows] == [3, 2, 1]
    assert rank(grid, pa.array([10., 10., 12., 100., None]), dt.date(2026, 11, 16), history) == rows


def test_export_records_run_and_lead(tmp_path):
    result = export(toy_grid(), [(dt.date(2026, 11, 16), pa.array([10., 9., 8., 99., None]))], '2026111200', tmp_path / 'week', tmp_path)
    spot = result['BGR']['regions']['BG-01']['2026-11-16'][0]
    assert spot['p'] is None and spot['inputs']['fwi'] == 10
    assert spot['lead_days'] == 4 and spot['run_date'] == '2026-11-12'
    assert (tmp_path / 'week/BGR.json').exists()
