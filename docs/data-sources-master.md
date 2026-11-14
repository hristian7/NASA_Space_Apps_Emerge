# Data sources: the master list

**The one place that records every data source:** what it gives, whether we use it yet, and how much it helps predict fires one day or more ahead (plan 2: [`../specs/plan-2-fire-risk/specification.md`](../specs/plan-2-fire-risk/specification.md)). Started 14 Nov 2026. Detail lives in the linked research files; this file is the register.

**Tags:** `[V]` verified at a primary source · `[D]` directional · `[U]` our inference.

## How to read it

**Status:**
- **In use:** the code reads it today.
- **In development:** being wired in now, or partly in the app (for example example figures only).
- **Planned:** in a build plan, not started.
- **Future:** a good idea for later; not in a build plan.
- **Link only:** we point users to it; we don't read its data.
- **Rejected:** checked and not usable (section 5 says why).

**Prediction value (1–5):** how much the source should help the next-day risk engine.
- **5** core driver: without it there is no forecast;
- **4** strong: clearly improves where and when fires start;
- **3** useful: adds skill in some places or seasons;
- **2** small or indirect;
- **1** none: display or context only.

The values are our judgement `[U]`, based on the fire factor each source measures (weather, plant dryness, fuel type, people, history, terrain) and on whether it covers the whole world daily for free. **After the hold-out test,** each input's real value is measured by removing it and checking how much the capture rate drops, and the ranks are updated here.

## How to add or change a source

1. **Pull first.** Search this file; if the source is already here, update its row instead of adding a new one.
2. Add **one row** in the right section, with every column filled: status, value and a one-line reason, coverage and delay, access and licence, the official link, and where the repo discusses it.
3. Tag every number. Link the official page, not a blog.
4. **No keys, logins, tokens or personal names** in this file.
5. Add one line to the change log at the bottom, then commit and push (pull before every push).

---

## 1. Sources that can feed the prediction engine, ranked

