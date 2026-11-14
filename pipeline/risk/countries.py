"""Map Natural Earth administrative codes to its ISO alpha-3 values."""
from collections import defaultdict
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NATURAL_EARTH = ROOT / 'data/raw/naturalearth'


def country_lookup():
    """Unknown or disputed units without an ISO code remain null, never guessed."""
    countries = json.loads((NATURAL_EARTH / 'ne_10m_admin_0_countries.geojson').read_text())['features']
    by_admin = {}
    by_alpha2 = defaultdict(set)
    for feature in countries:
        p = feature['properties']
        code = p.get('ISO_A3_EH')
        if not code or code == '-99':
            code = p.get('ISO_A3')
        if not code or code == '-99':
            continue
        key = p['ADM0_A3']
        if key in by_admin and by_admin[key] != code:
            raise ValueError(f'Conflicting ISO codes for {key}')
        by_admin[key] = code
        for field in ('ISO_A2', 'ISO_A2_EH'):
            alpha2 = p.get(field)
            if alpha2 and alpha2 != '-99':
                by_alpha2[alpha2].add(code)

    def lookup(admin, alpha2):
        if admin in by_admin:
            return by_admin[admin]
        possible = by_alpha2.get(alpha2, set())
        return next(iter(possible)) if len(possible) == 1 else None

    return lookup
