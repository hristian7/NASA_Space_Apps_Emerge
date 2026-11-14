# FIRMS fire data: deep dive for the MODIS & VIIRS challenge

*For the general guide to all challenge data sources, see [`data-sources.md`](data-sources.md).*

Facts checked on 2026-11-13. Tags: `[V]` verified at the source · `[D]` directional (secondary source or estimate) · `[U]` our inference.

## What FIRMS is

**FIRMS** (Fire Information for Resource Management System, https://www.earthdata.nasa.gov/data/tools/firms) is NASA's active-fire portal. It is the only resource the challenge lists `[V]`.

| Sensor | Satellite(s) | Pixel size | Years in the yearly country files |
|---|---|---|---|
| MODIS (Collection 6.1) | Terra, Aqua | about 1 km | 2000–2025 `[V]` |
| VIIRS 375 m | Suomi NPP (S-NPP) | 375 m | 2012–2025 `[V]` |
| VIIRS 375 m | NOAA-20 (folder name `viirs-jpss1`) | 375 m | 2018–2025 `[V]` |
| VIIRS 375 m | NOAA-21 | 375 m | No yearly country files yet `[V]` |

**Important:** VIIRS on Suomi NPP **stopped producing new fire data on about 2 Nov 2026** `[V]`. Its history stays available, and NOAA-20 and NOAA-21 replace it.
- [FIRMS blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)
- [LANCE blog](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-noaa-20-noaa-21-what-lance-users-need-know)

## How to get the data

### 1. Yearly country files (no login, no key)

```
https://firms.modaps.eosdis.nasa.gov/data/country/<folder>/<year>/<folder>_<year>_<Country>.csv
```

- **Folders:** `modis`, `viirs-snpp`, `viirs-jpss1`.
  - `viirs-noaa20` and `viirs-noaa21` return 404 `[V]`.
- **Index of all files:** `https://firms.modaps.eosdis.nasa.gov/data/country/yearly_summary_files.txt` `[V]`.
- **Sizes:**

| Data | MODIS | S-NPP | NOAA-20 | Tag |
|---|---|---|---|---|
| Bulgaria, all years | 5.3 MB | 7.4 MB | 3.4 MB | `[D]` |
| Bulgaria, 2024 | 0.1 MB | 0.3 MB | — | `[V]` |
| Brazil, 2024 | 40.6 MB | 147.1 MB | — | `[V]` |
| Global, all years | 10.7 GB | 27.2 GB | 15.4 GB | `[D]` |
| Global, all years, **measured 14 Nov** (country CSVs) | 8.7 GB | 22.2 GB | 12.6 GB | `[V]` (43.5 GB in total; 9.8 GB as zipped global files) |

- **Implication:** per-country on demand is cheap; the whole world is not.

### 2. Recent and 2026 data (free MAP_KEY)

- **Key:** register by email at https://firms.modaps.eosdis.nasa.gov/api/map_key/ `[V]`.
- **Area API:** `…/api/area/csv/<MAP_KEY>/<SOURCE>/<west,south,east,north>/<DAY_RANGE 1-5>/<YYYY-MM-DD>` returns data for that date plus `DAY_RANGE − 1` days `[V]` ([FIRMS API page](https://firms.modaps.eosdis.nasa.gov/api/area/), checked 14 Nov). Not yet tested with a real key. Long histories need many calls, so use the yearly files for 2000–2025.
- **Sources:** `MODIS_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`.
  - Don't use `VIIRS_SNPP_NRT`: it ended on 2 Nov 2026 `[V]`.
- **Limit:** about 5,000 calls per 10 minutes `[D]`.
- **Without a key:** the last 24 hours and last 7 days NRT files download with no key `[V]`.
- **Never commit the MAP_KEY to the repo.**

## Columns and cleaning rules

**MODIS columns:**

```
latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
```

**VIIRS columns:**

```
latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type
```

| Column | Rule | Tag |
|---|---|---|
| `type` | 0 = presumed vegetation fire, 2 = other static land source (e.g. industry). **Keep `type == 0`.** Example: a repeated industrial hot spot near 42.71 N, 24.17 E in Bulgaria is `type = 2` | `[V]` |
| `confidence` | **MODIS:** a number 0–100. **VIIRS:** a letter (`l` low, `n` nominal, `h` high). The scales differ, so thresholds must be chosen per sensor | `[V]` |
| `daynight` | `D` or `N`. The sensors pass over at different times, which affects counts | `[V]` |
| `frp` | Fire radiative power (MW): how intense a fire is | `[V]` |

## How much the two sensors differ (sanity ranges)

| Finding | Source | Tag |
|---|---|---|
| VIIRS saw about **4.8×** more fires than MODIS Terra+Aqua, and **6.5×** more than Aqua alone (Punjab, India) | Vadrevu & Lasko 2018, *Remote Sensing* 10:978 | `[D]` |
| MODIS missed **65%** (forest) to **83%** (low-biomass land) of VIIRS fire pixels (NE Asia, 2012–2017) | Fu et al. 2020, *Remote Sensing* 12:2870 | `[D]` |
| VIIRS 375 m algorithm and first comparison with MODIS | Schroeder et al. 2014, *Remote Sensing of Environment* 143:85–96 | `[D]` (not re-opened) |
| Calibrating VIIRS counts to MODIS-based burned area by region and land cover (code and data public) | Chen et al. 2026, ESSD 18:7535 (GFED5NRT) | `[D]` |
| NASA team working toward a harmonized 0.25° record, so **no official harmonized product exists yet** | Boschetti, MODIS science-team slides (link timed out) | `[D]` |
| Bulgaria: VIIRS S-NPP has about **2.7–3.9×** more detections than MODIS each year, 2012–2025 | Our estimate from file sizes, before cleaning | `[D]` |

**Key risk:** the MODIS-to-VIIRS factor is **not one constant**. It changes with fire size, land cover, season and overpass time `[D]`. Small areas and quiet months (0–5 fires) will be noisy `[U]`.

## Possible second source of truth (not checked yet)

**EFFIS** (European Forest Fire Information System, Copernicus) publishes fire seasons and burned areas for European countries. If it is usable, it is an independent check (method M41).
