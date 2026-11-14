"""Regenerates tests/expected/cell_id.json and tests/expected/bakeoff/truth_samples.json.

Standard library only. Reads the raw NASA CSV files and the gap-day list.
Usage: python tests/expected/make_expected.py [--data <data dir>] [--only cell|truth]
"""
import argparse
import csv
import json
import math
import os
from collections import Counter
from datetime import date
from decimal import Decimal
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def floor_frac(x):
    return math.floor(x)


def q25(lat_s, lon_s):
    """Cell rule of spec 4.3 evaluated in exact rational arithmetic."""
    lat = Fraction(lat_s)
    lon = Fraction(lon_s)
    lon = ((lon + 180) % 360) - 180
    row = floor_frac((90 - lat) / Fraction(1, 4))
    row = min(max(row, 0), 719)
    col = floor_frac((lon + 180) / Fraction(1, 4))
    cell = row * 1440 + col
    clat = 90 - (Fraction(row) + Fraction(1, 2)) * Fraction(1, 4)
    clon = -180 + (Fraction(col) + Fraction(1, 2)) * Fraction(1, 4)
    return row, col, cell, float(clat), float(clon)


CASES = [
    ("Sofia", "42.6977", "23.3219"),
    ("San Francisco", "37.7749", "-122.4194"),
    ("Equator and prime meridian", "0", "0"),
    ("Just south of equator, just west of meridian", "-0.0001", "-0.0001"),
    ("Just north of equator, just east of meridian", "0.0001", "0.0001"),
    ("North pole, lon 0", "90", "0"),
    ("North pole, lon -180", "90", "-180"),
    ("Just below north pole, last column", "89.9999", "179.9999"),
    ("South pole, lon 0 (clamped to row 719)", "-90", "0"),
    ("South pole, lon 180 (wraps to col 0)", "-90", "180"),
    ("Just above south pole", "-89.9999", "0"),
    ("Lon 180 wraps to -180", "0", "180"),
    ("Lon -180", "0", "-180"),
    ("Last column", "10", "179.9999"),
    ("Lon 180.0001 wraps to -179.9999", "10", "180.0001"),
    ("Lon 190 wraps to -170", "10", "190"),
    ("Lon -190 wraps to 170", "10", "-190"),
    ("Lat on a cell edge belongs to the cell south of it (row 191)", "42.25", "23.0"),
    ("Lat just north of the edge (row 190)", "42.2501", "23.0"),
    ("Lat just south of the edge (row 191)", "42.2499", "23.0"),
    ("Lon on a cell edge belongs to the cell east of it (col 813)", "42.0", "23.25"),
    ("Lon just west of the edge (col 812)", "42.0", "23.2499"),
    ("Lon just east of the edge (col 813)", "42.0", "23.2501"),
    ("Row 719 starts exactly at lat -89.75 (included)", "-89.75", "10"),
    ("Row 719, just south of -89.75", "-89.7501", "10"),
    ("Row 718, just north of -89.75", "-89.7499", "10"),
    ("Sydney, south and east", "-33.8688", "151.2093"),
    ("Cape Town, south and east", "-33.9249", "18.4241"),
    ("Buenos Aires, south and west", "-34.6037", "-58.3816"),
    ("Lima, south and west", "-12.0464", "-77.0428"),
    ("Honolulu, north and far west", "21.3069", "-157.8583"),
    ("Anchorage, high north and west", "61.2181", "-149.9003"),
    ("Tromso, high north and east", "69.6492", "18.9553"),
    ("A cell centre maps back to its own cell", "42.625", "23.375"),
]


def make_cell_id():
    out = []
    for name, la, lo in CASES:
        row, col, cell, clat, clon = q25(la, lo)
        out.append({
            "name": name,
            "lat": float(Fraction(la)),
            "lon": float(Fraction(lo)),
            "row": row,
            "col": col,
            "cell_id": cell,
            "center_lat": clat,
            "center_lon": clon,
        })
    doc = {
        "rule": "row = floor((90 - lat) / 0.25); col = floor((lon + 180) / 0.25); cell_id = row * 1440 + col. "
                "Longitude is first wrapped into [-180, 180). Latitude 90 gives row 0. Latitude -90 is clamped to row 719. "
                "Centre = (90 - (row + 0.5) * 0.25, -180 + (col + 0.5) * 0.25).",
        "cases": out,
    }
    with open(os.path.join(HERE, "cell_id.json"), "w") as f:
        json.dump(doc, f, indent=1)
        f.write("\n")
    print("cell_id cases:", len(out))


SAMPLES = [
    ("Bulgaria", 2014, 3),
    ("Bulgaria", 2020, 8),
    ("Bulgaria", 2022, 7),
    ("United_States", 2020, 9),
    ("United_States", 2022, 8),
]


