import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import features  # noqa: E402
import features_v3  # noqa: E402
import v3_plants_soil  # noqa: E402


def test_v3_starts_from_the_unchanged_v2_inputs():
    assert features_v3.features([]) == list(features.FEATURES)
    assert features_v3.features(['calendar'])[:len(features.FEATURES)] == list(features.FEATURES)


def test_every_input_has_sql_and_a_join():
    groups = list(features_v3.GROUPS)
    assert all(n in features_v3.SQL for g in groups for n in features_v3.GROUPS[g])
    clause = features_v3.from_sql(groups, '/v3')
    for alias in (' pp ', ' nd', ' nn', ' sm', ' wx'):
        assert alias in clause


def test_greenness_and_soil_cutoffs_match_the_download_rules():
    assert features_v3.NDVI_CUTOFF_DAYS == 2 + v3_plants_soil.VIIRS_LAG_FROM_START_DAYS
    assert features_v3.SMAP_CUTOFF_DAYS == 2 + v3_plants_soil.SMAP_LAG_DAYS
    assert features_v3.SMAP_MAX_AGE_DAYS == v3_plants_soil.SMAP_LOOKBACK_DAYS - 1


def test_modis_composite_must_be_published_by_end_of_d_minus_2():
    day = dt.date(2025, 7, 20)
    newest = v3_plants_soil.newest_modis_end(day)
    assert newest + dt.timedelta(days=v3_plants_soil.MODIS_LAG_DAYS) == day - dt.timedelta(days=2)


def test_smap_days_never_reach_past_the_cutoff():
    day = dt.date(2025, 7, 20)
    days = v3_plants_soil.smap_days(day)
    assert max(days) + dt.timedelta(days=v3_plants_soil.SMAP_LAG_DAYS) <= day - dt.timedelta(days=2)
    assert len(days) == v3_plants_soil.SMAP_LOOKBACK_DAYS


def test_downloads_stop_at_the_end_of_the_test_period(monkeypatch):
    monkeypatch.setattr(sys, 'argv', ['x', 'download', '--end', '2026-11-01'])
    with pytest.raises(SystemExit):
        v3_plants_soil.main()


def test_viirs_composite_counts_from_its_window_start():
    day = dt.date(2025, 7, 20)
    start = v3_plants_soil.newest_viirs_start(day)
    assert start + dt.timedelta(days=v3_plants_soil.VIIRS_LAG_FROM_START_DAYS) == day - dt.timedelta(days=2)
    assert max(v3_plants_soil.NORMAL_YEARS) < 2021


def test_gfs_nodes_average_to_spot_centres():
    import numpy as np
    import v3_weather
    lat = 90 - 0.25 * np.arange(721)[:, None] + 0 * np.arange(1440)[None, :]
    lon = -180 + 0.25 * np.arange(1440)[None, :] + 0 * lat
    spot = 400 * 1440 + 10
    assert v3_weather.to_spots(lat)[spot] == pytest.approx(89.875 - 0.25 * 400)
    assert v3_weather.to_spots(lon)[spot] == pytest.approx(-179.875 + 0.25 * 10)


def test_gfs_stops_at_the_end_of_the_test_period(monkeypatch):
    import v3_weather
    monkeypatch.setattr(sys, 'argv', ['x', '--end', '2026-10-30'])
    with pytest.raises(SystemExit):
        v3_weather.main()


def test_weather_reasons_need_plain_sense_values():
    import pandas as pd
    import export_risk as ex
    cold = pd.Series({'tmax_c': 9.3, 'wind_max': 5.0, 'gust_max': 6.0, 'days_since_rain': 2, 'rain_d': 0.0, 'rh_min': 82.0})
    hot = pd.Series({'tmax_c': 34.0, 'wind_max': 9.0, 'gust_max': 6.0, 'days_since_rain': 12, 'rain_d': 0.2, 'rh_min': 20.0})
    for reason, name in (('very_hot', 'tmax_c'), ('strong_wind', 'wind_max'), ('little_rain', 'days_since_rain'), ('very_dry', 'rh_min')):
        assert not ex.weather_reason_holds(reason, name, cold)
        assert ex.weather_reason_holds(reason, name, hot)


def test_v3_mode_defaults_to_off(monkeypatch):
    import daily_v3
    monkeypatch.delenv('RISK_V3_MODE', raising=False)
    assert daily_v3.mode() == 'off'
    monkeypatch.setenv('RISK_V3_MODE', 'sideways')
    with pytest.raises(ValueError):
        daily_v3.mode()
