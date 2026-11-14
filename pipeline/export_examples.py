#!/usr/bin/env python3
"""Build the example data files that freeze the pipeline-to-app contract.

Every file this writes has the exact shape described in docs/data-contract.md,
so the app can be built and tested before the real conversion exists.

Numbers from February 2012 onward are the measured S-NPP values. Numbers before
that are NOT a real conversion: they are the MODIS value multiplied by a fixed
example ratio, with a plus or minus 30 per cent range. Every such record carries
the flag "example", and meta.json carries "example": true.

Run:
    python pipeline/export_examples.py --data <data dir> --out <out dir>

Output is deterministic: running it twice gives byte-identical files.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import math
from pathlib import Path

import duckdb

# ---------------------------------------------------------------------------
# Frozen constants. These mirror web/src/lib/data/cell.ts.
# ---------------------------------------------------------------------------

SCHEMA_VERSION = "1"
CELL_DEG = 0.25
GRID_ROWS = 720
GRID_COLS = 1440
TILE_DEG = 5
EARTH_RADIUS_KM = 6371.0088
MONTH_EPOCH_YEAR = 2000

FIRST_MONTH = (2000, 11)
LAST_MONTH = (2025, 12)
LAST_DATA_DAY = dt.date(2025, 12, 31)

DATA_VERSION = "example-2026-11-14"
BUILT = "2026-11-14"

SRC_LABELS = [
    "estimated_terra",
    "estimated_modis",
    "measured",
    "measured_calibrated",
    "provisional",
]
FLAG_LABELS = ["example", "partial_month", "snpp_gap_filled", "low_confidence"]

# The one ratio used for every example number before February 2012. It is the
# measured worldwide S-NPP to MODIS fire-cell-day ratio, used here only to give
# the app numbers of a believable size. It is not a conversion.
EXAMPLE_RATIO = 2.7
EXAMPLE_BAND = 0.30

# First month each satellite measured anything in this data set. A month before
# this is null, not zero.
SAT_START = {
    "terra": (2000, 11),
    "aqua": (2002, 7),
    "snpp": (2012, 1),
    "noaa20": (2018, 4),
    "noaa21": None,
}

# The month the raw series of a satellite covers only in part.
PARTIAL_MONTHS = {(2012, 1)}

DAILY_WINDOW_DAYS = 45
MIN_COMPARE_DAYS = 8

EXAMPLE_TILES = ["40_20", "40_25", "35_-120", "45_-115"]
DAILY_TILES = ["40_20", "40_25"]
GLOBE_YEARS = [2024]
EXAMPLE_COUNTRIES = {"Bulgaria": "BGR", "United_States": "USA"}


# ---------------------------------------------------------------------------
# Grid helpers
# ---------------------------------------------------------------------------


def month_index(y: int, m: int) -> int:
    return (y - MONTH_EPOCH_YEAR) * 12 + (m - 1)


def months_between(first: tuple[int, int], last: tuple[int, int]) -> list[tuple[int, int]]:
    out = []
    for i in range(month_index(*first), month_index(*last) + 1):
        y = MONTH_EPOCH_YEAR + i // 12
        out.append((y, i - (y - MONTH_EPOCH_YEAR) * 12 + 1))
    return out


def cell_center(cell_id: int) -> tuple[float, float]:
    row, col = divmod(cell_id, GRID_COLS)
    return (
        90.0 - CELL_DEG * row - CELL_DEG / 2,
        -180.0 + CELL_DEG * col + CELL_DEG / 2,
    )


def precision_radius_km(lat: float) -> float:
    height = EARTH_RADIUS_KM * CELL_DEG * (math.pi / 180)
    width = height * math.cos(math.radians(lat))
    return math.sqrt(height * height + width * width) / 2


def tile_key(lat: float, lon: float) -> str:
    lat0 = min(math.floor(lat / TILE_DEG) * TILE_DEG, 90 - TILE_DEG)
    return f"{int(lat0)}_{int(math.floor(lon / TILE_DEG) * TILE_DEG)}"


def haversine_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))


# ---------------------------------------------------------------------------
# Harmonization rules for the example numbers
# ---------------------------------------------------------------------------


def src_for(y: int, m: int) -> str:
    """Which label a month carries. Frozen in docs/data-contract.md."""
    i = month_index(y, m)
    if i < month_index(2000, 11):
        raise ValueError(f"month {y}-{m:02d} is before the record starts")
    if i <= month_index(2002, 6):
        return "estimated_terra"
    if i <= month_index(2012, 1):
        return "estimated_modis"
    return "measured"


def is_measured(y: int, m: int) -> bool:
    return src_for(y, m) == "measured"


def flags_for(y: int, m: int) -> list[str]:
    out = []
    if not is_measured(y, m):
        out.append("example")
    if (y, m) in PARTIAL_MONTHS:
        out.append("partial_month")
    return out


def flag_bits(flags: list[str]) -> int:
    bits = 0
    for f in flags:
        bits |= 1 << FLAG_LABELS.index(f)
    return bits


def frp_mw(milli_mw: int) -> int:
    """Whole MW from the integer thousandths the table carries.

    FRP is accumulated as whole thousandths of a MW so that every addition is
    an integer addition. Floating-point addition is not associative, so a
    parallel sum of doubles can land on a different last bit from one run to
    the next, and the output would stop being byte-identical.
    """
    return int(round(milli_mw / 1000))


def harmonize(
    y: int, m: int, snpp_n: int, snpp_cd: int, snpp_frp: int,
    modis_n: int, modis_cd: int, modis_frp: int,
) -> dict:
    """Harmonized hotspots, fire days, ranges and FRP for one place-month.

    "cd" is a count of fire cell-days on the 0.01 degree grid, added up over
    the place. A 0.25 degree cell holds 625 of those small cells, so a monthly
    cd has no 31-day ceiling and is never capped.
    """
    if is_measured(y, m):
        hot, cd, frp = snpp_n, snpp_cd, snpp_frp
        hot_lo = hot_hi = hot
        cd_lo = cd_hi = cd
    else:
        hot = round(EXAMPLE_RATIO * modis_n)
        cd = round(EXAMPLE_RATIO * modis_cd)
        frp = modis_frp
        hot_lo = round(hot * (1 - EXAMPLE_BAND))
        hot_hi = round(hot * (1 + EXAMPLE_BAND))
        cd_lo = round(cd * (1 - EXAMPLE_BAND))
        cd_hi = round(cd * (1 + EXAMPLE_BAND))
    return {
        "hot": int(hot), "hot_lo": int(hot_lo), "hot_hi": int(hot_hi),
        "cd": int(cd), "cd_lo": int(cd_lo), "cd_hi": int(cd_hi),
        "frp": frp_mw(frp),
    }


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------


def dump(obj: object) -> bytes:
    return json.dumps(obj, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(dump(obj) + b"\n")


def write_gzip_json(path: Path, obj: object) -> None:
    """Pre-gzipped, with no timestamp, so two runs give identical bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = dump(obj) + b"\n"
    with open(path, "wb") as fh:
        with gzip.GzipFile(filename="", mode="wb", fileobj=fh, compresslevel=9, mtime=0) as gz:
            gz.write(raw)


