"""Model v3 input groups, added on top of the unchanged v2 inputs in features.py.

New inputs may be missing; LightGBM treats a missing value as missing, so the
availability rule for a prediction stays the v2 rule (weather and history).
Every group respects the D-2 publication cutoff in PROTOCOL.md (plan 3):
  greenness: VIIRS composite starting 37 + 2 days or more before D
  soil moisture: SMAP days up to D-3, at most 3 days old
  weather: GFS run of D-2 (built by v3_inputs.py)
"""
from pathlib import Path

from features import FEATURES as BASE

GROUPS = {
    # UTC calendar day. Weekend is Saturday or Sunday everywhere [U].
    'calendar': ('dow_sin', 'dow_cos', 'weekend'),
    'people': ('pop_density_log', 'road_density_log', 'built_share'),
    'plants_soil': ('ndvi', 'ndvi_anomaly', 'ndvi_age_days', 'soil_moisture', 'soil_moisture_age_days'),
    'weather': ('tmax_c', 'rh_min', 'wind_max', 'wind_dir_sin', 'wind_dir_cos', 'gust_max',
                'rain_d', 'rain_d1', 'rain_next3', 'days_since_rain'),
}

NDVI_CUTOFF_DAYS = 2 + 37
SMAP_CUTOFF_DAYS = 3
SMAP_MAX_AGE_DAYS = 2

SQL = {
    'dow_sin': 'sin(2*pi()*(isodow(t.day)-1)/7)',
    'dow_cos': 'cos(2*pi()*(isodow(t.day)-1)/7)',
    'weekend': '(isodow(t.day) >= 6)::DOUBLE',
    'pop_density_log': 'pp.pop_density_log',
    'road_density_log': 'pp.road_density_log',
    'built_share': 'pp.built_share',
    'ndvi': 'nd.ndvi',
    'ndvi_anomaly': 'nd.ndvi - nn.ndvi_normal',
    'ndvi_age_days': '(t.day - nd.start)::DOUBLE',
    'soil_moisture': f'CASE WHEN t.sm_cut - sm.day <= {SMAP_MAX_AGE_DAYS} THEN sm.soil_moisture END',
    'soil_moisture_age_days': f'CASE WHEN t.sm_cut - sm.day <= {SMAP_MAX_AGE_DAYS} THEN (t.day - sm.day)::DOUBLE END',
    **{name: f'wx.{name}' for name in GROUPS['weather']},
}


def features(groups):
    names = list(BASE)
    for group in groups:
        names.extend(GROUPS[group])
    return names


def extra_sql(groups):
    """Select expressions for the added groups; `t` is the row with spot_id and day."""
    return ''.join(f', {SQL[n]} AS {n}' for g in groups for n in GROUPS[g])


def from_sql(groups, v3):
    """FROM clause: `?` is the base table (spot_id, day and the v2 inputs)."""
    v3 = Path(v3)
    parts = [f"""FROM (SELECT *, day - {NDVI_CUTOFF_DAYS} AS ndvi_cut, day - {SMAP_CUTOFF_DAYS} AS sm_cut
                      FROM read_parquet(?)) t"""]
    if 'people' in groups:
        parts.append(f"LEFT JOIN read_parquet('{v3 / 'people_0.25.parquet'}') pp ON pp.spot_id = t.spot_id")
    if 'plants_soil' in groups:
        parts.append(f"""ASOF LEFT JOIN read_parquet('{v3 / 'ndvi_0.25/*.parquet'}') nd
                          ON nd.spot_id = t.spot_id AND t.ndvi_cut >= nd.start
                        LEFT JOIN read_parquet('{v3 / 'ndvi_normal_0.25.parquet'}') nn
                          ON nn.spot_id = t.spot_id AND nn.month = month(nd.start)
                        ASOF LEFT JOIN read_parquet('{v3 / 'smap_0.25/*.parquet'}') sm
                          ON sm.spot_id = t.spot_id AND t.sm_cut >= sm.day""")
    if 'weather' in groups:
        parts.append(f"""LEFT JOIN read_parquet('{v3 / 'weather_0.25/*.parquet'}') wx
                          ON wx.spot_id = t.spot_id AND wx.day = t.day""")
    return '\n'.join(parts)
