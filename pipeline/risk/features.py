"""Shared, cutoff-safe model feature definitions.

Fuel inputs are majority-class indicators, not land-cover shares. A missing
last-fire date is represented by a fixed value and a separate missing flag.
"""
WEATHER = ('fwi', 'ffmc', 'dmc', 'dc', 'isi', 'bui', 'dsr')
FEATURES = WEATHER + ('forest', 'shrub_grass', 'farmland', 'hist_p',
    'last_year_same_month', 'days_since_log', 'no_previous_fire', 'fire_near_3d',
    'month_sin', 'month_cos', 'latitude', 'fwi_x_forest')


def feature_sql():
    return """f.fwi, f.ffmc, f.dmc, f.dc, f.isi, f.bui, f.dsr,
      (g.fuel_class='forest')::DOUBLE AS forest,
      (g.fuel_class='shrub_grass')::DOUBLE AS shrub_grass,
      (g.fuel_class='farmland')::DOUBLE AS farmland,
      h.hist_p, h.last_year_same_month::DOUBLE AS last_year_same_month,
      ln(1 + coalesce(h.days_since_last_fire, 3650)) AS days_since_log,
      (h.days_since_last_fire IS NULL)::DOUBLE AS no_previous_fire,
      h.fire_near_3d::DOUBLE AS fire_near_3d,
      sin(2*pi()*(month(f.day)-1)/12) AS month_sin,
      cos(2*pi()*(month(f.day)-1)/12) AS month_cos,
      g.lat::DOUBLE AS latitude,
      f.fwi * (g.fuel_class='forest')::INTEGER AS fwi_x_forest"""


def available_sql():
    return ' AND '.join(f'f.{name} IS NOT NULL AND isfinite(f.{name})' for name in WEATHER) + ' AND h.hist_p IS NOT NULL'