# ---------------------------------------------------------------------------
# Reading the cell-day table
# ---------------------------------------------------------------------------

SMALL_CELL_DAY_SQL = """
CREATE OR REPLACE TABLE small_cell_day AS
SELECT
  cy, cx, day,
  ((17999 - 2 * cy) // 50)::INT AS crow,
  ((2 * cx + 1 + 36000) // 50)::INT AS ccol,
  min(country) AS country,
  count(DISTINCT country) AS n_country,
  sum(CASE WHEN sat = 'Terra'  THEN detections ELSE 0 END)::BIGINT AS terra_n,
  sum(CASE WHEN sat = 'Aqua'   THEN detections ELSE 0 END)::BIGINT AS aqua_n,
  sum(CASE WHEN sat = 'SNPP'   THEN detections ELSE 0 END)::BIGINT AS snpp_n,
  sum(CASE WHEN sat = 'NOAA20' THEN detections ELSE 0 END)::BIGINT AS noaa20_n,
  sum(CASE WHEN sat IN ('Terra', 'Aqua') THEN detections ELSE 0 END)::BIGINT AS modis_n,
  -- One fire cell-day: this 0.01 degree cell had fire on this day, as seen by
  -- one satellite stream. These are the units "cd" counts; they are added up,
  -- never deduplicated to the 0.25 degree cell. MODIS is Terra plus Aqua, one
  -- cell-day each, because a cell-day belongs to a satellite stream.
  max(CASE WHEN sat = 'SNPP' THEN 1 ELSE 0 END)::INT AS snpp_cd,
  (max(CASE WHEN sat = 'Terra' THEN 1 ELSE 0 END)
   + max(CASE WHEN sat = 'Aqua' THEN 1 ELSE 0 END))::INT AS modis_cd,
  sum(CASE WHEN sat = 'SNPP' THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS snpp_frp,
  sum(CASE WHEN sat IN ('Terra', 'Aqua') THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS modis_frp
FROM read_parquet($parquet)
GROUP BY cy, cx, day
"""

