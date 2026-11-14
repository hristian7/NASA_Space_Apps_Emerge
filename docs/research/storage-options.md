# Storage options for Emerge (research task 2)

Written 14 Nov 2026 for [`../../specs/research-tasks.md`](../../specs/research-tasks.md) section 2 (interview D5).

**Constraints used (decided 14 Nov):**
- Hosting is Vercel only: static files plus small serverless functions, with no always-on server or database.
- All data is pre-computed by the Python + DuckDB pipeline.
- Users pick a country or click a point on a 3D globe.
- The harmonized table is monthly on NASA's 0.25° grid.

Tags: `[V]` verified at a primary source (or measured by us at the data host) · `[D]` directional · `[U]` our inference.

## Summary

- **No single format fits all four data shapes.** The winning mix is mostly **pre-computed static files**, plus one small function for raw points and a tiny Blob store for push subscriptions.
- **The calendar uses per-tile JSON.** We pre-compute small JSON files per 5° tile (only months with fire) and serve them as static files from Vercel. A click reads about 60–80 KB `[U]`, so it is well inside the 2 s target. If the world total is too big for the Hobby deploy limit (100 MB `[V]`), the same tiles go into one file on Vercel Blob, read by byte range `[V]`.
- **Raw points are not copied.** We query them per cell from the public **firms-catalog GeoParquet** on Source Cooperative. It is CC0, includes 2026 up to today, has `scan`, `track` and `type`, and allows range reads and CORS `[V]`.
  - **Trap:** filter with `ST_Intersects`, not `ST_X`/`ST_Y`. On our test that was 5 s instead of 49 s `[V]`.
- **Vercel Hobby limits shape the design `[V]`:**
  - cron jobs run at most once a day, so recent fires are fetched on request and cached;
  - Blob gives 1 GB of storage and 10 GB of transfer a month, but only 2,000 uploads a month;
  - static uploads are capped at 100 MB and 15,000 files.
- **Avoid server databases** (PostGIS, ClickHouse, BigQuery) and heavy science formats (NetCDF, Zarr) for the app. They need a server, credentials or unfamiliar code, and they don't help a phone.

## Ranked table

Scores run from 1 (bad) to 5 (good), across five criteria:
- **a. Fit:** fit for our access patterns. These are one cell's series, one country's series, the world layer, and raw points in one cell.
- **b. Phone:** speed on a phone.
- **c. Vercel:** fit with Vercel hosting.
- **d. Build:** speed to build with AI agents in about 20 hours.
- **e. Cost/licence:** cost and licence.

All scores are `[U]` judgments based on the facts below.

| Rank | Option | Best for which data shape | a. Fit | b. Phone | c. Vercel | d. Build | e. Cost/licence | Total /25 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Pre-computed JSON (static files)** | Country series, calendar tiles, validation report, world layer per year | 4 | 5 | 5 | 5 | 5 | **24** | **Use it as the backbone.** It needs no engine on the phone, is gzip-friendly, and every agent knows it. It can't hold 631 M raw points |
| 2 | **PMTiles / vector tiles** | World layer on the globe, plus country borders; can also pack many tiles into one file | 3 | 5 | 5 | 3 | 5 | **21** | Best "upgrade" for the globe layer, as one static file read by range. It needs a tiling step (tippecanoe) |
| 3 | **Parquet** | Master copy of the monthly table; CSV and open-data release | 4 | 3 | 4 | 4 | 5 | **20** | Keep it as the pipeline's master format. In the browser it needs a reader, and its footer adds a round trip |
| 4 | **Arrow (IPC/Feather)** | World layer as binary columns for deck.gl | 3 | 4 | 5 | 3 | 5 | **20** | Fast to draw (no parsing), but adds a library. Use it only if the JSON world layer is too slow |
| 5 | **GeoParquet (firms-catalog, read in place)** | Raw points in one cell, history and 2026 | 4 | 2 | 4 | 4 | 5 | **19** | **Use it for raw points** through a cached function. It's too heavy to query from a phone directly |
| 6 | **CSV** | User download (M11) only | 2 | 2 | 4 | 5 | 5 | **18** | Generate it in the browser from the JSON already loaded. Don't store or serve it |
| 7 | **COG rasters** (cloud-optimised GeoTIFF: a map image readable by byte range) | World layer, because the 0.25° grid is literally a 1440 × 720 image | 3 | 4 | 4 | 2 | 5 | **18** | Elegant, but GeoTIFF decoding on a MapLibre globe is unfamiliar. A plain PNG per year is the cheap cousin |
| 8 | **H3-indexed totals** (Uber's hexagon grid) | World layer as hexagons | 1 | 4 | 5 | 3 | 5 | **18** | Don't use it. Re-binning moves numbers off NASA's 0.25° grid, which is our core claim |
| 9 | **DuckDB (file)** | Pipeline engine and scratch database | 4 | 1 | 3 | 4 | 5 | **17** | **Keep it in the pipeline.** Shipping a .duckdb file to phones means a 4.7 MB engine download `[V]` |
| 10 | **Zarr** (chunked arrays: time × lat × lon) | One cell's series (one chunk = a tile's full history) | 3 | 4 | 3 | 2 | 5 | **17** | A good idea on paper, but the JS tooling is less familiar to agents. It's the same benefit as the JSON tiles |
| 11 | **SQLite / SpatiaLite** | A small local database | 3 | 2 | 2 | 3 | 5 | **15** | Vercel functions have no lasting disk `[U]`. Browser reads over HTTP are possible but hacky |
| 12 | **PostGIS** | Everything, if you have a server | 4 | 3 | 1 | 3 | 3 | **14** | Needs an always-on database, which is ruled out |
| 13 | **NetCDF** | Science data export | 2 | 1 | 2 | 3 | 5 | **13** | The format scientists expect. It's a "Could" export, not for the app |
| 14 | **ClickHouse** | Fast analytics on 631 M rows | 4 | 3 | 1 | 2 | 3 | **13** | Needs a server or a paid cloud. It's overkill when the data is pre-computed |
| 15 | **BigQuery public data** | Ad-hoc queries in Google's cloud | 3 | 2 | 2 | 2 | 2 | **11** | Needs a billing account and keys in a function, and every query has a delay. Not for a 20 h build |

