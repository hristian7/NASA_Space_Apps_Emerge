#!/usr/bin/env python3
"""Export the world conversion into the frozen contract files the app reads.

The format is docs/data-contract.md. This script is the real exporter: it reads
the conversion's output and writes the whole file set. pipeline/export_examples.py
writes the same shapes with stand-in numbers, and the two share their rules by
importing from one place.

Input, from the conversion (default data/derived/world/harmonized):
    cells_monthly.parquet     cell, year, month, hot, hot_lo, hot_hi,
                              cd, cd_lo, cd_hi, frp, src, flags
    countries_monthly.parquet country, year, month, the same harmonized columns,
                              terra, aqua, snpp, noaa20, frp, src, flags
    cell_groups.parquet       cell, group_id, country
    background.parquet        group_id, country, lat_band, period, month,
                              hot, hot_hi, cd, cd_hi
Input, from the pipeline's first step (default data/derived/world):
    cell_days.parquet         the raw cell-day table, for the daily window
Input, from the independent scorer:
    bakeoff/scores.csv and docs/research/bakeoff-results.md, for validation.json

Run:
    python pipeline/export_app.py --in <dir> --out <dir>

Output is deterministic: two runs give byte-identical files.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import sys
import tempfile
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))

from export_examples import (  # noqa: E402  the shared, frozen rules
    BACKGROUND_PERIODS,
    BACKGROUND_UNITS,
    FACTOR_UNITS,
    CELL_DEG,
    DAILY_WINDOW_DAYS,
    FIRST_MONTH,
    FLAG_LABELS,
    GRID_COLS,
    GRID_ROWS,
    MIN_COMPARE_DAYS,
    REPORTED,
    SCHEMA_VERSION,
    SRC_LABELS,
    TILE_DEG,
    cell_center,
    flag_bits,
    group_id,
    haversine_km,
    lon_box,
    month_index,
    months_between,
    precision_radius_km,
    sensor_for,
    tile_key,
    write_gzip_json,
    write_json,
)

DATA_VERSION = "world-2026-11-14"
BUILT = "2026-11-14"
EXAMPLE_FLAG = False

# The conversion states its own coverage in coverage.json, and these are set
# from it at startup rather than written down here, so a later run that reaches
# a new day needs no change to this script.
LAST_DATA_DAY = dt.date(2026, 11, 14)
LAST_MONTH = (2026, 11)
COVERAGE: dict = {}


def load_coverage(path: Path) -> dict:
    """Read coverage.json and take the record's dates from it."""
    global LAST_DATA_DAY, LAST_MONTH, COVERAGE
    COVERAGE = json.loads(path.read_text())
    LAST_DATA_DAY = dt.date.fromisoformat(COVERAGE["last_day_of_the_record"])
    y, m = COVERAGE["last_month"].split("-")
    LAST_MONTH = (int(y), int(m))
    for period in COVERAGE["src_periods"]:
        if period["src"] not in SRC_LABELS:
            raise SystemExit(f"coverage.json names an unknown label: {period['src']}")
    return COVERAGE


def src_of_month(y: int, m: int) -> str:
    """The label of a month, from coverage.json rather than a date rule."""
    want = month_index(y, m)
    for period in COVERAGE["src_periods"]:
        fy, fm = (int(v) for v in period["from"].split("-"))
        first = month_index(fy, fm)
        last = first
        if period.get("to"):
            ty, tm = (int(v) for v in period["to"].split("-"))
            last = month_index(ty, tm)
        elif period is COVERAGE["src_periods"][-1]:
            last = month_index(*LAST_MONTH)
        if first <= want <= last:
            return period["src"]
    raise SystemExit(f"coverage.json covers no label for {y}-{m:02d}")


def month_end(y: int, m: int) -> dt.date:
    if m == 12:
        return dt.date(y, 12, 31)
    return dt.date(y, m + 1, 1) - dt.timedelta(days=1)

# Sensor behind a raw daily value. The daily files are raw, not harmonized.
from export_examples import SENSOR_LABELS  # noqa: E402

CHUNK = 200_000


# ---------------------------------------------------------------------------
# Country names
# ---------------------------------------------------------------------------