CELL_MONTH_SQL = """
CREATE OR REPLACE TABLE cell_month AS
SELECT
  crow * 1440 + ccol AS cell_id,
  year(day)::INT  AS y,
  month(day)::INT AS m,
  min(country) AS country,
  sum(terra_n)::BIGINT  AS terra_n,
  sum(aqua_n)::BIGINT   AS aqua_n,
  sum(snpp_n)::BIGINT   AS snpp_n,
  sum(noaa20_n)::BIGINT AS noaa20_n,
  sum(modis_n)::BIGINT  AS modis_n,
  sum(snpp_cd)::BIGINT  AS snpp_cd,
  sum(modis_cd)::BIGINT AS modis_cd,
  sum(snpp_frp)::BIGINT  AS snpp_frp,
  sum(modis_frp)::BIGINT AS modis_frp
FROM small_cell_day
GROUP BY cell_id, y, m
ORDER BY cell_id, y, m
"""

DAILY_SQL = """
SELECT
  crow * 1440 + ccol AS cell_id,
  day,
  sum(snpp_n)::BIGINT    AS snpp_n,
  sum(modis_n)::BIGINT   AS modis_n,
  sum(snpp_frp)::BIGINT  AS snpp_frp,
  sum(modis_frp)::BIGINT AS modis_frp
FROM small_cell_day
WHERE (month(day) = 11 AND day(day) >= $start_day) OR month(day) = 12
GROUP BY cell_id, day
ORDER BY cell_id, day
"""


