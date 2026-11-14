# The data contract between the pipeline and the app

Frozen Sat 14 Nov 2026. This file is the contract named in [`../specs/specification.md`](../specs/specification.md) section 4.3 and step 1 of [`plans/build-plan.md`](plans/build-plan.md).

**This format is frozen. Any change to a file name, a field name, a type, a unit or a null rule needs the director's approval.** The app, the exporter, the oracle's expected answers and the contract test all read this one page, so a quiet change breaks four streams at once. If something here is wrong, say so and get it changed here first.

Three files hold the same contract and must stay in step:

| File | What it is |
|---|---|
| `docs/data-contract.md` | this page, the written contract |
| `web/src/types/data.ts` | the same shapes as TypeScript types, no runtime code |
| `pipeline/export_examples.py` | the generator that writes the example files |

**Tags:** `[V]` verified at a primary source or measured by us; `[D]` directional; `[U]` our inference.

---

## 1. What the app reads

Everything lives under `web/public/data/`, so the app fetches static files and does no processing in the browser (M2).

| Path | Holds | Example size `[V]` |
|---|---|---|
| `meta.json` | version, dates, grid rules, label meanings, no-data periods, which files exist, sources | 3.7 KB |
| `countries/<ISO3>.json` | one country's full monthly series | 56 to 63 KB |
| `countries/index.json` | one line per country file, for the country search | 0.3 KB |
| `background.json` | the value of a month before Feb 2012 that a cell does not list | 1.5 KB |
| `reported/<ISO3>.json` | officially reported fires and burned area per year | 1 to 3 KB |
| `tiles/<lat0>_<lon0>.json.gz` | every fire cell in a 5 degree square, monthly, pre-gzipped | 46 to 56 KB |
| `globe/<year>.json.gz` | one year's totals per cell, for the globe layer, pre-gzipped | 12 KB |
| `daily/<lat0>_<lon0>.json.gz` | the daily window per cell, pre-gzipped | 4 to 5 KB |
| `validation.json` | everything the "How we know it's right" page shows | 7 KB |

The example set in this repo covers Bulgaria and two squares of the USA. The real export adds the rest of the world in the same format. The example set is 0.36 MiB in total `[V]`; the real one is measured at the first world export (decision D-9).

### The two rules that run through every file

1. **Zero is not missing (M19).** `0` means the satellites looked and saw no fire. `null` means there was no measurement at all. Monthly cell files and the daily window list **fire entries only**: a month or day that is absent but inside the coverage period means `0`. The periods with no measurement are listed once, in `meta.json` under `no_data`, and never repeated per record.
2. **Everything is a point (M18, M29).** Every record that stands for a place carries `type`, `lat`, `lon` and `precision_radius_km`, plus at least one measurement. Shapes are drawn by the app after fetching, never stored.

---

## 2. Grid, tiles and the month index

### Cell id, 0.25 degree grid

```
lon  wrapped into [-180, 180)      so +180 becomes -180
row  = floor((90 - lat) / 0.25)    latitude 90 gives row 0; -90 clamps to 719
col  = floor((lon + 180) / 0.25)
cell_id = row * 1440 + col
```

This is the 1440 by 720 grid `[V]`. Row 0 is the top. A cell covers `(lower, upper]` in latitude, so a point exactly on a cell's upper edge belongs to the cell below it. Rows run 0 to 719, columns 0 to 1439, so cell ids run 0 to 1,036,799.

**Cell centre** (what `lat` and `lon` hold on a cell record):

```
row = floor(cell_id / 1440)
col = cell_id - row * 1440
lat = 90 - 0.25 * row - 0.125
lon = -180 + 0.25 * col + 0.125
```

**Precision radius.** Half the diagonal of the cell, in km, with a mean Earth radius of 6371.0088 km:

```
height = 6371.0088 * 0.25 * pi / 180          = 27.80 km
width  = height * cos(lat in radians)
precision_radius_km = sqrt(height^2 + width^2) / 2
```

That is 19.66 km at the equator and 17.11 km at 44.125 degrees `[V]`. It is the honest distance from the cell centre to the furthest point inside the cell, which is why a selection smaller than a cell is labelled low confidence.

### Tile key

```
lat0 = floor(lat / 5) * 5          capped at 85
lon0 = floor(wrapped lon / 5) * 5
key  = "<lat0>_<lon0>"
```

Examples: `40_20` (Bulgaria west), `40_25` (Bulgaria east), `35_-120` (central and eastern California with a strip of Nevada), `45_-115` (Idaho and western Montana). `lat0` runs -90 to 85, `lon0` runs -180 to 175, so there are at most 2,592 tiles; only tiles with fire exist as files.

### Month index

```
monthIndex(y, m) = (y - 2000) * 12 + (m - 1)
```

January 2000 is 0, so November 2000 is 10 and December 2025 is 311. The epoch is stated in `meta.json` as `grid.month_epoch`. `web/src/lib/data/cell.ts` holds all of the above as pure functions: `cellId`, `cellCenter`, `precisionRadiusKm`, `tileKey`, `tileFromKey`, `monthIndex`, `monthFromIndex`.