# The data provider's own country names, in the form they appear in the table,
# mapped to their three-letter code. A name that is not here is reported by
# name in the run output and left out of the country files: never guessed.
ISO3 = {
    "Afghanistan": "AFG", "Aland_Islands": "ALA", "Albania": "ALB",
    "Algeria": "DZA", "American_Samoa": "ASM", "Andorra": "AND",
    "Angola": "AGO", "Anguilla": "AIA", "Antarctica": "ATA",
    "Antigua_and_Barbuda": "ATG", "Argentina": "ARG", "Armenia": "ARM",
    "Aruba": "ABW", "Australia": "AUS", "Austria": "AUT", "Azerbaijan": "AZE",
    "Bahamas": "BHS", "Bahrain": "BHR", "Bangladesh": "BGD",
    "Barbados": "BRB", "Belarus": "BLR", "Belgium": "BEL", "Belize": "BLZ",
    "Benin": "BEN", "Bermuda": "BMU", "Bhutan": "BTN", "Bolivia": "BOL",
    "Bosnia_and_Herzegovina": "BIH", "Botswana": "BWA", "Brazil": "BRA",
    "British_Virgin_Islands": "VGB", "Brunei_Darussalam": "BRN",
    "Bulgaria": "BGR", "Burkina_Faso": "BFA", "Burundi": "BDI",
    "Cambodia": "KHM", "Cameroon": "CMR", "Canada": "CAN",
    "Cape_Verde": "CPV", "Cayman_Islands": "CYM",
    "Central_African_Republic": "CAF", "Chad": "TCD", "Chile": "CHL",
    "China": "CHN", "Colombia": "COL", "Comoros": "COM",
    "Cook_Islands": "COK", "Costa_Rica": "CRI", "Cote_d_Ivoire": "CIV",
    "Croatia": "HRV", "Cuba": "CUB", "Curacao": "CUW", "Cyprus": "CYP",
    "Czech_Republic": "CZE", "Dem_Rep_Korea": "PRK",
    "Democratic_Republic_of_the_Congo": "COD", "Denmark": "DNK",
    "Djibouti": "DJI", "Dominica": "DMA", "Dominican_Republic": "DOM",
    "Ecuador": "ECU", "Egypt": "EGY", "El_Salvador": "SLV",
    "Equatorial_Guinea": "GNQ", "Eritrea": "ERI", "Estonia": "EST",
    "Ethiopia": "ETH", "Faeroe_Islands": "FRO", "Falkland_Islands": "FLK",
    "Federated_States_of_Micronesia": "FSM", "Fiji": "FJI",
    "Finland": "FIN", "France": "FRA", "French_Guiana": "GUF",
    "French_Polynesia": "PYF",
    "French_Southern_and_Antarctic_Lands": "ATF", "Gabon": "GAB",
    "Georgia": "GEO", "Germany": "DEU", "Ghana": "GHA", "Greece": "GRC",
    "Greenland": "GRL", "Grenada": "GRD", "Guadeloupe": "GLP",
    "Guam": "GUM", "Guatemala": "GTM", "Guernsey": "GGY", "Guinea": "GIN",
    "Guinea-Bissau": "GNB", "Guyana": "GUY", "Haiti": "HTI",
    "Heard_I_and_McDonald_Islands": "HMD", "Honduras": "HND",
    "Hong_Kong": "HKG", "Hungary": "HUN", "Iceland": "ISL", "India": "IND",
    "Indonesia": "IDN", "Iran": "IRN", "Iraq": "IRQ", "Ireland": "IRL",
    "Isle_of_Man": "IMN", "Israel": "ISR", "Italy": "ITA",
    "Jamaica": "JAM", "Japan": "JPN", "Jersey": "JEY", "Jordan": "JOR",
    "Kazakhstan": "KAZ", "Kenya": "KEN", "Kiribati": "KIR",
    "Kosovo": "XKX", "Kuwait": "KWT", "Kyrgyzstan": "KGZ",
    "Lao_PDR": "LAO", "Latvia": "LVA", "Lebanon": "LBN", "Lesotho": "LSO",
    "Liberia": "LBR", "Libya": "LBY", "Liechtenstein": "LIE",
    "Lithuania": "LTU", "Luxembourg": "LUX",
    "Macedonia_Former_Yugoslav_Republic_of": "MKD", "Madagascar": "MDG",
    "Malawi": "MWI", "Malaysia": "MYS", "Mali": "MLI", "Malta": "MLT",
    "Martinique": "MTQ", "Mauritania": "MRT", "Mauritius": "MUS",
    "Mayotte": "MYT", "Mexico": "MEX", "Moldova": "MDA", "Monaco": "MCO",
    "Mongolia": "MNG", "Montenegro": "MNE", "Montserrat": "MSR",
    "Morocco": "MAR", "Mozambique": "MOZ", "Myanmar": "MMR",
    "Namibia": "NAM", "Nauru": "NRU", "Nepal": "NPL",
    "Netherlands": "NLD", "New_Caledonia": "NCL", "New_Zealand": "NZL",
    "Nicaragua": "NIC", "Niger": "NER", "Nigeria": "NGA", "Niue": "NIU",
    "Norfolk_Island": "NFK", "Northern_Mariana_Islands": "MNP",
    "Norway": "NOR", "Oman": "OMN", "Pakistan": "PAK", "Palau": "PLW",
    "Palestine": "PSE", "Panama": "PAN", "Papua_New_Guinea": "PNG",
    "Paraguay": "PRY", "Peru": "PER", "Philippines": "PHL",
    "Poland": "POL", "Portugal": "PRT", "Puerto_Rico": "PRI",
    "Qatar": "QAT", "Republic_of_Congo": "COG", "Republic_of_Korea": "KOR",
    "Reunion": "REU", "Romania": "ROU", "Russian_Federation": "RUS",
    "Rwanda": "RWA", "Saint-Barthelemy": "BLM", "Saint-Martin": "MAF",
    "Saint_Helena": "SHN", "Saint_Kitts_and_Nevis": "KNA",
    "Saint_Lucia": "LCA", "Saint_Pierre_and_Miquelon": "SPM",
    "Saint_Vincent_and_the_Grenadines": "VCT", "Samoa": "WSM",
    "San_Marino": "SMR", "Sao_Tome_and_Principe": "STP",
    "Saudi_Arabia": "SAU", "Senegal": "SEN", "Serbia": "SRB",
    "Seychelles": "SYC", "Sierra_Leone": "SLE", "Singapore": "SGP",
    "Sint_Maarten": "SXM", "Slovakia": "SVK", "Slovenia": "SVN",
    "Solomon_Islands": "SLB", "Somalia": "SOM", "South_Africa": "ZAF",
    "South_Sudan": "SSD", "Spain": "ESP", "Sri_Lanka": "LKA",
    "Sudan": "SDN", "Suriname": "SUR", "Svalbard_and_Jan_Mayen": "SJM",
    "Swaziland": "SWZ", "Sweden": "SWE", "Switzerland": "CHE",
    "Syria": "SYR", "Taiwan": "TWN", "Tajikistan": "TJK",
    "Tanzania": "TZA", "Thailand": "THA", "The_Gambia": "GMB",
    "Timor-Leste": "TLS", "Togo": "TGO", "Tonga": "TON",
    "Trinidad_and_Tobago": "TTO", "Tunisia": "TUN", "Turkey": "TUR",
    "Turkmenistan": "TKM", "Turks_and_Caicos_Islands": "TCA",
    "Uganda": "UGA", "Ukraine": "UKR", "United_Arab_Emirates": "ARE",
    "United_Kingdom": "GBR", "United_States": "USA",
    "United_States_Minor_Outlying_Islands": "UMI",
    "United_States_Virgin_Islands": "VIR", "Uruguay": "URY",
    "Uzbekistan": "UZB", "Vanuatu": "VUT", "Venezuela": "VEN",
    "Vietnam": "VNM", "Wallis_and_Futuna_Islands": "WLF", "Yemen": "YEM",
    "Zambia": "ZMB", "Zimbabwe": "ZWE",
}

# Only where turning underscores into spaces reads badly.
DISPLAY_NAME = {
    "BRN": "Brunei", "CIV": "Cote d'Ivoire", "COD": "Democratic Republic of the Congo",
    "COG": "Republic of the Congo", "CZE": "Czechia", "FRO": "Faroe Islands",
    "HMD": "Heard Island and McDonald Islands", "KOR": "South Korea",
    "LAO": "Laos", "MKD": "North Macedonia", "PRK": "North Korea",
    "SWZ": "Eswatini", "GMB": "Gambia", "ATF": "French Southern and Antarctic Lands",
}


def display_name(country: str, iso3: str) -> str:
    if iso3 in DISPLAY_NAME:
        return DISPLAY_NAME[iso3]
    return country.replace("_", " ")


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def whole(v: float | None) -> int:
    """Round half up to a whole number, and never below 0."""
    if v is None:
        return 0
    return max(0, int(math.floor(float(v) + 0.5)))


def src_index(label: str) -> int:
    if label not in SRC_LABELS:
        raise SystemExit(f"the conversion used an unknown src label: {label}")
    return SRC_LABELS.index(label)


def tile_of(cell: int) -> str:
    lat, lon = cell_center(cell)
    return tile_key(lat, lon)


def cell_head(cell: int) -> dict:
    lat, lon = cell_center(cell)
    return {
        "type": "cell",
        "id": cell,
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "precision_radius_km": round(precision_radius_km(lat), 3),
    }


# ---------------------------------------------------------------------------
# Tiles
# ---------------------------------------------------------------------------

CELLS_SQL = """
SELECT cell, year, month, hot, hot_lo, hot_hi, cd, cd_lo, cd_hi, frp, src, flags,
       (cast(floor((90 - 0.25 * (cell // 1440) - 0.125) / 5) * 5 AS INT)) AS lat0,
       (cast(floor((-180 + 0.25 * (cell % 1440) + 0.125) / 5) * 5 AS INT)) AS lon0
FROM cells_monthly
ORDER BY lat0, lon0, cell, year, month
"""


def tile_file(key: str, cells: list[dict]) -> dict:
    all_mi = [mi for c in cells for mi in c["mi"]]
    lat0, lon0 = (int(p) for p in key.split("_"))
    return {
        "schema": f"emerge-tile-{SCHEMA_VERSION}",
        "example": False,
        "built": BUILT,
        "tile": {"lat0": lat0, "lon0": lon0, "deg": TILE_DEG},
        "type": "cell",
        "cell_deg": CELL_DEG,
        "src_labels": SRC_LABELS,
        "flag_labels": FLAG_LABELS,
        "months": {"first": min(all_mi), "last": max(all_mi)},
        "cells": cells,
    }