| # | Source | What it gives | Value | Why it matters for prediction | Status | Coverage and delay | Access, licence and link |
|---|---|---|---|---|---|---|---|
| 1 | **NASA FIRMS archive:** MODIS C6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20) | Every satellite fire detection since 2000 | **5** | Fires come back to the same places and months; this is the history behind every forecast and the source of the training labels `[D]` | **In use** (pipeline: 461,501,221 detections kept `[V]`) | World; Terra from 1 Nov 2000, Aqua from 4 Jul 2002, S-NPP 20 Jan 2012 – 2 Nov 2026, NOAA-20 from 1 Apr 2018 `[V]` | Yearly country files, no key, NASA open data: [link](https://firms.modaps.eosdis.nasa.gov/data/country/) · [`firms-data.md`](firms-data.md) |
| 2 | **firms-catalog** (public GeoParquet mirror of FIRMS) | 2026 detections up to today, NOAA-21 from Jan 2024 | **5** | Keeps the history current without a huge download | **In use** (raw hotspots download) | World; `type` is empty for recent rows `[V]` | Data CC0 `[V]`: [link](https://source.coop/portolan-mirrors/firms-catalog) |
| 3 | **NASA FIRMS near-real-time** (last 24 h and 7 days: MODIS, NOAA-20, NOAA-21) | Fires burning now | **5** | A fire nearby today raises tomorrow's risk; also the daily truth for the scorecard | **In use** (recent fires layer) | World; within 3 hours of each pass `[V]`; no `type` field `[V]` | No key, NASA open data: [link](https://firms.modaps.eosdis.nasa.gov/data/active_fire/) |
| 4 | **NASA GFWED fire-weather forecasts** (GEOS-5) | Fire weather index (FWI) and its parts: FFMC, DMC, DC, ISI, BUI, DSR | **5** | Weather is the main day-to-day driver; the FWI turns temperature, humidity, wind and rain into plant dryness and spread speed `[D]`. Past forecasts from Dec 2017 let the model train on the same system it runs on `[V]` | **Planned** (plan 2, decision D-11) | World, 0.25°; days +1 to +8 per run; runs 1–2 days behind; labelled experimental `[V]` | No login, NetCDF: [about](https://data.giss.nasa.gov/impacts/gfwed/) · [files](https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/) |
| 5 | **NASA MODIS land cover MCD12C1** v061 | Share of forest, shrubs, grass and farmland in each square | **4** | What grows decides what burns; forest is the firefighters' main concern | **Planned** (plan 2, spike c) | World, 0.05°, yearly; latest 2025 `[V]` | Free Earthdata login `[D]`: [LP DAAC](https://cmr.earthdata.nasa.gov/search/concepts?short_name=MCD12C1) |
| 6 | **NASA MODIS vegetation index MOD13C1** v061 (NDVI) | How green the plants are, compared with normal | **4** | Shows plants drying out (green in June, dry in July), which weather alone misses | **Planned** (plan 2, spike d) | World, 0.05°, every 16 days; about 2 weeks behind `[V]`. Successor after MODIS: VIIRS VJ213C1 (NOAA-21) or VJ113C1 (NOAA-20) `[V]` | Free Earthdata login `[D]`: [LP DAAC](https://cmr.earthdata.nasa.gov/search/concepts?short_name=MOD13C1) |
| 7 | **People: population and settlements** (for example the JRC Global Human Settlement Layer) **and roads** (OpenStreetMap) | Where people live, work and travel | **4** | Most fires are started by people; in Bulgaria about 95% of forest fires are human-caused `[D]`. Distance to roads and villages is a known predictor `[D]` | **Future**, not checked | World; yearly or slower `[U]` | GHSL free `[U]`; OpenStreetMap ODbL `[D]` |
| 8 | **Raw weather forecast in real units** (temperature, humidity, wind speed and direction, rain) | The numbers behind "very hot, strong wind" | **3** | The FWI already carries these; raw values explain each spot, draw wind arrows and may add skill | **Planned** (plan 2, spike a) | Open-Meteo: world, up to 16 days, ERA5 history API `[V]`; free for non-commercial use, under 10,000 calls a day `[V]`, so per region only | No key: [terms](https://open-meteo.com/en/terms). A global model grid (for example NOAA GFS) is to check `[U]` |
| 9 | **Copernicus GWIS / EFFIS fire danger** (ECMWF FWI) | The official fire-danger forecast | **3** | The baseline our engine must beat; shown to users as the official view | **In use** (fire-danger layer, S3) | World, today to +9 days; point values from `ecmwf.query` were empty for 13–20 Nov, `nasa_geos5.query` worked `[V]` | No key; licence under review (D-4): [WMS](https://maps.effis.emergency.copernicus.eu/gwis) |
| 10 | **Copernicus CEMS historical fire danger** (ERA5) | FWI and its parts, every day since 1940 | **3** | Longer training history; a backup to GFWED | **Future** (backup) | World, 0.25°, daily, to 12 Nov 2026; **offline from 16 Nov 2026** for an upgrade `[V]` | Free ECMWF account `[D]`, CC BY 4.0 `[V]`: [link](https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1) |
| 11 | **Lightning** (EFFIS lightning forecast; GOES lightning mapper for the Americas) | Where lightning will strike | **3** | The main natural cause of fires, especially in remote forests `[D]` | **Future**, not checked | EFFIS area; Americas `[U]` | EFFIS catalogue: [link](https://forest-fire.emergency.copernicus.eu/applications/data-and-services) |
| 12 | **Terrain** (elevation, slope, which way a slope faces; for example the Copernicus DEM) | The shape of the land | **3** | Sunny south slopes dry faster and fire runs uphill `[D]` | **Future**, not checked | World `[U]` | Free `[U]` |
| 13 | **Soil moisture** (for example NASA SMAP) | How wet the ground is | **3** | Deep drought feeds big fires `[D]` | **Future**, not checked | World `[U]` | Free Earthdata login `[U]` |
| 14 | **NASA MODIS burned area MCD64A1** | Where land burned each month | **3** | Time since the last burn shows how much fuel has grown back `[D]`; also an outside check | **Planned** (proof page, V-M41) | World, monthly `[U]` | Free Earthdata login `[U]` |
| 15 | **European Fuel Map** (EFFIS) | Fuel classes across Europe | **3** | Better fuel detail than global land cover, for Europe only | **Future** | Europe; 2017 edition `[V]` | EFFIS catalogue: [link](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fuels) |
| 16 | **Finer land cover** (CORINE for Europe, ESA WorldCover, ESA CCI) | Forest and fields at 10–300 m | **3** | Needed for sharper 1–2 km spots (C12) | **Future** | Europe or world `[U]` | Copernicus / ESA terms to check |
| 17 | **Meteosat fire products** (LSA SAF: MSG SEVIRI and MTG FCI) | Fires every 10–15 minutes over Europe and Africa | **3** | Sees fires between polar-satellite passes, so "fires now" is fresher | **Future** (a "fires in the last hour" layer is possible) | SEVIRI 3 km, every 15 min, operational; FCI 1 km, every 10 min, demonstration `[V]` | WMS without login; CC BY 4.0 `[V]`: [`research/competitors.md`](research/competitors.md) |
| 18 | **GOES-19 fire product** (NOAA) | Fires every 10 minutes over the Americas | **2** | Fresher fires, but the Americas only `[V]` | **Future** | Americas, 2 km bands `[V]` | Public domain `[V]` |
| 19 | **Himawari (Japan) and GK2A (Korea)** | Geostationary fire views over Asia and Australia | **2** | As GOES, for Asia and Australia | **Future**, not checked | Asia-Pacific `[U]` | Provider terms to check |
| 20 | **Sentinel-3 SLSTR active fires** | Fires from a European sensor | **2** | A second, independent sensor `[U]` | **Future** | World `[U]` | Copernicus terms to check |
| 21 | **Landsat active fires** | Small fires at 30 m | **2** | Detail for case studies; too infrequent for daily use | **Future** | From June 2022 `[V]` | Through FIRMS |
| 22 | **Forest height and density** (for example NASA GEDI) | How much wood is there to burn | **2** | Fuel amount `[D]` | **Future**, not checked | Partial world coverage `[U]` | Free `[U]` |
| 23 | **NIFC fire-potential outlooks** (7 days, 4 months) | The official US outlook | **2** | A US baseline and display layer | **Planned** (S3, USA) | USA `[V]` | US government: [link](https://www.nifc.gov/nicc/predictive-services/outlooks) |
| 24 | **Seasonal fire danger** (Copernicus CEMS seasonal, EFFIS monthly) | Danger months ahead | **2** | Planning a season, not tomorrow; little skill beyond weeks `[D]` | **Future** | World, up to 7 months `[D]` | Free account `[D]` |
| 25 | **EFFIS wildfire risk map** (pan-European) | Long-term danger × vulnerability × exposure | **2** | Static context, not a daily probability | **Future** | Europe | EFFIS: [link](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/wildfire-risk-assessment) |
| 26 | **Bulgaria NIMH fire-danger map** (meteo.bg) | Official daily danger per province, in summer | **2** | The national baseline for Bulgaria | **Link only** (no API) | Bulgaria, today and maybe +1 day `[U]` | [meteo.bg](https://meteo.bg) |

## 2. Truth and outside checks

FIRMS (rows 1–3) is the truth for the plan 2 scorecard. The sources below check plan 1's record and give official reported numbers (M28). A source built from the same satellites is not an independent check.

| Source | What it gives | Status | Coverage | Access and link |
|---|---|---|---|---|
| **EFFIS estimates by country** (JSON) | Satellite-mapped fires and burned area per country and year | **In development** (M28; the app holds example figures) | Bulgaria 2006–2026 `[V]` | [API](https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=BGR) |
| **EFFIS annual report, national tables** | Fires reported by national services (for Bulgaria, the Executive Forest Agency) | **Planned** (M28) | Bulgaria 2015–2024 `[V]` | [Report](https://doi.org/10.2760/0649290) |
| **NIFC annual fires and acres** | US reported fires | **In development** (M28) | USA 1983–2025 `[V]` | [link](https://www.nifc.gov/fire-information/statistics/wildfires) |
| **NOAA NCEI monthly US wildfires** | Monthly US fires and acres (from NIFC) | **Future** | Contiguous USA, Jan 2000 – Oct 2026 `[V]` | [link](https://www.ncei.noaa.gov/access/monitoring/wildfires/) |
| **European Fire Database** | National fire records | **Future** (detailed data by request) | Participating European countries | [link](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/european-fire-database) |
| **US fire perimeters** (WFIGS) | Outlines of US incidents | **Future** | USA | [link](https://data-nifc.opendata.arcgis.com/) |

## 3. Maps, borders and display (value 1)

| Source | Used for | Status | Access and link |
|---|---|---|---|
| **NASA GIBS** Blue Marble and Black Marble | Day and night base maps | **In use** | No key: [docs](https://nasa-gibs.github.io/gibs-api-docs/) |
| **OpenFreeMap** (OpenStreetMap data) | Street base map | **In use** | ODbL, credit OpenStreetMap: [link](https://openfreemap.org) |
| **Natural Earth admin-0** | Country borders | **In use** | Public domain: [link](https://www.naturalearthdata.com/) |
| **Natural Earth admin-1** | Provinces and states for "top spots per region" (value 2: needed for the ranking, predicts nothing) | **Planned** (plan 2, spike e) | Public domain, over 4,500 regions `[V]` |
| **Sentinel-2 cloudless** (EOX) | A sharper background map | **Future** | Tile-service terms to check |
| **GIBS daily MODIS/VIIRS true colour** | Today's satellite picture | **Future** | No key |

## 4. Reference sites and competitors (not data feeds)

Details in [`research/competitors.md`](research/competitors.md) and [`research/feature-map.md`](research/feature-map.md).

| Site | Why it matters | Status |
|---|---|---|
| EFFIS and the JRC pages | The EU's fire system and its reports | Link only |
| NASA FIRMS map | The official NASA fire map | Link only |
| Google wildfire boundary tracking | AI fire outlines in Search and Maps, 34+ countries `[V]`; no public data feed | Link only |
| fire.ai | Closest rival: FIRMS + NIFC + history in one map, mostly the USA | Benchmark |
| Watch Duty | US nonprofit app; the benchmark for "user-friendly" | Benchmark |
| Global Forest Watch, Greenpeace fire calendar, OroraTech | Other rivals | Benchmark |
| NIFC, CAL FIRE, Ready.gov, InciWeb | US official information and advice | Link only |
| EU Civil Protection Mechanism (DW article) | How Europe coordinates firefighters | Background |

## 5. Rejected, and why

| Source | Why not |
|---|---|
| VIIRS VNP13C1 vegetation index | Its satellite (S-NPP) stopped delivering on 2 Nov 2026 `[V]`; use VJ213C1 or MODIS |
| A numeric Copernicus fire forecast | None exists as a download; only history and seasonal `[V]` |
| Open-Meteo for the whole world every day | Under 10,000 calls a day on the free plan `[V]`; one call per place |
| Google boundaries as a feed | No public API or export found |
| Commercial feeds (Watch Duty stream, OroraTech, Planet, Overstory) | No open licence |
| Burned-area grids as the fire history | They measure burned land, not active fires, so they can't replace hotspots (M14) |
| Data before 2000 | No honest way to extend the record ([`research/data-sources-summary.md`](research/data-sources-summary.md)) |

---

## Change log

| Date | Change |
|---|---|
| 14 Nov 2026 | File started from the repo's research, the code, and the plan 2 data check |
