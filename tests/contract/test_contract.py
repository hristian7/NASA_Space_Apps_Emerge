"""Check the generated example files against docs/data-contract.md.

Every rule here is written out in that document. If a check fails, either the
export is wrong or the contract changed, and a contract change needs the
director's approval before this file moves.
"""

from __future__ import annotations

import csv
import glob
import os
import gzip
import json
import math
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]

# The example set by default. Point EMERGE_OUT at another export, such as the
# world one, to check that against the same contract. The checks that only make
# sense for the two-country example set are skipped when the set says it is not
# an example.
DATA = Path(os.environ.get("EMERGE_OUT") or (REPO / "web" / "public" / "data"))
IS_EXAMPLE = json.loads((DATA / "meta.json").read_text())["example"]
example_only = pytest.mark.skipif(
    not IS_EXAMPLE, reason="only the two-country example set has this"
)

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


def cell_center(cell_id: int) -> tuple[float, float]:
    row, col = divmod(cell_id, GRID_COLS)
    return (90 - CELL_DEG * row - CELL_DEG / 2, -180 + CELL_DEG * col + CELL_DEG / 2)


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


def check_month_values(v: dict, y: int, m: int, where: str) -> None:
    """The harmonized block of one month, wherever it appears.

    No ceiling is asserted on cd. A fire day is a (0.01 degree cell, day) pair,
    and a 0.25 degree cell holds 625 small cells, so a monthly cd can run into
    the thousands.
    """
    assert month_index(y, m) >= FIRST_INDEX, f"{where}: month before November 2000"
    assert month_index(y, m) <= LAST_INDEX, f"{where}: month after the data ends"
    for field in HARM_FIELDS:
        assert field in v, f"{where}: missing {field}"
        assert v[field] is not None, f"{where}: {field} is null inside coverage"
        assert is_whole(v[field]), f"{where}: {field} is not a whole number"
        assert v[field] >= 0, f"{where}: {field} is negative"
    assert v["hot_lo"] <= v["hot"] <= v["hot_hi"], f"{where}: hotspot range is wrong"
    assert v["cd_lo"] <= v["cd"] <= v["cd_hi"], f"{where}: fire-day range is wrong"


# ---------------------------------------------------------------------------
# meta.json
# ---------------------------------------------------------------------------


SENSOR_LABELS = ["modis", "viirs"]
BACKGROUND_PERIODS = ["estimated_terra", "estimated_modis"]
BACKGROUND_UNITS = ["hot", "hot_hi", "cd", "cd_hi"]
BACKGROUND_GROUPS = set(read_json(DATA / "background.json")["groups"])


@pytest.fixture(scope="module")
def meta() -> dict:
    return read_json(DATA / "meta.json")


def test_meta_shape(meta):
    assert meta["schema"] == "emerge-meta-1"
    assert meta["example"] is IS_EXAMPLE
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
    assert meta["daily_window"]["values"] == "raw"
    for period in meta["src_periods"]:
        assert period["src"] in SRC_LABELS
    for nd in meta["no_data"]:
        assert nd["scope"] in ("global", "satellite")
        assert nd["sat"] in (None,) + SAT_FIELDS
        assert nd["reason"]
    assert meta["sources"], "meta.json must list its sources"


def test_meta_indexes_match_the_files(meta):
    assert meta["countries"] == sorted(
        p.stem for p in (DATA / "countries").glob("*.json") if p.stem != "index"
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
        int(p.name[: -len(".json.gz")]) for p in (DATA / "globe").glob("*.json.gz")
    )


# ---------------------------------------------------------------------------
# countries/<ISO3>.json
# ---------------------------------------------------------------------------

COUNTRY_FILES = sorted(
    p for p in (DATA / "countries").glob("*.json") if p.stem != "index"
)
TILE_FILES = sorted((DATA / "tiles").glob("*.json.gz"))
DAILY_FILES = sorted((DATA / "daily").glob("*.json.gz"))
GLOBE_FILES = sorted((DATA / "globe").glob("*.json.gz"))


