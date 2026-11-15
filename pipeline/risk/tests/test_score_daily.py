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


def test_firms_labels_match_preregistered_independent_oracle(tmp_path):
    import csv
    import json
    oracle = json.loads((Path(__file__).parents[3] / 'tests/expected/risk/labels.json').read_text())
    cases = list(oracle['cases']) + [
        {'name': 'neighbour probe', 'detections': [item['prior_detection'], item['current_detection']],
         'target_spot': [1, 1], 'expected': item['expected']}
        for item in oracle['neighbour_probes']]
    target_day = dt.date(2025, 7, 3)
    for case in cases:
        csv_path = tmp_path / 'firms.csv'
        mask_cells = set()
        rows = []
        for detection in case['detections']:
            if detection['satellite'] != 'NOAA-20':
                continue  # This NASA file contains NOAA-20 only.
            row, col = detection['spot']
            if case['name'] == 'wrap neighbour' and col == 3:
                col = 1439
            cy, cx = 8999 - row * 25, col * 25 - 18000
            if detection['static_source']:
                mask_cells.add((cy, cx))
            rows.append([(cy + .5) / 100, (cx + .5) / 100,
                         (target_day + dt.timedelta(days=detection['day'])).isoformat(), detection['confidence']])
        # Guarantee the file has an acquisition date even when the case has no NOAA-20 rows.
        rows.append([0.1, 0.1, '2025-07-04', 'n'])
        with csv_path.open('w', newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(['latitude', 'longitude', 'acq_date', 'confidence'])
            writer.writerows(rows)
        mask = tmp_path / 'mask.parquet'
        pq.write_table(pa.table({'cy': pa.array([x[0] for x in mask_cells], type=pa.int64()),
                                 'cx': pa.array([x[1] for x in mask_cells], type=pa.int64())}), mask)
        base = tmp_path / 'base.parquet'
        pq.write_table(pa.table({'cy': pa.array([], type=pa.int64()), 'cx': pa.array([], type=pa.int64()),
            'day': pa.array([], type=pa.date32()), 'sat': pa.array([], type=pa.string())}), base)
        con = duckdb.connect()
        module.detection_spots(con, csv_path, mask, base)
        module.new_fires(con, target_day)
        row, col = case['target_spot']
        spot = row * 1440 + col
        seen = con.execute('SELECT count(*) FROM detections WHERE spot_id=? AND day=?', [spot, target_day]).fetchone()[0]
        is_new = con.execute('SELECT count(*) FROM new_fires WHERE spot_id=?', [spot]).fetchone()[0]
        actual = ('new' if is_new else 'continuing') if seen else None
        assert actual == case['expected'], case['name']