---

## 3. Shared field meanings

These fields mean the same thing in every file.

| Field | Type | Unit | Null rule |
|---|---|---|---|
| `type` | `"cell"`, `"country"` or `"detection"` | - | never null |
| `lat` | number, -90 to 90 | degrees | never null |
| `lon` | number, -180 to 180 | degrees | never null |
| `precision_radius_km` | number, 3 decimals | km | never null |
| `hot` | whole number, 0 or more | hotspots, harmonized to VIIRS level | `null` only where there is no measurement |
| `hot_lo`, `hot_hi` | whole numbers | hotspots | same as `hot`; always `hot_lo <= hot <= hot_hi` |
| `cd` | whole number, 0 or more | fire cell-days on the **0.01 degree** grid, added up over the record's area, harmonized to VIIRS level | same as `hot` |
| `cd_lo`, `cd_hi` | whole numbers | the same unit as `cd` | always `cd_lo <= cd <= cd_hi` |
| `frp` | whole number, 0 or more | MW (fire radiative power) | same as `hot`. **Not harmonized**: it is the reference sensor's own total, so it steps at the sensor change |
| `terra`, `aqua`, `snpp`, `noaa20`, `noaa21` | whole number or `null` | raw hotspots that satellite itself counted | `null` before that satellite started, or in a gap that was not filled |
| `src` | one of five labels | - | never null |
| `flags` | list of labels, or a bit set in the packed files | - | never null; may be empty or 0 |

Harmonized values and their ranges are **always whole numbers**. `frp` is rounded to whole MW at the last step, after being accumulated in whole thousandths of a MW: floating-point addition is not associative, so a parallel sum of decimals can land on a different last bit from one run to the next, and the files would stop being byte-identical. Only `lat`, `lon` and `precision_radius_km` carry decimals.

### 3.1 What a fire day (`cd`) is

A **fire cell-day** is one 0.01 degree cell (about 1 km) that had fire on one day. `cd` is the number of those (small cell, day) pairs inside the record's area, added up. It is **not** a count of days, and **not** a count of 0.25 degree cell-days, so it has no 31-day ceiling and is never capped.

This is the unit the conversion method uses ([`conversion-plan.md`](conversion-plan.md) section 2: the harmonized value is the sum of fire cell-days in one 0.25 degree cell for one month, counted on 0.01 degree cells) and the unit the bake-off scores ([`../pipeline/bakeoff/PROTOCOL.md`](../pipeline/bakeoff/PROTOCOL.md) section 2, where `cd` is the number of rows of the cell-day table and one row is one satellite seeing fire in one 0.01 degree cell on one day). The small cell is `cy = floor(lat * 100)`, `cx = floor(lon * 100)`.

A cell-day belongs to one satellite stream, so when two satellites see the same small cell on the same day that is two cell-days. The measured series is S-NPP alone. For the estimated years the MODIS input is Terra plus Aqua counted separately, which is what the protocol's row count gives.

**Worked example.** One 0.25 degree cell is 25 by 25 small cells, so it holds 625 of them. If 40 small cells inside it burn on 3 days each in one month, that cell's `cd` for the month is 120. Cell 302642 in `tiles/35_-120.json.gz` has `cd` 2448 for month index 248 (September 2020) `[V]`: a large fire covering many small cells over many days.

The interface may call this "fire days", which reads better than "cell-days" for a firefighter. The number behind the label is the one defined here. A cell's `cd` and its `hot` answer different questions: `hot` counts detections, so one small cell seen twice in a day counts twice; `cd` counts the small cell once that day.

### `src`: how the value was produced

| Label | Period | Meaning |
|---|---|---|
| `estimated_terra` | Nov 2000 to Jun 2002 | converted from Terra alone, the only sensor flying |
| `estimated_modis` | Jul 2002 to Jan 2012 | converted from Terra and Aqua together |
| `measured` | Feb 2012 onward | measured by VIIRS on S-NPP, no conversion |
| `measured_calibrated` | not used in the example set | measured by a second VIIRS sensor, calibrated to S-NPP |
| `provisional` | not used in the example set | from near-real-time data, may be revised |

S-NPP started on 20 Jan 2012 `[V]`, so January 2012 is only part covered and stays `estimated_modis`; the measured record starts in February 2012. This closes conflict 22 in the build plan, which asked for one answer on January 2012.

### `flags`

A closed set. In `countries/` and `reported/` they are written out as strings; in the packed tile, globe and daily files they are a bit set, lowest bit first, over the file's own `flag_labels` list.

| Flag | Bit | Meaning |
|---|---|---|
| `example` | 1 | the number is a stand-in, not a real conversion |
| `partial_month` | 2 | a satellite covers only part of this month |
| `snpp_gap_filled` | 4 | S-NPP gap days were filled from NOAA-20 |
| `low_confidence` | 8 | below the grid's reliable size |

---

## 4. `meta.json`

