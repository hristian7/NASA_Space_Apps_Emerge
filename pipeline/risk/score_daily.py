#!/usr/bin/env python3
"""Compare published daily forecasts with complete NOAA-20 UTC detections."""
import argparse
import datetime as dt
import json
import tempfile
import urllib.request
from pathlib import Path

import duckdb
import pyarrow as pa

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT / 'data/derived/world'
DATA = ROOT / 'data/derived/risk'
WEB = ROOT / 'web/public/data/risk'
FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv'


def download_firms(path):
    with urllib.request.urlopen(FIRMS_URL, timeout=90) as source, path.open('wb') as dest:
        while chunk := source.read(1024 * 1024):
            dest.write(chunk)


def detection_spots(con, csv_path, mask, baseline):
    """Load unmasked NOAA-20 spot-days; replace overlapping catalog UTC days."""
    con.execute("""CREATE OR REPLACE TEMP TABLE firms_raw AS
        SELECT try_cast(acq_date AS DATE) AS day,
               floor(try_cast(latitude AS DOUBLE)*100)::INTEGER AS cy,
               floor(try_cast(longitude AS DOUBLE)*100)::INTEGER AS cx,
               lower(confidence) AS confidence
        FROM read_csv(?, header=true, all_varchar=true)
        WHERE try_cast(latitude AS DOUBLE) BETWEEN -90 AND 90
          AND try_cast(longitude AS DOUBLE) >= -180 AND try_cast(longitude AS DOUBLE) < 180
    """, [str(csv_path)])
    first, newest = con.execute('SELECT min(day),max(day) FROM firms_raw').fetchone()
    if not first or not newest:
        raise ValueError('FIRMS file contains no dated detections')
    con.execute("""CREATE OR REPLACE TEMP TABLE detections AS
      WITH cells AS (
        SELECT cy,cx,day FROM read_parquet(?) WHERE sat='NOAA20' AND day < ?
        UNION ALL
        SELECT cy,cx,day FROM firms_raw WHERE confidence IN ('n','h','nominal','high')
      ), clean AS (
        SELECT DISTINCT d.cy,d.cx,d.day FROM cells d
        ANTI JOIN read_parquet(?) m USING(cy,cx)
      )
      SELECT DISTINCT greatest(0,least(719,floor((8999-cy)/25)))::INTEGER * 1440 +
        ((floor((cx+18000)/25)::INTEGER % 1440)+1440)%1440 AS spot_id, day
      FROM clean WHERE day IS NOT NULL
    """, [str(baseline), first, str(mask)])
    return first, newest


def extend_detection_history(con, data, first, newest):
    """Recover complete older spot-days retained by the daily refresh."""
    state = data / 'daily_detections.parquet'
    info = data / 'daily_detections.json'
    if state.exists() != info.exists():
        raise ValueError('Incomplete saved detection state')
    if not state.exists():
        return first
    saved = json.loads(info.read_text())
    start = dt.date.fromisoformat(saved['start'])
    complete = dt.date.fromisoformat(saved['complete_through'])
    if complete > newest - dt.timedelta(days=1):
        raise ValueError('FIRMS file is older than the saved detection state')
    if start >= first or complete < first - dt.timedelta(days=1):
        return first
    con.execute("""CREATE OR REPLACE TEMP TABLE detections AS
        SELECT DISTINCT spot_id,day FROM (
          SELECT spot_id,day FROM detections WHERE day < ? OR day >= ?
          UNION ALL
          SELECT spot_id,day FROM read_parquet(?) WHERE day >= ? AND day < ?
        )""", [start, first, str(state), start, first])
    return start


def new_fires(con, day):
    """New spot-days have no detection in the surrounding grid on D-1 or D-2."""
    con.execute("""CREATE OR REPLACE TEMP TABLE new_fires AS
      SELECT f.spot_id FROM detections f WHERE f.day=? AND NOT EXISTS (
        SELECT 1 FROM detections p
        WHERE p.day BETWEEN ?::DATE-2 AND ?::DATE-1
          AND abs(floor(p.spot_id/1440)-floor(f.spot_id/1440))<=1
          AND (abs((p.spot_id%1440)-(f.spot_id%1440))<=1 OR
               abs((p.spot_id%1440)-(f.spot_id%1440))=1439))
    """, [day, day, day])


