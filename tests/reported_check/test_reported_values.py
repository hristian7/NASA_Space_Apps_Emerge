"""Independent values read from the cited tables, not from the exporter."""
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads(Path(__file__).with_name("source_values.json").read_text())


@pytest.mark.parametrize("expected", FIXTURE["rows"], ids=lambda row: f"{row['country']}-{row['year']}")
def test_national_report_matches_source(expected):
    data = json.loads((ROOT / "web/public/data/reported" / f"{expected['country']}.json").read_text())
    national = next(series for series in data["series"] if series["kind"] == "national_report")
    actual = next(row for row in national["years"] if row["y"] == expected["year"])
    area = round(expected["acres"] * 0.40468564224, 1) if "acres" in expected else expected["burned_ha"]
    assert actual["fires"] == expected["fires"]
    assert actual["burned_ha"] == area
