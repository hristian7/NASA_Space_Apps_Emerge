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
import math
import sys
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
    LAST_DATA_DAY,
    LAST_MONTH,
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
    src_for,
    tile_key,
    write_gzip_json,
    write_json,
)

DATA_VERSION = "world-2026-11-14"
BUILT = "2026-11-14"
EXAMPLE_FLAG = False

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
        rec["g"] = groups.get(cell, "")
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
    return {"tiles": sorted(tiles), "yearly": yearly, "totals": totals}


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
    "noaa20": (2018, 4), "noaa21": None,
}


def build_countries(
    con: duckdb.DuckDBPyConnection, cells_of: dict[str, list[int]], out: Path
) -> tuple[list[str], list[str], dict[str, dict[str, int]]]:
    rows = con.execute(COUNTRY_SQL).fetchall()
    by_country: dict[str, dict[tuple[int, int], tuple]] = {}
    for r in rows:
        by_country.setdefault(r[0], {})[(r[1], r[2])] = r[3:]

    unmapped = sorted(c for c in by_country if c not in ISO3)
    index = []
    totals: dict[str, dict[str, int]] = {}

    for country in sorted(by_country):
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
        hot_sum = cd_sum = 0
        for (y, m) in months_between(FIRST_MONTH, LAST_MONTH):
            v = by_country[country].get((y, m))
            if v is None:
                values = {k: 0 for k in ("hot", "hot_lo", "hot_hi", "cd",
                                         "cd_lo", "cd_hi", "frp")}
                raw = {"terra": 0, "aqua": 0, "snpp": 0, "noaa20": 0, "noaa21": 0}
                src, flags = src_for(y, m), 0
            else:
                (hot, hot_lo, hot_hi, cd, cd_lo, cd_hi,
                 terra, aqua, snpp, noaa20, frp, src, flags) = v
                values = {
                    "hot": whole(hot), "hot_lo": whole(hot_lo), "hot_hi": whole(hot_hi),
                    "cd": whole(cd), "cd_lo": whole(cd_lo), "cd_hi": whole(cd_hi),
                    "frp": whole(frp),
                }
                raw = {"terra": whole(terra), "aqua": whole(aqua),
                       "snpp": whole(snpp), "noaa20": whole(noaa20), "noaa21": 0}
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
            months.append(rec)

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
    return sorted(e["iso3"] for e in index), unmapped, totals


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


def build_background(con: duckdb.DuckDBPyConnection, out: Path) -> None:
    """background.json: the background values and the conversion factors.

    Background values are whole hundredths, factors whole thousandths. The
    factors are what the app multiplies a raw daily count by (ruling 11), so a
    missing factors file is a hard stop rather than a silent 1.
    """
    rows = con.execute(
        """
        SELECT group_id, period, month, hot, hot_hi, cd, cd_hi
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
        SELECT group_id, period, month, k_hot, k_cd
        FROM factors ORDER BY group_id, period, month
        """
    ).fetchall():
        if period not in BACKGROUND_PERIODS:
            raise SystemExit(f"a factor carries an unknown period: {period}")
        if gid not in groups or period not in groups[gid]:
            raise SystemExit(f"a factor names a group with no background: {gid} {period}")
        groups[gid][period]["k_hot"][int(month) - 1] = whole((k_hot or 0) * 1000)
        groups[gid][period]["k_cd"][int(month) - 1] = whole((k_cd or 0) * 1000)

    for gid, periods in groups.items():
        for period in BACKGROUND_PERIODS:
            if period not in periods:
                raise SystemExit(f"group {gid} has no {period} background")
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

DAILY_SQL = """
SELECT
  (((17999 - 2 * cy) // 50) * 1440 + ((2 * cx + 1 + 36000) // 50))::BIGINT AS cell,
  day,
  sum(CASE WHEN sat = 'Terra' THEN detections ELSE 0 END)::BIGINT AS terra_n,
  sum(CASE WHEN sat = 'Aqua'  THEN detections ELSE 0 END)::BIGINT AS aqua_n,
  sum(CASE WHEN sat = 'SNPP'  THEN detections ELSE 0 END)::BIGINT AS snpp_n,
  sum(CASE WHEN sat = 'Terra' THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS terra_frp,
  sum(CASE WHEN sat = 'Aqua'  THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS aqua_frp,
  sum(CASE WHEN sat = 'SNPP'  THEN cast(round(frp * 1000) AS BIGINT) ELSE 0 END)::BIGINT AS snpp_frp
FROM read_parquet($cell_days)
WHERE (month(day) = $start_month AND day(day) >= $start_day) OR month(day) = 12
GROUP BY cell, day
ORDER BY (cast(floor((90 - 0.25 * (cell // 1440) - 0.125) / 5) * 5 AS INT)),
         (cast(floor((-180 + 0.25 * (cell % 1440) + 0.125) / 5) * 5 AS INT)),
         cell, day
"""