**Access paths** (ways to read the formats above, not formats themselves):

| Path | What it is | Verdict for Emerge |
|---|---|---|
| **Vercel Blob** | Vercel's file store, served through its CDN | Good for **a few big files** and the subscription store. It supports range reads `[V]`. On Hobby the limits are 1 GB stored, 10 GB transfer a month and only 2,000 uploads, lists or copies a month `[V]`. Exceeding them blocks Blob for 30 days `[V]`, so **never upload ~1,000 small tiles there repeatedly** |
| **DuckDB-WASM, Parquet over HTTP** | The DuckDB engine compiled for the browser | Works in principle `[V]`, but the engine is a 4.7 MB download (brotli) `[V]`. Memory is capped at 4 GB and it runs one thread by default `[V]`. DuckDB's docs also warn that the built-in httpfs "may currently download the whole file" `[V]`. **Too heavy for the phone path**; fine for a "power user" page |
| **Vercel function + DuckDB** | A server-side query that returns JSON | **Use it for raw points.** Python functions may be up to 500 MB `[V]`, Hobby allows 300 s and 2 GB `[V]`, and the CDN can cache each answer, since history doesn't change |

## Recommended combination for Emerge

| Data | Format | Where it lives | How the app reads it | Rough size `[U]` |
|---|---|---|---|---|
| **Master monthly table** (`cell_id, year, month, terra … ood_flag`) | Parquet (zstd), written by DuckDB | Pipeline machine (git-ignored); later published as open data | Not read by the app. It is the source for everything below and for the References field | 100–300 MB |
| **One cell's monthly series** (calendar M4, anomaly M5, chance M13) | **Pre-computed JSON per 5° tile**: only months with fire, pre-gzipped (`.json.gz`), with the browser unzipping it (`DecompressionStream`) | **Plan A:** static files in the deployment (~1,000 files). **Plan B** if the total is over ~85 MB: the same tiles packed into one file on **Vercel Blob**, with a small index file `{tile: [offset, length]}` in static, read with one `Range` request | 1 fetch per click (the tile), cached by the PWA (installable web app) service worker | 60–80 KB per tile (gz); 60–80 MB in total (gz) |
| **One country's series** (~250 countries) | Pre-computed JSON, one file per country plus `countries/index.json` | Static | One fetch | 2–5 MB in total |
| **World layer for the globe** (per-cell yearly totals) | Pre-computed JSON, one file per year, as columns (`ids[]`, `values[]`), drawn with deck.gl or MapLibre. Upgrade to **PMTiles** if phones struggle | Static | 1 fetch for the year shown (~0.3 MB gz); others load on demand | ~8 MB in total (27 years) |
| **Raw points in the selected cell** (history and 2026) | **firms-catalog GeoParquet**, queried by year and by the cell's box (`ST_Intersects`) | **Vercel function** (Python + DuckDB) reading Source Cooperative. Response cached with `Cache-Control: s-maxage=31536000` (immutable history) | Calendar first (≤ 2 s), points a few seconds later; instant on the 2nd view | 0 stored; ~2–3 MB read per cell-year `[V]` |
| **Raw points fallback** (if the function fails the spike) | Slim Parquet or JSON for **Bulgaria + USA** only, cut from the pipeline's 11.9 M cleaned detections `[V]` | Vercel Blob (one upload) | Range read or one fetch per tile | 60–100 MB |
| **Recent fires** (last 24 h / 7 days, S5) | GeoJSON from FIRMS near-real-time data, with the MAP_KEY in an environment variable | Vercel function, **CDN-cached ~1 h**. Not a cron: Hobby cron is daily only `[V]` | 1 fetch | <1–5 MB per world view |
| **Validation report** (M6) | JSON | Static | 1 fetch | <1 MB |
| **Push subscriptions** (S11) | One small private JSON blob per subscription | **Vercel Blob** (private store), read by a **daily** cron function `[V]` | Server only | KB |
| **CSV for users** (M11) | CSV made in the browser from the loaded JSON | None | Download button | — |

