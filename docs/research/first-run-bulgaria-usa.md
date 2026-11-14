# First run: Bulgaria and the USA (14 Nov 2026)

The first real numbers from the pipeline, on all FIRMS yearly files for Bulgaria and the USA (96 files, 1.2 GB). Every number below was computed from NASA's files with the scripts in `pipeline/`, so it is tagged `[V]` unless marked otherwise.

## How to reproduce

```bash
python3 pipeline/download_firms.py --countries Bulgaria United_States   # about 1 minute
python3 pipeline/build_cells.py --name bg_us --countries Bulgaria United_States   # about 3 seconds
```

- `download_firms.py` reads NASA's index of yearly country files, skips files already on disk at the listed size, and can be rerun after a stop. `--all` fetches the whole world: **10,095 files, 43.5 GB** (MODIS 8.7 GB for 2000 to 2025, S-NPP 22.2 GB for 2012 to 2025, NOAA-20 12.6 GB for 2018 to 2025) `[V]`.
- `build_cells.py` applies the cleaning rules in [`../harmonization-plan.md`](../harmonization-plan.md) step 1 (type 0 only; MODIS confidence 30 or more; VIIRS confidence `n` or `h`), then counts **fire cell-days**: a 0.01° cell (about 1 km) counts once per day per satellite. It needs the `duckdb` command-line tool. Outputs go to `data/derived/<name>/` (git-ignored).

## Size

- 11,917,303 detections kept after cleaning; 7,342,793 cell-days.

## Checks from the verification plan

| Method | Check | Result |
|---|---|---|
| M125 | Monthly cell-days add up to the cell-day rows | Pass |
| M32 | No future dates; FRP never negative; coordinates valid | Pass |
| M38 | Sensor ratios inside published ranges | Pass, see below |
| M21 | S-NPP and NOAA-20 agree | Mostly, **except for gaps in S-NPP**, see below |

## Finding 1: cell-days halve the sensor gap, they don't remove it

Yearly ratio of VIIRS S-NPP to MODIS, 2012 to 2025:

| | Bulgaria | USA |
|---|---|---|
| Detections, S-NPP ÷ MODIS (Terra + Aqua) | 2.5 to 3.5 (mostly about 3.0) | 3.2 to 4.0 |
| Detections, S-NPP ÷ Aqua only | 3.8 to 5.4 | 5.8 to 7.8 |
| **Cell-days, S-NPP ÷ MODIS** | **1.7 to 2.6 (mostly about 2.2)** | **1.8 to 2.2** |
| Cell-days, S-NPP ÷ Aqua only | 2.7 to 4.0 | 3.3 to 4.3 |

- The detection ratios sit in the published range (Punjab: 4.8× against Terra + Aqua, 6.5× against Aqua alone) `[D]` for the literature figure.
- Counting cell-days brings the gap from about 3× down to about 2×. **The conversion model still matters:** VIIRS sees about twice as many fire cell-days as MODIS.
- The ratio is fairly stable from year to year, which is good for a simple ratio model (model A), but differs between countries, so it must be learned per region.

## Finding 2: S-NPP has data gaps; fill them from NOAA-20

Days on which NOAA-20 detected US fires but S-NPP has no detection at all:

| Period | Days missing in S-NPP |
|---|---|
| 27 Jul to 10 Aug 2022 | 15 |
| 30 May to 3 Jun 2024 | 5 |
| 10 to 28 Jul 2024 | 11 |
| Single days in Sep and Nov 2024, Jul 2025 | 5 |

- In July 2024, S-NPP shows about **half** the cell-days of NOAA-20 in both countries (Bulgaria 399 vs 756, USA 14,156 vs 27,999). Outside gaps the two agree within about 5% (ratio 0.95 to 1.10 most months).
- **Consequence:** a "measured VIIRS" record from S-NPP alone has holes, and training the conversion on those months would teach it the wrong ratio. Suggested fix: use NOAA-20 where S-NPP is missing (from April 2018), and drop gap days from the training pairs.

## Finding 3: MODIS changes satellites in its first years

- Terra starts on 1 Nov 2000; Aqua only on 4 Jul 2002. So **2000 to mid-2002 is Terra only**, while later years are Terra + Aqua.
- The plan learns the conversion on Aqua-to-VIIRS pairs (same afternoon overpass). Converting Terra-only years needs its own Terra relationship, or the first 20 months will be under-counted.

## Not checked yet

- Whether Terra and Aqua overpass times drifted in 2019 to 2025 (the test years) `[U]`; the yearly Aqua ratios above show no strong trend for Bulgaria, and a mild rise for the USA in 2018 to 2020.
- The whole world (download and build running 14 Nov).