def q25_from_cd(cy, cx):
    """q25 cell of a 0.01 degree cell, from its integer indices, exact."""
    row = (17999 - 2 * cy) // 50
    col = (2 * cx + 36001) // 50
    return min(max(row, 0), 719) * 1440 + col


def month_truth(data, country, year, month, gaps):
    path = os.path.join(data, "raw", "viirs-snpp", str(year), "viirs-snpp_%d_%s.csv" % (year, country))
    drops = Counter()
    pairs = set()
    hot_by_pair = Counter()
    float_vs_decimal = 0
    alt_pairs = set()
    with open(path, newline="") as f:
        rd = csv.DictReader(f)
        for r in rd:
            d = r["acq_date"]
            if int(d[5:7]) != month or int(d[0:4]) != year:
                continue
            drops["rows_in_month"] += 1
            if r["type"] != "0":
                drops["type_not_0"] += 1
                continue
            if r["confidence"] not in ("n", "h"):
                drops["confidence_low"] += 1
                continue
            try:
                lat = float(r["latitude"])
                lon = float(r["longitude"])
                frp = float(r["frp"])
            except ValueError:
                drops["unparseable"] += 1
                continue
            if not (math.isfinite(lat) and math.isfinite(lon) and math.isfinite(frp)):
                drops["not_finite"] += 1
                continue
            if frp < 0:
                drops["frp_negative"] += 1
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                drops["bad_coordinates"] += 1
                continue
            if d in gaps:
                drops["gap_day"] += 1
                continue
            cy = math.floor(lat * 100)
            cx = math.floor(lon * 100)
            if (math.floor(Decimal(r["latitude"]) * 100) != cy
                    or math.floor(Decimal(r["longitude"]) * 100) != cx):
                float_vs_decimal += 1
            alt_pairs.add((math.floor(Decimal(r["latitude"]) * 100), math.floor(Decimal(r["longitude"]) * 100), d))
            key = (cy, cx, d)
            pairs.add(key)
            hot_by_pair[key] += 1
    cd_cell = Counter()
    hot_cell = Counter()
    for (cy, cx, d), n in hot_by_pair.items():
        c = q25_from_cd(cy, cx)
        cd_cell[c] += 1
        hot_cell[c] += n
    total_cd = len(pairs)
    total_hot = sum(hot_by_pair.values())
    ranked = sorted(cd_cell, key=lambda c: (-cd_cell[c], c))
    ranked_hot = sorted(hot_cell, key=lambda c: (-hot_cell[c], c))
    top_cd = [{"cell": c, "cd": cd_cell[c], "hot": hot_cell[c]} for c in ranked[:3]]
    top_hot = [{"cell": c, "cd": cd_cell[c], "hot": hot_cell[c]} for c in ranked_hot[:3]]
    return {
        "country": country,
        "year": year,
        "month": month,
        "total_cd": total_cd,
        "total_hot": total_hot,
        "q25_cells_with_fire": len(cd_cell),
        "busiest_cell_by_cd": top_cd[0],
        "busiest_cell_by_hot": top_hot[0],
        "top3_cells_by_cd": top_cd,
        "top3_cells_by_hot": top_hot,
        "dropped": dict(drops),
        "rows_where_float_and_decimal_floor_differ": float_vs_decimal,
        "info_total_cd_if_exact_decimal_floor": len(alt_pairs),
    }


def make_truth(data):
    gaps = set()
    with open(os.path.join(ROOT, "pipeline", "bakeoff", "snpp_gap_days.csv"), newline="") as f:
        for r in csv.DictReader(f):
            gaps.add(r["day"].strip())
    out = []
    for country, y, m in SAMPLES:
        s = month_truth(data, country, y, m, gaps)
        print(country, y, m, s["total_cd"], s["total_hot"], s["busiest_cell_by_cd"])
        out.append(s)
    doc = {
        "source": "raw NASA S-NPP country CSV files, read with the csv module only",
        "rules": "type == 0; confidence in n, h; frp >= 0; finite coordinates inside the valid range; "
                 "days in snpp_gap_days.csv dropped; cy = floor(lat * 100), cx = floor(lon * 100) in double arithmetic; "
                 "cd = distinct (cy, cx, day); hot = number of kept rows; "
                 "q25 cell of a 0.01 degree cell by exact integer arithmetic on its centre.",
        "gap_days_count": len(gaps),
        "samples": out,
    }
    with open(os.path.join(HERE, "bakeoff", "truth_samples.json"), "w") as f:
        json.dump(doc, f, indent=1)
        f.write("\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(ROOT, "data"))
    ap.add_argument("--only", choices=["cell", "truth"])
    a = ap.parse_args()
    if a.only in (None, "cell"):
        make_cell_id()
    if a.only in (None, "truth"):
        make_truth(a.data)