@example_only
def test_the_example_set_exists():
    assert [p.stem for p in COUNTRY_FILES] == ["BGR", "USA"]
    assert len(TILE_FILES) == 4
    assert len(DAILY_FILES) == 2
    assert len(GLOBE_FILES) == 1


@pytest.mark.parametrize("path", COUNTRY_FILES, ids=lambda p: p.stem)
def test_country_file(path: Path):
    doc = read_json(path)
    assert doc["schema"] == "emerge-country-1"
    assert doc["example"] is IS_EXAMPLE
    assert doc["iso3"] == path.stem
    assert doc["name_key"] == f"country.{path.stem}"
    check_point_head(doc, path.name, "country")

    months = doc["months"]
    assert len(months) == LAST_INDEX - FIRST_INDEX + 1, "the series must have no gaps"
    for pos, rec in enumerate(months):
        where = f"{path.name} {rec['y']}-{rec['m']:02d}"
        assert month_index(rec["y"], rec["m"]) == FIRST_INDEX + pos, f"{where}: out of order"
        check_month_values(rec, rec["y"], rec["m"], where)

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
    assert doc["example"] is True, (
        "the reported figures are the two verified ones and stay flagged as an "
        "example until the rest are fetched"
    )
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
    assert doc["example"] is IS_EXAMPLE
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

        assert isinstance(cell["g"], str) and cell["g"], f"{where}: missing group id"
        assert cell["g"] in BACKGROUND_GROUPS, f"{where}: group {cell['g']} is not in background.json"

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
            values = {name: cell[name][pos] for name in HARM_FIELDS}
            values.update({"y": y, "m": m})
            check_month_values(values, y, m, f"{where} {y}-{m:02d}")

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
    doc = read_gzip_json(path)
    assert doc["schema"] == "emerge-globe-1"
    assert doc["example"] is IS_EXAMPLE
    assert doc["type"] == "cell"
    assert doc["year"] == int(path.name[: -len(".json.gz")])
    assert doc["point_from_id"] is True
    assert doc["cell_deg"] == CELL_DEG
    cols = doc["cols"]
    assert list(cols) == ["id", "hot", "cd", "frp"], (
        "the globe layer is slim on purpose: id and values only"
    )
    n = doc["n"]
    for name, values in cols.items():
        assert len(values) == n, f"{path.name}: column {name} has the wrong length"
    assert cols["id"] == sorted(cols["id"])
    assert len(set(cols["id"])) == n, f"{path.name}: a cell is listed twice"

    for i in range(n):
        where = f"{path.name} cell {cols['id'][i]}"
        cell_id = cols["id"][i]
        assert 0 <= cell_id < GRID_ROWS * GRID_COLS, where
        # The point must be reachable from the id alone, which is why it is
        # not stored.
        lat, lon = cell_center(cell_id)
        assert -90 <= lat <= 90 and -180 <= lon <= 180, where
        assert cell_id == cell_id_of(lat, lon), f"{where}: id does not round-trip"
        for field in ("hot", "cd", "frp"):
            v = cols[field][i]
            assert is_whole(v) and v >= 0, f"{where}: {field} must be a whole number, 0 or more"


# ---------------------------------------------------------------------------
# daily/<key>.json.gz
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", DAILY_FILES, ids=lambda p: p.name)
def test_daily_file(path: Path):
    key = path.name[: -len(".json.gz")]
    doc = read_gzip_json(path)
    assert doc["schema"] == "emerge-daily-1"
    assert doc["example"] is IS_EXAMPLE
    assert doc["type"] == "cell"
    assert doc["src_labels"] == SRC_LABELS
    window = doc["window"]
    assert window["days"] == 45
    assert window["latest_day"] == "2025-12-31"
    assert window["start_md"] == "11-17"
    assert window["end_md"] == "12-31"
    assert window["wraps_year"] is False
    assert doc["values"] == "raw", "the daily files hold raw counts"
    assert doc["sensor_labels"] == SENSOR_LABELS
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
            want_sensor = "viirs" if block["y"] >= 2012 else "modis"
            assert SENSOR_LABELS[block["sensor"]] == want_sensor, f"{w2}: wrong sensor"
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
    assert doc["example"] is IS_EXAMPLE
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


