#!/usr/bin/env python3
"""Publish every missing forecast day in order, up to the newest the inputs allow.

The scheduled job (daily.py) publishes the newest day only; after a missed run
it would skip days. This catches up one day at a time with the same
publish_forecast, so "today" and "tomorrow" always stay consecutive. A day is
published only when its NASA fire-weather run (D-3) exists and the detections
are complete through D-2. Model v3 follows RISK_V3_MODE, as in daily.py.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import sys
import tempfile

import daily
import score_daily


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--firms', type=Path, help='use a previously downloaded FIRMS CSV')
    ap.add_argument('--max-days', type=int, default=7, help='publish at most this many days in one run')
    ap.add_argument('--data', type=Path, default=daily.DATA)
    ap.add_argument('--world', type=Path, default=daily.WORLD)
    ap.add_argument('--web', type=Path, default=daily.WEB)
    args = ap.parse_args()
    newest_run, newest_day = daily.find_latest(dt.datetime.now(dt.timezone.utc).date())
    with tempfile.TemporaryDirectory(prefix='risk-firms-') as tmp:
        firms = args.firms or Path(tmp) / 'firms.csv'
        if not args.firms:
            score_daily.download_firms(firms)
        first, complete = daily.refresh_state(firms, args.world, args.data)
    print(f'newest fire-weather run {newest_run} gives {newest_day}; detections complete through {complete}', flush=True)
    published = []
    for _ in range(args.max_days):
        meta = json.loads((args.web / 'meta.json').read_text())
        last = max(dt.date.fromisoformat(value) for value in meta['days'].values())
        day = last + dt.timedelta(days=1)
        if day > newest_day:
            break
        if complete < day - dt.timedelta(days=2):
            print(f'{day}: detections through {day - dt.timedelta(days=2)} are not complete yet', flush=True)
            break
        daily.publish_forecast(day - dt.timedelta(days=3), day, last, first, args.data, args.web)
        published.append(day.isoformat())
    print('PUBLISHED_DAYS', ' '.join(published) or 'none', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