def load(parquet: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute(SMALL_CELL_DAY_SQL, {"parquet": str(parquet)})
    mixed = con.execute("SELECT count(*) FROM small_cell_day WHERE n_country > 1").fetchone()[0]
    if mixed:
        raise SystemExit(f"{mixed} cell-days span two countries; the country rule needs a decision")
    con.execute(CELL_MONTH_SQL)
    return con


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------


def build_country_files(con: duckdb.DuckDBPyConnection, out: Path) -> None:
    rows = con.execute(
        """
        SELECT country, y, m,
               sum(terra_n), sum(aqua_n), sum(snpp_n), sum(noaa20_n), sum(modis_n),
               sum(snpp_cd), sum(modis_cd), sum(snpp_frp), sum(modis_frp)
        FROM cell_month GROUP BY country, y, m ORDER BY country, y, m
        """
    ).fetchall()
    by_country: dict[str, dict[tuple[int, int], tuple]] = {}
    for r in rows:
        by_country.setdefault(r[0], {})[(r[1], r[2])] = r[3:]

    # The country point: the mean of its fire cells, and a radius that reaches
    # the furthest of them. It is a summary point, not a border centroid.
    cells = con.execute(
        "SELECT country, cell_id FROM cell_month GROUP BY country, cell_id ORDER BY country, cell_id"
    ).fetchall()
    centres: dict[str, list[tuple[float, float]]] = {}
    for country, cell_id in cells:
        centres.setdefault(country, []).append(cell_center(cell_id))

    for country, iso3 in sorted(EXAMPLE_COUNTRIES.items(), key=lambda kv: kv[1]):
        pts = centres[country]
        clat = sum(p[0] for p in pts) / len(pts)
        clon = sum(p[1] for p in pts) / len(pts)
        radius = max(haversine_km(clat, clon, p[0], p[1]) for p in pts)

        months = []
        for (y, m) in months_between(FIRST_MONTH, LAST_MONTH):
            v = by_country[country].get((y, m))
            terra_n, aqua_n, snpp_n, noaa20_n, modis_n, snpp_cd, modis_cd, snpp_frp, modis_frp = (
                v if v else (0, 0, 0, 0, 0, 0, 0, 0.0, 0.0)
            )
            rec = {"y": y, "m": m}
            rec.update(
                harmonize(y, m, int(snpp_n), int(snpp_cd), int(snpp_frp),
                          int(modis_n), int(modis_cd), int(modis_frp))
            )
            raw = {"terra": int(terra_n), "aqua": int(aqua_n), "snpp": int(snpp_n),
                   "noaa20": int(noaa20_n), "noaa21": 0}
            for key, start in SAT_START.items():
                if start is None or month_index(y, m) < month_index(*start):
                    raw[key] = None
            rec.update(raw)
            rec["src"] = src_for(y, m)
            rec["flags"] = flags_for(y, m)
            months.append(rec)

        write_json(
            out / "countries" / f"{iso3}.json",
            {
                "schema": f"emerge-country-{SCHEMA_VERSION}",
                "example": True,
                "built": BUILT,
                "iso3": iso3,
                "name_key": f"country.{iso3}",
                "type": "country",
                "lat": round(clat, 4),
                "lon": round(clon, 4),
                "precision_radius_km": round(radius, 3),
                "first_month": "%04d-%02d" % FIRST_MONTH,
                "last_month": "%04d-%02d" % LAST_MONTH,
                "months": months,
            },
        )


# Only figures verified at the publishing authority go in. Everything else is
# null: an example file must never invent a reported number.
REPORTED = {
    "BGR": {
        "source": {
            "name": "EFFIS (European Forest Fire Information System)",
            "url": None,
            "fetched": None,
            "covers": [2006, 2026],
            "note": "National totals. EFFIS maps mainly fires of about 30 ha or more.",
        },
        "known": {2024: {"fires": 133, "burned_ha": 44745}},
    },
    "USA": {
        "source": {
            "name": "NIFC (National Interagency Fire Center)",
            "url": None,
            "fetched": None,
            "covers": [1983, 2025],
            "note": "National totals. Acres in the source are converted to hectares.",
        },
        "known": {2024: {"fires": 64897, "burned_ha": None}},
    },
}


def build_reported_files(out: Path) -> None:
    for iso3 in sorted(REPORTED):
        spec = REPORTED[iso3]
        lo, hi = spec["source"]["covers"]
        years = []
        for y in range(lo, hi + 1):
            known = spec["known"].get(y, {})
            years.append({
                "y": y,
                "fires": known.get("fires"),
                "burned_ha": known.get("burned_ha"),
            })
        write_json(
            out / "reported" / f"{iso3}.json",
            {
                "schema": f"emerge-reported-{SCHEMA_VERSION}",
                "example": True,
                "built": BUILT,
                "iso3": iso3,
                "scope": "national",
                "source": spec["source"],
                "units": {"fires": "count", "burned_ha": "hectares"},
                "years": years,
            },
        )


def cell_month_rows(con: duckdb.DuckDBPyConnection) -> list[tuple]:
    return con.execute(
        """
        SELECT cell_id, y, m, terra_n, aqua_n, snpp_n, noaa20_n, modis_n,
               snpp_cd, modis_cd, snpp_frp, modis_frp
        FROM cell_month ORDER BY cell_id, y, m
        """
    ).fetchall()


def build_tiles(rows: list[tuple], out: Path) -> dict[int, dict]:
    """Write the tile files. Returns the yearly totals the globe file needs."""
    wanted = set(EXAMPLE_TILES)
    per_tile: dict[str, dict[int, list[dict]]] = {k: {} for k in EXAMPLE_TILES}
    yearly: dict[int, dict[int, dict]] = {y: {} for y in GLOBE_YEARS}

    for (cell_id, y, m, terra_n, aqua_n, snpp_n, noaa20_n, modis_n,
         snpp_cd, modis_cd, snpp_frp, modis_frp) in rows:
        lat, lon = cell_center(cell_id)
        key = tile_key(lat, lon)
        if key not in wanted:
            continue
        h = harmonize(y, m, int(snpp_n), int(snpp_cd), int(snpp_frp),
                      int(modis_n), int(modis_cd), int(modis_frp))
        h["mi"] = month_index(y, m)
        h["src"] = SRC_LABELS.index(src_for(y, m))
        h["flags"] = flag_bits(flags_for(y, m))
        per_tile[key].setdefault(cell_id, []).append(h)

        if y in yearly:
            acc = yearly[y].setdefault(
                cell_id,
                {"hot": 0, "hot_lo": 0, "hot_hi": 0, "cd": 0, "cd_lo": 0,
                 "cd_hi": 0, "frp": 0, "src": len(SRC_LABELS) - 1, "flags": 0},
            )
            for field in ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi", "frp"):
                acc[field] += h[field]
            acc["src"] = min(acc["src"], h["src"])
            acc["flags"] |= h["flags"]

    for key in EXAMPLE_TILES:
        cells = []
        for cell_id in sorted(per_tile[key]):
            series = sorted(per_tile[key][cell_id], key=lambda r: r["mi"])
            lat, lon = cell_center(cell_id)
            cell = {
                "type": "cell",
                "id": cell_id,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "precision_radius_km": round(precision_radius_km(lat), 3),
                "mi": [r["mi"] for r in series],
            }
            for field in ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi",
                          "frp", "src", "flags"):
                cell[field] = [r[field] for r in series]
            cells.append(cell)
        all_mi = [mi for c in cells for mi in c["mi"]]
        lat0, lon0 = (int(p) for p in key.split("_"))
        write_gzip_json(
            out / "tiles" / f"{key}.json.gz",
            {
                "schema": f"emerge-tile-{SCHEMA_VERSION}",
                "example": True,
                "built": BUILT,
                "tile": {"lat0": lat0, "lon0": lon0, "deg": TILE_DEG},
                "type": "cell",
                "cell_deg": CELL_DEG,
                "src_labels": SRC_LABELS,
                "flag_labels": FLAG_LABELS,
                "months": {"first": min(all_mi), "last": max(all_mi)},
                "cells": cells,
            },
        )
    return yearly


