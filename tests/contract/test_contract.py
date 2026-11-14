"""Check the generated example files against docs/data-contract.md.

Every rule here is written out in that document. If a check fails, either the
export is wrong or the contract changed, and a contract change needs the
director's approval before this file moves.
"""

from __future__ import annotations

import calendar
import glob
import gzip
import json
import math
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "web" / "public" / "data"

SRC_LABELS = [
    "estimated_terra",
    "estimated_modis",
    "measured",
    "measured_calibrated",
    "provisional",
]
FLAG_LABELS = ["example", "partial_month", "snpp_gap_filled", "low_confidence"]

CELL_DEG = 0.25
GRID_COLS = 1440
GRID_ROWS = 720
TILE_DEG = 5
EARTH_RADIUS_KM = 6371.0088

FIRST_INDEX = 10          # November 2000
LAST_INDEX = 311          # December 2025
HARM_FIELDS = ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi", "frp")
SAT_FIELDS = ("terra", "aqua", "snpp", "noaa20", "noaa21")
POINT_FIELDS = ("type", "lat", "lon", "precision_radius_km")


# ---------------------------------------------------------------------------
# Helpers that restate the contract's own rules
# ---------------------------------------------------------------------------


def month_index(y: int, m: int) -> int:
    return (y - 2000) * 12 + (m - 1)


def expected_src(y: int, m: int) -> str:
    i = month_index(y, m)
    if i <= month_index(2002, 6):
        return "estimated_terra"
    if i <= month_index(2012, 1):
        return "estimated_modis"
    return "measured"


def cell_id_of(lat: float, lon: float) -> int:
    row = min(max(math.floor((90 - lat) / CELL_DEG), 0), GRID_ROWS - 1)
    col = min(max(math.floor((lon + 180) / CELL_DEG), 0), GRID_COLS - 1)
    return row * GRID_COLS + col


def half_diagonal_km(lat: float) -> float:
    height = EARTH_RADIUS_KM * CELL_DEG * (math.pi / 180)
    width = height * math.cos(math.radians(lat))
    return math.sqrt(height * height + width * width) / 2


def tile_key_of(lat: float, lon: float) -> str:
    lat0 = min(math.floor(lat / TILE_DEG) * TILE_DEG, 90 - TILE_DEG)
    return f"{int(lat0)}_{int(math.floor(lon / TILE_DEG) * TILE_DEG)}"


