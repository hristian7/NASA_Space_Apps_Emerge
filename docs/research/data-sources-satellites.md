# Satellite hot spot sources: before 2000, 2026 data, other satellites, national statistics

Second pass at [research task 1](../../specs/research-tasks.md#1-data-sources-interview-c2-d1). Covers only the gaps left by [`data-sources-fire.md`](data-sources-fire.md): active-fire (hot spot) data, not burned area or fire danger. Researched 14 Nov 2026, time-boxed; cut short, so several items are in "Not verified".

Tags: `[V]` opened the official page on 14 Nov · `[D]` directional (search summary, abstract or secondary source) · `[U]` our inference.

## Summary

- **2026 worldwide is easy with a free FIRMS key.** The area API accepts `world` as the area, and allows 5,000 transactions per 10 minutes `[V]`. NRT (near-real-time) data is replaced by science-quality SP data after about 5 months `[V]`, so 2026 must be NRT for now.
- **MODIS ends soon:** Terra science ends about Feb 2027 and Aqua about Sep 2027 `[V]`. S-NPP VIIRS already stopped on 2 Nov 2026 `[V]`. NOAA-20 (from Apr 2018) and NOAA-21 (from Mar 2023) carry the record on `[V]`.
- **Before Nov 2000 there is no honest extension of the calendar.** The ATSR World Fire Atlas (1995 to 2012) is night-only, from a different sensor `[D]`; TRMM VIRS covers only the tropics `[D]`. Show them, if at all, as a separate "context" layer.
- **Geostationary satellites** (one image every 5 to 15 minutes) are good for a Bulgaria or USA cross-check, but each covers one region and uses a different pixel size. Not worth it for the ~20-hour core.
- **National statistics are available as tables:** EFFIS has a public JSON endpoint for Bulgaria (2006 to 2026) `[V]`; NIFC has a US table for 1983 to 2025 `[V]`.

## Gap 1: before 2000

| Source | Years | Coverage, pixel | Access, format | Licence | Verdict |
|---|---|---|---|---|---|
| **ESA ATSR World Fire Atlas** | Jun 1995 to Mar 2012 `[D]` | Global; ATSR-2 (1995 to 2002) and AATSR (2003 to 2012), **night-time only**, about 1 km `[D]` | ESA DUE portal `due.esrin.esa.int/page_wfa.php` (refused connection on 14 Nov, not verified) | Not verified | **Check only**: night-only counts are a small, different subset of fires, so they cannot be scaled to a daytime MODIS/VIIRS calendar honestly `[U]` |
| **TRMM VIRS fire product** | From Jan 1998 `[D]` (end date not verified) | Tropics only, 38°S to 38°N; monthly summaries at 0.5° `[D]` | NASA GES DISC (not verified) | NASA data, likely open `[U]` | **Skip**: tropics only, different sensor and orbit (drifting overpass time) `[U]` |
| **AVHRR active fire** (NOAA satellites) | Not researched in time | — | — | — | **Skip for now**: see "Not verified" |

**Bottom line:** the hot spot calendar should start in **Nov 2000** (MODIS Terra). For earlier years, point users to burned-area records already listed in the first pass (GFED5 from 1997).

## Gap 2: 2026 data and timing

| Item | Facts | Verdict |
|---|---|---|
| **FIRMS area API** | `/api/area/csv/<MAP_KEY>/<SOURCE>/world/<1-5>/<YYYY-MM-DD>`: **`world` is a valid area** (= -180,-90,180,90) `[V]`. Returns `DATE` to `DATE + DAY_RANGE - 1` `[V]`. Limit **5,000 transactions per 10 minutes**; "larger transactions may count as multiple requests" `[V]`. Jan to mid-Nov 2026 is about 318 days, so about 64 calls of 5 days per source `[U]` | **Use** for 2026 |
| **Sources** | `MODIS_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, plus `_SP` versions for each sensor `[V]` | **Use** NRT for 2026 |
| **Which dates exist** | `/api/data_availability/csv/<MAP_KEY>/ALL` lists the date range of every SP and NRT source `[V]` | **Use** first, to find where SP ends |
| **NRT to SP lag** | "NRT data are replaced with standard science quality data as they become available (with approximately a 5 month lag)" `[V]`. So SP for 2026 covers roughly Jan to Jun now `[U]` | **Use** SP where it exists, NRT after |
| **Latency** | NASA "real-time" = within 60 minutes of the overpass; URT (ultra real-time) under 60 seconds for much of the US and Canada; RT/URT points are deleted once NRT arrives or after 6 hours `[V]`. NRT itself is usually within about 3 hours `[D]` | Not needed for a monthly calendar |
| **FIRMS archive download** | Web request tool; login with **Earthdata or an email code**; CSV, shapefile or JSON, sent by email `[V]` | **Check only**: slower than the API |
| **Coverage per sensor** | MODIS C6.1 from 1 Nov 2000; S-NPP 20 Jan 2012 to 2 Nov 2026; NOAA-20 from 1 Apr 2018; NOAA-21 from 1 Mar 2023 `[V]` | NOAA-21 has no yearly country files (first pass) |
| **End of MODIS** | NASA projects end of science: **Terra Feb 2027, Aqua Sep 2027** `[V]`. Earthdata: both platforms "will begin shutting down operations" in late 2026/early 2027 and are drifting from their designed orbits `[V]` | Flag 2026 MODIS as "drifting orbit" |

## Gap 2a: the VIIRS fleet itself, for reference

Not a new source — Suomi NPP, NOAA-20 and NOAA-21 are already Emerge's core reference sensors (detail on coverage dates and cleaning rules: [`../firms-data.md`](../firms-data.md)). Added here because the orbit geometry explains *why* three satellites together densify the record, which the other files don't spell out.

| Satellite | Equator crossing (local mean solar time) `[V]` | Role in the stagger `[V]` |
|---|---|---|
| Suomi NPP (S-NPP) | ~01:30 and ~13:30 | sits between NOAA-20 and NOAA-21 in the orbit train |
| NOAA-20 (JPSS-1) | ~01:30 and ~13:30, same orbit plane | — |
| NOAA-21 (JPSS-2) | ~01:30 and ~13:30, same orbit plane | flies about 50 minutes ahead of NOAA-20 `[V]` |

**Shared facts, all VIIRS satellites:** 375 m pixels at nadir on the I-band active-fire product (`VIIRS_*_NRT`/`_SP` in FIRMS) `[V]`; 3,040 km swath, giving about 15% overlap between consecutive orbits at the equator and full global coverage from **one** satellite every **12 hours** `[V]`. With three satellites staggered through the same orbit plane, Emerge's combined VIIRS revisit is denser than any single one of them — this is the orbital reason NOAA-20/21 are worth filling gaps with (as `first-run-bulgaria-usa.md` already found for the 2022/2024 S-NPP gap days), not just a fallback.

## Gap 3: other satellites for densifying or cross-checking

Resolved 14 Nov 2026 (second pass): the open questions this file left on Sentinel-3, GOES and Meteosat, plus a new look at Sentinel-4. "comsat geo" in the request that prompted this pass is read as **GOES**, the US geostationary weather satellite already listed here — flag if that's the wrong satellite.

| Source | Coverage, years | Time step, pixel | Access | Licence | Verdict |
|---|---|---|---|---|---|
| **Sentinel-3 SLSTR FRP** (`SL_2_FRP` NTC) | Global; product since 19 Aug 2020; daytime detection completed 28 Feb 2022 `[D]` | About 10:00 and 22:00 overpasses `[U]`; 1 km grid `[D]` | Copernicus Data Space (free account), NetCDF4 `[V]`. **File size:** the SLSTR Level-1+FRP bundle (L1B imagery, FRP mini-files in CSV and NetCDF, and the full image grid) runs **about 24 GB for one full day of global coverage** `[V]` — that's the whole bundle, not the FRP-only output alone, which the product docs don't size separately `[U]` | Copernicus: free and open (CC BY 4.0 since Jul 2025, first pass) | **Check only**: independent sensor for 2020+; the C3S 0.25° grid stays the cheaper cross-check, the full SLSTR bundle is too heavy to pull routinely |
| **GOES ABI fire product** (FDC) | Americas; GOES-East is GOES-19 since 4 Apr 2025, GOES-West is GOES-18 since 10 Jan 2023 `[V]`; GOES-16 from about 2017 `[D]` | 5 to 15 minutes. **Confirmed: 2 km**, on the ABI fixed grid, for both Full Disk and CONUS `[V]`. Product name confirmed: **`ABI-L2-FDCF`** (Full Disk) `[V]`, four bands per file: fire mask, fire temperature, fire area, fire radiative power | AWS open data (`noaa-goes16`/`17`/`18`/`19` S3 buckets, `us-east-1`), **no login**, NetCDF4 `[V]` | NOAA open data `[U]` | **Check only**: good for a USA case study; the mask+FRP bands make it a candidate for an S9-style intensity cross-check, still heavy to process routinely |
| **Himawari-8/9 AHI wildfire (WLF)** | Asia-Pacific; from Jul 2015 `[D]` | 10-minute, hourly, daily and monthly products in P-Tree `[V]`; about 2 km `[D]` | JAXA P-Tree, **registration required** (name, email, organisation, purpose) `[V]` | Free; credit JAXA; **commercial use allowed but must notify JAXA in advance** `[V]` | **Skip**: login plus notification terms; outside our two focus countries |
| **Meteosat SEVIRI/FCI FRP** (LSA SAF) | Europe, Africa (incl. Bulgaria); FRP-Pixel and FRP-Grid from MSG SEVIRI or MTG FCI `[V]`. **Confirmed: operational since 2008, reprocessed back to 2004** via the FRPPixel-R/FRPGrid-R data records `[V]` | **Confirmed: FRP-PIXEL is 3 km / 15 minutes; FRP-GRID is a 5 km hourly summary** that corrects for cloud cover and missed low-FRP pixels `[V]` | LSA SAF data service (`lsa-saf.eumetsat.int`), **free account required** (Account → Register, name/email/organisation) `[V]` | **Confirmed: CC BY 4.0, EUMETSAT** `[V]` | **Check only**: best geostationary option for Bulgaria; FRP-Grid's cloud/low-FRP correction makes it a genuinely different signal from a hot spot count, worth a V-M41-style cross-check rather than a data source for the core record |
| **Sentinel-4 UVN** (on MTG-S1, launched 1 Jul 2025) | Europe and North Africa only; geostationary, scans the full disk every 60 minutes `[V]` | Not a fire/hot-spot sensor: a UV-visible-near-IR spectrometer measuring **NO2, O3, SO2, formaldehyde, glyoxal and aerosols** — smoke and fire emissions, not fire location `[V]` | Via Copernicus Atmosphere Monitoring Service (CAMS) forecasts; raw instrument access not checked this pass `[U]` | Copernicus, presumed CC BY 4.0 like its sibling missions `[U]`, not independently confirmed for this instrument | **Skip for the hot spot calendar** — it cannot detect or count fires. Only relevant if Emerge ever adds a smoke/air-quality layer (matches EFFIS's own "Fire Emissions" Technical Background page, found in [`reported-fires-bg-effis.md`](reported-fires-bg-effis.md)); not worth it for this weekend |

Note: LSA SAF's older FD&M fire product was **discontinued in 2024** `[V]`.

## Gap 4: national statistics

| Source | What | Years | Access | Verdict |
|---|---|---|---|---|
| **EFFIS estimates, Bulgaria** | Yearly mapped burned area (`ba`, ha) and number of mapped fires (`nf`). Example: 2024 = 44,745 ha, 133 fires; 2025 = 32,752 ha, 92 fires; 2026 so far = 8,811 ha, 72 fires `[V]` | 2006 to 2026 `[V]` | Public JSON, no login: `https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=BGR` (ISO3 code; `BG` returns empty) `[V]`. Weekly 2026 trend: `.../statistics/v2/effis/weekly?country=BGR&year=2026` `[V]` | **Use** as the Bulgaria outside check. EFFIS maps only fires of about 30 ha or more `[D]`, so `nf` is far below hot spot counts |
| **EFFIS national (country-reported) statistics** | Number of fires and burned area reported by Bulgaria, in the yearly JRC "Forest Fires in Europe, Middle East and North Africa" report `[D]` | Long series `[D]` | PDF tables (no CSV found) | **Check only** |
| **NIFC wildfires and acres (USA)** | Fires and acres per year, source NICC. 2025 = 77,850 fires, 5,131,474 acres; 2024 = 64,897 fires, 8,924,884 acres `[V]` | **1983 to 2025**; no official data before 1983 `[V]` | HTML table, no download file: `https://www.nifc.gov/fire-information/statistics/wildfires` `[V]` | **Use** for the USA year ranking (copy the table once). US federal work, so public domain `[U]` |

## Recommendations for Emerge

1. **2026:** get a free MAP_KEY, call `data_availability` first, then pull `world` in 5-day chunks: SP where it exists, NRT after (about 64 calls per source, far below the limit `[U]`). Label NRT months "provisional".
2. **Start the hot spot calendar in Nov 2000.** Do not stitch ATSR or VIRS onto it; at most, mention them as "older, different sensors".
3. **Plan for MODIS ending in 2027:** flag 2026 MODIS months as "drifting orbit" and keep NOAA-20/21 as the forward record.
4. **Outside checks per country:** EFFIS JSON for Bulgaria (2006+), NIFC table for the USA (1983+). Compare year rankings, not raw counts.
5. **Geostationary and Sentinel-3:** "Could" only. If time allows, the C3S monthly 0.25° Sentinel-3 FRP grid is the cheapest independent check for 2020+.

## Sources

- FIRMS area API: https://firms.modaps.eosdis.nasa.gov/api/area/
- FIRMS data availability API: https://firms.modaps.eosdis.nasa.gov/api/data_availability/
- FIRMS archive download: https://firms.modaps.eosdis.nasa.gov/download/
- Terra, Aqua end of science (editor's note): https://science.nasa.gov/science-research/earth-science/terra-the-end-of-an-era
- Earthdata MODIS to VIIRS transition: https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs
- S-NPP stop: see [`../firms-data.md`](../firms-data.md)
- ATSR World Fire Atlas: https://due.esrin.esa.int/page_wfa.php (not reachable 14 Nov); ESA news: https://www.esa.int/About_Us/ESRIN/World_fire_maps_now_available_online_in_near-real_time
- TRMM VIRS fire (Giglio et al. 2003, *IJRS* 24(22)): https://modis.gsfc.nasa.gov/sci_team/pubs/abstract_new.php?id=03270
- Sentinel-3 FRP release: https://sentinel.esa.int/web/sentinel/-/new-copernicus-sentinel-3-fire-radiative-power-products-released
- Sentinel-3 SLSTR L2 FRP product data format spec: https://sentinels.copernicus.eu/documents/247904/4760806/S3MPC.ACR.FRP.003+-+i1r4+-+SLSTR+L2+Product+Data+Format+Specification_version_online.pdf
- C3S satellite FRP: https://cds.climate.copernicus.eu/datasets/satellite-fire-radiative-power
- GOES on AWS: https://registry.opendata.aws/noaa-goes/
- GOES-R ABI Fire/Hot Spot Characterization (FDC) product page: https://www.goes-r.gov/products/baseline-fire-hot-spot.html
- GOES-R FDC land product (STAR): https://www.star.nesdis.noaa.gov/goesr/product_land_fire.php
- JAXA P-Tree terms: https://www.eorc.jaxa.jp/ptree/terms.html
- JAXA research data terms: https://earth.jaxa.jp/en/data/policy/index.html
- LSA SAF fire products: https://lsa-saf.eumetsat.int/en/data/products/fire-products/
- LSA SAF data access and registration: https://training.eumetsat.int/mod/book/view.php?id=13365&forceview=1
- LSA SAF FRP products, algorithms and reprocessing to 2004 (Wooster et al. 2015, *ACP*): https://acp.copernicus.org/articles/15/13241/2015/acp-15-13241-2015.pdf
- Sentinel-4 mission overview (EUMETSAT): https://www.eumetsat.int/sentinel-4
- Sentinel-4 mission introduction (ESA): https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-4/Introducing_the_Sentinel-4_mission
- VIIRS Collection 2 375m active fire user guide (orbit, swath, overlap): https://www.earthdata.nasa.gov/s3fs-public/2025-06/VIIRS_C2_AF-375m_User_Guide_1.2.pdf
- FIRMS FAQ (VIIRS acquisition frequency): https://www.earthdata.nasa.gov/data/tools/firms/faq
- EFFIS statistics portal: https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates
- EFFIS API (Bulgaria): https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=BGR
- NIFC wildfires and acres: https://www.nifc.gov/fire-information/statistics/wildfires

## Not verified

- **AVHRR active-fire records** (for example the 1990s IGBP-DIS global fire product, NOAA AVHRR fire detections): not researched in time.
- **ATSR World Fire Atlas** access, format, size and licence: the ESA DUE site refused connections.
- **TRMM VIRS** end year and current download location.
- ~~**Sentinel-3 SLSTR FRP** overpass times, current processing baseline and file sizes.~~ Resolved above (second pass): NetCDF4, CC BY 4.0 confirmed; the ~24 GB/day figure is for the whole L1B+FRP bundle, not the FRP output alone, which is still unsized.
- ~~**GOES ABI FDC** exact product name on AWS and pixel size.~~ Resolved above: `ABI-L2-FDCF`, 2 km, on the ABI fixed grid.
- **Himawari** start year and pixel size: still not independently re-verified (not in scope of the second pass).
- ~~**LSA SAF** start year, account rules and licence text.~~ Resolved above: operational since 2008 (reprocessed to 2004), free registered account, CC BY 4.0.
- **Sentinel-4 UVN** (added second pass): confirmed it is not a fire/hot-spot instrument at all — it measures trace gases and aerosols, not fire location — so it answers "is it useful" (no, for the core calendar) rather than leaving an open question.
- **NRT latency** of about 3 hours for MODIS/VIIRS NRT.
- **What "larger transactions count as multiple" means** for a 5-day `world` call: test with a real key and the MAP_KEY status page.
- **EFFIS country-reported statistics** as a downloadable table (only PDF reports found); the 30 ha mapping threshold.
- **Licences:** NIFC (assumed US public domain), GOES (assumed NOAA open data), LSA SAF.