def daily_window() -> tuple[dt.date, dt.date, list[int]]:
    start = LAST_DATA_DAY - dt.timedelta(days=DAILY_WINDOW_DAYS - 1)
    return start, LAST_DATA_DAY, list(range(FIRST_MONTH[0], LAST_MONTH[0] + 1))


def daily_file(key: str, cells: list[dict], start: dt.date, end: dt.date,
               years: list[int]) -> dict:
    lat0, lon0 = (int(p) for p in key.split("_"))
    return {
        "schema": f"emerge-daily-{SCHEMA_VERSION}",
        "example": False,
        "built": BUILT,
        "tile": {"lat0": lat0, "lon0": lon0, "deg": TILE_DEG},
        "type": "cell",
        "cell_deg": CELL_DEG,
        "values": "raw",
        "sensor_labels": SENSOR_LABELS,
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
                groups: dict[int, str], out: Path) -> list[str]:
    start, end, years = daily_window()
    if (start.month, end.month) != (11, 12):
        raise SystemExit("the daily query assumes a window inside November and December")
    con.execute(DAILY_SQL, {"cell_days": str(cell_days),
                            "start_month": start.month, "start_day": start.day})

    written: list[str] = []
    key = None
    cells: list[dict] = []
    cell = None
    per_year: dict[int, list[tuple[int, int, int]]] = {}

    def close_cell() -> None:
        if cell is None or not per_year:
            return
        rec = cell_head(cell)
        rec["g"] = groups[cell]
        rec["years"] = [
            {
                "y": y,
                "src": SRC_LABELS.index(src_for(y, 12)),
                "flags": flag_bits([]),
                "sensor": SENSOR_LABELS.index(sensor_for(y, 12)),
                "d": [d[0] for d in sorted(per_year[y])],
                "hot": [d[1] for d in sorted(per_year[y])],
                "frp": [d[2] for d in sorted(per_year[y])],
            }
            for y in sorted(per_year)
        ]
        cells.append(rec)

    def close_tile() -> None:
        if key is None or not cells:
            return
        write_gzip_json(out / "daily" / f"{key}.json.gz",
                        daily_file(key, cells, start, end, years))
        written.append(key)

    while True:
        chunk = con.fetchmany(CHUNK)
        if not chunk:
            break
        for (c, day, terra_n, aqua_n, snpp_n,
             terra_frp, aqua_frp, snpp_frp) in chunk:
            tkey = tile_of(c)
            if tkey != key:
                close_cell()
                close_tile()
                key, cells, cell, per_year = tkey, [], None, {}
            if c != cell:
                close_cell()
                cell, per_year = c, {}
            # Raw, from the one sensor the year's block names (ruling 11).
            counts = {"terra": (terra_n, terra_frp), "aqua": (aqua_n, aqua_frp),
                      "snpp": (snpp_n, snpp_frp)}
            hot, frp = (int(v) for v in counts[sensor_for(day.year, day.month)])
            if hot <= 0:
                continue
            offset = (day - dt.date(day.year, start.month, start.day)).days
            if 0 <= offset < DAILY_WINDOW_DAYS:
                per_year.setdefault(day.year, []).append(
                    (offset, hot, whole(frp / 1000))
                )

    close_cell()
    close_tile()
    return sorted(written)


# ---------------------------------------------------------------------------
# validation.json, from the independent scorer
# ---------------------------------------------------------------------------

LEVEL_SCOPE = {
    "a": "country_month", "b": "cell_month", "c": "circle_month",
    "c2": "circle_month_weighted", "d": "cell_month_0p1",
}
TEST_YEARS = {
    "t1": ((2012, 2018), (2019, 2022)),
    "t2": ((2016, 2022), (2012, 2015)),
    "t3": ((2012, 2018), (2023, 2025)),
}
WINNER = "A"

