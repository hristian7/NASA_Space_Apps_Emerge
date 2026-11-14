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

**Where the repo discusses each source** (last column): `FD` [firms-data](firms-data.md) · `DS` [data-sources](data-sources.md) · `RF` [research/data-sources-fire](research/data-sources-fire.md) · `RS` [research/data-sources-satellites](research/data-sources-satellites.md) · `SUM` [research/data-sources-summary](research/data-sources-summary.md) · `FO` [research/forecast-options](research/forecast-options.md) · `FM` [research/feature-map](research/feature-map.md) · `CO` [research/competitors](research/competitors.md) · `CP` [conversion-plan](conversion-plan.md) · `SR` [plans/spike-results](plans/spike-results.md) · `REF` [references](references.md) · `SP1` [plan 1 spec](../specs/specification.md) · `SP2` [plan 2 spec](../specs/plan-2-fire-risk/specification.md).

## How to add or change a source

1. **Pull first.** Search this file; if the source is already here, update its row instead of adding a new one.
2. Add **one row** in the right section, with every column filled: status, value and a one-line reason, coverage and delay, access and licence, the official link, and where the repo discusses it.
3. Tag every number. Link the official page, not a blog.
4. **No keys, logins, tokens or personal names** in this file.
5. Add one line to the change log at the bottom, then commit and push (pull before every push).

---

## 1. Sources that can feed the prediction engine, ranked

Sorted by value, then by how ready the source is.