def build_globe(yearly: dict[int, dict], out: Path) -> None:
    for year in GLOBE_YEARS:
        ids = sorted(yearly[year])
        cols: dict[str, list] = {k: [] for k in (
            "id", "lat", "lon", "precision_radius_km", "hot", "hot_lo", "hot_hi",
            "cd", "cd_lo", "cd_hi", "frp", "src", "flags")}
        for cell_id in ids:
            acc = yearly[year][cell_id]
            lat, lon = cell_center(cell_id)
            cols["id"].append(cell_id)
            cols["lat"].append(round(lat, 4))
            cols["lon"].append(round(lon, 4))
            cols["precision_radius_km"].append(round(precision_radius_km(lat), 3))
            for field in ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi"):
                cols[field].append(acc[field])
            cols["frp"].append(acc["frp"])
            cols["src"].append(acc["src"])
            cols["flags"].append(acc["flags"])
        write_json(
            out / "globe" / f"{year}.json",
            {
                "schema": f"emerge-globe-{SCHEMA_VERSION}",
                "example": True,
                "built": BUILT,
                "year": year,
                "type": "cell",
                "cell_deg": CELL_DEG,
                "src_labels": SRC_LABELS,
                "flag_labels": FLAG_LABELS,
                "n": len(ids),
                "cols": cols,
            },
        )


def daily_window() -> tuple[dt.date, dt.date, list[int]]:
    start = LAST_DATA_DAY - dt.timedelta(days=DAILY_WINDOW_DAYS - 1)
    years = list(range(FIRST_MONTH[0], LAST_MONTH[0] + 1))
    return start, LAST_DATA_DAY, years


