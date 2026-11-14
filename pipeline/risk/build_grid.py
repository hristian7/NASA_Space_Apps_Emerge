#!/usr/bin/env python3
"""Build the quarter-degree land-spot grid from Natural Earth and IGBP classes."""
import argparse
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw'
OUT = ROOT / 'data/derived/risk'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--grid', type=float, required=True)
    args = parser.parse_args()
    if args.grid != 0.25:
        parser.error('only the 0.25 degree grid is implemented')
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute('LOAD spatial')
    con.execute('SET threads=6')
    geo = str(RAW / 'naturalearth/ne_10m_admin_1_states_provinces.geojson')
    land = str(RAW / 'landcover/cell_table.csv')
    temp = OUT / 'grid_0.25.parquet.tmp'
    con.execute("""
      CREATE TEMP TABLE regions AS
      SELECT iso_3166_2 AS region_id, adm0_a3 AS country, geom
      FROM ST_Read(?)
    """, [geo])
    # The spatial join uses the square's centre; ties are deterministic.
    con.execute("""
      CREATE TEMP TABLE matched AS
      SELECT row * 1440 + col AS spot_id, 89.875 - row * 0.25 AS lat,
             -179.875 + col * 0.25 AS lon, region_id, country
      FROM (SELECT range AS row FROM range(720))
      CROSS JOIN (SELECT range AS col FROM range(1440))
      JOIN regions ON ST_Intersects(geom, ST_Point(-179.875 + col * 0.25,
                                                   89.875 - row * 0.25))
      QUALIFY row_number() OVER (PARTITION BY spot_id ORDER BY region_id, country) = 1
    """)
    con.execute("""
      COPY (SELECT m.spot_id, 0.25 AS grid_g, m.lat, m.lon,
              sqrt(pow(6371.0088 * 0.25 * pi() / 180, 2) *
                   (1 + pow(cos(radians(m.lat)), 2))) / 2 AS precision_radius_km,
              m.region_id, m.country, l.land_class,
              CASE WHEN l.land_class BETWEEN 1 AND 5 THEN 'forest'
                   WHEN l.land_class BETWEEN 6 AND 10 THEN 'shrub_grass'
                   WHEN l.land_class IN (12,14) THEN 'farmland'
                   ELSE NULL END AS fuel_class
            FROM matched m LEFT JOIN read_csv_auto(?) l ON m.spot_id=l.cell_id
            ORDER BY m.spot_id) TO ? (FORMAT parquet, COMPRESSION zstd)
    """, [land, str(temp)])
    temp.replace(OUT / 'grid_0.25.parquet')
    print('grid spots, regions:', con.execute('SELECT count(*), count(DISTINCT region_id) FROM matched').fetchone())


if __name__ == '__main__':
    main()