# ---------------------------------------------------------------------------
# Control totals against the independent expected answers
# ---------------------------------------------------------------------------

EXPECTED = REPO / "tests" / "expected"
GAP_DAYS_CSV = REPO / "pipeline" / "bakeoff" / "snpp_gap_days.csv"
ISO3_OF = {"Bulgaria": "BGR", "United_States": "USA", "United States": "USA"}


def gap_months() -> set[tuple[int, int]]:
    """Months holding an S-NPP gap day, which the expected answers drop."""
    with GAP_DAYS_CSV.open() as fh:
        return {
            (int(row["day"][:4]), int(row["day"][5:7]))
            for row in csv.DictReader(fh)
        }


def truth_samples() -> list[dict]:
    doc = read_json(EXPECTED / "bakeoff" / "truth_samples.json")
    assert doc["gap_days_count"] == 34
    return doc["samples"]


@pytest.mark.parametrize(
    "sample",
    truth_samples(),
    ids=lambda s: f"{ISO3_OF[s['country']]}-{s['year']}-{s['month']:02d}",
)
def test_country_totals_match_the_independent_answers(sample: dict):
    """The measured series must equal an answer computed from the raw files.

    The expected answers were written by a separate agent from the raw CSV
    files, with no dataframe library and without the cell-day table, and they
    drop the S-NPP gap days. Our measured months agree with them on every
    sample, gap months included, so the two paths also agree on the gap rule.
    Nothing here is adjusted to match: a difference is a failure.
    """
    iso3 = ISO3_OF[sample["country"]]
    y, m = sample["year"], sample["month"]
    doc = read_json(DATA / "countries" / f"{iso3}.json")
    rec = {(r["y"], r["m"]): r for r in doc["months"]}[(y, m)]

    assert rec["src"] == "measured", (
        f"{iso3} {y}-{m:02d} is not a measured month, so it cannot be compared "
        "with a measured S-NPP answer"
    )
    assert rec["cd"] == sample["total_cd"], (
        f"{iso3} {y}-{m:02d} fire days: file has {rec['cd']}, "
        f"the expected answer has {sample['total_cd']}"
        + ("  (this month holds an S-NPP gap day)" if (y, m) in gap_months() else "")
    )
    assert rec["hot"] == sample["total_hot"], (
        f"{iso3} {y}-{m:02d} hotspots: file has {rec['hot']}, "
        f"the expected answer has {sample['total_hot']}"
        + ("  (this month holds an S-NPP gap day)" if (y, m) in gap_months() else "")
    )
    assert rec["snpp"] == sample["total_hot"], (
        f"{iso3} {y}-{m:02d}: the raw S-NPP series does not match either"
    )


def test_fire_days_are_not_capped_at_the_days_in_a_month():
    """cd counts 0.01 degree cell-days, so it has no 31-day ceiling."""
    doc = read_gzip_json(DATA / "tiles" / "35_-120.json.gz")
    big = [v for cell in doc["cells"] for v in cell["cd"] if v > 31]
    assert big, "no cell-month above 31 fire days: the old cap may be back"
    assert max(big) > 100

    if IS_EXAMPLE:
        # Section 3.1 of the contract cites this cell-month as its worked example.
        cell = next(c for c in doc["cells"] if c["id"] == 302642)
        pos = cell["mi"].index(248)  # September 2020
        assert cell["cd"][pos] == 2448
        assert cell["hot"][pos] == 10382


# ---------------------------------------------------------------------------
# background.json and countries/index.json
# ---------------------------------------------------------------------------