def build_daily(con: duckdb.DuckDBPyConnection, out: Path) -> None:
    start, end, years = daily_window()
    if (start.month, end.month) != (11, 12):
        raise SystemExit("the daily window query assumes a window inside November and December")
    rows = con.execute(DAILY_SQL, {"start_day": start.day}).fetchall()

    wanted = set(DAILY_TILES)
    per_tile: dict[str, dict[int, dict[int, list[tuple[int, int, int]]]]] = {
        k: {} for k in DAILY_TILES
    }
    for cell_id, day, snpp_n, modis_n, snpp_frp, modis_frp in rows:
        lat, lon = cell_center(cell_id)
        key = tile_key(lat, lon)
        if key not in wanted:
            continue
        measured = is_measured(day.year, day.month)
        hot = int(snpp_n) if measured else round(EXAMPLE_RATIO * int(modis_n))
        frp = int(snpp_frp) if measured else int(modis_frp)
        if hot <= 0:
            continue
        offset = (day - dt.date(day.year, start.month, start.day)).days
        if offset < 0 or offset >= DAILY_WINDOW_DAYS:
            continue
        per_tile[key].setdefault(cell_id, {}).setdefault(day.year, []).append(
            (offset, int(hot), frp_mw(frp))
        )

    for key in DAILY_TILES:
        cells = []
        for cell_id in sorted(per_tile[key]):
            lat, lon = cell_center(cell_id)
            year_blocks = []
            for y in sorted(per_tile[key][cell_id]):
                days = sorted(per_tile[key][cell_id][y])
                year_blocks.append({
                    "y": y,
                    "src": SRC_LABELS.index(src_for(y, 12)),
                    "flags": flag_bits(flags_for(y, 12)),
                    "d": [d[0] for d in days],
                    "hot": [d[1] for d in days],
                    "frp": [d[2] for d in days],
                })
            cells.append({
                "type": "cell",
                "id": cell_id,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "precision_radius_km": round(precision_radius_km(lat), 3),
                "years": year_blocks,
            })
        lat0, lon0 = (int(p) for p in key.split("_"))
        write_gzip_json(
            out / "daily" / f"{key}.json.gz",
            {
                "schema": f"emerge-daily-{SCHEMA_VERSION}",
                "example": True,
                "built": BUILT,
                "tile": {"lat0": lat0, "lon0": lon0, "deg": TILE_DEG},
                "type": "cell",
                "cell_deg": CELL_DEG,
                "window": {
                    "days": DAILY_WINDOW_DAYS,
                    "latest_day": end.isoformat(),
                    "start_md": f"{start.month:02d}-{start.day:02d}",
                    "end_md": f"{end.month:02d}-{end.day:02d}",
                    "wraps_year": False,
                },
                "years": years,
                "src_labels": SRC_LABELS,
                "flag_labels": FLAG_LABELS,
                "cells": cells,
            },
        )


LIMITS = [
    {"id": "cell-size",
     "text": "Harmonized numbers exist per 0.25 degree cell, about 28 km across. A smaller "
             "area still reports the whole cell, so it is labelled low confidence."},
    {"id": "before-2012",
     "text": "Nothing like VIIRS flew before 20 January 2012. Values before February 2012 are "
             "converted from MODIS and carry a range, not a single certain number."},
    {"id": "short-windows",
     "text": "Counts over fewer than eight days are strongly biased by the satellite's orbit, "
             "so the app never compares a run shorter than that."},
    {"id": "country-edges",
     "text": "Country files use the data provider's own country for each detection, so cells on "
             "a border can differ slightly from a drawn outline."},
    {"id": "industrial",
     "text": "Static industrial heat sources are filtered out, so gas flares and similar sites "
             "are not counted as fires."},
    {"id": "frp-not-harmonized",
     "text": "Fire radiative power is the reference sensor's own total, not converted between "
             "sensors, so it steps at the sensor change."},
    {"id": "not-a-warning",
     "text": "This is a research prototype built from past detections. It is not an official "
             "warning service."},
]