**Why this mix:**
- Everything the phone needs first is a plain static file, so there's no engine, no cold start and no database.
- The only live queries are raw points (lazy, cached) and recent fires (cached).
- It meets the 2 s calendar and 4 s globe targets with margin `[U]`. AI agents can build it with stock tools.

### Run these 4 quick tests before building

1. **Size gate:** once the world build ends, total the sparse tile JSON (gz). If it's 85 MB or less, use Plan A; if more, Plan B.
2. **Blob from the browser:** is a `Range` fetch from the app's origin to a public Blob URL allowed by CORS? If not, add a Vercel rewrite so it is same-origin.
3. **Points function spike** (30 min):
   - Can Python DuckDB plus the `spatial` extension run inside a Vercel function? Extensions download at run time, and only `/tmp` is writable `[U]`.
   - Time one cell-month query from region `iad1`.
4. **Static range:** do Vercel static files answer `Range` with HTTP 206? This only matters if Plan B uses static hosting instead of Blob. Test with `curl -r 0-15 <url>`.

## Traps found

- **The firms-catalog filter must use `ST_Intersects(geometry, ST_MakeEnvelope(...))`.** On 2025 data `[V]`:
  - with it: 1 of 582 row groups scanned, 2.3 MB read, 5.1 s;
  - with `ST_X/ST_Y BETWEEN`: 49 s for the same 76 rows, because nothing is pruned.
- **`type` is NULL for all near-real-time rows** `[V]`. `WHERE type = 0` silently drops the last 3–4 months; use `type = 0 OR type IS NULL` for 2026.
- **The firms-catalog docs disagree with each other:**
  - the repo README says rows are sorted by month, then Hilbert order (a curve that keeps nearby points close), with `_month` and `_hilbert` columns;
  - the collection's AGENTS.md says the sort is purely spatial;
  - the 2026 file has no `_month`/`_hilbert` columns, and our 2025 cell query read only 1 row group.
  - So treat it as spatial ordering `[V]`: **a date filter won't prune.** Always put the year in the path.
- **Its `collection.json` on GitHub is stale.** It says data runs to 15 Sep 2026 with 631,469,093 rows, but the 2026 file itself runs to 14 Nov 2026 `[V]`.
- **firms-catalog uses the FIRMS API, while our pipeline uses the yearly country files.** Those files are clipped to country borders and drop offshore detections (the publisher measured 3 against 58 on one day `[V]`). Raw points near coasts may not match our counts exactly. Our counts already exclude offshore fires (`type` 0 only).
- **The FIRMS yearly country files stop at 2025** (first run). firms-catalog's 2026 file covers 1 Jan to 14 Nov 2026 `[V]`, so it is a candidate source for the pipeline's 2026 months.
- **Blob files over 512 MB are never cached**, so every access is a billed miss `[V]`. Keep each Blob file under 512 MB.

## Size estimates `[U]` (arithmetic shown)

