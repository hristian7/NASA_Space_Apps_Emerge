# Storage options: short version

Summary of [`storage-options.md`](storage-options.md) (14 Nov 2026). Tags: `[V]` checked at the source · `[D]` directional · `[U]` our guess.

## The question

Where and in what form do we keep the fire data, so the app is fast on a phone and runs on **Vercel only** (no server running all the time)?

## All 15 options, best to worst

Each scored 1–5 on five things (fits our data, fast on phones, fits Vercel, quick to build, free and open), so the maximum is 25.

| # | Option | What it is | Score | Verdict |
|---|---|---|---|---|
| 1 | **Ready-made JSON files** | Small text files, made in advance | 24 | **Use** for calendars, countries, proof page |
| 2 | PMTiles | One big map file the app reads piece by piece | 21 | Backup if the globe layer is slow |
| 3 | Parquet | Compact table file for data tools | 20 | **Use** inside the pipeline only |
| 4 | Arrow | Fast binary table format | 20 | Only if JSON is too slow |
| 5 | **firms-catalog** | Free online copy of all NASA fire points | 19 | **Use** for raw fire points and 2026 |
| 6 | CSV | Spreadsheet text file | 18 | Only for the user's download button |
| 7 | COG | Map image readable piece by piece | 18 | Skip: unfamiliar tooling |
| 8 | H3 | Hexagon grid | 18 | Skip: moves numbers off NASA's grid |
| 9 | DuckDB file | Database file | 17 | Pipeline only; too heavy for phones |
| 10 | Zarr | Chunked data cubes | 17 | Skip: same benefit as JSON, harder |
| 11 | SQLite | Small database file | 15 | Skip: Vercel has no lasting disk |
| 12 | PostGIS | Map database server | 14 | Skip: needs a server |
| 13 | NetCDF | Scientists' data format | 13 | Maybe a science export later |
| 14 | ClickHouse | Analytics database server | 13 | Skip: needs a server |
| 15 | BigQuery | Google's cloud database | 11 | Skip: needs billing and keys |

## Recommendation

| Data | Where it lives | Why |
|---|---|---|
| Calendar for a tapped point | One small JSON file per 5° square of the map, inside the app on Vercel | Tapping loads one small file: fast, no database |
| Country calendars, proof page | JSON files | Same reason |
| World layer on the globe | One JSON file per year, about 0.3 MB `[U]` | Loads quickly on a phone |
| Raw fire points in a cell, 2026 data | firms-catalog, read by a small Vercel function | Free, already up to today `[V]`, so no 631-million-row download |
| Recent fires (24 h) | NASA's free 24 h file `[V]`, fetched and cached for about 1 hour | Always fresh |
| Push-alert sign-ups | Upstash Redis (small online database) | Vercel Blob gets blocked for 30 days if a free limit is exceeded `[V]` |

**Why this wins:** the hard work happens once, before the demo. Phones download only small files, so the app is fast, free and quick to build.

## Watch out

- **Vercel's free plan allows 100 MB of static files** `[V]`. **Measured later (14 Nov): about 150 MB gzipped** with every column, above the limit, so the tiles go to Vercel Blob or a slimmer format (spec decision D-9). The 60–80 MB estimate was too low.
- **firms-catalog:** filter with `ST_Intersects` (5 s vs 49 s `[V]`). `type` is empty for the last 3–4 months, so `type = 0` drops recent fires.
- **Not verified:** DuckDB map tools inside a Vercel function; real phone speed.