def build_validation(out: Path) -> None:
    holdout = []
    for direction in ("forward", "reverse"):
        for unit in ("hot", "cd"):
            for scope in ("country_month", "cell_month", "circle_month"):
                holdout.append({
                    "direction": direction, "unit": unit, "scope": scope,
                    "train_years": None, "test_years": None, "n": None,
                    "nrmse": None, "mae": None, "bias_pct": None, "r": None, "slope": None,
                })
    slices = []
    for key in ("BGR", "USA"):
        slices.append({"slice": "country", "key": key, "unit": "cd",
                       "n": None, "nrmse": None, "bias_pct": None})
    for m in range(1, 13):
        slices.append({"slice": "month", "key": f"{m:02d}", "unit": "cd",
                       "n": None, "nrmse": None, "bias_pct": None})
    for band in ("0-30", "30-45", "45-60", "60-90"):
        slices.append({"slice": "latitude_band", "key": band, "unit": "cd",
                       "n": None, "nrmse": None, "bias_pct": None})

    write_json(
        out / "validation.json",
        {
            "schema": f"emerge-validation-{SCHEMA_VERSION}",
            "example": True,
            "built": BUILT,
            "method": {
                "grid_deg": CELL_DEG,
                "time_step": "month",
                "model": None,
                "reference": "measured S-NPP",
                "train_years": None,
                "test_years": None,
                "pre_registered": None,
                "leakage_check": None,
            },
            "holdout": holdout,
            "slices": slices,
            "satellite_agreement": [
                {"pair": "S-NPP vs NOAA-20", "unit": "cd", "years": None, "n": None, "diff_pct": None},
                {"pair": "S-NPP vs NOAA-20", "unit": "hot", "years": None, "n": None, "diff_pct": None},
                {"pair": "Terra vs Aqua", "unit": "cd", "years": None, "n": None, "diff_pct": None},
            ],
            "published_ratios": [
                {"scope": "world", "unit": "cd", "ours": None, "published": None,
                 "published_source": None, "note": None},
                {"scope": "BGR", "unit": "cd", "ours": None, "published": None,
                 "published_source": None, "note": None},
                {"scope": "BGR", "unit": "hot", "ours": None, "published": None,
                 "published_source": None, "note": None},
            ],
            "range_coverage": [
                {"level_pct": 90, "unit": unit, "scope": scope, "n": None, "observed_pct": None}
                for unit in ("hot", "cd")
                for scope in ("country_month", "cell_month", "circle_month")
            ],
            "chance_of_fire": {
                "brier": None,
                "reliability": [
                    {"bin": [round(i / 10, 1), round((i + 1) / 10, 1)],
                     "predicted": None, "observed": None, "n": None}
                    for i in range(10)
                ],
            },
            "control_totals": [
                {"check": "daily totals equal monthly totals", "passed": None, "detail": None},
                {"check": "monthly totals equal the kept raw detections", "passed": None, "detail": None},
                {"check": "exported totals equal the pipeline totals", "passed": None, "detail": None},
                {"check": "three hand-computed cell-months match", "passed": None, "detail": None},
            ],
            "limits": LIMITS,
        },
    )


SOURCES = [
    {"id": "modis-terra", "name": "MODIS hotspots, Terra",
     "used_for": "the record from November 2000, and the MODIS side of the conversion",
     "url": None, "licence": "open government data", "fetched": None},
    {"id": "modis-aqua", "name": "MODIS hotspots, Aqua",
     "used_for": "the record from July 2002, and the MODIS side of the conversion",
     "url": None, "licence": "open government data", "fetched": None},
    {"id": "viirs-snpp", "name": "VIIRS 375 m hotspots, S-NPP",
     "used_for": "the measured record from January 2012, and the conversion reference",
     "url": None, "licence": "open government data", "fetched": None},
    {"id": "viirs-noaa20", "name": "VIIRS 375 m hotspots, NOAA-20",
     "used_for": "filling S-NPP gap days and checking S-NPP against a second sensor",
     "url": None, "licence": "open government data", "fetched": None},
    {"id": "viirs-noaa21", "name": "VIIRS 375 m hotspots, NOAA-21",
     "used_for": "recent months; not present in this example set",
     "url": None, "licence": "open government data", "fetched": None},
    {"id": "reported-effis", "name": "EFFIS (European Forest Fire Information System)",
     "used_for": "officially reported fires and burned area for EU countries",
     "url": None, "licence": None, "fetched": None},
    {"id": "reported-nifc", "name": "NIFC (National Interagency Fire Center)",
     "used_for": "officially reported fires and burned area for the USA",
     "url": None, "licence": "US government", "fetched": None},
]