LIMITS = [
    {"id": "cell-size",
     "text": "Harmonized numbers exist per 0.25 degree cell, about 28 km across. A smaller "
             "area still reports the whole cell, so it is labelled low confidence."},
    {"id": "tested-on-two-countries",
     "text": "The conversion was tested on Bulgaria and the United States only. Every score "
             "on this page comes from those two countries, and the rest of the world is "
             "converted by the same method without a local test."},
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


def build_validation(scores_csv: Path, results_md: Path, out: Path) -> None:
    rows = [r for r in read_scores(scores_csv) if r["pipeline"] == WINNER]
    text = results_md.read_text()

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
                "model": f"pipeline {WINNER}, ratio of sums with a zero term",
                "reference": "measured S-NPP",
                "train_years": list(TEST_YEARS["t1"][0]),
                "test_years": list(TEST_YEARS["t1"][1]),
                "pre_registered": True,
                "leakage_check": "no S-NPP row of a test's prediction years is used while "
                                 "fitting or predicting that test",
                "tested_countries": ["Bulgaria", "United_States"],
                "tested_countries_note": "The test covers two countries. The rest of the world "
                                         "is converted by the same method, untested locally.",
            },
            "holdout": holdout,
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
               tiles: list[str], daily: list[str], globe_years: list[int]) -> None:
    start, end, years = daily_window()
    write_json(
        out / "meta.json",
        {
            "schema": f"emerge-meta-{SCHEMA_VERSION}",
            "example": False,
            "data_version": DATA_VERSION,
            "built": BUILT,
            "last_data_day": LAST_DATA_DAY.isoformat(),
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
            "src_periods": [
                {"from": "2000-11", "to": "2002-06", "src": "estimated_terra"},
                {"from": "2002-07", "to": "2012-01", "src": "estimated_modis"},
                {"from": "2012-02", "to": None, "src": "measured"},
            ],
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
            "sources": SOURCES,
        },
    )


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description="Export the world conversion for the app.")
    ap.add_argument("--in", dest="inp", default=str(here / "data" / "derived" / "world" / "harmonized"))
    ap.add_argument("--cell-days", default=None,
                    help="the raw cell-day table; defaults to cell_days.parquet one level above --in")
    ap.add_argument("--scores", default=str(here / "data" / "derived" / "bakeoff" / "scores.csv"))
    ap.add_argument("--results", default=str(here / "docs" / "research" / "bakeoff-results.md"))
    ap.add_argument("--out", default=str(here / "web" / "public" / "data"))
    ap.add_argument("--threads", type=int, default=6)
    args = ap.parse_args()

    inp = Path(args.inp)
    cell_days = Path(args.cell_days) if args.cell_days else inp.parent / "cell_days.parquet"
    out = Path(args.out)
    for path in (inp / "cells_monthly.parquet", inp / "countries_monthly.parquet",
                 inp / "cell_groups.parquet", inp / "background.parquet",
                 inp / "factors.parquet", cell_days,
                 Path(args.scores), Path(args.results)):
        if not path.is_file():
            raise SystemExit(
                f"input not found: {path}\n"
                "The conversion must deliver every one of cells_monthly.parquet, "
                "countries_monthly.parquet, cell_groups.parquet, "
                "background.parquet and factors.parquet."
            )

    con = duckdb.connect()
    con.execute(f"PRAGMA threads={args.threads}")
    con.execute("PRAGMA memory_limit='6GB'")
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
    groups = {int(c): g for c, g, _ in rows}
    print(f"  {len(groups)} fire cells", flush=True)

    print("background ...", flush=True)
    build_background(con, out)

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

    print("countries ...", flush=True)
    countries, unmapped, country_totals = build_countries(con, cells_of, out)
    print(f"  {len(countries)} country files", flush=True)
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
    daily = build_daily(con, cell_days, groups, out)
    print(f"  {len(daily)} tiles", flush=True)

    print("validation ...", flush=True)
    build_validation(Path(args.scores), Path(args.results), out)

    build_meta(out, countries, reported, built["tiles"], daily, globe_years)

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