- **Grid:** 1440 × 720 = 1,036,800 cells. **Months:** Nov 2000 to Nov 2026 = 2 + (25 × 12) + 11 = **313**.
- **Cells that ever had fire:** about **200,000** `[U]`, roughly 15–25% of grid cells. Deserts, ice and ocean never burn. The world build will give the real number.
- **Dense master table** (every month for every fire cell):
  - 200,000 × 313 = **62.6 M rows**;
  - one row is about 42 bytes: `cell_id` int32 (4) + `year` int16 (2) + `month` int8 (1) + 5 sensor counts × int32 (20) + `harmonized/lo/hi` × float32 (12) + 3 flags (3);
  - that is about **2.6 GB in memory**, and about **100–300 MB as Parquet** with zstd, because the many zero months compress to almost nothing.
- **Calendar tiles:**
  - 5° tiles: 72 × 36 = 2,592 tiles, each 20 × 20 = 400 cells; about 1,000 contain fire. That is under the 15,000-file limit `[V]`.
  - Sparse JSON: about 40 fire-months per cell × ~25 bytes is about 1 KB per cell.
  - 200,000 cells × 1 KB is about **200 MB raw**, or about **60–80 MB gzipped**. That is why the tiles are stored pre-gzipped: the 100 MB Hobby limit counts the files as uploaded `[V]`.
  - One tile is about 200 fire cells × 1 KB = ~200 KB raw, **~60–80 KB gz**. That takes ≤ 0.3 s on 4G.
  - Storing all 313 months would be ~4.7 KB per cell, or ~940 MB raw, which is too big. **Sparse storage is required.**
- **World layer:** about 80,000 cells with fire in a given year × ~12 bytes (id + value as JSON text) is about **1 MB raw, ~0.3 MB gz per year**, and ~8 MB gz for 27 years.
- **Raw points, slimmed, for the world:**
  - 631 M rows × ~6 bytes is about **3.8 GB**, which is over the Hobby Blob limit of 1 GB `[V]`. **Hence the plan reads firms-catalog in place.**
  - For Bulgaria + USA only: 11.9 M × 5–8 bytes is about **60–100 MB**.

## Verified facts

### Vercel