Read first. It tells the app which files exist, what the labels mean and where there is no data, so no other file has to repeat it.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-meta-1"` | format version; a new number means a breaking change |
| `example` | boolean | `true` while any file in the set holds stand-in numbers |
| `data_version` | string | version of the data, not of the format |
| `built` | `"YYYY-MM-DD"` | when the files were written |
| `last_data_day` | `"YYYY-MM-DD"` | last day of satellite data in the set |
| `first_month`, `last_month` | `"YYYY-MM"` | range of the monthly files |
| `grid` | object | `cell_deg`, `rows`, `cols`, `tile_deg`, `month_epoch` |
| `units` | object | unit name per measurement field |
| `src_labels` | object | one plain-language sentence per `src` label |
| `flag_labels` | object | one plain-language sentence per flag |
| `src_periods` | list | `{from, to, src}`, `to` is `null` for the open end |
| `no_data` | list | see below |
| `daily_window` | object | `days`, `latest_day`, `start_md`, `end_md`, `wraps_year`, `years`, `min_compare_days` |
| `countries`, `reported` | list of ISO3 | which country files exist |
| `tiles`, `daily` | list of tile keys | which tile files exist |
| `globe_years` | list of numbers | which globe files exist |
| `sources` | list | `{id, name, used_for, url, licence, fetched}` |

One `no_data` entry: `scope` is `"global"` (nothing measured) or `"satellite"` (one satellite missing); `sat` names it or is `null`; `from` and `to` are ISO dates and `null` means open; `days` is a count when the period is a scatter of days rather than a run; `reason` is one plain sentence.

`daily_window.min_compare_days` is 8. Nothing shorter may be summed and compared, because counts over fewer than about eight days are strongly biased by the orbit `[V]`.

```json
{"schema":"emerge-meta-1","example":true,"data_version":"example-2026-11-14",
 "built":"2026-11-14","last_data_day":"2025-12-31","first_month":"2000-11",
 "last_month":"2025-12",
 "grid":{"cell_deg":0.25,"rows":720,"cols":1440,"tile_deg":5,"month_epoch":"2000-01"},
 "src_periods":[{"from":"2012-02","to":null,"src":"measured"}],
 "no_data":[{"scope":"satellite","sat":"noaa21","from":null,"to":null,"days":null,
             "reason":"NOAA-21 is not in this data set at all."}],
 "tiles":["35_-120","40_20","40_25","45_-115"]}
```

---

## 5. `countries/<ISO3>.json`

One file per country, keyed by its three-letter code. The country is a single point record (M29) carrying a long list of months.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-country-1"` | |
| `example` | boolean | |
| `built` | `"YYYY-MM-DD"` | |
| `iso3` | string | three-letter country code |
| `name_key` | string | translation key, `country.<ISO3>` |
| `type` | `"country"` | |
| `lat`, `lon` | number | the mean of the country's fire cell centres. A summary point, **not** a border centroid |
| `precision_radius_km` | number | distance from that point to the furthest of those cells, so the circle covers all the data in the file |
| `first_month`, `last_month` | `"YYYY-MM"` | |
| `months` | list | **every** month from `first_month` to `last_month`, in order, with no gaps |

`months` is the one place that does not drop empty entries: the calendar needs a full grid, and a country file is small enough to carry it (302 months `[V]`). A month with no fire carries zeros, not `null`.

Each month holds, in this order: `y`, `m`, the seven harmonized fields, the five raw satellite fields, `src`, `flags`.

**How the harmonized country numbers are built.** `cd` adds up the fire cell-days inside the country, so a country total is the sum over its 0.25 degree cells (section 3.1). From Feb 2012 `hot`, `cd` and `frp` are the measured S-NPP totals for the country and the ranges collapse onto the value. Before that they are the MODIS total multiplied by the example ratio, with a plus or minus 30 per cent range. Country totals use the data provider's own country for each detection, so cells on a border can differ slightly from a drawn outline (stated in the app).

```json
{"schema":"emerge-country-1","example":true,"built":"2026-11-14","iso3":"BGR",
 "name_key":"country.BGR","type":"country","lat":42.7886,"lon":25.2032,
 "precision_radius_km":292.486,"first_month":"2000-11","last_month":"2025-12",
 "months":[{"y":2024,"m":7,"hot":742,"hot_lo":742,"hot_hi":742,"cd":399,"cd_lo":399,
            "cd_hi":399,"frp":9107,"terra":196,"aqua":246,"snpp":742,"noaa20":1377,
            "noaa21":null,"src":"measured","flags":[]}]}
```

---

### 5.1 `countries/index.json`

One line per country file, so the country search box has a data source and does not need to fetch every country file to know what exists.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-country-index-1"` | |
| `example` | boolean | |
| `built` | `"YYYY-MM-DD"` | |
| `countries` | list | sorted by `iso3` |

One entry: `iso3`, `name` (English, for the search box), `lat` and `lon` (the same summary point as the country file), and `bbox` as `[west, south, east, north]` in degrees. The box is drawn around the outer edges of the country's fire cells, not its border, and it is the smallest such box: it is found by cutting the longitudes at their widest empty gap, so a country reaching across the 180 degree line gets a box with **`west` greater than `east`** rather than one spanning the whole world. The app must handle that case.

