import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location('risk_countries', Path(__file__).parents[1] / 'countries.py')
countries = importlib.util.module_from_spec(spec)
spec.loader.exec_module(countries)


def test_country_codes_use_iso_mapping_and_leave_unknown_null(tmp_path, monkeypatch):
    features = [{'properties': {'ADM0_A3': 'SDS', 'ISO_A3_EH': 'SSD', 'ISO_A3': 'SSD',
                                'ISO_A2': 'SS', 'ISO_A2_EH': 'SS'}},
                {'properties': {'ADM0_A3': 'AUS', 'ISO_A3_EH': 'AUS', 'ISO_A3': 'AUS',
                                'ISO_A2': 'AU', 'ISO_A2_EH': 'AU'}}]
    (tmp_path / 'ne_10m_admin_0_countries.geojson').write_text(json.dumps({'features': features}))
    monkeypatch.setattr(countries, 'NATURAL_EARTH', tmp_path)
    lookup = countries.country_lookup()
    assert lookup('SDS', 'SS') == 'SSD'
    assert lookup('ATC', 'AU') == 'AUS'
    assert lookup('KOS', 'XK') is None