| # | Fact | Source |
|---|---|---|
| V1 | **Static file uploads (CLI deploy): 100 MB on Hobby**, 1 GB on Pro | [vercel.com/docs/limits](https://vercel.com/docs/limits) |
| V2 | **15,000 source files** at most per CLI deployment (`--archive=tgz` to go further) | [vercel.com/docs/limits](https://vercel.com/docs/limits) |
| V3 | **Function size: 250 MB uncompressed, 500 MB for Python**; "large functions" beta allows up to 5 GB | [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations) |
| V4 | Hobby functions: **2 GB memory / 1 vCPU, 300 s maximum duration**; **4.5 MB request and response body** (streaming exempt); default region `iad1` | [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations) |
| V5 | **Hobby cron jobs run at most once per day**, with timing within ±59 minutes, and 100 per project. More frequent expressions fail at deploy | [vercel.com/docs/cron-jobs/usage-and-pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) |
| V6 | **Vercel Blob on Hobby:** 1 GB storage a month, 10,000 simple operations, 2,000 advanced operations (uploads, lists, copies), **10 GB data transfer**. Going over **blocks Blob for 30 days** (no charge) | [vercel.com/docs/vercel-blob/usage-and-pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) |
| V7 | Blob: files over **512 MB are not cached** (every access is a miss); maximum file size 5 TB; cache hits are not counted as operations | [vercel.com/docs/vercel-blob/usage-and-pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) |
| V8 | **Blob supports HTTP range requests** (`curl -r 0-3` example) | [vercel.com/docs/vercel-blob/examples](https://vercel.com/docs/vercel-blob/examples) |
| V9 | Hobby typical monthly usage: 100 GB Fast Data Transfer, 1,000,000 function invocations, 4 h Active CPU. Waiting for I/O doesn't count as Active CPU | [fair-use-guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [functions/limitations](https://vercel.com/docs/functions/limitations) |

### firms-catalog

| # | Fact | Source |
|---|---|---|
| V10 | Data is **CC0-1.0, from NASA**, published as yearly GeoParquet 2.0 files (`detections/year=YYYY/detections.parquet`) | [GitHub README](https://github.com/portolan-mirrors/firms-catalog) |
| V11 | Columns include **`scan`, `track`** (km for MODIS, m for VIIRS) and **`type`** (0 vegetation … 3 offshore; NULL for all near-real-time rows) | [collection.json](https://github.com/portolan-mirrors/firms-catalog/blob/main/catalog/detections/collection.json), [detections README](https://github.com/portolan-mirrors/firms-catalog/blob/main/catalog/detections/README.md) |
| V12 | **2026 is included.** We measured the 2026 file on 14 Nov 2026: `acq_date` runs 2026-01-01 to **2026-11-14**; 518 row groups; 916,638,542 bytes; last modified 14 Nov 2026 11:25 GMT. The schema confirms `scan`/`track` as DOUBLE and `type` as INT32 | [the 2026 file](https://data.source.coop/portolan-mirrors/firms-catalog/detections/year=2026/detections.parquet) (DuckDB `parquet_metadata`) |
| V13 | **Range reads and CORS work.** `Range` returns HTTP 206; `access-control-allow-origin: *`; the preflight allows all headers and methods (max-age 7200) | Same URL, tested with `curl` |
| V14 | **Area reads work with DuckDB over HTTP.** One 0.25° cell in Bulgaria for 2025 read 1 of 582 row groups (2.3 MB) in 5.1 s, from a desktop in Sofia with DuckDB 2.0. The same query with `ST_X/ST_Y` filters took 49 s | [the 2025 file](https://data.source.coop/portolan-mirrors/firms-catalog/detections/year=2025/detections.parquet) |

### DuckDB-WASM

| # | Fact | Source |
|---|---|---|
| V15 | It reads "only the bytes a query needs". The caveat: the built-in httpfs "may currently download the whole file". Memory is capped at 4 GB; it runs **single-threaded by default** | [duckdb.org/docs/2.0/clients/wasm/overview](https://duckdb.org/docs/2.0/clients/wasm/overview.html) |
| V16 | The engine file `duckdb-eh.wasm` (v1.29.0) is **35.7 MB raw, 4.7 MB brotli**; the licence is MIT | [jsDelivr npm file](https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-eh.wasm), [LICENSE](https://github.com/duckdb/duckdb-wasm/blob/main/LICENSE) |

### PMTiles

| # | Fact | Source |
|---|---|---|
| V17 | It is a single-file tile archive; readers "use HTTP Range Requests"; it can sit on plain storage such as S3 | [docs.protomaps.com/pmtiles](https://docs.protomaps.com/pmtiles/) |
| V18 | It plugs into MapLibre with `maplibregl.addProtocol("pmtiles", protocol.tile)` | [docs.protomaps.com/pmtiles/maplibre](https://docs.protomaps.com/pmtiles/maplibre) |
| V19 | **Licence:** the reference code is BSD-3; the specification is public domain / CC0 | [PMTiles LICENSE](https://github.com/protomaps/PMTiles/blob/main/LICENSE) |

### From the repo

| # | Fact | Source |
|---|---|---|
| V20 | Bulgaria + USA: 11,917,303 detections kept after cleaning | [`first-run-bulgaria-usa.md`](first-run-bulgaria-usa.md) |

## Not verified

- **Hobby plan terms:** whether Hobby is limited to non-commercial or personal use. That part of the fair-use page didn't render for us; it is commonly described that way `[D]`. A hackathon demo is likely fine, but check [vercel.com/legal/terms](https://vercel.com/legal/terms).
- **Range requests on Vercel static files:** whether they return HTTP 206. There is no Vercel doc on it, and one community report says the image CDN doesn't ([thread](https://community.vercel.com/t/image-optimization-returns-200-ok-instead-of-206-partial-content-for-range-requests/49239)). Test 4 above.
- **Blob from the browser:** CORS headers on public Blob URLs, for cross-origin `Range` fetches (test 2).
- **Git deployments:** whether the 100 MB static limit also applies to Git-based deployments and build output. The doc only names the CLI.
- **The points function:**
  - whether DuckDB's `spatial` extension installs and loads inside a Vercel Python function (writable `/tmp` only);
  - the DuckDB wheel's size against the 500 MB limit;
  - query time from `iad1` to Source Cooperative.
- **DuckDB-WASM on phones:** real load and query time, and whether the spatial extension works in WASM on iOS Safari.
- **The world layer on phones:** whether ~80–200k cells draw smoothly in deck.gl on a mid-range phone's MapLibre globe. This belongs to task 3 (tech stack).
- **Other licences:** hyparquet (MIT), Apache Arrow JS (Apache-2.0), H3 (Apache-2.0), tippecanoe (BSD-2) and Natural Earth borders (public domain) are `[D]`, from memory.
- **All size estimates** in the section above are `[U]` until the world build finishes. The real number of fire cells and fire-months will settle Plan A against Plan B.
