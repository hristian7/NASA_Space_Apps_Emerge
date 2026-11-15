"""Examples follow the independently specified NOAA-20 neighbour rule."""
import datetime as dt
import importlib.util
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

spec = importlib.util.spec_from_file_location('score_daily', Path(__file__).parents[1] / 'score_daily.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_firms_shape_confidence_mask_neighbours_and_wrap(tmp_path):
    # Independent expected cases: prior neighbour, antimeridian neighbour,
    # masked and low confidence detections cannot start or continue a fire.
    csv = tmp_path / 'firms.csv'
    csv.write_text('latitude,longitude,acq_date,confidence,satellite\n'
        '0.1,0.1,2026-11-12,nominal,N\n'
        '0.1,0.3,2026-11-14,high,N\n'  # adjacent, continuing
        '0.1,1.1,2026-11-14,n,N\n'  # new
        '0.1,2.1,2026-11-14,low,N\n'  # excluded
        '0.1,3.1,2026-11-14,h,N\n'  # masked
        '0.1,179.9,2026-11-13,high,N\n'
        '0.1,-179.9,2026-11-14,nominal,N\n'  # wraps, continuing
        '0.1,4.1,2026-11-15,nominal,N\n')
    mask = tmp_path / 'mask.parquet'
    pq.write_table(pa.table({'cy': [10], 'cx': [310]}), mask)
    base = tmp_path / 'base.parquet'
    pq.write_table(pa.table({'cy': pa.array([], type=pa.int64()), 'cx': pa.array([], type=pa.int64()),
        'day': pa.array([], type=pa.date32()), 'sat': pa.array([], type=pa.string())}), base)
    con = duckdb.connect()
    first, newest = module.detection_spots(con, csv, mask, base)
    assert (first, newest) == (dt.date(2026, 11, 12), dt.date(2026, 11, 15))
    module.new_fires(con, dt.date(2026, 11, 14))
    # Cell-centre mapping: row 359, column 724 for longitude 1.1.
    assert con.execute('SELECT spot_id FROM new_fires').fetchall() == [(359 * 1440 + 724,)]


def test_daily_log_is_idempotent_and_updates_only_matching_key():
    row = {'date': '2026-11-14', 'scope': 'world', 'new_fires': 5,
           'captured_by_us': 2, 'captured_by_index': 1, 'regions_scored': 3}
    card = {'other': {'keep': True}}
    assert module.update_log(card, [row])
    assert not module.update_log(card, [row])
    assert card == {'other': {'keep': True}, 'daily_log': [row]}
