"""The protocol fixes the latest allowed fire at the end of D-k."""
import datetime as dt
from pathlib import Path
import subprocess
import sys

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq
import pytest


@pytest.mark.parametrize('lead', range(4, 9))
def test_lead_history_ignores_fires_after_issue_day(tmp_path, lead):
    day = dt.date(2025, 7, 15)
    cutoff = day - dt.timedelta(days=lead)
    spot = 1440 * 300 + 200
    weather = tmp_path / f'fwi_lead{lead}_0.25' / 'month=2025-07'
    weather.mkdir(parents=True)
    pq.write_table(pa.table({'spot_id': [spot], 'day': [day]}), weather / f'{day}.parquet')
    pq.write_table(pa.table({'spot_id': [spot]}), tmp_path / 'grid_0.25.parquet')
    labels = tmp_path / 'labels_0.25.parquet'
    pq.write_table(pa.table({'spot_id': [spot, spot], 'day': [dt.date(2024, 7, 1), cutoff]}), labels)
    command = [sys.executable, str(Path(__file__).parents[1] / 'build_history.py'),
               '--start', str(day), '--end', str(day), '--lead', str(lead), '--data', str(tmp_path)]
    subprocess.run(command, check=True, capture_output=True, text=True)
    output = tmp_path / f'history_lead{lead}_0.25' / 'month=2025-07' / 'history.parquet'
    query = 'SELECT hist_p,last_year_same_month,days_since_last_fire,fire_near_3d FROM read_parquet(?)'
    before = duckdb.connect().execute(query, [str(output)]).fetchone()
    assert before == (1 / 7, True, lead, True)
    pq.write_table(pa.table({'spot_id': [spot, spot, spot],
                             'day': [dt.date(2024, 7, 1), cutoff, cutoff + dt.timedelta(days=1)]}), labels)
    subprocess.run(command, check=True, capture_output=True, text=True)
    after = duckdb.connect().execute(query, [str(output)]).fetchone()
    assert after == before