```json
{"schema":"emerge-country-index-1","example":true,"built":"2026-11-14",
 "countries":[{"iso3":"BGR","name":"Bulgaria","lat":42.7886,"lon":25.2032,
               "bbox":[22.25,41,28.75,44.25]},
              {"iso3":"USA","name":"United States","lat":42.7733,"lon":-106.677,
               "bbox":[179.5,18.75,-66.75,70.5]}]}
```

The USA entry shows the wrap: its fire cells run from the Aleutians past the 180 degree line to Maine, so `west` is 179.5 and `east` is -66.75.

## 6. `reported/<ISO3>.json`

Officially reported fires and burned area, for the "detected vs reported" card (M28). These are **national totals**: shown in full for a country selection, and as "country total, for context" for a point or a drawn area.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-reported-1"` | |
| `example` | boolean | |
| `built` | `"YYYY-MM-DD"` | |
| `iso3` | string | |
| `scope` | `"national"` | the only value for now |
| `source` | object | `{name, url, fetched, covers, note}`; `covers` is `[firstYear, lastYear]`; `note` is the caveat the app shows |
| `units` | object | `{fires: "count", burned_ha: "hectares"}` |
| `years` | list | one entry per year the source covers |

A year entry is `{y, fires, burned_ha}`. **`null` means not published or not yet fetched, never zero.** The example files carry only figures verified at the publishing authority: Bulgaria 2024 is 133 fires and 44,745 ha `[V]`; the USA 2024 is 64,897 fires `[V]`, with burned area `null` because we have not verified it. Every other year is `null` in both columns. No reported number is ever invented, not even as an example.

```json
{"schema":"emerge-reported-1","example":true,"built":"2026-11-14","iso3":"BGR",
 "scope":"national",
 "source":{"name":"EFFIS (European Forest Fire Information System)","url":null,
           "fetched":null,"covers":[2006,2026],
           "note":"National totals. EFFIS maps mainly fires of about 30 ha or more."},
 "units":{"fires":"count","burned_ha":"hectares"},
 "years":[{"y":2023,"fires":null,"burned_ha":null},
          {"y":2024,"fires":133,"burned_ha":44745}]}
```

---

## 7. `tiles/<lat0>_<lon0>.json.gz`

Every fire cell in one 5 degree square, with its monthly series. **Stored pre-gzipped; the app unzips it in the browser** (`DecompressionStream("gzip")`), so the file is small whatever the host does about compression.

Layout: one object per cell, with **parallel arrays indexed by position in `mi`**. Every array on a cell has the same length. This drops the repeated field names that a list of month objects would carry, which is most of the bytes at this size.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-tile-1"` | |
| `example` | boolean | |
| `built` | `"YYYY-MM-DD"` | |
| `tile` | object | `{lat0, lon0, deg}` |
| `type` | `"cell"` | every record in the file is a cell |
| `cell_deg` | number | 0.25 |
| `src_labels` | list of 5 labels | `src` values index into this list |
| `flag_labels` | list of 4 labels | `flags` is a bit set over this list, lowest bit first |
| `months` | object | `{first, last}`, the lowest and highest month index in the file |
| `cells` | list | sorted by `id` ascending |