def score_day(con, day, web, data):
    """Score the actual published top spots and common scored candidates."""
    hist = data / 'history_0.25' / f'month={day:%Y-%m}' / 'history.parquet'
    if not hist.exists():
        raise FileNotFoundError(f'history missing for {day}')
    scores, selected = [], []
    for file in sorted((web / 'scores').glob('*.json')):
        obj = json.loads(file.read_text())
        if obj.get('columns') != ['spot_id', 'p', 'level', 'usual', 'fwi']:
            raise ValueError(f'unexpected score columns in {file.name}')
        rows = obj['days'].get(day.isoformat())
        if rows is None:
            continue
        latest = web / 'latest' / file.name
        if not latest.exists():
            raise FileNotFoundError(f'published ranking missing: {latest.name}')
        ranks = json.loads(latest.read_text())['regions']
        for region, days in ranks.items():
            for spot in days.get(day.isoformat(), []):
                if spot['rank'] <= 5:
                    selected.append((spot['spot_id'], region))
        scores.extend((row[0], row[1], row[4]) for row in rows)
    if not scores:
        raise ValueError(f'no published scores for {day}')
    con.register('score_input', pa.table({'spot_id': pa.array([r[0] for r in scores], type=pa.int64()),
        'p': pa.array([r[1] for r in scores], type=pa.float64()), 'fwi': pa.array([r[2] for r in scores], type=pa.float64())}))
    con.execute('CREATE OR REPLACE TEMP TABLE scores AS SELECT * FROM score_input')
    con.register('published_input', pa.table({'spot_id': pa.array([r[0] for r in selected], type=pa.int64()),
        'region_id': pa.array([r[1] for r in selected], type=pa.string())}))
    con.execute('CREATE OR REPLACE TEMP TABLE published AS SELECT * FROM published_input')
    con.execute("""CREATE OR REPLACE TEMP TABLE candidates AS
      SELECT g.spot_id,g.region_id,g.lat,g.lon,s.p,s.fwi,h.hist_p,
             n.spot_id IS NOT NULL AS is_new
      FROM read_parquet(?) g LEFT JOIN scores s USING(spot_id)
      LEFT JOIN read_parquet(?) h ON g.spot_id=h.spot_id AND h.day=?
      LEFT JOIN new_fires n ON g.spot_id=n.spot_id
      WHERE g.country IS NOT NULL AND g.region_id IS NOT NULL
        AND g.fuel_class IN ('forest','shrub_grass')
    """, [str(data / 'grid_0.25.parquet'), str(hist), day])
    con.execute("""CREATE OR REPLACE TEMP TABLE ranked AS
      SELECT *, row_number() OVER (PARTITION BY region_id ORDER BY fwi DESC, hist_p DESC,
                  hash(spot_id,?::DATE,20261114),spot_id) AS fwi_rank
      FROM candidates WHERE p IS NOT NULL AND fwi IS NOT NULL AND hist_p IS NOT NULL
    """, [day])
    result = []
    for scope, condition in [('world', 'TRUE'), ('europe', 'lat BETWEEN 34 AND 72 AND lon BETWEEN -25 AND 45')]:
        # As in the hold-out, the denominator includes eligible fires without scores.
        total = con.execute(f'SELECT count(*) FROM candidates WHERE is_new AND {condition}').fetchone()[0]
        regions = con.execute(f'''SELECT count(DISTINCT c.region_id) FROM candidates c
            WHERE c.is_new AND {condition} AND EXISTS
              (SELECT 1 FROM ranked r WHERE r.region_id=c.region_id)''').fetchone()[0]
        ours, index = con.execute(f'''SELECT count(*) FILTER (WHERE is_new AND p2.spot_id IS NOT NULL),
            count(*) FILTER (WHERE is_new AND fwi_rank<=5) FROM ranked r
            LEFT JOIN published p2 USING(spot_id,region_id) WHERE {condition}''').fetchone()
        result.append({'date': day.isoformat(), 'scope': scope, 'new_fires': total,
                       'captured_by_us': ours, 'captured_by_index': index, 'regions_scored': regions})
    return result


def update_log(card, rows):
    existing = {(row['date'], row['scope']): row for row in card.get('daily_log', [])}
    for row in rows:
        existing[(row['date'], row['scope'])] = row
    updated = sorted(existing.values(), key=lambda row: (row['date'], row['scope']))
    if updated == card.get('daily_log', []):
        return False
    card['daily_log'] = updated
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--firms', type=Path, help='use a previously downloaded FIRMS CSV')
    parser.add_argument('--date', type=dt.date.fromisoformat)
    parser.add_argument('--world', type=Path, default=WORLD)
    parser.add_argument('--data', type=Path, default=DATA)
    parser.add_argument('--web', type=Path, default=WEB)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='risk-firms-') as tmp:
        firms = args.firms or Path(tmp) / 'firms.csv'
        if not args.firms:
            download_firms(firms)
        con = duckdb.connect()
        con.execute('SET threads=4')
        first, newest = detection_spots(con, firms, args.world / 'static_mask.parquet', args.world / 'cell_days_2026.parquet')
        first = extend_detection_history(con, args.data, first, newest)
        meta = json.loads((args.web / 'meta.json').read_text())
        published = {dt.date.fromisoformat(value): args.web for value in meta['days'].values()}
        for archive in (args.data / 'daily_archive').glob('*'):
            if archive.is_dir():
                try:
                    published.setdefault(dt.date.fromisoformat(archive.name), archive)
                except ValueError:
                    continue
        days = sorted(published)
        if args.date:
            days = [args.date] if args.date in published else []
        card_path = args.web / 'scorecard.json'
        card = json.loads(card_path.read_text())
        rows = []
        for day in days:
            if not first + dt.timedelta(days=2) <= day < newest:
                print(f'{day}: detections incomplete or outside the saved coverage, skipped', flush=True)
                continue
            new_fires(con, day)
            rows.extend(score_day(con, day, published[day], args.data))
        if update_log(card, rows):
            temp = card_path.with_suffix('.json.tmp')
            temp.write_text(json.dumps(card, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n')
            temp.replace(card_path)
        for row in rows:
            print(json.dumps(row, sort_keys=True), flush=True)
        if not rows:
            print('No complete published days to score', flush=True)


if __name__ == '__main__':
    main()