| # | Source | What it gives | Value | Why it matters for prediction | Status | Coverage and delay | Access, licence and link | Repo |
|---|---|---|---|---|---|---|---|---|
| 1 | **NASA FIRMS archive:** MODIS C6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20) | Every satellite fire detection since 2000 | **5** | Fires come back to the same places and months; this is the history behind every forecast and the source of the training labels `[D]` | **In use** (461,501,221 detections kept from 10,095 files, 43.5 GB `[V]`) | World; Terra from 1 Nov 2000, Aqua from 4 Jul 2002, S-NPP 20 Jan 2012 – 2 Nov 2026, NOAA-20 from 1 Apr 2018 `[V]`. MODIS science data ends about Feb 2027 (Terra) and Sep 2027 (Aqua) `[V]` | Yearly country files, no key, NASA open data: [link](https://firms.modaps.eosdis.nasa.gov/data/country/). NOAA-20 folder is `viirs-jpss1` `[V]` | FD, RS, SP1, CP, REF |
| 2 | **firms-catalog** (public GeoParquet mirror of FIRMS) | All detections 2000 to today, incl. NOAA-21 from Jan 2024 | **5** | Keeps the history current to today without a huge download | **In use** (2026 months, raw-hotspots download) | World; 631 million rows, data to 14 Nov 2026 `[V]`; `type` is empty for recent rows `[V]`, so a static-source mask is needed | Data CC0, code Apache-2.0 `[V]`: [link](https://source.coop/portolan-mirrors/firms-catalog) | SO, CP, SP1, REF |
| 3 | **NASA FIRMS near-real-time** (24 h and 7-day files: MODIS, NOAA-20, NOAA-21) | Fires burning now | **5** | A fire nearby today raises tomorrow's risk; also the daily truth for the scorecard | **In use** (recent fires layer) | World; within 3 hours of each pass `[V]`; no `type` field `[V]`. Backup route: the FIRMS area API with a free key (5,000 calls per 10 min `[V]`) | No key, NASA open data: [link](https://firms.modaps.eosdis.nasa.gov/data/active_fire/) | FD, SP1, REF |
| 4 | **NASA GFWED fire-weather forecasts** (GEOS-5) | Fire weather index (FWI) and its parts: FFMC, DMC, DC, ISI, BUI, DSR | **5** | Weather is the main day-to-day driver; the FWI turns temperature, humidity, wind and rain into plant dryness and spread speed `[D]`. Past forecasts from Dec 2017 let the model train on the same system it runs on `[V]` | **Planned** (plan 2, decision D-11) | World, 0.25°; days +1 to +8 per run; runs 1–2 days behind; labelled experimental `[V]` | No login, NetCDF, about 16 MiB a day `[V]`: [about](https://data.giss.nasa.gov/impacts/gfwed/) · [files](https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5/) | SP2, FO, RF |
| 5 | **NASA MODIS land cover MCD12C1** v061 | Share of forest, shrubs, grass and farmland in each square | **4** | What grows decides what burns; forest is the firefighters' main concern | **Planned** (plan 2, spike c) | World, 0.05°, yearly; latest 2025 `[V]` | Free Earthdata login `[D]`: [LP DAAC](https://cmr.earthdata.nasa.gov/search/concepts?short_name=MCD12C1) | SP2, CP |
| 6 | **MODIS land cover MCD12Q1 mosaic** (Zenodo) | 17 land classes at 500 m, 2021 | **4** | Same use as row 5, with no login | **Planned** as the no-login option (already downloaded in spike e) | World, 500 m, 133 MB `[V]` | **CC BY-SA 4.0** (share-alike, decision open) `[V]`: Zenodo record 8367523 | SR |
| 7 | **NASA MODIS vegetation index MOD13C1** v061 (NDVI) | How green the plants are, compared with normal | **4** | Shows plants drying out (green in June, dry in July), which weather alone misses | **Planned** (plan 2, spike d) | World, 0.05°, every 16 days; about 2 weeks behind `[V]`. After MODIS: VIIRS VJ213C1 (NOAA-21) or VJ113C1 (NOAA-20) `[V]` | Free Earthdata login `[D]`: [LP DAAC](https://cmr.earthdata.nasa.gov/search/concepts?short_name=MOD13C1) | SP2 |
| 8 | **People: population and settlements** (JRC Human Settlement Layer) **and roads** (OpenStreetMap) | Where people live, work and travel | **4** | Most fires are started by people; in Bulgaria about 95% of forest fires are human-caused `[D]`. Distance to roads and villages is a known predictor `[D]` | **Future**, not checked | World; yearly or slower `[U]` | GHSL free, edition to check `[U]`; OpenStreetMap ODbL `[D]` | FM, IQ |
| 9 | **Raw weather forecast in real units** (Open-Meteo; a global model grid such as NOAA GFS) | Temperature, humidity, wind speed and direction, rain | **3** | The FWI already carries these; raw values explain each spot, draw wind arrows and may add skill | **Planned** (plan 2, spike a) | Open-Meteo: world, up to 16 days `[V]`; free for non-commercial use, under 10,000 calls a day `[V]`, so per region only. GFS to check `[U]` | No key: [terms](https://open-meteo.com/en/terms) | SP2, FM |
| 10 | **Copernicus GWIS / EFFIS fire danger** (ECMWF about 8 km, Météo-France about 10 km, NASA GEOS-5 layers) | The official fire-danger forecast | **3** | The baseline our engine must beat; shown to users as the official view | **In use** (fire-danger layer, S3) | World, today to +9 days `[V]`; 406 map layers `[V]`; point values from `ecmwf.query` empty for 13–20 Nov, `nasa_geos5.query` worked `[V]` | No key, CORS open `[V]`; licence under review (D-4): [WMS](https://maps.effis.emergency.copernicus.eu/gwis) | FO, SP1, REF, SR |
| 11 | **Copernicus CEMS historical fire danger** (ERA5) | FWI and its parts, every day since 1940 | **3** | Longer training history; a backup to GFWED | **Future** (backup) | World, 0.25°, daily, to 12 Nov 2026; **offline from 16 Nov 2026** for an upgrade `[V]` | Free ECMWF account `[D]`, CC BY 4.0 `[V]`: [link](https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1) | RF, SUM, FO, SP2 |
| 12 | **ERA5 weather history** (through Open-Meteo or CEMS) | Past temperature, humidity, wind, rain | **3** | Needed only if raw weather becomes a model input | **Future** | World, 0.25°, from 1940; about 5 days behind `[V]` | Open-Meteo history API `[V]` | RF, FO, SP2 |
| 13 | **NASA MODIS burned area MCD64A1** v6.1 | Where land burned each month | **3** | Time since the last burn shows how much fuel has grown back `[D]`; also an outside check | **Planned** (proof page, V-M41) | World, 500 m, monthly, Nov 2000 to now `[D]` | Free Earthdata login, no restrictions `[D]` | RF, SUM, SP1, CP |
| 14 | **Rain: NASA GPM IMERG** | Rain every 30 minutes, about 10 km | **3** | Recent rain resets plant dryness `[D]` | **Future** | World `[D]` | Earthdata login `[D]` | DS |
| 15 | **Soil moisture** (NASA SMAP; GLDAS; ESA CCI soil moisture) | How wet the ground is | **3** | Deep drought feeds big fires `[D]` | **Future** (skipped in plan 1) | SMAP 9–36 km from 2015 `[D]` | SMAP no restrictions `[D]`; GLDAS Earthdata login; ESA CCI terms conflict `[D]` | RF, DS |
| 16 | **NOAA Vegetation Health (VHI)** | Weekly plant stress | **3** | Another view of drying plants, back to 1981 `[D]` | **Future** (skipped in plan 1) | World, 4 km, weekly `[D]` | US government work `[D]` | RF, SUM |
| 17 | **Lightning** (EFFIS lightning forecast; GOES lightning mapper for the Americas) | Where lightning will strike | **3** | The main natural cause of fires, especially in remote forests `[D]` | **Future** | EFFIS area; GOES: Americas, from 2017 `[D]` | EFFIS terms to check: [catalogue](https://forest-fire.emergency.copernicus.eu/applications/data-and-services); GOES US government `[D]`. WWLLN rejected (section 5) | FM, RF |
| 18 | **Terrain** (SRTM 30 m; Copernicus DEM) | Height, slope and which way a slope faces | **3** | Sunny south slopes dry faster and fire runs uphill `[D]` | **Future** | World | SRTM on AWS, no login `[D]` | DS |
| 19 | **European Fuel Map** (JRC) | Fuel classes across Europe | **3** | Better fuel detail than global land cover, for Europe only | **Future** | Europe; 2017 edition `[V]` | EFFIS, citation given: [link](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fuels) | FM |
| 20 | **Finer land cover** (ESA CCI Land Cover; CORINE for Europe; ESA WorldCover) | Forest and fields at 10–300 m | **3** | Needed for sharper 1–2 km spots (C12) | ESA CCI: **Planned** (plan 1 pipeline B, region lookup); others **Future** | World or Europe | Licences to verify | CP, FM, CO |
| 21 | **Meteosat fire products** (LSA SAF: MSG SEVIRI, MTG FCI) | Fires every 10–15 minutes over Europe and Africa | **3** | Sees fires between polar-satellite passes, so "fires now" is fresher | **Future** (a "fires in the last hour" layer is a Could) | SEVIRI 3 km, every 15 min, 2004–2015 record and live from 2016; FCI 1 km, every 10 min, demonstration since Oct 2025 `[V]` | WMS with no login, CORS open; CC BY 4.0 `[V]` | RS, SUM, CO |
| 22 | **ECMWF Probability of Fire** (machine-learning forecast) | A 10-day fire probability | **3** | A rival forecast to compare against | **Future** (access not checked) | World `[D]`; reported +30% skill `[D]` | ECMWF | FO |
| 23 | **SeasFire cube** | 59 fire-driver variables, ready-made | **3** | Shows which drivers matter, before we collect them ourselves | **Future** | World, 0.25°, 8-day, 2001–2021 | CC BY 4.0 `[V]`: [Zenodo](https://doi.org/10.5281/zenodo.8055879) | RF |
| 24 | **Mesogeos** | Mediterranean wildfire data cube | **3** | A ready daily training set for the Mediterranean | **Future** | 1 km, daily, 2006–2022 | CC BY 4.0 `[V]`: [Zenodo](https://zenodo.org/records/8036851) | RF |
| 25 | **GOES-19 fire product** (NOAA ABI) | Fires every 5–15 minutes over the Americas | **2** | Fresher fires, Americas only `[V]` | **Future** (heavy to process) | Americas, about 2 km `[D]`; GOES-19 East since 4 Apr 2025 `[V]` | AWS open data, no login, public domain `[V]`: [link](https://registry.opendata.aws/noaa-goes/) | RS, SUM, CO |
| 26 | **Himawari (Japan) and GK2A (Korea)** | Geostationary fire views over Asia and Australia | **2** | As GOES, for Asia and Australia | **Future** (Himawari skipped in plan 1) | Himawari from Jul 2015 `[D]` | Himawari: registration, companies must notify JAXA `[V]`; GK2A terms to check | RS, SUM, FM |
| 27 | **Sentinel-3 SLSTR fires** (plus the Copernicus monthly 0.25° FRP grid) | Fires from a European sensor | **2** | A second, independent sensor | **Future** (cheapest independent check) | From 19 Aug 2020, about 1 km `[D]` | Free Copernicus account, CC BY 4.0: [link](https://cds.climate.copernicus.eu/datasets/satellite-fire-radiative-power) | RS, SUM, FM |
| 28 | **Landsat active fires** (OLI, in FIRMS) | Small fires at 30 m | **2** | Detail for case studies; too infrequent for daily use | **Future** | From Jun 2022 `[V]` | Through FIRMS | DS, FM |
| 29 | **NOAA/CIMSS Next Generation Fire System** | US fires every 5 minutes | **2** | Faster detection, USA only | **Future** | USA; 5 min is the provider's claim `[V]` | Terms not verified | FM |
| 30 | **FIRMS US/Canada rapid regional** | Faster MODIS/VIIRS for North America | **2** | Fresher "fires now", North America only | **Future** | USA and Canada | Free: [link](https://firms.modaps.eosdis.nasa.gov/usfs/) | FM |
| 31 | **Forest height: NASA GEDI** | Forest height and biomass | **2** | Fuel amount `[D]` | **Future** | Partial world coverage `[U]` | Earthdata login | DS |
| 32 | **Plant water stress: NASA ECOSTRESS** | Plant stress at about 70 m | **2** | Fine detail, but irregular revisits `[U]` | **Future** | Partial | Earthdata login | DS |
| 33 | **Drought indices** (SPEIbase; GRACE drought indicators) | Long-term drought | **2** | Season-scale dryness; SPEIbase stops in 2020 | **Future** (skipped in plan 1) | SPEIbase 0.5°, 1901–2020 `[D]` | SPEIbase ODbL `[D]`; GRACE likely CC BY 4.0 `[D]` | RF, SUM |
| 34 | **Climate indices** (El Niño: RONI, ONI, Niño regions, MEI; Indian Ocean Dipole; NAO, AO, PDO, AMO) | Large-scale climate swings | **2** | Shift whole fire seasons, not tomorrow; NAO matters most for the Balkans `[D]` | **Future** (checked in plan 1 research) | Monthly; e.g. RONI Aug–Oct 2026 = +1.97 `[V]` | NOAA, no account: [RONI](https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt) · [PSL](https://psl.noaa.gov/data/timeseries/month/) | RF, SUM |
| 35 | **NIFC fire-potential outlooks** (7 days; 4 months) | The official US outlook | **2** | A US baseline and display layer | **Planned** (S3, USA) | USA; 4-month: 240 zones, field `FirePotent` `[V]`. **Never show the `Comments` field** (staff names) | ArcGIS, no key, CORS `[V]`: [outlooks](https://www.nifc.gov/nicc/predictive-services/outlooks) | FO, SP1 |
| 36 | **Seasonal fire danger** (Copernicus CEMS seasonal; EFFIS monthly outlook) | Danger months ahead | **2** | Planning a season, not tomorrow | **Future** (Could layer) | World, 216-day horizon `[V]` | Free account, CC BY 4.0 `[V]`: [link](https://ewds.climate.copernicus.eu/datasets/cems-fire-seasonal) | RF, FO, FM |
| 37 | **EFFIS wildfire risk map** (pan-European) | Long-term danger × vulnerability × exposure | **2** | Static context, not a daily probability | **Future** | Europe | EFFIS: [link](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/wildfire-risk-assessment) | FM |
| 38 | **NASA POWER** | Daily weather for any point since 1981 | **2** | Simple point weather history | **Future** | World | No account | DS |
| 39 | **MERRA-2** (NASA reanalysis) | Hourly atmosphere, about 50 km, from 1980 | **2** | The basis of GFWED's history | **Future** | World | Earthdata login | DS, RF |
| 40 | **Next Day Wildfire Spread** (Google, Kaggle) | 18,545 US fires with next-day spread | **2** | About spread, not where fires start; USA only | **Future** | USA | Licence not confirmed `[U]` | RF |
| 41 | **GFED4.1s basis regions** | 14 world fire regions on the 0.25° grid | **2** | A way to group the world for the model | **In development** (downloaded in spike e; licence open) | World, 70 MB `[V]` | No login; no licence text `[V]`: [link](https://www.geo.vu.nl/~gwerf/GFED/GFED4/) | SR, CP |
| 42 | **Bulgaria NIMH fire-danger map** (meteo.bg) | Official danger per district, today to +2 days | **2** | The national baseline for Bulgaria | **Link only**: PNG only, copyrighted `[V]` | Bulgaria | [meteo.bg](https://meteo.bg/bg/forecasts/fireindex) | FO |
| 43 | **NASA AIRS** | Air temperature and humidity by height | **1** | Not needed for ground-level fire risk `[U]` | **Future** | World | Earthdata login | DS |

## 2. Truth, outside checks and plan 1 conversion inputs

FIRMS (rows 1–3) is the truth for the plan 2 scorecard. A source built from the same satellites is not an independent check.

| Source | What it gives | Status | Coverage and facts | Access and link | Repo |
|---|---|---|---|---|---|
| **EFFIS estimates by country** (JSON) | Satellite-mapped fires (about 30 ha or more `[D]`) and burned area per year | **In development** (M28; the app holds one example year) | Bulgaria 2006–2026 `[V]`; BG 2024: 44,745 ha, 133 fires `[V]`. **Not "national reported" numbers** | No login: [API](https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=BGR) (use `BGR`; `BG` returns empty `[V]`) | RS, SUM, SP1, FM, CO |
| **EFFIS annual report, national tables** | Fires reported by national services (Bulgaria: the Executive Forest Agency) | **Planned** (M28, top recommendation) | Bulgaria 2015–2024 `[V]`; BG 2024: 595 forest fires, 17,116 ha `[V]` | PDF tables: [report](https://doi.org/10.2760/0649290) | RS, FM, CO |
| **NIFC annual fires and acres** | US reported fires | **In development** (M28; example file has 2024 only) | USA 1983–2025 `[V]`; 2025: 77,850 fires, 5,131,474 acres `[V]` | HTML table: [link](https://www.nifc.gov/fire-information/statistics/wildfires) | RS, SUM, SP1, FM |
| **NIFC cause and cost statistics** | Human vs lightning causes; costs | **Future** | USA | [link](https://www.nifc.gov/fire-information/statistics) | FM |
| **NOAA NCEI monthly US wildfires** | Monthly fires and acres | **Future** (not independent of NIFC) | Contiguous USA, Jan 2000 – Oct 2026 `[V]` | [link](https://www.ncei.noaa.gov/access/monitoring/wildfires/) | FM |
| **European Fire Database** | National fire records | **Future** (by request) | Participating European countries | [link](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/european-fire-database) | FM |
| **US fire perimeters (WFIGS)**; **MTBS** (large US fires, 30 m, from 1984) | Outlines and severity of US fires | **Future** | USA | [WFIGS](https://data-nifc.opendata.arcgis.com/); MTBS CC BY 4.0 `[D]` | FM, RF, CP |
| **Canada active fires ("DIP" in FIRMS)** | Canadian incidents | **Future** (terms unresolved) | Canada | FIRMS US/Canada map | FM |
| **MODIS MCD14CMQ** | Monthly 0.25° fire pixels with cloud and coverage | **Planned** (plan 1 pipeline A, step 4) | World; 2026 posting unverified | UMD SFTP, HDF4 | CP |
| **VIIRS VNP64A1** burned area | Monthly 500 m burned area from 2012 | **Future** (check) | World | Earthdata, no restrictions `[D]` | RF, CP |
| **GFED5 burned area** and the **GFED5NRT** method | 0.25° burned area 1997–2020; a published VIIRS calibration method | **Future** (checks only); GFED5NRT is our method template | r = 0.94, 8% regional error `[V]` | GFED5 CC BY 4.0 `[D]` ([Zenodo](https://zenodo.org/records/7668423)); code MIT ([GitHub](https://github.com/ychenzgithub/GFED5NRT)) | RF, CP, SR |
| **ESA FireCCI 5.1** | Monthly burned area 2001–2020 | **Future** (check) | World | Open via Copernicus `[D]` | RF, SUM |
| **GWIS GlobFire and country profiles** | Fire perimeters and country statistics | **Future** (check) | From 2002; profiles stop at 2019 `[V]` | CC BY 4.0 `[D]`: [link](https://gwis.jrc.ec.europa.eu/applications) | RF, CO |
| **EFFIS rapid damage assessment** | Mapped burned areas and severity | **Future** (context) | Europe | EU content CC BY 4.0 `[V]` | FM, CO |
| **Local-authority fire scars** (as used in Google's evaluation) | Post-fire outlines | **Future** (a model for an independent check) | Not downloadable | — | FM |

## 3. Maps, borders and display (value 1)

| Source | Used for | Status | Access and link | Repo |
|---|---|---|---|---|
| **NASA GIBS** Blue Marble and Black Marble | Day and night base maps | **In use** | No key, CORS open `[V]`: [docs](https://nasa-gibs.github.io/gibs-api-docs/) | REF, SP1 |
| **OpenFreeMap** (OpenStreetMap data) | Street base map | **In use** | ODbL, credit OpenStreetMap; tile terms to verify: [link](https://openfreemap.org) | REF, SP1 |
| **Natural Earth admin-0** | Country borders | **In use** | Public domain: [link](https://www.naturalearthdata.com/) | REF, SP1 |
| **Natural Earth admin-1** | Provinces and states for "top spots per region" (needed for the ranking, predicts nothing) | **Planned** (plan 2, spike e) | Public domain, over 4,500 regions `[V]` | SP2 |
| **GIBS daily MODIS/VIIRS true colour** | Today's satellite picture | **Future** | No key | FM |
| **Sentinel-2 cloudless** (EOX) | A sharper background map | **Future** | Tile terms to check | FM |
| **Protected areas** (Natura 2000, via EFFIS) | What a fire would damage | **Future** | Layer-specific rights | FM, CO |

## 4. Reference sites and competitors (not data feeds)

Details in [`research/competitors.md`](research/competitors.md) and [`research/feature-map.md`](research/feature-map.md).

| Site | Why it matters | Status |
|---|---|---|
| NASA FIRMS map and map services | The official NASA fire map; the only resource the challenge page lists `[V]` | Link only |
| EFFIS and the JRC pages | The EU's fire system and its reports | Link only |
| Google wildfire boundary tracking | AI fire outlines in Search and Maps, 34+ countries `[V]`; no public data feed | Link only |
| fire.ai | Closest rival: FIRMS + NIFC + history in one map, mostly the USA | Benchmark |
| Watch Duty | US nonprofit app; the benchmark for "user-friendly" | Benchmark |
| Global Forest Watch (now Global Nature Watch `[V]`), Greenpeace fire calendar, OroraTech | Other rivals | Benchmark |
| NIFC, InciWeb, CAL FIRE, Ready.gov, AirNow | US official information, incidents, advice and air quality | Link only |
| EU Civil Protection Mechanism (DW article) | How Europe coordinates firefighters | Background |

## 5. Rejected, and why

| Source | Why not |
|---|---|
| VIIRS VNP13C1 vegetation index; `VIIRS_SNPP_NRT` | Their satellite (S-NPP) stopped delivering on 2 Nov 2026 `[V]`; use VJ213C1, NOAA-20/21 or MODIS |
| A numeric Copernicus fire forecast | None exists as a download; only history and seasonal `[V]` |
| Copernicus CEMS as plan 2's live fire-weather source | No numeric forecast, and offline from 16 Nov `[V]`; NASA GFWED instead (D-11) |
| Open-Meteo for the whole world every day | Under 10,000 calls a day on the free plan `[V]`; one call per place |
| Pre-2000 sensors: ESA ATSR World Fire Atlas, TRMM VIRS, AVHRR | Different sensors, night-only or tropics-only; no honest way to extend the record |
| Burned-area grids (GFED5, FireCCI, SeasFire) on the globe | They measure burned land and blend sensors, and stop in 2020–2021; outside checks only |
| Geostationary or Sentinel-3 counts in the calendar | Different detection limits; they complement the record but can't extend it |
| EFFIS estimates shown as "reported" national figures | They are satellite-mapped fires; use the Executive Forest Agency figures instead |
| Bulgaria NIMH map as a data layer | Copyrighted image with no values; link only |
| US Red Flag and Fire Weather warnings | Not for an unofficial service; never reuse warning words |
| Google boundaries, Watch Duty stream, OroraTech, Planet, Overstory, Wet Dog Weather | No open data, or commercial |
| Camera networks (ALERTCalifornia, fire.ai community cameras); airport observations in fire.ai | No open data feed; web cameras are out of scope (W11) |
| EM-DAT | Commercial use needs a paid licence `[V]` |
| WWLLN lightning, OpenAQ, Berkeley Earth | Non-commercial only `[D]` |
| GDACS, ReliefWeb, Copernicus EMS rapid mapping | Unclear licence or out of scope `[D]` |
| Smoke and air quality (CAMS GFAS, CAMS EAC4, NOAA HMS, Open-Meteo air quality) | Out of scope for fire prediction |
| Esri/ArcGIS, Mapbox, Google 3D Tiles base maps; Cesium ion | Need an account, key or billing; not open `[V]` |

---

## Change log

| Date | Change |
|---|---|
| 14 Nov 2026 | File started from the repo's research, the code, and the plan 2 data check |
| 14 Nov 2026 | Merged a full sweep of the repo's docs: added 17 prediction sources, plan 1 checks and conversion inputs, and the rejected list |