def build_meta(out: Path) -> None:
    start, end, years = daily_window()
    write_json(
        out / "meta.json",
        {
            "schema": f"emerge-meta-{SCHEMA_VERSION}",
            "example": True,
            "data_version": DATA_VERSION,
            "built": BUILT,
            "last_data_day": LAST_DATA_DAY.isoformat(),
            "first_month": "%04d-%02d" % FIRST_MONTH,
            "last_month": "%04d-%02d" % LAST_MONTH,
            "grid": {
                "cell_deg": CELL_DEG,
                "rows": GRID_ROWS,
                "cols": GRID_COLS,
                "tile_deg": TILE_DEG,
                "month_epoch": "2000-01",
            },
            "units": {
                "hot": "hotspots",
                "cd": "fire_cell_days",
                "frp": "MW",
                "precision_radius_km": "km",
            },
            "src_labels": {
                "estimated_terra": "Estimated from Terra alone",
                "estimated_modis": "Estimated from Terra and Aqua",
                "measured": "Measured by VIIRS",
                "measured_calibrated": "Measured by a second VIIRS sensor, calibrated to S-NPP",
                "provisional": "Provisional, from near-real-time data",
            },
            "flag_labels": {
                "example": "Stand-in number, not a real conversion",
                "partial_month": "A satellite covers only part of this month",
                "snpp_gap_filled": "S-NPP gap days filled from NOAA-20",
                "low_confidence": "Below the grid's reliable size",
            },
            "src_periods": [
                {"from": "2000-11", "to": "2002-06", "src": "estimated_terra"},
                {"from": "2002-07", "to": "2012-01", "src": "estimated_modis"},
                {"from": "2012-02", "to": None, "src": "measured"},
            ],
            "no_data": [
                {"scope": "global", "sat": None, "from": None, "to": "2000-10-31", "days": None,
                 "reason": "No satellite measured hotspots this way before Terra started."},
                {"scope": "global", "sat": None, "from": "2026-01-01", "to": None, "days": None,
                 "reason": "This data set stops on 31 December 2025."},
                {"scope": "satellite", "sat": "aqua", "from": None, "to": "2002-07-03", "days": None,
                 "reason": "Aqua started on 4 July 2002."},
                {"scope": "satellite", "sat": "snpp", "from": None, "to": "2012-01-19", "days": None,
                 "reason": "S-NPP started on 20 January 2012."},
                {"scope": "satellite", "sat": "snpp", "from": "2022-01-01", "to": "2024-12-31",
                 "days": 34,
                 "reason": "S-NPP is missing 34 days across 2022 and 2024. They are not filled in "
                           "this example set."},
                {"scope": "satellite", "sat": "noaa20", "from": None, "to": "2018-03-31", "days": None,
                 "reason": "NOAA-20 started on 1 April 2018."},
                {"scope": "satellite", "sat": "noaa21", "from": None, "to": None, "days": None,
                 "reason": "NOAA-21 is not in this data set at all."},
            ],
            "daily_window": {
                "days": DAILY_WINDOW_DAYS,
                "latest_day": end.isoformat(),
                "start_md": f"{start.month:02d}-{start.day:02d}",
                "end_md": f"{end.month:02d}-{end.day:02d}",
                "wraps_year": False,
                "years": years,
                "min_compare_days": MIN_COMPARE_DAYS,
            },
            "countries": sorted(EXAMPLE_COUNTRIES.values()),
            "reported": sorted(REPORTED),
            "tiles": sorted(EXAMPLE_TILES),
            "daily": sorted(DAILY_TILES),
            "globe_years": GLOBE_YEARS,
            "sources": SOURCES,
        },
    )


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", default=str(here / "data"),
                    help="folder holding derived/bg_us/cell_days.parquet")
    ap.add_argument("--out", default=str(here / "web" / "public" / "data"),
                    help="folder to write the example files into")
    args = ap.parse_args()

    parquet = Path(args.data) / "derived" / "bg_us" / "cell_days.parquet"
    if not parquet.is_file():
        raise SystemExit(f"cell-day table not found at {parquet}")
    out = Path(args.out)

    con = load(parquet)
    rows = cell_month_rows(con)
    build_meta(out)
    build_country_files(con, out)
    build_reported_files(out)
    yearly = build_tiles(rows, out)
    build_globe(yearly, out)
    build_daily(con, out)
    build_validation(out)

    total = 0
    for path in sorted(out.rglob("*")):
        if path.is_file():
            size = path.stat().st_size
            total += size
            print(f"{size:>9}  {path.relative_to(out)}")
    print(f"{total:>9}  total ({total / 1_048_576:.2f} MiB)")


if __name__ == "__main__":
    main()
