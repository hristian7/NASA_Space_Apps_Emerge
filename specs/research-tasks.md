# Open research tasks (for whoever picks them up)

Created Sat 14 Nov 2026. The team decided to do this research later; nothing below has been started except task 4.

**Read first:**
- [`interview-answers.md`](interview-answers.md): what the team decided.
- [`features-moscow.md`](features-moscow.md): the features.
- [`../docs/firms-data.md`](../docs/firms-data.md): FIRMS facts already checked.
- [`../docs/data-sources.md`](../docs/data-sources.md): the general guide to data sources.

**Conventions:** tag every number `[V]` (read on the original source), `[D]` (secondary source or estimate) or `[U]` (our guess), and give a link for each source. Put results in `docs/research/<topic>.md`. This repo is public, so keep personal information out.

**Requirements every task must respect:**
- **Coverage:** worldwide, with **Bulgaria and the USA as must-haves**.
- **Time:** 2000–2025, plus newer data, plus older data if it exists.
- **Resolution:** daily where possible.
- **App:** a 3D globe (like Google Earth) plus 2D maps; English and Bulgarian; mobile-friendly PWA.
- **Hosting:** a virtual machine and/or Vercel.
- **Build:** done with AI coding agents (Claude Code); the demo is due **Sun 15 Nov 14:00**.

## 1. Data sources (interview C2, D1)

Find fire data that extends or cross-checks the MODIS/VIIRS record. For each source, give: years, coverage, resolution, access (login?), format, size, licence.
- **Before 2000:** for example AVHRR fire products, and ESA's ATSR World Fire Atlas.
- **After 2025:** VIIRS on NOAA-20 and NOAA-21, MODIS near-real-time, and how quickly each updates.
- **Other satellites:** Sentinel-3 SLSTR; geostationary GOES, Himawari and Meteosat (SEVIRI fire radiative power).
- **Burned area:** MODIS MCD64A1, ESA FireCCI, GFED.
- **Small global gridded products:** to avoid downloading tens of GB (for example MODIS monthly climate-modelling-grid fire products).
- **Country-specific:** EFFIS for Bulgaria; NIFC and MTBS for the USA.

## 2. Storage options (interview D5), after task 1

Rank **15** storage and format options from best to worst for:
- worldwide hot-spot points (hundreds of millions of rows);
- daily and monthly totals per area;
- fast drawing on a 3D globe;
- hosting on a VM or Vercel;
- a 24-hour build.

**Candidates:** CSV, Parquet, GeoParquet, DuckDB, SQLite/SpatiaLite, PostGIS, PMTiles/vector tiles, Zarr, NetCDF, COG rasters, pre-computed JSON, H3-indexed totals, ClickHouse, BigQuery public data, Arrow.

**Output:** the ranking plus a recommended combination.

## 3. Tech stack (interview H1)

Rank **20** stack options from best to worst. Score each 1–5 on: polish and wow, 3D globe, large point data, speed of building with AI agents, mobile and PWA, hosting fit (VM/Vercel), licence and cost.

**Candidates:**
- **Globe and map:** CesiumJS/Resium, deck.gl GlobeView, MapLibre globe, Mapbox globe, Globe.gl, Kepler.gl, Google Photorealistic 3D Tiles, OpenLayers, Leaflet, ArcGIS JS.
- **Frameworks:** Next.js, Vite + React, SvelteKit, Streamlit, Dash, Panel.
- **Back ends:** FastAPI, Vercel serverless, DuckDB-WASM, a VM with PostGIS and a tile server.

**Also:**
- **Check the navigation:** describe the pattern of https://everydayweather.com/lab/hazards.
- **Confirm the PWA estimate:** the guess is +5–10% for installable and +25–35% with push (interview B4).
- **Starter repos:** list open-source repos we could start from.

## 4. Forecasting: done, needs verification

A first pass exists: [`../docs/research/forecast-options.md`](../docs/research/forecast-options.md).
- **Recommendation:** show official forecasts (Copernicus GWIS/EFFIS for 1–9 days; the NIFC 4-month outlook for the USA). Add our own "historical chance of fire this month", checked on held-out years. Label it "Risk outlook (unofficial)".
- **Still to verify** (most numbers there are `[D]`):
  - the GWIS/EFFIS WMS layer names;
  - the Fire Weather Index class limits;
  - whether Bulgaria's weather service (NIMH) offers machine-readable fire-danger data.

## Still waiting on the team

- **Tick features** in [`features-moscow.md`](features-moscow.md) (Must and Should).
- **Unanswered interview questions:**
  - E1 and E2 (Claude recommends VIIRS-equivalent units and a ratio-vs-regression comparison);
  - D4 (who registers the FIRMS key);
  - H4 (performance target);
  - J1 (who pitches on site at 16:00).