One cell: `type` (`"cell"`), `id` (the cell id), `lat`, `lon`, `precision_radius_km`, `g` (the cell's group id, for the background lookup in section 7.1), then the parallel arrays `mi` (month indexes, ascending), `hot`, `hot_lo`, `hot_hi`, `cd`, `cd_lo`, `cd_hi`, `frp`, `src` (index into `src_labels`), `flags` (bit set).

**Fire months only.** A month is listed when at least one satellite saw at least one detection in that cell. A month inside the coverage period that is not listed means 0. A listed month can still hold `hot: 0` and `cd: 0`: that happens from Feb 2012 when MODIS or NOAA-20 saw fire in the cell but the reference sensor, S-NPP, did not. Zero is the honest harmonized answer there.

**The raw per-satellite series are not in tiles.** They live in the country files only, where the "measured per satellite" view needs them. Keeping them out of tiles is what holds the world export inside a static-file budget (decision D-9).

```json
{"schema":"emerge-tile-1","example":true,"built":"2026-11-14",
 "tile":{"lat0":40,"lon0":20,"deg":5},"type":"cell","cell_deg":0.25,
 "src_labels":["estimated_terra","estimated_modis","measured","measured_calibrated","provisional"],
 "flag_labels":["example","partial_month","snpp_gap_filled","low_confidence"],
 "months":{"first":10,"last":311},
 "cells":[{"type":"cell","id":264329,"lat":44.125,"lon":22.375,
           "precision_radius_km":17.11,
           "g":"BGR_40",
           "mi":[25,55],"hot":[3,11],"hot_lo":[2,8],"hot_hi":[4,14],
           "cd":[3,11],"cd_lo":[2,8],"cd_hi":[4,14],"frp":[12,515],
           "src":[0,1],"flags":[1,1]}]}
```

Read as: cell 264329, month index 25 (February 2002) had 3 harmonized hotspots in a range of 2 to 4, 3 fire cell-days, 12 MW, produced by `src_labels[0]` (`estimated_terra`) and flagged bit 1 (`example`).

---

### 7.1 `background.json`, and the value of a month a cell does not list

Before February 2012 the old sensors often saw nothing where the newer one would have seen fire. The conversion carries that as a small **background** value, and it is the same for every cell of a group in a given calendar month and period, so it is stored once per group rather than on every cell. Without it, a small selection before 2012 reads too low and the calendar shows a false rise in 2012. This matches ruling 10 of [`number-logic.md`](number-logic.md) section 9.

**A group** is one country and one 5 degree latitude band. A tile cell names its group in `g`. **The group id is opaque**: the app looks it up and never takes it apart, because the pipeline owns its shape.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-background-1"` | |
| `example` | boolean | |
| `built` | `"YYYY-MM-DD"` | |
| `note` | string | present only while the numbers are stand-ins |
| `unit` | `"hundredths"` | every value is a whole hundredth: 37 means 0.37 |
| `periods` | `["estimated_terra","estimated_modis"]` | |
| `groups` | object | keyed by group id |

Each group holds one entry per period, and each period holds four arrays of **12 whole numbers, January first**: `hot`, `hot_hi`, `cd`, `cd_hi`. The lower end is always 0, so it is not stored. Values are whole hundredths because a background is well under 1 and storing it as a decimal would cost bytes and invite rounding drift.

**The reading rule, for a tile cell and one month:**

1. The month **is listed** in the cell's `mi`: use the values at that position as they are. A listed month already includes everything, background and all.
2. The month **is not listed and is before February 2012**: the value is `background[g][period][unit][m - 1] / 100`, where `period` is the month's `src` label and `m` is its calendar month. The **lower end is 0** and the **upper end** comes from the matching `_hi` array, divided by 100 as well.
3. The month **is not listed and is February 2012 or later**: the value is 0, with 0 for both ends. The satellites looked and saw no fire.
4. A month outside the coverage period in `meta.json` has no value at all. That is `null`, not 0.

**Country files are not affected.** A country's monthly value already contains the background of every cell inside it, because it was summed over the cells before it was written. Adding the background again to a country total would double-count it.

The globe files are not affected either: a cell absent from a globe file saw no fire that year, and a year is never read through the background rule.

```json
{"schema":"emerge-background-1","example":true,"built":"2026-11-14",
 "note":"Stand-in numbers of a believable size, the same in every month and group. Not a prediction.",
 "unit":"hundredths","periods":["estimated_terra","estimated_modis"],
 "groups":{"BGR_40":{"estimated_terra":{"hot":[30,30,30,30,30,30,30,30,30,30,30,30],
                                        "hot_hi":[90,90,90,90,90,90,90,90,90,90,90,90],
                                        "cd":[20,20,20,20,20,20,20,20,20,20,20,20],
                                        "cd_hi":[60,60,60,60,60,60,60,60,60,60,60,60]},
                     "estimated_modis":{"hot":[30,30,30,30,30,30,30,30,30,30,30,30],
                                        "hot_hi":[90,90,90,90,90,90,90,90,90,90,90,90],
                                        "cd":[20,20,20,20,20,20,20,20,20,20,20,20],
                                        "cd_hi":[60,60,60,60,60,60,60,60,60,60,60,60]}}}}
```

Read as: a cell in group `BGR_40` that does not list March 2005 has 0.30 hotspots for that month, in a range of 0 to 0.90, and 0.20 fire days, in a range of 0 to 0.60. The example numbers are the same in every month and group on purpose, so nobody mistakes them for a prediction.

**The daily files do not carry `g` and do not use the background.** Ruling 10 is a rule about monthly values. The daily window lists fire days only, and a day it does not list is 0, as section 9 says. If the conversion later produces a daily background, that is a contract change and needs the director's approval.

## 8. `globe/<year>.json.gz`

One year of totals per cell, for the globe layer. Pre-gzipped, like a tile.

Layout: **columnar and slim**. One `cols` object of equal-length arrays sharing one index, which is the cheapest shape for a layer that uploads straight into a buffer.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-globe-1"` | |
| `example` | boolean | |
| `built` | `"YYYY-MM-DD"` | |
| `year` | number | |
| `type` | `"cell"` | |
| `cell_deg` | number | 0.25 |
| `point_from_id` | `true` | see below |
| `n` | number | number of cells, equal to every array's length |
| `cols` | object | `id`, `hot`, `cd`, `frp` |

**The point comes from the id here, not from stored fields.** `lat`, `lon` and `precision_radius_km` are left out and the app works them out from `id` with the frozen rule in section 2, which `cellCenter` and `precisionRadiusKm` implement and the expected answers test. `point_from_id` says so in the file. The reason is measured: with the full record shape the world globe layer came to **140 MB for 26 years `[V]`**, which no static budget holds, and the three position fields are exactly reproducible from the id. The ranges and the labels are left out for the same reason: the globe colours cells, and a cell that is opened is read from its tile, which carries everything.

Cells are sorted by `id` ascending. Only cells with at least one detection that year are present; a cell that is absent saw no fire. Yearly `hot`, `cd` and `frp` are the sum of that year's months, with no ceiling on `cd` (section 3.1). Which era a year belongs to comes from `src_periods` in `meta.json`.

```json
{"schema":"emerge-globe-1","example":false,"built":"2026-11-14","year":2024,
 "type":"cell","cell_deg":0.25,"point_from_id":true,"n":2,
 "cols":{"id":[236420,236426],"hot":[8,0],"cd":[4,0],"frp":[100,0]}}
```

## 9. `daily/<lat0>_<lon0>.json.gz`, the daily window

Hotspots and FRP per 0.25 degree cell per day, for the **latest 45 days of data and the same 45 calendar days in every past year**. It feeds "is this month unusual so far" (M5) and "this fire vs past fires" (M27). One file per tile, pre-gzipped, named by the same tile key as `tiles/`.

The window is stated once in the file and once in `meta.json`: `days` (45), `latest_day` (the last day of data), `start_md` and `end_md` (`"MM-DD"`), and `wraps_year`. In the example set the window is 17 November to 31 December, so `wraps_year` is `false`. When a window does run past 31 December, `start_md` is later in the year than `end_md`, `wraps_year` is `true`, and a year block's `y` is the year the window **starts** in, with the last day offsets falling in `y + 1`.

| Field | Type | Notes |
|---|---|---|
| `schema` | `"emerge-daily-1"` | |
| `example`, `built`, `tile`, `type`, `cell_deg` | as in a tile | |
| `values` | `"raw"` | the daily numbers are raw counts, not harmonized ones |
| `sensor_labels` | `["modis","viirs"]` | `sensor` on a year block indexes this list |
| `window` | object | `{days, latest_day, start_md, end_md, wraps_year}` |
| `years` | list of numbers | every year the window is held for, ascending |
| `src_labels`, `flag_labels` | lists | as in a tile |
| `cells` | list | sorted by `id` ascending |

One cell: `type`, `id`, `lat`, `lon`, `precision_radius_km`, `years`. One year block: `y`, `src` (index), `flags` (bit set), `sensor` (index into `sensor_labels`), then the parallel arrays `d` (day offsets from the window start, 0 to `days - 1`, ascending), `hot` and `frp`.

**The daily values are raw, and the app scales them.** `hot` and `frp` are what the sensor flying at the time actually counted: S-NPP from February 2012, MODIS before that. They are **not** converted to VIIRS level, for two reasons. The method refuses to publish daily harmonized values at all, because a count over fewer than about eight days is strongly biased by the orbit `[V]`; and the conversion publishes a monthly factor, not a daily one, so turning one into the other here would be a modelling step nobody has tested. Each year block therefore says which sensor it came from, and the app either marks a MODIS year estimated or scales it with the conversion's own hotspot factor for that place and month. Comparing a MODIS year with a VIIRS year unscaled would show a false jump at 2012.

**Fire days only.** A day is listed when its harmonized `hot` is 1 or more. A day inside the coverage period that is not listed means 0. Only years with at least one fire day are listed, so a cell's `years` is usually much shorter than the file's `years`. A year block's `src` and `flags` are the window's, taken from the lowest `src_labels` index across the days present.

**Usage rule, not a storage rule:** the values are daily, but nothing shorter than `min_compare_days` (8) may be summed and compared, because short runs are badly biased by the orbit `[V]`. M27 sums 8 days. M5 sums the month to date, which is at least 8 days before the comparison is shown.

```json
{"schema":"emerge-daily-1","example":true,"built":"2026-11-14",
 "tile":{"lat0":40,"lon0":20,"deg":5},"type":"cell","cell_deg":0.25,
 "values":"raw","sensor_labels":["modis","viirs"],
 "window":{"days":45,"latest_day":"2025-12-31","start_md":"11-17","end_md":"12-31",
           "wraps_year":false},
 "years":[2000,2001],
 "src_labels":["estimated_terra","estimated_modis","measured","measured_calibrated","provisional"],
 "flag_labels":["example","partial_month","snpp_gap_filled","low_confidence"],
 "cells":[{"type":"cell","id":264329,"lat":44.125,"lon":22.375,
           "precision_radius_km":17.11,
           "years":[{"y":2009,"src":1,"flags":1,"sensor":0,"d":[7],"hot":[1],"frp":[2]}]}]}
```

Read as: cell 264329 had fire on one day of the 2009 window, offset 7, which is 24 November 2009, with 1 raw MODIS hotspot (`sensor_labels[0]`) and 2 MW, in a month the monthly files label estimated.

---

## 10. `validation.json`

Everything the "How we know it's right" page shows (M6). The page renders this file and types no number of its own. In the example set every measured value is `null` and `example` is `true`, so the page can be built and reviewed before the conversion exists; the structure is final.

| Field | Holds |
|---|---|
| `schema` | `"emerge-validation-1"` |
| `example`, `built` | as elsewhere |
| `method` | `grid_deg`, `time_step`, `model`, `reference`, `train_years`, `test_years`, `pre_registered`, `leakage_check` |
| `holdout` | one entry per `direction` (`forward`, `reverse`) x `unit` (`hot`, `cd`) x `scope` (`country_month`, `cell_month`, `circle_month`), each with `train_years`, `test_years`, `n`, `nrmse`, `mae`, `bias_pct`, `r`, `slope` |
| `slices` | `{slice, key, unit, n, nrmse, bias_pct}` per country, month, latitude band, year or fire size, so a weak group cannot hide inside an average |
| `satellite_agreement` | `{pair, unit, years, n, diff_pct}`, for example S-NPP against NOAA-20 |
| `published_ratios` | `{scope, unit, ours, published, published_source, note}` |
| `range_coverage` | `{level_pct, unit, scope, n, observed_pct}`: does a 90 per cent range really hold about 90 per cent of values |
| `chance_of_fire` | `{brier, reliability}`, with ten reliability bins `{bin, predicted, observed, n}` |
| `control_totals` | `{check, passed, detail}` per check, where `passed` is `true`, `false` or `null` for not run |
| `limits` | `{id, text}`, one plain sentence each, written now and not left `null` |

`train_years` and `test_years` are `[first, last]` or `null`. Years are numbers, never strings.

```json
{"schema":"emerge-validation-1","example":true,"built":"2026-11-14",
 "method":{"grid_deg":0.25,"time_step":"month","model":null,"reference":"measured S-NPP",
           "train_years":null,"test_years":null,"pre_registered":null,"leakage_check":null},
 "holdout":[{"direction":"forward","unit":"hot","scope":"country_month","train_years":null,
             "test_years":null,"n":null,"nrmse":null,"mae":null,"bias_pct":null,
             "r":null,"slope":null}],
 "range_coverage":[{"level_pct":90,"unit":"hot","scope":"cell_month","n":null,
                    "observed_pct":null}],
 "control_totals":[{"check":"daily totals equal monthly totals","passed":null,"detail":null}],
 "limits":[{"id":"cell-size","text":"Harmonized numbers exist per 0.25 degree cell, about 28 km across. A smaller area still reports the whole cell, so it is labelled low confidence."}]}
```

---

## 11. Which files a selection loads

| Selection | Files |
|---|---|
| any first load | `meta.json`, `background.json` and `countries/index.json` |
| a country | `countries/<ISO3>.json`, and `reported/<ISO3>.json` for the reported card |
| a point plus a search distance | every `tiles/<key>.json.gz` that overlaps the selection's bounding box, then cells are kept by their centre: inside the distance, **plus the cell that contains the chosen point**, which is always kept because a cell centre can be up to about 19 km away `[V]` |
| a drawn area | the same tiles for the area's bounding box, then cells whose centre is inside the polygon |
| "is this month unusual so far", and "this fire vs past fires" | `daily/<key>.json.gz` for the same tiles |
| the globe layer | `globe/<year>.json.gz` for the year on screen |
| the proof page | `validation.json` |
| the reported card for a point or an area | `reported/<ISO3>.json` of the country the point falls in, shown as "country total, for context" |

A tile covers 5 degrees, so a 500 km search distance can touch a handful of tiles; the app fetches them in parallel and they cache well because the key is a plain name.

---

## 12. Decisions taken while freezing this, and the disagreements behind them

Non-blocking points found while reading the spec and the build plan, and how each is resolved here. None of them changed a field name.

1. **January 2012 had no label.** The spec's M1 says estimated through January 2012; its label rule in 4.3 ends `estimated_modis` in 2011. Build plan conflict 22 asked for one answer. Resolved here: `estimated_modis` runs to January 2012 and `measured` starts in February 2012, because S-NPP started on 20 January 2012 `[V]` and a part-covered month must not be called measured.
2. **The exporter's name.** The spec names `pipeline/export_app.py`. This stream writes `pipeline/export_examples.py`, which is the example-file generator the spec itself asks for in section 8, shortcut 1. The real exporter keeps its own name and writes the same format.
3. **`flags` was a string in the design preview.** Here it is a list of labels in the plain files and a bit set in the packed ones. The preview is not the contract; build plan item 11 and 14 already say so.
4. **FRP is not harmonized.** The spec lists `frp` apart from the harmonized values and their ranges, and no conversion for it has been validated. Rather than invent one, `frp` is the reference sensor's own total and the step at the sensor change is written into `validation.json` as a limit.
5. **A country is not a cell, but M29 needs a point.** A country file is one point record with many months. Its `lat` and `lon` are the mean of its fire cells and its `precision_radius_km` reaches the furthest of them, so the circle honestly covers the data in the file. It is not a claim about borders. For the USA that radius is large, which is correct for a national total.
6. **Country files keep every month; cell files keep fire entries only.** The calendar needs a full grid and a country file is small. A cell file would grow by a large factor if it carried empty months, so there the absence of a month means 0, per rule 1.
7. **A listed cell-month can be all zeros.** From February 2012 a cell can have a month where another satellite saw fire but the reference sensor did not. Dropping the month would be wrong, because the harmonized answer is a measured zero.
8. **`cd` must not be capped, and is not a count of 0.25 degree cell-days.** An earlier draft of this contract defined `cd` on the 0.25 degree grid and capped it at the days in the month. That was wrong: the conversion method, the bake-off protocol and the conversion plan all count a fire cell-day on the 0.01 degree grid. Section 3.1 now carries the real definition, and no ceiling is applied at any level.
9. **Daily values exist although the method refuses daily harmonized numbers.** The spec's method rejects daily output, yet 4.3 requires the daily window table, and M27 needs it. Resolved as a usage rule: the file stores days, nothing shorter than 8 days may be summed and compared, and `min_compare_days` carries that in `meta.json`.
10. **The pre-2012 example numbers.** They are the MODIS value times 2.7 with a plus or minus 30 per cent range. 2.7 is our measured worldwide S-NPP to MODIS fire-cell-day ratio `[V]`, used here only to give the app numbers of a believable size. It is **not** a conversion: the real conversion varies by region, month and unit, and hotspot ratios vary more than fire-day ratios `[V]`. Every such record carries the `example` flag and every file carries `"example": true`.
11. **NOAA-21 is null everywhere.** The source files hold no NOAA-21 at all, so every `noaa21` field is `null`, not 0, and `meta.json` lists it as a no-data period. This is the clearest live test of rule 1 in the app.
12. **Tiles are only as complete as the input.** The example tiles are built from a two-country extract, so a tile that straddles a border holds only cells from Bulgaria or the USA. The world export fills them.

---

## 13. The two exporters

| Script | Writes | Numbers |
|---|---|---|
| `pipeline/export_examples.py` | the whole file set for Bulgaria and two squares of the USA | measured S-NPP from Feb 2012; stand-ins before that, flagged `example` |
| `pipeline/export_app.py` | the whole file set for the world | the conversion's own output, `"example": false` |

They share the grid rules, the labels, the writers and the reported figures from one place, so the two cannot drift apart. The real exporter reads four files from the conversion (`cells_monthly`, `countries_monthly`, `cell_groups`, `background`), the raw cell-day table for the daily window, and the independent scorer's results for `validation.json`.

**The real exporter does not invent anything it was not given.** Its country files map the data provider's own country names to three-letter codes from a table written out in the script; **a name that is not in that table gets no country file and is printed by name in the run output**, never guessed. Its reported files carry the same two verified figures as the example set and no others, so they stay flagged as an example until the rest are fetched. Its `validation.json` is read from the scorer's own score table and committed results, including the one world-gate check that was missed, and it states that the conversion was tested on two countries only.

Every value the conversion gives as a decimal is rounded half up to a whole number on the way out, and a range whose end lands on the wrong side of the value after rounding is pulled back to the value, so `hot_lo <= hot <= hot_hi` always holds. Background values are rounded half up to whole hundredths the same way.

## 14. How the example files are made and checked

```bash
python pipeline/export_examples.py --data <data dir> --out web/public/data
```

`--data` defaults to `data` beside the repo root and must hold `derived/bg_us/cell_days.parquet`. `--out` defaults to `web/public/data`. The world export is `python pipeline/export_app.py --in <conversion dir> --out <dir>`. The output is deterministic: JSON with no spaces and a fixed field order, and gzip written with no timestamp, so two runs give byte-identical files.

`tests/contract/test_contract.py` checks the generated files against this page: required fields on every record, `src` inside the five labels and matching the date rule, `hot_lo <= hot <= hot_hi` and the same for `cd`, whole numbers where this page says whole numbers, no negative values, no month before November 2000, each cell id consistent with its own `lat` and `lon`, `precision_radius_km` within 1 per cent of half the cell diagonal, every `.gz` file valid gzip, and that `cd` is not capped at the days in a month.

Three control totals sit on top of that, each against something this stream did not write:

1. For three months the raw per-satellite numbers in `countries/BGR.json` equal a direct count from the source table, and nowhere in the series does a `null` hide a real count.
2. For all five country-months in `tests/expected/bakeoff/truth_samples.json` the measured `cd` and `hot` in the country file equal the independently computed totals. Those answers were written by a separate agent from the raw files, with no dataframe library and without the cell-day table, and they drop the 34 S-NPP gap days. Our files agree on all five, including the two months that hold gap days (Bulgaria Jul 2022 and the USA Aug 2022), so the two paths agree on the gap rule as well.
3. `web/tests/cell.test.ts` runs all 34 cases of `tests/expected/cell_id.json` through `cellId` and `cellCenter`. It sits under `web/tests/` rather than beside `cell.ts` because the test config only collects `tests/**/*.test.ts` and another stream owns that config.

```bash
python -m pytest tests/contract -q
cd web && npm test
```