def test_background_file():
    doc = read_json(DATA / "background.json")
    assert doc["schema"] == "emerge-background-1"
    assert doc["example"] is IS_EXAMPLE
    assert doc["unit"] == "hundredths"
    assert doc["periods"] == BACKGROUND_PERIODS
    if doc["example"]:
        assert doc["note"], "a stand-in background must say so in the file"
    assert doc["groups"], "background.json has no groups"
    assert list(doc["groups"]) == sorted(doc["groups"]), "groups must be sorted"

    for gid, periods in doc["groups"].items():
        assert list(periods) == BACKGROUND_PERIODS, f"{gid}: wrong periods"
        for period, series in periods.items():
            where = f"{gid} {period}"
            assert list(series) == BACKGROUND_UNITS, f"{where}: wrong units"
            for unit, values in series.items():
                assert len(values) == 12, f"{where} {unit}: needs 12 months"
                for v in values:
                    assert is_whole(v), f"{where} {unit}: not a whole hundredth"
                    assert v >= 0, f"{where} {unit}: negative"
            for m in range(12):
                assert series["hot"][m] <= series["hot_hi"][m], f"{where}: hot above its upper end"
                assert series["cd"][m] <= series["cd_hi"][m], f"{where}: cd above its upper end"


@example_only
def test_every_background_group_is_used_by_a_tile():
    """No group may be listed that no cell points at, and none may be missing."""
    used = set()
    for path in TILE_FILES:
        for cell in read_gzip_json(path)["cells"]:
            used.add(cell["g"])
    assert used == BACKGROUND_GROUPS, (
        f"groups only in the tiles: {sorted(used - BACKGROUND_GROUPS)}; "
        f"groups only in background.json: {sorted(BACKGROUND_GROUPS - used)}"
    )


def test_the_daily_files_carry_no_group_id():
    """Ruling 10 is a monthly rule, so the daily files must not imply one."""
    for path in DAILY_FILES:
        for cell in read_gzip_json(path)["cells"]:
            assert "g" not in cell, f"{path.name}: a daily cell carries a group id"


def test_country_index():
    doc = read_json(DATA / "countries" / "index.json")
    assert doc["schema"] == "emerge-country-index-1"
    assert doc["example"] is IS_EXAMPLE
    entries = doc["countries"]
    assert [e["iso3"] for e in entries] == sorted(e["iso3"] for e in entries)
    assert [e["iso3"] for e in entries] == [p.stem for p in COUNTRY_FILES], (
        "the index must name exactly the country files that exist"
    )
    for e in entries:
        where = f"index {e['iso3']}"
        assert e["name"], where
        country = read_json(DATA / "countries" / f"{e['iso3']}.json")
        assert e["lat"] == country["lat"] and e["lon"] == country["lon"], (
            f"{where}: the point must match the country file"
        )
        west, south, east, north = e["bbox"]
        assert -90 <= south < north <= 90, f"{where}: latitudes out of order"
        for v in (west, east):
            assert -180 <= v <= 180, f"{where}: longitude outside the range"
        assert south <= e["lat"] <= north, f"{where}: the point is outside its own box"


@example_only
def test_the_country_box_holds_every_cell_of_that_country():
    """Including the case where the box crosses the 180 degree line."""
    boxes = {
        e["iso3"]: e["bbox"]
        for e in read_json(DATA / "countries" / "index.json")["countries"]
    }
    west, south, east, north = boxes["USA"]
    assert west > east, "the USA box is expected to cross the 180 degree line"

    for path in TILE_FILES:
        for cell in read_gzip_json(path)["cells"]:
            iso3 = cell["g"].split("_")[0]
            w, s, e, n = boxes[iso3]
            assert s <= cell["lat"] <= n, f"{iso3} cell {cell['id']} outside its box"
            inside = (cell["lon"] >= w or cell["lon"] <= e) if w > e else (w <= cell["lon"] <= e)
            assert inside, f"{iso3} cell {cell['id']} outside its box in longitude"
