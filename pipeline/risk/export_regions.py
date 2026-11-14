#!/usr/bin/env python3
"""Export Natural Earth region metadata for regions containing land centres."""
import json
from pathlib import Path

import duckdb

from countries import country_lookup

ROOT = Path(__file__).resolve().parents[2]


def coordinates(node):
    if isinstance(node[0], (int, float)):
        yield node[:2]
    else:
        for part in node:
            yield from coordinates(part)


def main():
    grid = ROOT / 'data/derived/risk/grid_0.25.parquet'
    geo = ROOT / 'data/raw/naturalearth/ne_10m_admin_1_states_provinces.geojson'
    out = ROOT / 'web/public/data/risk/regions.json'
    counts = dict(duckdb.connect().execute('SELECT region_id, count(*) FROM read_parquet(?) GROUP BY 1', [str(grid)]).fetchall())
    regions = {}
    lookup = country_lookup()
    for feature in json.loads(geo.read_text())['features']:
        p = feature['properties']
        key = p['iso_3166_2']
        if key not in counts:
            continue
        region = regions.setdefault(key, {'region_id': key, 'grid_g': 0.25, 'name_en': p.get('name_en') or p['name'],
                                          'name_local': p.get('name_local'), 'country': lookup(p['adm0_a3'], p['iso_a2']),
                                          'bbox': [180., 90., -180., -90.], 'spots': counts[key]})
        if region['country'] != lookup(p['adm0_a3'], p['iso_a2']):
            raise ValueError(f'Conflicting countries for {key}')
        for lon, lat in coordinates(feature['geometry']['coordinates']):
            box = region['bbox']
            box[0], box[1], box[2], box[3] = min(box[0], lon), min(box[1], lat), max(box[2], lon), max(box[3], lat)
    if regions.keys() != counts.keys():
        raise ValueError('Region metadata does not cover the grid')
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix('.json.tmp')
    tmp.write_text(json.dumps([regions[k] for k in sorted(regions)], ensure_ascii=False, separators=(',', ':')) + '\n')
    tmp.replace(out)
    print('regions exported:', len(regions))


if __name__ == '__main__':
    main()
