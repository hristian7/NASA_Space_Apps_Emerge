import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).parents[1]))
spec = importlib.util.spec_from_file_location('daily', Path(__file__).parents[1] / 'daily.py')
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


def test_newest_run_and_fixed_lead():
    available = dt.date(2026, 11, 12)
    seen = []
    def probe(url):
        seen.append(url)
        return '2026111200.20261115.nc' in url
    assert daily.find_latest(dt.date(2026, 11, 15), probe) == (available, dt.date(2026, 11, 15))
    assert len(seen) == 4
    assert '/2026/2026111200/' in seen[-1]


def test_detection_state_is_idempotent_and_ignores_partial_day(tmp_path):
    world = tmp_path / 'world'
    world.mkdir()
    data = tmp_path / 'risk'
    pq.write_table(pa.table({'cy': pa.array([], type=pa.int64()), 'cx': pa.array([], type=pa.int64())}), world / 'static_mask.parquet')
    pq.write_table(pa.table({'cy': [0], 'cx': [0], 'day': [dt.date(2026, 11, 12)], 'sat': ['NOAA20']}), world / 'cell_days_2026.parquet')
    firms = tmp_path / 'firms.csv'
    firms.write_text('latitude,longitude,acq_date,confidence\n0.1,0.1,2026-11-12,n\n'
                     '0.1,0.2,2026-11-13,nominal\n0.1,0.3,2026-11-14,high\n')
    assert daily.refresh_state(firms, world, data) == (dt.date(2026, 11, 12), dt.date(2026, 11, 13))
    state = data / 'daily_detections.parquet'
    before = (state.read_bytes(), state.stat().st_mtime_ns, (data / 'daily_detections.json').read_bytes())
    assert daily.refresh_state(firms, world, data) == (dt.date(2026, 11, 12), dt.date(2026, 11, 13))
    assert before == (state.read_bytes(), state.stat().st_mtime_ns, (data / 'daily_detections.json').read_bytes())
    assert max(pq.read_table(state)['day'].to_pylist()) == dt.date(2026, 11, 13)
    assert json.loads((data / 'daily_detections.json').read_text())['complete_through'] == '2026-11-13'


def test_publish_first_time_then_only_changed_files(tmp_path, monkeypatch):
    data = tmp_path / 'risk'
    data.mkdir()
    world = tmp_path / 'world'
    world.mkdir()
    web = tmp_path / 'web'
    (web / 'scores').mkdir(parents=True)
    (web / 'scores/BGR.json').write_text('{"value":1}')
    (web / 'meta.json').write_text('{"day":1}')
    previous = tmp_path / 'manifest.json'
    previous.write_text(json.dumps(daily.manifest(web)))
    sent = []
    monkeypatch.setenv('BLOB_READ_WRITE_TOKEN', 'test')
    monkeypatch.setenv('NEXT_PUBLIC_RISK_DATA_URL', 'https://example.public.blob.vercel-storage.com/risk')
    monkeypatch.setattr(daily, 'blob_put', lambda base, name, file, token: sent.append(name))
    monkeypatch.setattr(daily, 'make_bundle', lambda output, *args: output.write_bytes(b'bundle'))
    daily.publish_changes(previous, data, world, web)
    assert sent == ['scores/BGR.json', 'meta.json', '_state/bundle.tar.gz']
    assert (data / '.blob_initialized').exists()
    sent.clear()
    (web / 'meta.json').write_text('{"day":2}')
    daily.publish_changes(previous, data, world, web)
    assert sent == ['meta.json', '_state/bundle.tar.gz']


def test_blob_put_constructs_public_overwrite_request(tmp_path, monkeypatch):
    import io
    import urllib.parse
    body = tmp_path / 'meta.json'
    body.write_text('{}')
    calls = []
    base = 'https://example.public.blob.vercel-storage.com/risk'
    def fake_open(request, timeout):
        calls.append((request, timeout))
        return io.BytesIO(json.dumps({'url': base + '/meta.json'}).encode())
    monkeypatch.setattr(daily.urllib.request, 'urlopen', fake_open)
    token = '_'.join(['vercel', 'blob', 'rw', 'example', 'test'])
    daily.blob_put(base, 'meta.json', body, token)
    request, timeout = calls[0]
    assert request.method == 'PUT'
    assert urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query) == {'pathname': ['risk/meta.json']}
    assert request.get_header('X-vercel-blob-store-id') == 'example'
    assert request.get_header('X-allow-overwrite') == '1'
    assert request.get_header('X-vercel-blob-access') == 'public'
    assert timeout == 180
    import pytest
    with pytest.raises(ValueError, match='same store'):
        daily.blob_put(base, 'meta.json', body, '_'.join(['vercel', 'blob', 'rw', 'other', 'test']))
    assert len(calls) == 1