def is_whole(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def read_json(path: Path):
    return json.loads(path.read_text())


def read_gzip_json(path: Path):
    raw = path.read_bytes()
    assert raw[:2] == b"\x1f\x8b", f"{path.name} is not gzip"
    return json.loads(gzip.decompress(raw))


def check_point_head(rec: dict, where: str, expect_type: str) -> None:
    for field in POINT_FIELDS:
        assert field in rec, f"{where}: missing {field}"
    assert rec["type"] == expect_type, where
    assert -90 <= rec["lat"] <= 90, where
    assert -180 <= rec["lon"] <= 180, where
    assert rec["precision_radius_km"] > 0, where


def check_month_values(v: dict, y: int, m: int, where: str, cd_cap: int) -> None:
    """The harmonized block of one month, wherever it appears."""
    assert month_index(y, m) >= FIRST_INDEX, f"{where}: month before November 2000"
    assert month_index(y, m) <= LAST_INDEX, f"{where}: month after the data ends"
    for field in HARM_FIELDS:
        assert field in v, f"{where}: missing {field}"
        assert v[field] is not None, f"{where}: {field} is null inside coverage"
        assert is_whole(v[field]), f"{where}: {field} is not a whole number"
        assert v[field] >= 0, f"{where}: {field} is negative"
    assert v["hot_lo"] <= v["hot"] <= v["hot_hi"], f"{where}: hotspot range is wrong"
    assert v["cd_lo"] <= v["cd"] <= v["cd_hi"], f"{where}: fire-day range is wrong"
    assert v["cd_hi"] <= cd_cap, f"{where}: fire days exceed the days in the period"


# ---------------------------------------------------------------------------
# meta.json
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def meta() -> dict:
    return read_json(DATA / "meta.json")


def test_meta_shape(meta):
    assert meta["schema"] == "emerge-meta-1"
    assert meta["example"] is True
    assert meta["first_month"] == "2000-11"
    assert meta["last_month"] == "2025-12"
    assert meta["grid"] == {
        "cell_deg": 0.25, "rows": 720, "cols": 1440, "tile_deg": 5,
        "month_epoch": "2000-01",
    }
    assert list(meta["src_labels"]) == SRC_LABELS
    assert list(meta["flag_labels"]) == FLAG_LABELS
    assert meta["daily_window"]["days"] == 45
    assert meta["daily_window"]["min_compare_days"] == 8
    assert meta["daily_window"]["latest_day"] == "2025-12-31"
    for period in meta["src_periods"]:
        assert period["src"] in SRC_LABELS
    for nd in meta["no_data"]:
        assert nd["scope"] in ("global", "satellite")
        assert nd["sat"] in (None,) + SAT_FIELDS
        assert nd["reason"]
    assert meta["sources"], "meta.json must list its sources"


def test_meta_indexes_match_the_files(meta):
    assert meta["countries"] == sorted(
        p.stem for p in (DATA / "countries").glob("*.json")
    )
    assert meta["reported"] == sorted(
        p.stem for p in (DATA / "reported").glob("*.json")
    )
    assert meta["tiles"] == sorted(
        p.name[: -len(".json.gz")] for p in (DATA / "tiles").glob("*.json.gz")
    )
    assert meta["daily"] == sorted(
        p.name[: -len(".json.gz")] for p in (DATA / "daily").glob("*.json.gz")
    )
    assert meta["globe_years"] == sorted(
        int(p.stem) for p in (DATA / "globe").glob("*.json")
    )


# ---------------------------------------------------------------------------
# countries/<ISO3>.json
# ---------------------------------------------------------------------------

COUNTRY_FILES = sorted((DATA / "countries").glob("*.json"))
TILE_FILES = sorted((DATA / "tiles").glob("*.json.gz"))
DAILY_FILES = sorted((DATA / "daily").glob("*.json.gz"))
GLOBE_FILES = sorted((DATA / "globe").glob("*.json"))


def test_the_example_set_exists():
    assert [p.stem for p in COUNTRY_FILES] == ["BGR", "USA"]
    assert len(TILE_FILES) == 4
    assert len(DAILY_FILES) == 2
    assert len(GLOBE_FILES) == 1


@pytest.mark.parametrize("path", COUNTRY_FILES, ids=lambda p: p.stem)
def test_country_file(path: Path):
    doc = read_json(path)
    assert doc["schema"] == "emerge-country-1"
    assert doc["example"] is True
    assert doc["iso3"] == path.stem
    assert doc["name_key"] == f"country.{path.stem}"
    check_point_head(doc, path.name, "country")

    months = doc["months"]
    assert len(months) == LAST_INDEX - FIRST_INDEX + 1, "the series must have no gaps"
    for pos, rec in enumerate(months):
        where = f"{path.name} {rec['y']}-{rec['m']:02d}"
        assert month_index(rec["y"], rec["m"]) == FIRST_INDEX + pos, f"{where}: out of order"
        cap = calendar.monthrange(rec["y"], rec["m"])[1]
        # A country spans many cells, so its fire days may exceed the month's
        # days. The contract caps it at days x fire cells, which is at least
        # the measured value, so only the per-cell shape is checked here.
        check_month_values(rec, rec["y"], rec["m"], where, cd_cap=cap * 10 ** 5)

        assert rec["src"] in SRC_LABELS, where
        assert rec["src"] == expected_src(rec["y"], rec["m"]), f"{where}: wrong src label"
        assert isinstance(rec["flags"], list), where
        for flag in rec["flags"]:
            assert flag in FLAG_LABELS, f"{where}: unknown flag {flag}"
        if rec["src"].startswith("estimated"):
            assert "example" in rec["flags"], f"{where}: estimated months must be flagged"
        else:
            assert "example" not in rec["flags"], f"{where}: measured months are not examples"

        for sat in SAT_FIELDS:
            assert sat in rec, f"{where}: missing {sat}"
            if rec[sat] is not None:
                assert is_whole(rec[sat]), f"{where}: {sat} is not a whole number"
                assert rec[sat] >= 0, f"{where}: {sat} is negative"
        assert rec["noaa21"] is None, f"{where}: NOAA-21 is not in this data set"


def test_null_means_no_measurement_not_zero():
    """Rule 1 of the contract, on the one series that is null throughout."""
    doc = read_json(DATA / "countries" / "BGR.json")
    by_key = {(r["y"], r["m"]): r for r in doc["months"]}
    assert by_key[(2000, 11)]["aqua"] is None, "Aqua had not launched"
    assert by_key[(2002, 7)]["aqua"] is not None, "Aqua started in July 2002"
    assert by_key[(2011, 12)]["snpp"] is None, "S-NPP had not launched"
    assert by_key[(2012, 1)]["snpp"] is not None, "S-NPP started in January 2012"
    assert "partial_month" in by_key[(2012, 1)]["flags"]
    assert by_key[(2018, 3)]["noaa20"] is None, "NOAA-20 started in April 2018"
    assert by_key[(2018, 4)]["noaa20"] is not None


# ---------------------------------------------------------------------------
# reported/<ISO3>.json
# ---------------------------------------------------------------------------

VERIFIED_REPORTED = {
    ("BGR", 2024): {"fires": 133, "burned_ha": 44745},
    ("USA", 2024): {"fires": 64897, "burned_ha": None},
}


@pytest.mark.parametrize("path", sorted((DATA / "reported").glob("*.json")), ids=lambda p: p.stem)
def test_reported_file(path: Path):
    doc = read_json(path)
    assert doc["schema"] == "emerge-reported-1"
    assert doc["example"] is True
    assert doc["scope"] == "national"
    assert doc["units"] == {"fires": "count", "burned_ha": "hectares"}
    src = doc["source"]
    assert src["name"], "a reported file must name its source"
    lo, hi = src["covers"]
    assert lo < hi
    assert src["note"], "a reported file must carry its caveat"

    years = doc["years"]
    assert [r["y"] for r in years] == list(range(lo, hi + 1))
    for rec in years:
        want = VERIFIED_REPORTED.get((path.stem, rec["y"]))
        if want is None:
            assert rec["fires"] is None, f"{path.stem} {rec['y']}: invented a fire count"
            assert rec["burned_ha"] is None, f"{path.stem} {rec['y']}: invented a burned area"
        else:
            assert rec["fires"] == want["fires"]
            assert rec["burned_ha"] == want["burned_ha"]
        for field in ("fires", "burned_ha"):
            if rec[field] is not None:
                assert is_whole(rec[field]) and rec[field] >= 0


# ---------------------------------------------------------------------------
# tiles/<key>.json.gz
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", TILE_FILES, ids=lambda p: p.name)
def test_tile_file(path: Path):
    key = path.name[: -len(".json.gz")]
    doc = read_gzip_json(path)
    assert doc["schema"] == "emerge-tile-1"
    assert doc["example"] is True
    assert doc["type"] == "cell"
    assert doc["cell_deg"] == CELL_DEG
    assert doc["src_labels"] == SRC_LABELS
    assert doc["flag_labels"] == FLAG_LABELS
    assert doc["tile"] == {
        "lat0": int(key.split("_")[0]), "lon0": int(key.split("_")[1]), "deg": TILE_DEG,
    }

    cells = doc["cells"]
    assert cells, f"{path.name} has no cells"
    assert [c["id"] for c in cells] == sorted(c["id"] for c in cells)
    seen_min, seen_max = LAST_INDEX, FIRST_INDEX

    arrays = ("hot", "hot_lo", "hot_hi", "cd", "cd_lo", "cd_hi", "frp", "src", "flags")
    for cell in cells:
        where = f"{path.name} cell {cell['id']}"
        check_point_head(cell, where, "cell")
        assert cell["id"] == cell_id_of(cell["lat"], cell["lon"]), f"{where}: cell id does not match lat/lon"
        assert tile_key_of(cell["lat"], cell["lon"]) == key, f"{where}: cell is in the wrong tile"
        want = half_diagonal_km(cell["lat"])
        assert abs(cell["precision_radius_km"] - want) <= 0.01 * want, f"{where}: precision radius off"

        n = len(cell["mi"])
        assert n > 0, where
        assert cell["mi"] == sorted(cell["mi"]), f"{where}: months out of order"
        assert len(set(cell["mi"])) == n, f"{where}: a month is listed twice"
        for name in arrays:
            assert len(cell[name]) == n, f"{where}: {name} has the wrong length"

        for pos, mi in enumerate(cell["mi"]):
            assert FIRST_INDEX <= mi <= LAST_INDEX, f"{where}: month index {mi} outside the record"
            y = 2000 + mi // 12
            m = mi - (y - 2000) * 12 + 1
            cap = calendar.monthrange(y, m)[1]
            values = {name: cell[name][pos] for name in HARM_FIELDS}
            values.update({"y": y, "m": m})
            check_month_values(values, y, m, f"{where} {y}-{m:02d}", cd_cap=cap)

            src_i = cell["src"][pos]
            assert 0 <= src_i < len(SRC_LABELS), where
            assert SRC_LABELS[src_i] == expected_src(y, m), f"{where} {y}-{m:02d}: wrong src label"
            bits = cell["flags"][pos]
            assert is_whole(bits) and 0 <= bits < (1 << len(FLAG_LABELS)), where
            example_bit = 1 << FLAG_LABELS.index("example")
            if SRC_LABELS[src_i].startswith("estimated"):
                assert bits & example_bit, f"{where} {y}-{m:02d}: estimated months must be flagged"
            else:
                assert not bits & example_bit, f"{where} {y}-{m:02d}: measured months are not examples"

            seen_min = min(seen_min, mi)
            seen_max = max(seen_max, mi)

    assert doc["months"] == {"first": seen_min, "last": seen_max}


def test_bulgaria_is_fully_covered_by_its_tiles():
    """Bulgaria's extent, 41.2 to 44.2 north and 22.3 to 28.6 east."""
    keys = {p.name[: -len(".json.gz")] for p in TILE_FILES}
    for lat in (41.2, 42.5, 44.2):
        for lon in (22.3, 25.0, 28.6):
            assert tile_key_of(lat, lon) in keys, f"no tile covers {lat},{lon}"


# ---------------------------------------------------------------------------
# globe/<year>.json
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", GLOBE_FILES, ids=lambda p: p.name)
def test_globe_file(path: Path):
    doc = read_json(path)
    assert doc["schema"] == "emerge-globe-1"
    assert doc["example"] is True
    assert doc["type"] == "cell"
    assert doc["year"] == int(path.stem)
    assert doc["src_labels"] == SRC_LABELS
    cols = doc["cols"]
    n = doc["n"]
    for name, values in cols.items():
        assert len(values) == n, f"{path.name}: column {name} has the wrong length"
    assert cols["id"] == sorted(cols["id"])
    cap = 366 if calendar.isleap(doc["year"]) else 365

    for i in range(n):
        where = f"{path.name} cell {cols['id'][i]}"
        head = {name: cols[name][i] for name in ("lat", "lon", "precision_radius_km")}
        head["type"] = doc["type"]
        check_point_head(head, where, "cell")
        assert cols["id"][i] == cell_id_of(head["lat"], head["lon"]), f"{where}: cell id does not match lat/lon"
        want = half_diagonal_km(head["lat"])
        assert abs(head["precision_radius_km"] - want) <= 0.01 * want, f"{where}: precision radius off"
        for field in HARM_FIELDS:
            v = cols[field][i]
            assert is_whole(v) and v >= 0, f"{where}: {field} must be a whole number, 0 or more"
        assert cols["hot_lo"][i] <= cols["hot"][i] <= cols["hot_hi"][i], where
        assert cols["cd_lo"][i] <= cols["cd"][i] <= cols["cd_hi"][i], where
        assert cols["cd_hi"][i] <= cap, f"{where}: fire days exceed the days in the year"
        assert 0 <= cols["src"][i] < len(SRC_LABELS), where
        assert 0 <= cols["flags"][i] < (1 << len(FLAG_LABELS)), where


# ---------------------------------------------------------------------------
# daily/<key>.json.gz
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", DAILY_FILES, ids=lambda p: p.name)
def test_daily_file(path: Path):
    key = path.name[: -len(".json.gz")]
    doc = read_gzip_json(path)
    assert doc["schema"] == "emerge-daily-1"
    assert doc["example"] is True
    assert doc["type"] == "cell"
    assert doc["src_labels"] == SRC_LABELS
    window = doc["window"]
    assert window["days"] == 45
    assert window["latest_day"] == "2025-12-31"
    assert window["start_md"] == "11-17"
    assert window["end_md"] == "12-31"
    assert window["wraps_year"] is False
    assert doc["years"] == list(range(2000, 2026))

    cells = doc["cells"]
    assert cells, f"{path.name} has no cells"
    assert [c["id"] for c in cells] == sorted(c["id"] for c in cells)
    for cell in cells:
        where = f"{path.name} cell {cell['id']}"
        check_point_head(cell, where, "cell")
        assert cell["id"] == cell_id_of(cell["lat"], cell["lon"]), f"{where}: cell id does not match lat/lon"
        assert tile_key_of(cell["lat"], cell["lon"]) == key, f"{where}: cell is in the wrong tile"
        want = half_diagonal_km(cell["lat"])
        assert abs(cell["precision_radius_km"] - want) <= 0.01 * want, f"{where}: precision radius off"

        blocks = cell["years"]
        assert blocks, f"{where}: a listed cell must have at least one year"
        assert [b["y"] for b in blocks] == sorted(b["y"] for b in blocks)
        for block in blocks:
            w2 = f"{where} {block['y']}"
            assert block["y"] in doc["years"], w2
            assert 0 <= block["src"] < len(SRC_LABELS), w2
            assert SRC_LABELS[block["src"]] == expected_src(block["y"], 12), f"{w2}: wrong src label"
            assert 0 <= block["flags"] < (1 << len(FLAG_LABELS)), w2
            n = len(block["d"])
            assert n > 0, w2
            assert len(block["hot"]) == n and len(block["frp"]) == n, w2
            assert block["d"] == sorted(block["d"]), f"{w2}: days out of order"
            assert len(set(block["d"])) == n, f"{w2}: a day is listed twice"
            for pos in range(n):
                assert 0 <= block["d"][pos] < window["days"], f"{w2}: day offset outside the window"
                assert is_whole(block["hot"][pos]) and block["hot"][pos] >= 1, f"{w2}: only fire days are listed"
                assert is_whole(block["frp"][pos]) and block["frp"][pos] >= 0, w2


# ---------------------------------------------------------------------------
# validation.json
# ---------------------------------------------------------------------------


def test_validation_file_has_everything_the_proof_page_needs():
    doc = read_json(DATA / "validation.json")
    assert doc["schema"] == "emerge-validation-1"
    assert doc["example"] is True
    for section in ("method", "holdout", "slices", "satellite_agreement",
                    "published_ratios", "range_coverage", "chance_of_fire",
                    "control_totals", "limits"):
        assert section in doc, f"validation.json is missing {section}"
        assert doc[section], f"validation.json: {section} is empty"

    assert doc["method"]["grid_deg"] == CELL_DEG
    assert doc["method"]["time_step"] == "month"

    for entry in doc["holdout"]:
        assert entry["direction"] in ("forward", "reverse")
        assert entry["unit"] in ("hot", "cd")
        assert entry["scope"] in ("country_month", "cell_month", "circle_month")
        for field in ("n", "nrmse", "mae", "bias_pct", "r", "slope"):
            assert field in entry
    for entry in doc["slices"]:
        assert entry["slice"] in ("country", "month", "latitude_band", "year", "fire_size")
        assert entry["key"]
    for entry in doc["satellite_agreement"]:
        assert entry["pair"] and "diff_pct" in entry
    for entry in doc["published_ratios"]:
        assert entry["scope"] and "ours" in entry and "published" in entry
    for entry in doc["range_coverage"]:
        assert entry["level_pct"] == 90 and "observed_pct" in entry
    assert len(doc["chance_of_fire"]["reliability"]) == 10
    for entry in doc["control_totals"]:
        assert entry["check"] and entry["passed"] in (True, False, None)
    for entry in doc["limits"]:
        assert entry["id"] and len(entry["text"]) > 20, "a limit must be a real sentence"


# ---------------------------------------------------------------------------
# Control total against the source table
# ---------------------------------------------------------------------------

CONTROL_MONTHS = [(2019, 7), (2021, 8), (2024, 8)]
PARQUET_TAIL = Path("derived") / "bg_us" / "cell_days.parquet"


def find_parquet() -> Path:
    import os

    env = os.environ.get("EMERGE_DATA")
    if env:
        candidate = Path(env) / PARQUET_TAIL
        if candidate.is_file():
            return candidate
    candidate = REPO / "data" / PARQUET_TAIL
    if candidate.is_file():
        return candidate
    # The shared data folder is kept outside the working copy, so look for it
    # beside the repository without naming any machine path.
    for ancestor in list(REPO.parents)[:3]:
        hits = sorted(glob.glob(str(ancestor / "*" / "data" / PARQUET_TAIL)))
        if hits:
            return Path(hits[0])
    raise AssertionError(
        "cell-day table not found. Set EMERGE_DATA to the folder holding "
        f"{PARQUET_TAIL}, so the control total can run."
    )


def test_raw_satellite_counts_match_a_direct_count():
    """V-M125 in miniature: the exported raw series must equal the source.

    The export reaches these numbers through the 0.25 degree cell table. This
    check counts straight from the source rows instead, so the two paths have
    to agree.
    """
    import duckdb

    parquet = find_parquet()
    doc = read_json(DATA / "countries" / "BGR.json")
    by_key = {(r["y"], r["m"]): r for r in doc["months"]}

    con = duckdb.connect()
    rows = con.execute(
        """
        SELECT year(day)::INT, month(day)::INT, sat, sum(detections)::BIGINT
        FROM read_parquet($parquet)
        WHERE country = 'Bulgaria'
        GROUP BY 1, 2, 3
        """,
        {"parquet": str(parquet)},
    ).fetchall()
    direct: dict[tuple[int, int], dict[str, int]] = {}
    for y, m, sat, n in rows:
        direct.setdefault((y, m), {})[sat.lower()] = int(n)

    checked = 0
    for y, m in CONTROL_MONTHS:
        want = direct[(y, m)]
        rec = by_key[(y, m)]
        for sat in ("terra", "aqua", "snpp", "noaa20"):
            assert rec[sat] == want.get(sat, 0), (
                f"BGR {y}-{m:02d} {sat}: file has {rec[sat]}, source has {want.get(sat, 0)}"
            )
            checked += 1
        assert rec["noaa21"] is None and "noaa21" not in want
        # From February 2012 the harmonized hotspots are the measured S-NPP
        # count, so the control total reaches the harmonized series too.
        assert rec["hot"] == want.get("snpp", 0), f"BGR {y}-{m:02d}: hot is not the measured S-NPP count"
    assert checked == len(CONTROL_MONTHS) * 4

    # And nowhere in the whole series may a null hide a real count.
    for (y, m), rec in by_key.items():
        want = direct.get((y, m), {})
        for sat in ("terra", "aqua", "snpp", "noaa20", "noaa21"):
            if rec[sat] is None:
                assert want.get(sat, 0) == 0, (
                    f"BGR {y}-{m:02d} {sat}: the file says no measurement, "
                    f"the source has {want.get(sat)}"
                )