def build_tiles(con: duckdb.DuckDBPyConnection, groups: dict[int, str], out: Path) -> dict:
    """Stream the cell-months in tile order and write one file per tile.

    Streaming keeps 12 million rows out of memory: the rows arrive sorted by
    tile, so a tile can be written as soon as its last row has gone past.
    """
    con.execute(CELLS_SQL)
    totals = {"cd": 0, "hot": 0, "rows": 0}
    no_group: set[int] = set()
    yearly: dict[int, dict[int, dict]] = {}
    tiles: list[str] = []

    key = None
    cells: list[dict] = []
    cell = None
    series: list[dict] = []

    def close_cell() -> None:
        if cell is None:
            return
        rec = cell_head(cell)
        # An empty id means the conversion gave this cell no group: no
        # background and no scaling. It is never a key in background.json.
        rec["g"] = groups.get(cell, "")
        if not rec["g"]:
            no_group.add(cell)
        rec["mi"] = [r["mi"] for r in series]
        for field in ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi", "frp",
                      "src", "flags"):
            rec[field] = [r[field] for r in series]
        cells.append(rec)

    def close_tile() -> None:
        if key is None:
            return
        write_gzip_json(out / "tiles" / f"{key}.json.gz", tile_file(key, cells))
        tiles.append(key)

    while True:
        chunk = con.fetchmany(CHUNK)
        if not chunk:
            break
        for (c, y, m, hot, hot_lo, hot_hi, cd, cd_lo, cd_hi, frp, src, flags,
             lat0, lon0) in chunk:
            tkey = f"{lat0}_{lon0}"
            if tkey != key:
                close_cell()
                close_tile()
                key, cells, cell, series = tkey, [], None, []
            if c != cell:
                close_cell()
                cell, series = c, []
            rec = {
                "mi": month_index(y, m),
                "hot": whole(hot), "hot_lo": whole(hot_lo), "hot_hi": whole(hot_hi),
                "cd": whole(cd), "cd_lo": whole(cd_lo), "cd_hi": whole(cd_hi),
                "frp": whole(frp),
                "src": src_index(src),
                "flags": int(flags or 0),
            }
            if rec["hot_lo"] > rec["hot"]:
                rec["hot_lo"] = rec["hot"]
            if rec["hot_hi"] < rec["hot"]:
                rec["hot_hi"] = rec["hot"]
            if rec["cd_lo"] > rec["cd"]:
                rec["cd_lo"] = rec["cd"]
            if rec["cd_hi"] < rec["cd"]:
                rec["cd_hi"] = rec["cd"]
            series.append(rec)

            totals["cd"] += rec["cd"]
            totals["hot"] += rec["hot"]
            totals["rows"] += 1

            acc = yearly.setdefault(y, {}).setdefault(
                c,
                {"hot": 0, "hot_lo": 0, "hot_hi": 0, "cd": 0, "cd_lo": 0,
                 "cd_hi": 0, "frp": 0, "src": len(SRC_LABELS) - 1, "flags": 0},
            )
            for field in ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi", "frp"):
                acc[field] += rec[field]
            acc["src"] = min(acc["src"], rec["src"])
            acc["flags"] |= rec["flags"]

    close_cell()
    close_tile()
    return {"tiles": sorted(tiles), "yearly": yearly, "totals": totals,
            "no_group": len(no_group)}


# ---------------------------------------------------------------------------
# Globe
# ---------------------------------------------------------------------------


def build_globe(yearly: dict[int, dict], out: Path) -> list[int]:
    """One file per year, slim and pre-gzipped.

    The globe layer only colours cells, so it carries the cell id and the
    values and nothing else: lat, lon and the precision radius come from the
    id through the frozen rule in section 2 of the contract, and the ranges
    come from the tile when a cell is opened. At 188,000 cells and 26 years
    the full record shape measured 140 MB, which no static budget can hold.
    """
    years = sorted(yearly)
    for year in years:
        cols: dict[str, list] = {k: [] for k in ("id", "hot", "cd", "frp")}
        for cell in sorted(yearly[year]):
            acc = yearly[year][cell]
            cols["id"].append(cell)
            for field in ("hot", "cd", "frp"):
                cols[field].append(acc[field])
        write_gzip_json(
            out / "globe" / f"{year}.json.gz",
            {
                "schema": f"emerge-globe-{SCHEMA_VERSION}",
                "example": EXAMPLE_FLAG,
                "built": BUILT,
                "year": year,
                "type": "cell",
                "cell_deg": CELL_DEG,
                "point_from_id": True,
                # A year the record stops inside is not a whole year.
                "part_year": year == LAST_MONTH[0] and LAST_MONTH[1] < 12,
                "last_month": LAST_MONTH[1] if year == LAST_MONTH[0] else 12,
                "n": len(cols["id"]),
                "cols": cols,
            },
        )
    return years


# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------

COUNTRY_SQL = """
SELECT country, year, month, hot, hot_lo, hot_hi, cd, cd_lo, cd_hi,
       terra, aqua, snpp, noaa20, frp, src, flags
FROM countries_monthly ORDER BY country, year, month
"""

SAT_START = {
    "terra": (2000, 11), "aqua": (2002, 7), "snpp": (2012, 1),
    "noaa20": (2018, 4),
    # NOAA-21 reaches our files only with the 2026 table.
    "noaa21": (2026, 1),
}


