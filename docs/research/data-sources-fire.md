# Fire data sources beyond FIRMS (research task 1)

First pass at [research task 1](../../specs/research-tasks.md#1-data-sources-interview-c2-d1): data that extends, densifies or cross-checks the MODIS/VIIRS hot spot record, plus fire danger, El Niño and crisis data that could feed a risk outlook. Researched 14 Nov 2026.

Tags: `[V]` checked at the original source on 14 Nov · `[D]` from official pages or papers read by a research pass, not re-opened · `[U]` our inference. Licences matter because everything we submit becomes open source, and non-NASA material must be freely available.

## Summary

- **Avoid downloading tens of GB.** Two small, ready-made global grids exist: **GFED5 burned area** (0.25°, monthly, 1997 to 2020) and the **SeasFire cube** (0.25°, 8-day, 2001 to 2021, 59 variables including MODIS fire and ocean indices). Both CC BY 4.0.
- **Best second source of truth (method M41):** **MODIS MCD64A1 burned area** (500 m, monthly, Nov 2000 to now, no restrictions). It is a different product from the hot spots (burned area, not active fire), so agreement in season and year-to-year pattern is a real outside check.
- **Fire danger history and forecasts:** the Copernicus fire weather index (FWI) reanalysis goes back to **1940**, and the seasonal fire danger forecast reaches about 7 months. Copernicus data has been **CC BY 4.0 since 2 July 2025** `[V]`, which answers the open GWIS licence question in the forecast note (credit required).
- **Watch out for:** EM-DAT (paid for commercial use), WWLLN lightning (non-commercial), Berkeley Earth temperatures (non-commercial), Google Earth Engine as a platform for anything commercial.
- **A caveat for the backtest:** the Terra and Aqua satellites carrying MODIS have been drifting from their usual overpass times in recent years `[U]`, which changes when MODIS looks and so how many fires it counts, in the same years used to test the conversion (2019 to 2025). Worth checking before trusting the test results; the same-time pairs approach (interview answer D3, option 5) partly protects against it.

## 1. Burned area and fire history

| Dataset | Contents | Resolution, period | Access | Licence |
|---|---|---|---|---|
| **MODIS MCD64A1 v6.1** | Monthly burned area with burn date | 500 m, Nov 2000 to now | NASA Earthdata (free login), also LP DAAC | No restrictions (NASA data policy) `[D]` |
| **VIIRS VNP64A1 v2** | Monthly burned area from VIIRS | 500 m, 2012 to now | NASA Earthdata | No restrictions `[D]` |
| **GFED5 burned area** | Monthly burned area by type (crop, forest, peat, total) | 0.25°, 1997 to 2020 (1° for 1997 to 2000) | Zenodo record 7668423 | CC BY 4.0 `[D]` |
| **ESA FireCCI 5.1** | Monthly burned area from MODIS | 250 m pixels, 0.25° grid, 2001 to 2020 | CEDA archive | Open for any purpose via the Copernicus copy `[D]` |
| **GWIS burned area (GlobFire)** | Fire perimeters and country statistics | 2002 to now | JRC data catalogue, map services | CC BY 4.0 `[D]` |
| **MTBS** (USA) | Large fire perimeters and burn severity | 30 m, 1984 to now | mtbs.gov | CC BY 4.0 `[D]` |
| **EFFIS** (Europe, Bulgaria) | Fire seasons, burned area, country profiles | Seasonal and yearly | EFFIS website and map services | CC BY 4.0 (Copernicus) `[D]` |

## 2. Ready-made datasets for training or quick global coverage

| Dataset | Contents | Licence |
|---|---|---|
| **SeasFire cube** (Zenodo 8055879) | 59 variables at 0.25°, 8-day steps, 2001 to 2021: ERA5 weather, MODIS burned area and fire, drought, vegetation, ocean and climate indices | CC BY 4.0 `[V]` |
| **Mesogeos** (Zenodo 8036851) | Mediterranean wildfire datacube, 1 km daily, 2006 to 2022 | CC BY 4.0 `[V]` |
| **GFED5 burned area** | See above; small enough to serve globally | CC BY 4.0 `[D]` |
| **Next Day Wildfire Spread** (Google, Kaggle) | 18,545 US fire events with next-day spread | Not confirmed `[U]` |

## 3. Fire danger (forecast and history)

| Dataset | Contents | Resolution, period | Access | Licence |
|---|---|---|---|---|
| **CEMS fire historical** | Fire weather index and its parts (FFMC, DMC, DC, ISI, BUI) from ERA5 | 0.25°, daily, 1940 to now | Copernicus EWDS `cems-fire-historical`, free account | CC BY 4.0 `[V]` |
| **CEMS seasonal fire danger** | Monthly-issued forecasts about 7 months ahead, reforecasts from 1981 | 1°, monthly | EWDS `cems-fire-seasonal` | CC BY 4.0 `[D]` |
| **GWIS current situation** | FWI forecast to about 10 days, active fires, burnt area | Global map service | `maps.effis.emergency.copernicus.eu/gwis` (layer names already verified in the forecast note) | CC BY 4.0 `[D]` |
| **NASA GFWED** | FWI from NASA's MERRA-2 and GEOS-5, plus forecasts | About 0.5°, 1981 to now | `portal.nccs.nasa.gov/datashare/GlobalFWI/` | NASA open data; no licence page found `[D]` |
| **ECMWF GEFF** (the model itself) | Software that computes fire danger indices | n/a | GitHub `ecmwf-projects/geff` | Apache 2.0 `[D]` |

## 4. Fuel, drought and lightning

| Dataset | Contents | Resolution, period | Licence |
|---|---|---|---|
| **NOAA vegetation health (VHI)** | Weekly vegetation stress, a fuel dryness proxy | 4 km, 1981 to now | US government work; "experimental" note on older pages `[D]` |
| **SPEIbase** | Drought index at 1 to 48 month scales | 0.5°, monthly, 1901 to 2020 | ODbL (credit, share-alike for derived databases) `[D]` |
| **GRACE drought indicators** | Groundwater and soil moisture percentiles | 0.25°, weekly, 2002 to now | Likely CC BY 4.0 `[D]` |
| **NASA SMAP** | Soil moisture | 9 to 36 km, 2015 to now | No restrictions `[D]` |
| **ESA CCI soil moisture** | Soil moisture | 0.25°, daily, 1978 to now | Conflicting terms (archive "any purpose", project page "science only") `[D]` |
| **GOES GLM** | Lightning over the Americas, every 20 seconds | About 8 to 14 km, 2017 to now | US government work `[D]` |
| **WWLLN** | Global lightning | 2004 to now | **Non-commercial only** `[D]` |

## 5. Smoke and air quality

| Dataset | Contents | Resolution, period | Licence |
|---|---|---|---|
| **CAMS GFAS** | Fire emissions and fire radiative power, feeds smoke forecasts | 0.1°, 2003 to now | CC BY 4.0 `[D]` |
| **CAMS reanalysis EAC4** | Smoke, dust and aerosol history | 0.75°, 3-hourly, 2003 to now | CC BY 4.0 `[D]` |
| **NOAA HMS smoke polygons** | Daily smoke plume outlines over North America | 2005 to now | US government work `[D]` |
| **OpenAQ** | Ground air quality stations | Varies | **Non-commercial** without an agreement `[D]` |

## 6. Disasters and related crises

| Dataset | Coverage | Licence |
|---|---|---|
| **Copernicus EMS rapid mapping activations** | Mapped disaster activations since 2012, public API | Open with credit `[D]` |
| **GloFAS** | River flooding history (1980 to now) and forecasts | CC BY 4.0 `[D]` |
| **GDACS** | Multi-hazard alerts, free API | No open licence stated on its terms page `[D]` |
| **ReliefWeb** (UN OCHA) | Humanitarian reports since 1996, API | Unclear `[D]` |
| **EM-DAT** | Disasters since 1900 | **Paid licence for commercial use** (price page in EUR `[V]`; reported about EUR 6,000 a year `[D]`) |
| **Dartmouth Flood Observatory** | Large floods since 1985 | Research and education only `[D]` |

## 7. El Niño and climate oscillations (for a seasonal outlook)

All NOAA files below are small text files, need no account, and are US government works.

| Index | History | File | Tag |
|---|---|---|---|
| **RONI** (NOAA's operational El Niño index since Feb 2026) | 1950 to now | `https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt` | `[V]` |
| **ONI** (the classic index) | 1950 to now | `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` | `[V]` |
| **Niño regions, monthly** | 1982 to now | `https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices` | `[V]` |
| **MEI.v2** | 1979 to now | `https://psl.noaa.gov/enso/mei/data/meiv2.data` | `[V]` |
| **Indian Ocean Dipole** | 1870 to now | `https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.had.long.data` | `[V]` |
| **NAO, AO, PDO, AMO** | Long records | `https://psl.noaa.gov/data/timeseries/month/` | `[D]` |

**Current state, checked 14 Nov:** a strong El Niño is under way. RONI for August to October 2026 is +1.97 (1997: +2.07, 2015: +1.80 at the same stage); the classic ONI is +2.46; the central Pacific (Niño 3.4) was +3.25 °C above normal in October `[V]`.

**What it means for fire `[D]`:**
- **Strong link:** Indonesia and Borneo, Central America, the Amazon (fire seasons predictable 3 to 5 months ahead from sea temperatures; Chen et al. 2011 and 2016).
- **Moderate:** southern Africa, the western USA (where La Niña winters and the PDO matter more).
- **Weak or none:** the Mediterranean and the Balkans (the NAO matters more), boreal Canada, central Siberia.
- **For Emerge:** El Niño adds little to a **Bulgaria** outlook. It is a good line for the world view and a possible extra input for tropical regions.

## Recommendations for Emerge

1. **Keep FIRMS hot spots as the core** (the challenge asks for them). Add **MCD64A1 burned area** as the independent check for M41: compare season timing and year ranking per region.
2. **For worldwide coverage without huge downloads:** precompute from the yearly FIRMS files on a server, or show the 0.25° grids (GFED5, SeasFire) for the world view and full-resolution hot spots only for Bulgaria and the USA.
3. **For the risk outlook:** the CEMS historical FWI (1940 onwards) lets us show "fire weather compared with normal for this date", and the seasonal forecast gives an official months-ahead view. Credit Copernicus (CC BY 4.0).
4. **Check the MODIS orbit drift** before relying on the 2019 to 2025 test years.

## Key papers `[D]`

- Chen et al. 2011, *Science*, Amazon fire season forecasts from sea temperatures: https://doi.org/10.1126/science.1209472
- Chen et al. 2016, *Environmental Research Letters*, how much global burned area is predictable from sea temperatures: https://doi.org/10.1088/1748-9326/11/4/045001
- Chen et al. 2017, *Nature Climate Change*, the pan-tropical fire cascade driven by El Niño: https://doi.org/10.1038/s41558-017-0014-8
- Turco et al. 2018, *Nature Communications*, seasonal fire forecasts from climate predictions: https://doi.org/10.1038/s41467-018-05250-0
- Di Giuseppe et al. 2024, *Scientific Data*, the GEFF fire danger dataset: https://doi.org/10.1038/s41597-024-02948-3
- Prapas et al. 2023, TeleViT, fire forecasting with climate oscillation indices: https://arxiv.org/abs/2306.10940

## Sources

- Copernicus licence change: https://forum.ecmwf.int/t/cc-by-licence-to-replace-licence-to-use-copernicus-products-on-02-july-2025/13464
- CEMS fire historical: https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1
- CEMS seasonal fire danger: https://ewds.climate.copernicus.eu/datasets/cems-fire-seasonal
- GWIS data licence: https://gwis.jrc.ec.europa.eu/about-gwis/data-license
- MCD64A1: https://www.earthdata.nasa.gov/data/catalog/lpcloud-mcd64a1-061
- VNP64A1: https://www.earthdata.nasa.gov/data/catalog/lpcloud-vnp64a1-002
- GFED5 burned area: https://zenodo.org/records/7668423
- SeasFire cube: https://doi.org/10.5281/zenodo.8055879
- Mesogeos: https://zenodo.org/records/8036851
- NASA GFWED: https://data.giss.nasa.gov/impacts/gfwed/
- CAMS GFAS: https://ads.atmosphere.copernicus.eu/datasets/cams-global-fire-emissions-gfas
- SPEIbase: https://spei.csic.es/database.html
- WWLLN: https://wwlln.net/
- OpenAQ terms: https://docs.openaq.org/about/terms
- EM-DAT licence: https://doc.emdat.be/docs/legal/database-license-agreement/
- GDACS terms: https://gdacs.org/About/termofuse.aspx
- Copernicus EMS mapping data: https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/
- GloFAS: https://ewds.climate.copernicus.eu/datasets/cems-glofas-historical
- NOAA CPC indices: https://www.cpc.ncep.noaa.gov/data/indices/
- NOAA PSL time series: https://psl.noaa.gov/data/timeseries/month/
- RONI announcement: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/announcement.php