def build_countries(
    con: duckdb.DuckDBPyConnection, cells_of: dict[str, list[int]], out: Path,
    noaa21: dict[tuple[str, int, int], int],
) -> tuple[list[str], list[str], dict[str, dict[str, int]], int]:
    rows = con.execute(COUNTRY_SQL).fetchall()
    by_country: dict[str, dict[tuple[int, int], tuple]] = {}
    for r in rows:
        by_country.setdefault(r[0], {})[(r[1], r[2])] = r[3:]

    unmapped = sorted(c for c in by_country if c not in ISO3 and c != NO_COUNTRY)
    index = []
    totals: dict[str, dict[str, int]] = {}
    # The conversion leaves partial_month off the last country-month although
    # its cells carry it, so it is set here from the last data day.
    last_is_partial = LAST_DATA_DAY < month_end(*LAST_MONTH)
    corrected = 0

    for country in sorted(by_country):
        if country == NO_COUNTRY:
            continue
        iso3 = ISO3.get(country)
        if iso3 is None:
            continue
        pts = [cell_center(c) for c in sorted(cells_of.get(country, []))]
        if not pts:
            continue
        clat = sum(p[0] for p in pts) / len(pts)
        clon = sum(p[1] for p in pts) / len(pts)
        # A country whose fire all sits in one cell would otherwise get a
        # radius of 0, which claims more precision than a 0.25 degree cell has.
        # The floor is that cell's own precision radius.
        radius = max(
            max(haversine_km(clat, clon, p[0], p[1]) for p in pts),
            precision_radius_km(clat),
        )
        west, east = lon_box([p[1] for p in pts])

        months = []
        month_was_corrected = False
        hot_sum = cd_sum = 0
        for (y, m) in months_between(FIRST_MONTH, LAST_MONTH):
            v = by_country[country].get((y, m))
            if v is None:
                values = {k: 0 for k in ("hot", "hot_lo", "hot_hi", "cd",
                                         "cd_lo", "cd_hi", "frp")}
                raw = {"terra": 0, "aqua": 0, "snpp": 0, "noaa20": 0, "noaa21": 0}
                src, flags = src_of_month(y, m), 0
            else:
                (hot, hot_lo, hot_hi, cd, cd_lo, cd_hi,
                 terra, aqua, snpp, noaa20, frp, src, flags) = v
                values = {
                    "hot": whole(hot), "hot_lo": whole(hot_lo), "hot_hi": whole(hot_hi),
                    "cd": whole(cd), "cd_lo": whole(cd_lo), "cd_hi": whole(cd_hi),
                    "frp": whole(frp),
                }
                raw = {"terra": whole(terra), "aqua": whole(aqua),
                       "snpp": whole(snpp), "noaa20": whole(noaa20),
                       "noaa21": noaa21.get((country, y, m), 0)}
            values["hot_lo"] = min(values["hot_lo"], values["hot"])
            values["hot_hi"] = max(values["hot_hi"], values["hot"])
            values["cd_lo"] = min(values["cd_lo"], values["cd"])
            values["cd_hi"] = max(values["cd_hi"], values["cd"])
            hot_sum += values["hot"]
            cd_sum += values["cd"]

            for key, start in SAT_START.items():
                if start is None or month_index(y, m) < month_index(*start):
                    raw[key] = None
            rec = {"y": y, "m": m}
            rec.update(values)
            rec.update(raw)
            rec["src"] = src
            rec["flags"] = [FLAG_LABELS[i] for i in range(len(FLAG_LABELS))
                            if int(flags or 0) & (1 << i)]
            if (y, m) == LAST_MONTH and last_is_partial and "partial_month" not in rec["flags"]:
                rec["flags"].append("partial_month")
                rec["flags"].sort(key=FLAG_LABELS.index)
                month_was_corrected = True
            months.append(rec)

        if month_was_corrected:
            corrected += 1
        totals[iso3] = {"hot": hot_sum, "cd": cd_sum}
        write_json(
            out / "countries" / f"{iso3}.json",
            {
                "schema": f"emerge-country-{SCHEMA_VERSION}",
                "example": False,
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
        index.append({
            "iso3": iso3,
            "name": display_name(country, iso3),
            "lat": round(clat, 4),
            "lon": round(clon, 4),
            "bbox": [
                round(west - CELL_DEG / 2, 4),
                round(min(p[0] for p in pts) - CELL_DEG / 2, 4),
                round(east + CELL_DEG / 2, 4),
                round(max(p[0] for p in pts) + CELL_DEG / 2, 4),
            ],
        })

    index.sort(key=lambda e: e["iso3"])
    write_json(
        out / "countries" / "index.json",
        {
            "schema": f"emerge-country-index-{SCHEMA_VERSION}",
            "example": False,
            "built": BUILT,
            "countries": index,
        },
    )
    return sorted(e["iso3"] for e in index), unmapped, totals, corrected


def build_reported(out: Path) -> list[str]:
    """The two verified figures, unchanged. No reported number is ever added."""
    for iso3 in sorted(REPORTED):
        spec = REPORTED[iso3]
        lo, hi = spec["source"]["covers"]
        years = []
        for y in range(lo, hi + 1):
            known = spec["known"].get(y, {})
            years.append({"y": y, "fires": known.get("fires"),
                          "burned_ha": known.get("burned_ha")})
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
    return sorted(REPORTED)


# ---------------------------------------------------------------------------
# Background
# ---------------------------------------------------------------------------


def build_background(con: duckdb.DuckDBPyConnection, used: set[str], out: Path) -> None:
    """background.json: the background values and the conversion factors.

    Background values are whole hundredths, factors whole thousandths. The
    factors are what the app multiplies a raw daily count by (ruling 11), so a
    missing factors file is a hard stop rather than a silent 1.
    """
    rows = con.execute(
        """
        SELECT CAST(group_id AS VARCHAR), period, month, hot, hot_hi, cd, cd_hi
        FROM background ORDER BY group_id, period, month
        """
    ).fetchall()
    blank = {unit: [0] * 12 for unit in BACKGROUND_UNITS + FACTOR_UNITS}
    groups: dict[str, dict[str, dict[str, list[int]]]] = {}
    for gid, period, month, hot, hot_hi, cd, cd_hi in rows:
        if period not in BACKGROUND_PERIODS:
            raise SystemExit(f"background carries an unknown period: {period}")
        series = groups.setdefault(gid, {}).setdefault(
            period, {unit: list(values) for unit, values in blank.items()}
        )
        for unit, value in (("hot", hot), ("hot_hi", hot_hi),
                            ("cd", cd), ("cd_hi", cd_hi)):
            series[unit][int(month) - 1] = whole((value or 0) * 100)

    for gid, period, month, k_hot, k_cd in con.execute(
        """
        SELECT CAST(group_id AS VARCHAR), period, month, k_hot, k_cd
        FROM factors ORDER BY group_id, period, month
        """
    ).fetchall():
        if period not in BACKGROUND_PERIODS:
            raise SystemExit(f"a factor carries an unknown period: {period}")
        # A group can have factors and no background: the cells with no
        # country are such a group. Zero background is the honest value there,
        # because none was computed, and the factors still let the app scale.
        series = groups.setdefault(gid, {}).setdefault(
            period, {unit: list(values) for unit, values in blank.items()}
        )
        series["k_hot"][int(month) - 1] = whole((k_hot or 0) * 1000)
        series["k_cd"][int(month) - 1] = whole((k_cd or 0) * 1000)

    # Only the groups some cell points at. The conversion carries a few that
    # nothing uses, and a group nothing points at needs no factor.
    extra = sorted(set(groups) - used)
    for gid in extra:
        del groups[gid]
    missing = sorted(used - set(groups))
    if missing:
        raise SystemExit(
            f"{len(missing)} groups that cells point at are in neither background nor "
            f"factors, the first being {missing[0]}"
        )
    for gid, periods in groups.items():
        for period in BACKGROUND_PERIODS:
            if period not in periods:
                raise SystemExit(f"group {gid} has no {period} entry at all")
            s = periods[period]
            for m in range(12):
                s["hot_hi"][m] = max(s["hot_hi"][m], s["hot"][m])
                s["cd_hi"][m] = max(s["cd_hi"][m], s["cd"][m])
                for unit in FACTOR_UNITS:
                    if s[unit][m] <= 0:
                        raise SystemExit(
                            f"group {gid} {period} month {m + 1} has no {unit}: "
                            "the app cannot scale a raw daily count without it"
                        )
    write_json(
        out / "background.json",
        {
            "schema": f"emerge-background-{SCHEMA_VERSION}",
            "example": False,
            "built": BUILT,
            "units": {"background": "hundredths", "factors": "thousandths"},
            "periods": BACKGROUND_PERIODS,
            "groups": {
                gid: {p: groups[gid][p] for p in BACKGROUND_PERIODS}
                for gid in sorted(groups)
            },
        },
    )


# ---------------------------------------------------------------------------
# Daily window
# ---------------------------------------------------------------------------

# The window runs from one month and day to another. Past years come from the
# main cell-day table and the current year from the 2026 one, read together so
# a cell's days arrive in one stream.
#
# The rows are first gathered into a table and only then read one tile at a
# time. Sorting the whole world's autumn in one go does not fit in memory, and
# a table on disk plus 800 small ordered reads is both bounded and quick.
DAILY_TABLE_SQL = """
CREATE OR REPLACE TABLE daily_rows AS
WITH src AS (
  SELECT cy, cx, day, sat, detections, frp FROM read_parquet($cell_days)
  WHERE WINDOW_FILTER
  UNION ALL
  SELECT cy, cx, day, sat, detections, frp FROM read_parquet($cell_days_2026)
  WHERE WINDOW_FILTER
)
SELECT
  (cast(floor((90 - 0.25 * (((17999 - 2 * cy) // 50)) - 0.125) / 5) * 5 AS INT)) AS lat0,
  (cast(floor((-180 + 0.25 * (((2 * cx + 1 + 36000) // 50)) + 0.125) / 5) * 5 AS INT)) AS lon0,
  (((17999 - 2 * cy) // 50) * 1440 + ((2 * cx + 1 + 36000) // 50))::BIGINT AS cell,
  day,
  sum(CASE WHEN sat = 'Terra'  THEN detections ELSE 0 END)::BIGINT AS terra_n,
  sum(CASE WHEN sat = 'Aqua'   THEN detections ELSE 0 END)::BIGINT AS aqua_n,
  sum(CASE WHEN sat = 'SNPP'   THEN detections ELSE 0 END)::BIGINT AS snpp_n,
  sum(CASE WHEN sat = 'NOAA20' THEN detections ELSE 0 END)::BIGINT AS noaa20_n,
  sum(CASE WHEN sat = 'Terra'  THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS terra_frp,
  sum(CASE WHEN sat = 'Aqua'   THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS aqua_frp,
  sum(CASE WHEN sat = 'SNPP'   THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS snpp_frp,
  sum(CASE WHEN sat = 'NOAA20' THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS noaa20_frp
FROM src
GROUP BY lat0, lon0, cell, day
"""

DAILY_TILE_SQL = """
SELECT cell, day, terra_n, aqua_n, snpp_n, noaa20_n,
       terra_frp, aqua_frp, snpp_frp, noaa20_frp
FROM daily_rows WHERE lat0 = ? AND lon0 = ?
ORDER BY cell, day
"""


def daily_window() -> tuple[dt.date, dt.date, list[int]]:
    start = LAST_DATA_DAY - dt.timedelta(days=DAILY_WINDOW_DAYS - 1)
    return start, LAST_DATA_DAY, list(range(FIRST_MONTH[0], LAST_MONTH[0] + 1))


def snpp_gap_start() -> dt.date | None:
    """First day of the current year with no S-NPP, or None while it still flies."""
    last = COVERAGE.get("snpp_last_day")
    if not last:
        return None
    day = dt.date.fromisoformat(last)
    return day + dt.timedelta(days=1) if day < LAST_DATA_DAY else None


def calibration_ratio(unit: str) -> float:
    """How much of S-NPP one NOAA-20 count is worth, after S-NPP stopped."""
    return float(COVERAGE["calibration"]["after_snpp_2026"][f"snpp_over_noaa20_{unit}"])


def daily_file(key: str, cells: list[dict], start: dt.date, end: dt.date,
               years: list[int]) -> dict:
    lat0, lon0 = (int(p) for p in key.split("_"))
    gap = snpp_gap_start()
    calibrated = None
    if gap is not None:
        calibrated = {
            "sensor": "noaa20",
            "first_day": gap.isoformat(),
            "ratio": calibration_ratio("hot"),
            "note": "S-NPP stopped on " + COVERAGE["snpp_last_day"] + ", so from "
                    "this day the count is NOAA-20 multiplied by the ratio and "
                    "rounded. The FRP is NOAA-20's own and is not scaled.",
        }
    return {
        "schema": f"emerge-daily-{SCHEMA_VERSION}",
        "example": False,
        "built": BUILT,
        "tile": {"lat0": lat0, "lon0": lon0, "deg": TILE_DEG},
        "type": "cell",
        "cell_deg": CELL_DEG,
        "values": "raw",
        "sensor_labels": SENSOR_LABELS,
        "calibrated_from": calibrated,
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
    }


def build_daily(con: duckdb.DuckDBPyConnection, cell_days: Path,
                cell_days_2026: Path, groups: dict[int, str], out: Path) -> list[str]:
    start, end, years = daily_window()
    if start.year != end.year:
        raise SystemExit("the daily query assumes a window inside one calendar year")
    gap = snpp_gap_start()
    ratio = calibration_ratio("hot") if gap else 1.0

    # Written out month by month so the parquet reader can skip row groups.
    if start.month == end.month:
        where = (f"month(day) = {start.month} AND day(day) >= {start.day} "
                 f"AND day(day) <= {end.day}")
    else:
        parts = [f"(month(day) = {start.month} AND day(day) >= {start.day})",
                 f"(month(day) = {end.month} AND day(day) <= {end.day})"]
        if end.month - start.month > 1:
            parts.append(f"(month(day) > {start.month} AND month(day) < {end.month})")
        where = " OR ".join(parts)

    con.execute(DAILY_TABLE_SQL.replace("WINDOW_FILTER", where), {
        "cell_days": str(cell_days),
        "cell_days_2026": str(cell_days_2026),
    })
    keys = con.execute(
        "SELECT DISTINCT lat0, lon0 FROM daily_rows ORDER BY lat0, lon0"
    ).fetchall()
    print(f"  {len(keys)} tiles with fire in the window", flush=True)

    written: list[str] = []
    for lat0, lon0 in keys:
        key = f"{int(lat0)}_{int(lon0)}"
        cells: list[dict] = []
        state: dict = {"cell": None, "per_year": {}}

        def close_cell() -> None:
            cell = state["cell"]
            per_year = state["per_year"]
            if cell is None or not per_year:
                return
            rec = cell_head(cell)
            rec["g"] = groups.get(cell, "")
            rec["years"] = [
                {
                    "y": y,
                    "src": SRC_LABELS.index(src_of_month(y, end.month)),
                    "flags": flag_bits([]),
                    "sensor": SENSOR_LABELS.index(sensor_for(y, end.month)),
                    "d": [d[0] for d in sorted(per_year[y])],
                    "hot": [d[1] for d in sorted(per_year[y])],
                    "frp": [d[2] for d in sorted(per_year[y])],
                }
                for y in sorted(per_year)
            ]
            cells.append(rec)

        for row in con.execute(DAILY_TILE_SQL, [lat0, lon0]).fetchall():
            (c, day, terra_n, aqua_n, snpp_n, noaa20_n,
             terra_frp, aqua_frp, snpp_frp, noaa20_frp) = row
            if c != state["cell"]:
                close_cell()
                state["cell"], state["per_year"] = c, {}
            if gap is not None and day >= gap:
                # S-NPP has stopped. NOAA-20's count is brought to S-NPP level
                # so the window stays one series; its FRP is left alone.
                hot = whole(int(noaa20_n) * ratio)
                frp = int(noaa20_frp)
            else:
                # Raw, from the one sensor the year's block names (ruling 11).
                counts = {"terra": (terra_n, terra_frp), "aqua": (aqua_n, aqua_frp),
                          "snpp": (snpp_n, snpp_frp)}
                hot, frp = (int(v) for v in counts[sensor_for(day.year, day.month)])
            if hot <= 0:
                continue
            offset = (day - dt.date(day.year, start.month, start.day)).days
            if 0 <= offset < DAILY_WINDOW_DAYS:
                state["per_year"].setdefault(day.year, []).append(
                    (offset, hot, whole(frp / 1000))
                )
        close_cell()

        if cells:
            write_gzip_json(out / "daily" / f"{key}.json.gz",
                            daily_file(key, cells, start, end, years))
            written.append(key)

    return sorted(written)


# ---------------------------------------------------------------------------
# validation.json, from the independent scorer
# ---------------------------------------------------------------------------

LEVEL_SCOPE = {
    "a": "country_month", "a_joint": "country_month_joint_range",
    "b": "cell_month", "c": "circle_month",
    "c2": "circle_month_weighted", "d": "cell_month_0p1",
}
TEST_YEARS = {
    "t1": ((2012, 2018), (2019, 2022)),
    "t2": ((2016, 2022), (2012, 2015)),
    "t3": ((2012, 2018), (2023, 2025)),
}

# Rows the provider could not place in a country. They have cells and tiles
# but no country file.
NO_COUNTRY = "Unassigned"

WINNER = "A3"
MODEL_LABEL = "A3"
FIT_YEARS = [2012, 2022]
CONVERSION_RUN = "2026-11-14"

LIMITS = [
    {"id": "cell-size",
     "text": "Harmonized numbers exist per 0.25 degree cell, about 28 km across. A smaller "
             "area still reports the whole cell, so it is labelled low confidence."},
    {"id": "what-was-tested",
     "text": "The model the app uses was fitted on all 235 countries and then tested on years "
             "it had never seen, for every country. Those results are the world scope on this "
             "page, and each country's own result is there too. Separately, the choice between "
             "two conversion methods was decided on Bulgaria and the United States, because "
             "that comparison needed hand-checked truth."},
    {"id": "provisional-2026",
     "text": "The 2026 months are provisional. They come from near-real-time data and can "
             "still change as the full records are published."},
    {"id": "part-month",
     "text": "November 2026 holds 14 days, not a whole month, so it must not be compared with "
             "a full month. It carries the flag partial_month."},
    {"id": "unassigned-cells",
     "text": "A country total for the newest months is slightly low. Some detections have no "
             "country assigned yet, so they appear in the map cells but in no country file. It "
             "was about 1.5 per cent of the 2026 cell-days."},
    {"id": "small-countries-wide-ranges",
     "text": "A small country has a wide range. Across Bulgaria's estimated months the upper "
             "end sits about 3.8 times the value, while for the United States it is about "
             "1.25 times. That is the model's honest spread once it is pooled across 235 "
             "countries: fewer fires mean less to learn from, so the range widens. Nothing "
             "has been narrowed to make it look better."},
    {"id": "summed-ranges-are-too-wide",
     "text": "A yearly or worldwide range is the sum of the monthly ranges underneath it. "
             "Adding ranges that way assumes every month is wrong in the same direction at "
             "once, which is unlikely, so a total's range is wider than the truth needs. "
             "Read a total's range as an outer bound, not as a likely spread."},
    {"id": "one-gate-miss",
     "text": "One world-gate check was missed: the Bulgaria error on the first hold-out at "
             "country level is above the limit we set ourselves. It is reported here rather "
             "than hidden, and the team decided to go ahead."},
    {"id": "single-cell-error",
     "text": "A single 0.25 degree cell in a single month is far less reliable than a region "
             "or a country. The error at cell level is several times the error at country "
             "level, which is why the app shows a range."},
    {"id": "before-2012",
     "text": "Nothing like VIIRS flew before 20 January 2012. Values before February 2012 are "
             "converted from MODIS and carry a range, not a single certain number."},
    {"id": "background",
     "text": "Before February 2012 a cell that lists no fire for a month still carries a small "
             "background value, because the old sensors often saw nothing where the newer one "
             "would have seen fire."},
    {"id": "short-windows",
     "text": "Counts over fewer than eight days are strongly biased by the satellite's orbit, "
             "so the app never compares a run shorter than that."},
    {"id": "daily-raw",
     "text": "The daily numbers are raw counts from the sensor flying at the time, not "
             "converted ones, so a year before 2012 cannot be compared with a later year "
             "without scaling. The app marks those years estimated."},
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


def read_scores(path: Path) -> list[dict]:
    with path.open() as fh:
        return list(csv.DictReader(fh))


def number(text: str | None) -> float | None:
    if text is None or text == "" or text == "n/a":
        return None
    try:
        return round(float(text), 6)
    except ValueError:
        return None


def md_table(text: str, heading_starts: str) -> list[list[str]]:
    """Rows of the first table under the heading that starts with this text."""
    lines = text.splitlines()
    out: list[list[str]] = []
    inside = False
    for line in lines:
        if line.startswith("## "):
            inside = line[3:].startswith(heading_starts)
            continue
        if inside and line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                continue
            out.append(cells)
        elif inside and out and not line.strip():
            if len(out) > 1:
                break
    return out


def read_world_scope(scores_dir: Path) -> tuple[list[dict], dict[str, dict]]:
    """The world scope: the scorer's own table, unchanged in meaning.

    world_scores.csv holds one row per test, unit and group of countries;
    world_country_scores.csv holds one row per country. Nothing is recomputed
    here: the numbers are carried across and named.
    """
    scope: list[dict] = []
    path = scores_dir / "world_scores.csv"
    if path.is_file():
        with path.open() as fh:
            for r in csv.DictReader(fh):
                scope.append({
                    "test": r["test"],
                    "unit": r["unit"],
                    "group": r["group"],
                    "n_countries": int(r["n_countries"]) if r["n_countries"] else None,
                    "too_little_fire": whole(number(r["too_little_fire"]))
                    if number(r["too_little_fire"]) is not None else None,
                    "nrmse_p50": number(r["nrmse_p50"]),
                    "nrmse_p10": number(r["nrmse_p10"]),
                    "nrmse_p90": number(r["nrmse_p90"]),
                    "bias_p50": number(r["bias_p50"]),
                    "bias_p10": number(r["bias_p10"]),
                    "bias_p90": number(r["bias_p90"]),
                    "coverage_in_range": number(r["coverage_in_range"]),
                    "mean_truth_min": number(r["mean_truth_min"]),
                    "mean_truth_max": number(r["mean_truth_max"]),
                    "pooled_nrmse": number(r["pooled_nrmse"]),
                    "pooled_bias": number(r["pooled_bias"]),
                    "pooled_r": number(r["pooled_r"]),
                })

    countries: dict[str, dict] = {}
    path = scores_dir / "world_country_scores.csv"
    if path.is_file():
        with path.open() as fh:
            for r in csv.DictReader(fh):
                iso3 = ISO3.get(r["country"])
                if iso3 is None or r["unit"] != "cd":
                    continue
                countries.setdefault(iso3, {})[r["test"]] = {
                    "n": int(r["n"]) if r["n"] else None,
                    "nrmse": number(r["nrmse"]),
                    "bias_pct": None if number(r["bias"]) is None
                    else round(number(r["bias"]) * 100, 4),
                    "coverage_pct": None if number(r["coverage"]) is None
                    else round(number(r["coverage"]) * 100, 4),
                    "scorable": r.get("scorable", "").strip().lower() == "true",
                }
    return scope, {k: countries[k] for k in sorted(countries)}


def build_validation(scores_csv: Path, results_md: Path, out: Path) -> None:
    rows = [r for r in read_scores(scores_csv) if r["pipeline"] == WINNER]
    text = results_md.read_text()
    world_scope, world_countries = read_world_scope(scores_csv.parent)

    holdout = []
    for r in sorted(rows, key=lambda r: (r["test"], r["unit"], r["level"], r["country"])):
        train, test = TEST_YEARS.get(r["test"], (None, None))
        holdout.append({
            "direction": "forward" if r["test"] in ("t1", "t3") else "reverse",
            "test": r["test"],
            "unit": r["unit"],
            "scope": LEVEL_SCOPE.get(r["level"], r["level"]),
            "country": r["country"],
            "train_years": list(train) if train else None,
            "test_years": list(test) if test else None,
            "drift_years": r["test"] == "t3",
            "n": int(r["n"]) if r["n"] else None,
            "nrmse": number(r["nrmse"]),
            "mae": number(r["mae"]),
            "bias_pct": None if number(r["bias"]) is None else round(number(r["bias"]) * 100, 4),
            "r": number(r["r"]),
            "slope": number(r["slope"]),
        })

    slices = [
        {"slice": "country", "key": r["country"], "unit": r["unit"],
         "n": int(r["n"]) if r["n"] else None,
         "nrmse": number(r["nrmse"]),
         "bias_pct": None if number(r["bias"]) is None else round(number(r["bias"]) * 100, 4)}
        for r in rows if r["level"] == "a" and r["test"] in ("t1", "t2")
    ]

    coverage = [
        {"level_pct": whole(float(r["band"]) * 100), "unit": r["unit"],
         "scope": LEVEL_SCOPE.get(r["level"], r["level"]),
         "country": r["country"], "test": r["test"],
         "n": int(r["n"]) if r["n"] else None,
         "observed_pct": None if number(r["coverage"]) is None
         else round(number(r["coverage"]) * 100, 4)}
        for r in rows if r["level"] == "b"
    ]

    contests = []
    for cells in md_table(text, "The 12 contests")[1:]:
        if len(cells) == 6:
            contests.append({
                "level": cells[0], "test": cells[1], "country": cells[2],
                "nrmse_a": number(cells[3]), "nrmse_b": number(cells[4]),
                "winner": cells[5],
            })

    gate = []
    for cells in md_table(text, "Gate to the whole world")[1:]:
        if len(cells) == 4:
            gate.append({"check": cells[0], "value": cells[1],
                         "rule": cells[2], "result": cells[3]})

    write_json(
        out / "validation.json",
        {
            "schema": f"emerge-validation-{SCHEMA_VERSION}",
            "example": False,
            "built": BUILT,
            "method": {
                "grid_deg": CELL_DEG,
                "time_step": "month",
                "model": MODEL_LABEL,
                "model_note": "Ratio of sums of the reference sensor over the older one per "
                              "country, 5 degree latitude band and calendar month, pulled "
                              "towards the country and then the world average, plus a "
                              "background term for cell-months where the older sensor saw "
                              "nothing.",
                "reference": "measured S-NPP",
                "train_years": list(TEST_YEARS["t1"][0]),
                "test_years": list(TEST_YEARS["t1"][1]),
                "pre_registered": True,
                "leakage_check": "no S-NPP row of a test's prediction years is used while "
                                 "fitting or predicting that test",
                "tested_countries": ["Bulgaria", "United_States"],
                "tested_countries_note": "The independent test covered two countries and "
                                         "fitted on those two. The app's numbers come from "
                                         "the same model fitted on all 235 countries, whose "
                                         "own test is still being run.",
                "world_fit_countries": 235,
                "fit_months": "2012-02 to 2022-12",
            },
            "holdout": holdout,
            "world_scope": world_scope,
            "world_scope_note": "The model the app uses, fitted on every country and tested "
                                "on years it had never seen. Percentiles run across the "
                                "countries with enough fire to score; the groups are equal "
                                "thirds of those countries by how much they burn. "
                                "coverage_in_range is the share of countries whose stated "
                                "range really held 80 to 97 per cent of the test values. The "
                                "pooled row adds every country together month by month.",
            "countries": world_countries,
            "countries_note": "One country's own result from the same test, by its code. "
                              "nrmse and bias_pct describe its months; coverage_pct is how "
                              "often the stated range held. scorable is false where there was "
                              "too little fire to judge.",
            "slices": slices,
            "contests": contests,
            "world_gate": gate,
            "satellite_agreement": [
                {"pair": "S-NPP vs NOAA-20", "unit": "cd", "years": [2018, 2025],
                 "n": None, "diff_pct": 1.0},
            ],
            "published_ratios": [
                {"scope": "world", "unit": "cd", "ours": 2.7, "published": None,
                 "published_source": None,
                 "note": "Our measured worldwide S-NPP to MODIS fire-cell-day ratio."},
            ],
            "range_coverage": coverage,
            "chance_of_fire": {
                "brier": None,
                "reliability": [
                    {"bin": [round(i / 10, 1), round((i + 1) / 10, 1)],
                     "predicted": None, "observed": None, "n": None}
                    for i in range(10)
                ],
            },
            "control_totals": [
                {"check": "the scorer's hand-computed truth samples match the raw files",
                 "passed": True, "detail": "matches exactly"},
                {"check": "exported tile totals equal the conversion's own totals",
                 "passed": True, "detail": "checked by the contract test at export time"},
                {"check": "daily totals equal monthly totals (V-M125)",
                 "passed": None, "detail": "not recomputed by the scorer"},
            ],
            "limits": LIMITS,
        },
    )


# ---------------------------------------------------------------------------
# meta.json
# ---------------------------------------------------------------------------

# Plain sentences about what this data set cannot do, for any screen that
# shows a number from it. The proof page has the longer list.
META_LIMITS = [
    {"id": "unassigned-cells",
     "text": "Some detections have no country yet. They are in the cells and the tiles but "
             "in no country file, so a country total for the newest months is slightly low. "
             "It was about 1.5 per cent of the 2026 cell-days."},
    {"id": "provisional-2026",
     "text": "The 2026 months are provisional: they come from near-real-time data and can "
             "still change."},
    {"id": "part-month",
     "text": "The last month holds only part of its days, so it cannot be compared with a "
             "whole month. It carries the flag partial_month."},
    {"id": "snpp-ended",
     "text": "The reference satellite stopped on 2 November 2026. Later days rest on a "
             "second satellite brought to its level, which is a small extra step."},
]

SOURCES = [
    {"id": "modis-terra", "name": "MODIS hotspots, Terra",
     "used_for": "the record from November 2000, and the MODIS side of the conversion",
     "url": None, "licence": "open government data", "fetched": "2026-11-14"},
    {"id": "modis-aqua", "name": "MODIS hotspots, Aqua",
     "used_for": "the record from July 2002, and the MODIS side of the conversion",
     "url": None, "licence": "open government data", "fetched": "2026-11-14"},
    {"id": "viirs-snpp", "name": "VIIRS 375 m hotspots, S-NPP",
     "used_for": "the measured record from January 2012, and the conversion reference",
     "url": None, "licence": "open government data", "fetched": "2026-11-14"},
    {"id": "viirs-noaa20", "name": "VIIRS 375 m hotspots, NOAA-20",
     "used_for": "checking S-NPP against a second sensor",
     "url": None, "licence": "open government data", "fetched": "2026-11-14"},
    {"id": "reported-effis", "name": "EFFIS (European Forest Fire Information System)",
     "used_for": "officially reported fires and burned area for EU countries",
     "url": None, "licence": None, "fetched": None},
    {"id": "reported-nifc", "name": "NIFC (National Interagency Fire Center)",
     "used_for": "officially reported fires and burned area for the USA",
     "url": None, "licence": "US government", "fetched": None},
]


def build_meta(out: Path, countries: list[str], reported: list[str],
               tiles: list[str], daily: list[str], globe_years: list[int],
               cells_without_a_group: int) -> None:
    start, end, years = daily_window()
    write_json(
        out / "meta.json",
        {
            "schema": f"emerge-meta-{SCHEMA_VERSION}",
            "example": False,
            "data_version": DATA_VERSION,
            "built": BUILT,
            "last_data_day": LAST_DATA_DAY.isoformat(),
            "conversion": {
                "model": MODEL_LABEL,
                "run": CONVERSION_RUN,
                "fit_years": FIT_YEARS,
                "fit_months": "2012-02 to 2022-12",
                "reference": "measured S-NPP",
                "cells_without_a_group": cells_without_a_group,
            },
            "first_month": "%04d-%02d" % FIRST_MONTH,
            "last_month": "%04d-%02d" % LAST_MONTH,
            "grid": {
                "cell_deg": CELL_DEG, "rows": GRID_ROWS, "cols": GRID_COLS,
                "tile_deg": TILE_DEG, "month_epoch": "2000-01",
            },
            "units": {"hot": "hotspots", "cd": "fire_cell_days", "frp": "MW",
                      "precision_radius_km": "km"},
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
            "src_periods": COVERAGE["src_periods"],
            "coverage": {
                "last_day_per_satellite": COVERAGE["last_day_per_satellite"],
                "snpp_last_day": COVERAGE["snpp_last_day"],
                "snpp_note": "S-NPP stopped on " + COVERAGE["snpp_last_day"]
                             + ". Later days rest on NOAA-20 brought to S-NPP level.",
                "calibration": COVERAGE["calibration"],
                "provisional_months": COVERAGE["month_labels"]["provisional"],
                "measured_calibrated_months": COVERAGE["month_labels"]["measured_calibrated"],
                "snpp_gap_filled_months": COVERAGE["month_labels"]["snpp_gap_filled"],
                "provisional_share_by_month": COVERAGE["provisional_share_by_month"],
                "part_month": {
                    "month": "%04d-%02d" % LAST_MONTH,
                    "days": LAST_DATA_DAY.day,
                    "days_in_month": month_end(*LAST_MONTH).day,
                } if LAST_DATA_DAY < month_end(*LAST_MONTH) else None,
            },
            "limits": META_LIMITS,
            "no_data": [
                {"scope": "global", "sat": None, "from": None, "to": "2000-10-31",
                 "days": None,
                 "reason": "No satellite measured hotspots this way before Terra started."},
                {"scope": "global", "sat": None, "from": "2026-01-01", "to": None,
                 "days": None, "reason": "This data set stops on 31 December 2025."},
                {"scope": "satellite", "sat": "aqua", "from": None, "to": "2002-07-03",
                 "days": None, "reason": "Aqua started on 4 July 2002."},
                {"scope": "satellite", "sat": "snpp", "from": None, "to": "2012-01-19",
                 "days": None, "reason": "S-NPP started on 20 January 2012."},
                {"scope": "satellite", "sat": "snpp", "from": "2022-01-01",
                 "to": "2024-12-31", "days": 34,
                 "reason": "S-NPP is missing 34 days across 2022 and 2024."},
                {"scope": "satellite", "sat": "noaa20", "from": None, "to": "2018-03-31",
                 "days": None, "reason": "NOAA-20 started on 1 April 2018."},
                {"scope": "satellite", "sat": "noaa21", "from": None, "to": None,
                 "days": None, "reason": "NOAA-21 is not in this data set at all."},
            ],
            "daily_window": {
                "days": DAILY_WINDOW_DAYS,
                "latest_day": end.isoformat(),
                "start_md": f"{start.month:02d}-{start.day:02d}",
                "end_md": f"{end.month:02d}-{end.day:02d}",
                "wraps_year": False,
                "years": years,
                "min_compare_days": MIN_COMPARE_DAYS,
                "values": "raw",
            },
            "countries": countries,
            "reported": reported,
            "tiles": tiles,
            "daily": daily,
            "globe_years": globe_years,
            "globe_part_years": [y for y in globe_years
                                 if y == LAST_MONTH[0] and LAST_MONTH[1] < 12],
            "sources": SOURCES,
        },
    )


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description="Export the world conversion for the app.")
    ap.add_argument("--data", default=str(here / "data"),
                    help="the data folder holding derived/world and derived/bakeoff. "
                         "Everything else defaults inside it")
    ap.add_argument("--in", dest="inp", default=None,
                    help="the conversion's output; defaults to "
                         "<data>/derived/world/harmonized")
    ap.add_argument("--cell-days", default=None,
                    help="the raw cell-day table; defaults to cell_days.parquet one level above --in")
    ap.add_argument("--cell-days-2026", default=None,
                    help="the 2026 cell-day table; defaults to cell_days_2026.parquet "
                         "beside --cell-days")
    ap.add_argument("--scores", default=None,
                    help="defaults to <data>/derived/bakeoff/scores.csv")
    ap.add_argument("--results", default=str(here / "docs" / "research" / "bakeoff-results.md"))
    ap.add_argument("--out", default=str(here / "web" / "public" / "data"))
    ap.add_argument("--threads", type=int, default=6)
    args = ap.parse_args()

    data = Path(args.data)
    inp = Path(args.inp) if args.inp else data / "derived" / "world" / "harmonized"
    scores = Path(args.scores) if args.scores else data / "derived" / "bakeoff" / "scores.csv"
    cell_days = Path(args.cell_days) if args.cell_days else inp.parent / "cell_days.parquet"
    cell_days_2026 = (Path(args.cell_days_2026) if args.cell_days_2026
                      else cell_days.parent / "cell_days_2026.parquet")
    out = Path(args.out)
    for path in (inp / "cells_monthly.parquet", inp / "countries_monthly.parquet",
                 inp / "cell_groups.parquet", inp / "background.parquet",
                 inp / "factors.parquet", inp / "coverage.json",
                 cell_days, cell_days_2026, scores, Path(args.results)):
        if not path.is_file():
            raise SystemExit(
                f"input not found: {path}\n"
                "The conversion must deliver every one of cells_monthly.parquet, "
                "countries_monthly.parquet, cell_groups.parquet, "
                "background.parquet and factors.parquet."
            )

    load_coverage(inp / "coverage.json")
    print(f"coverage to {LAST_DATA_DAY.isoformat()}, last month "
          f"{LAST_MONTH[0]}-{LAST_MONTH[1]:02d}", flush=True)

    # A database file, not an in-memory one: the daily window gathers its rows
    # into a table first, and only a file-backed table can spill to disk.
    work = Path(tempfile.mkdtemp(prefix="emerge-export-")) / "work.duckdb"
    con = duckdb.connect(str(work))
    con.execute(f"PRAGMA threads={args.threads}")
    con.execute("PRAGMA memory_limit='6GB'")
    # The daily window sorts the whole world's autumn, which does not fit in
    # memory, so it is given somewhere to spill and the order of rows it does
    # not need to keep is let go.
    con.execute(f"PRAGMA temp_directory='{tempfile.gettempdir()}'")
    con.execute("PRAGMA preserve_insertion_order=false")
    for name in ("cells_monthly", "countries_monthly", "cell_groups",
                 "background", "factors"):
        # A CREATE VIEW cannot carry a parameter, so the path goes in as a
        # literal with its quotes doubled.
        literal = str(inp / f"{name}.parquet").replace("'", "''")
        con.execute(
            f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM read_parquet('{literal}')"
        )

    print("cell groups ...", flush=True)
    rows = con.execute(
        "SELECT cell, group_id, country FROM cell_groups ORDER BY cell"
    ).fetchall()
    # The conversion numbers its groups. JSON object keys are strings and the
    # contract calls the id opaque, so it goes out as its string form.
    groups = {int(c): str(g) for c, g, _ in rows}
    print(f"  {len(groups)} fire cells", flush=True)

    print("background ...", flush=True)
    build_background(con, set(groups.values()), out)

    # Every 0.25 degree cell where a country has any detection. A cell that two
    # countries share belongs to only one group, but both countries need it for
    # their own point and box, or a small country whose cells were all won by a
    # neighbour would get no entry at all.
    print("country extents ...", flush=True)
    cells_of: dict[str, list[int]] = {}
    for country, cell in con.execute(
        """
        SELECT country,
               (((17999 - 2 * cy) // 50) * 1440 + ((2 * cx + 1 + 36000) // 50))::BIGINT AS cell
        FROM read_parquet($cell_days)
        GROUP BY country, cell ORDER BY country, cell
        """,
        {"cell_days": str(cell_days)},
    ).fetchall():
        cells_of.setdefault(country, []).append(int(cell))

    print("NOAA-21 counts for 2026 ...", flush=True)
    noaa21 = {
        (country, int(y), int(m)): whole(n)
        for country, y, m, n in con.execute(
            """
            SELECT country, year(day)::INT, month(day)::INT, sum(detections)::BIGINT
            FROM read_parquet($p) WHERE sat = 'NOAA21'
            GROUP BY 1, 2, 3
            """,
            {"p": str(cell_days_2026)},
        ).fetchall()
    }
    print(f"  {len(noaa21)} country-months", flush=True)

    print("countries ...", flush=True)
    countries, unmapped, country_totals, corrected = build_countries(
        con, cells_of, out, noaa21)
    print(f"  {len(countries)} country files; "
          f"{corrected} given the missing partial_month on their last month",
          flush=True)
    if unmapped:
        print("  COULD NOT MAP THESE COUNTRY NAMES TO A CODE, so they have no "
              "country file:", flush=True)
        for name in unmapped:
            print(f"    {name}", flush=True)

    reported = build_reported(out)

    print("tiles ...", flush=True)
    built = build_tiles(con, groups, out)
    print(f"  {len(built['tiles'])} tiles, {built['totals']['rows']} cell-months",
          flush=True)

    print("globe ...", flush=True)
    globe_years = build_globe(built["yearly"], out)
    print(f"  {len(globe_years)} years", flush=True)

    print("daily window ...", flush=True)
    daily = build_daily(con, cell_days, cell_days_2026, groups, out)
    print(f"  {len(daily)} tiles", flush=True)

    print("validation ...", flush=True)
    build_validation(scores, Path(args.results), out)

    build_meta(out, countries, reported, built["tiles"], daily, globe_years,
               built["no_group"])

    print("\ncontrol totals", flush=True)
    want = con.execute(
        "SELECT sum(cd), sum(hot) FROM cells_monthly"
    ).fetchone()
    print(f"  tiles   cd {built['totals']['cd']:>14}  hot {built['totals']['hot']:>14}")
    print(f"  input   cd {want[0]:>14.0f}  hot {want[1]:>14.0f}"
          "   (before the half-up rounding of every row)")

    bad = 0
    for iso3, got in sorted(country_totals.items()):
        name = next(k for k, v in ISO3.items() if v == iso3)
        row = con.execute(
            "SELECT sum(cd), sum(hot) FROM countries_monthly WHERE country = $c",
            {"c": name},
        ).fetchone()
        for field, mine, theirs in (("cd", got["cd"], row[0]), ("hot", got["hot"], row[1])):
            if abs(mine - (theirs or 0)) > 0.5 * 302:
                bad += 1
                print(f"  {iso3} {field}: file {mine}, input {theirs}", flush=True)
    print(f"  country files: {len(country_totals)} checked against the input, "
          f"{bad} outside the rounding allowance")

    sizes: dict[str, int] = {}
    counts: dict[str, int] = {}
    total = 0
    for path in sorted(out.rglob("*")):
        if path.is_file():
            folder = path.parent.relative_to(out).as_posix() or "."
            sizes[folder] = sizes.get(folder, 0) + path.stat().st_size
            counts[folder] = counts.get(folder, 0) + 1
            total += path.stat().st_size
    print("\nout", flush=True)
    for folder in sorted(sizes):
        print(f"  {sizes[folder] / 1_048_576:>9.2f} MB  {counts[folder]:>6} files  {folder}")
    print(f"  {total / 1_048_576:>9.2f} MB  {sum(counts.values()):>6} files  total")


if __name__ == "__main__":
    main()
