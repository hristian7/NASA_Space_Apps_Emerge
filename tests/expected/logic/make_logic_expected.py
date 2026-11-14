"""Writes the expected answers for the app's number logic (docs/number-logic.md).

Plain Python plus numpy and scipy. Example data files are read with json and gzip only.
Output is deterministic: no dates, fixed order, floats rounded to 6 decimals.
Usage: python tests/expected/logic/make_logic_expected.py
"""
import gzip
import json
import math
import os
from datetime import date, timedelta
from fractions import Fraction

import numpy as np
from scipy.stats import beta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
DATA = os.path.join(ROOT, "web", "public", "data")
R_EARTH = 6371.0088
FLAG_LABELS = ["example", "partial_month", "snpp_gap_filled", "low_confidence"]


def r6(x):
    if x is None:
        return None
    v = round(float(x), 6)
    return 0.0 if v == 0 else v


def write(name, about, cases):
    path = os.path.join(HERE, name)
    with open(path, "w") as f:
        json.dump({"about": about, "cases": cases}, f, indent=1)
        f.write("\n")
    print("%-28s %d cases" % (name, len(cases)))


# ------------------------------------------------------------------ cells and weights

def cell_id_of(lat_s, lon_s):
    lat, lon = Fraction(str(lat_s)), Fraction(str(lon_s))
    lon = ((lon + 180) % 360) - 180
    row = min(max(math.floor((90 - lat) / Fraction(1, 4)), 0), 719)
    col = math.floor((lon + 180) / Fraction(1, 4))
    return row * 1440 + col


def cell_rc(cid):
    return cid // 1440, cid % 1440


def cell_centre(cid):
    row, col = cell_rc(cid)
    return 90 - 0.25 * row - 0.125, -180 + 0.25 * col + 0.125


def tile_key(lat, lon):
    lat0 = min(math.floor(lat / 5) * 5, 85)
    lon0 = math.floor(lon / 5) * 5
    return "%d_%d" % (lat0, lon0)


def subcentres(cid):
    row, col = cell_rc(cid)
    off = (np.arange(25) + 0.5) * 0.01
    lat = 90.0 - row * 0.25 - off
    lon = -180.0 + col * 0.25 + off
    la, lo = np.meshgrid(lat, lon, indexing="ij")
    return la.ravel(), lo.ravel()


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin((np.radians(lon2) - np.radians(lon1)) / 2) ** 2
    return 2 * R_EARTH * np.arcsin(np.sqrt(np.minimum(1.0, a)))


def candidate_cells(lat_lo, lat_hi, lon_lo, lon_hi):
    r0 = max(math.floor((90 - lat_hi) / 0.25) - 1, 0)
    r1 = min(math.floor((90 - lat_lo) / 0.25) + 1, 719)
    if lon_hi - lon_lo >= 360:
        cols = list(range(1440))
    else:
        c0 = math.floor((lon_lo + 180) / 0.25) - 1
        c1 = math.floor((lon_hi + 180) / 0.25) + 1
        cols = sorted(set(c % 1440 for c in range(c0, c1 + 1)))
    return [r * 1440 + c for r in range(r0, r1 + 1) for c in cols]


def point_counts(lat, lon, radius_km):
    dlat = radius_km / 111.19 + 0.01
    cosv = max(math.cos(math.radians(min(abs(lat) + dlat, 89.99))), 0.01)
    dlon = radius_km / (111.19 * cosv) + 0.01
    counts = {}
    for cid in candidate_cells(lat - dlat, lat + dlat, lon - dlon, lon + dlon):
        la, lo = subcentres(cid)
        k = int((haversine(lat, lon, la, lo) <= radius_km).sum())
        if k:
            counts[cid] = k
    return counts


def inside_ring(ring, lat, lon):
    inside = np.zeros(lat.shape, dtype=bool)
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        if y1 == y2:
            continue
        cond = (y1 > lat) != (y2 > lat)
        xint = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
        inside ^= cond & (lon < xint)
    return inside


def polygon_counts(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    counts = {}
    for cid in candidate_cells(min(ys), max(ys), min(xs), max(xs)):
        la, lo = subcentres(cid)
        k = int(inside_ring(ring, la, lo).sum())
        if k:
            counts[cid] = k
    return counts


def selection_weights(sel):
    """Returns (counts, raw_total_weight, low_confidence). counts are sub-cell counts (weight = count / 625)."""
    if sel["kind"] == "point":
        counts = point_counts(sel["lat"], sel["lon"], sel["radiusKm"])
        anchor = (sel["lat"], sel["lon"])
    else:
        counts = polygon_counts(sel["ring"])
        ring = sel["ring"]
        anchor = (sum(p[1] for p in ring) / len(ring), sum(p[0] for p in ring) / len(ring))
    raw = sum(counts.values()) / 625.0
    if sum(counts.values()) < 625:
        return {cell_id_of(anchor[0], anchor[1]): 625}, raw, True
    return counts, raw, False


def weights_expected(sel):
    counts, raw, low = selection_weights(sel)
    total = sum(counts.values()) / 625.0
    return {
        "cells": [{"id": c, "weight": r6(counts[c] / 625.0), "subcells": counts[c]} for c in sorted(counts)],
        "cellCount": len(counts),
        "totalWeight": r6(total),
        "rawTotalWeightBeforeSmallRule": r6(raw),
        "lowConfidence": low,
    }


def make_weights():
    P = lambda lat, lon, r: {"kind": "point", "lat": lat, "lon": lon, "radiusKm": r}
    cases = []

    def add(name, sel, note=None, extra=None):
        exp = weights_expected(sel)
        if extra:
            exp.update(extra)
        c = {"name": name, "input": sel, "expected": exp}
        if note:
            c["note"] = note
        cases.append(c)

    add("Sofia, 50 km", P(42.70, 23.32, 50))
    add("Sofia, 10 km", P(42.70, 23.32, 10))
    add("Sofia, 200 km", P(42.70, 23.32, 200))
    add("Sofia, radius 0 (small selection)", P(42.70, 23.32, 0))
    add("Radius 0 exactly on a sub-cell centre (inside or not, the small-selection result is the same)",
        P(42.705, 23.325, 0), "A centre exactly at the distance counts as inside, so one sub-cell may count; either way the total is below 1.")
    # find the radius where the circle total crosses 1 at 42.7 N
    below = above = None
    for r in range(8, 25):
        raw = sum(point_counts(42.70, 23.32, r).values()) / 625.0
        if raw < 1:
            below = r
        elif above is None:
            above = r
    add("Sofia, %d km: total below 1 even though several cells are touched" % below, P(42.70, 23.32, below),
        "The small-selection rule replaces the overlap weights with the single cell holding the point.")
    add("Sofia, %d km: first whole-km radius with total of 1 or more" % above, P(42.70, 23.32, above))
    add("Equator, 50 km", P(0.0, 10.0, 50))
    add("65 N, 50 km", P(65.0, 20.0, 50))
    add("0 N 179.9 E, 50 km (cells on both sides of the 180 degree line)", P(0.0, 179.9, 50))
    add("Point exactly on a cell corner, 5 km (small selection; the cell below and east of the point)", P(42.25, 23.25, 5),
        "Latitude 42.25 is the upper edge of the cell below it. Longitude 23.25 belongs to the cell east of it.")
    add("Point exactly on a cell corner, 30 km", P(42.25, 23.25, 30))
    add("Point on the 180 degree line, 5 km (small selection, column 0)", P(10.0, 180.0, 5))
    add("Small polygon inside one cell (4 sub-cells)",
        {"kind": "polygon", "ring": [[23.31, 42.66], [23.33, 42.66], [23.33, 42.68], [23.31, 42.68]]},
        "The vertex average is (23.32, 42.67), inside cell 272973. The ring is not repeated at its end.")
    add("Polygon covering several cells (square 23.0 to 23.5 E, 42.5 to 43.0 N)",
        {"kind": "polygon", "ring": [[23.0, 42.5], [23.5, 42.5], [23.5, 43.0], [23.0, 43.0]]},
        "Edges lie on sub-cell boundaries, never on sub-cell centres, so inside or not is not in doubt.")
    add("Triangle (even-odd rule)",
        {"kind": "polygon", "ring": [[23.0, 42.5], [24.0, 42.5], [23.5, 43.5]]})
    add("Polygon with a repeated closing vertex gives the same weights as the open ring",
        {"kind": "polygon", "ring": [[23.0, 42.5], [23.5, 42.5], [23.5, 43.0], [23.0, 43.0], [23.0, 42.5]]})
    add("Self-crossing bow tie (even-odd leaves the crossing halves apart)",
        {"kind": "polygon", "ring": [[23.0, 42.5], [23.5, 43.0], [23.5, 42.5], [23.0, 43.0]]})
    # data-contract section 11 keeps the point's own cell always; number-logic section 1 only under the small rule
    probes = [(42.7499, 23.2501), (42.25, 23.25), (0.0, 0.0), (65.0, 20.0), (10.0, 180.0), (42.70, 23.32)]
    held = []
    for (la, lo) in probes:
        for r in (14, 20, 50):
            cts, _, lowc = selection_weights(P(la, lo, r))
            held.append(cell_id_of(la, lo) in cts)
    cases.append({
        "name": "The cell holding the point is in the weighted set whenever the total is 1 or more",
        "input": {"probes": [[la, lo] for la, lo in probes], "radiiKm": [14, 20, 50]},
        "expected": {"ownCellAlwaysInSet": all(held), "probeCount": len(held)}})
    return cases


# ------------------------------------------------------------------ example data

_cache = {}


def load_json(rel):
    if rel not in _cache:
        path = os.path.join(DATA, rel)
        op = gzip.open if rel.endswith(".gz") else open
        with op(path, "rt") as f:
            _cache[rel] = json.load(f)
    return _cache[rel]


META = load_json("meta.json")
FIRST_MI = 10
LAST_MI = (int(META["last_month"][:4]) - 2000) * 12 + int(META["last_month"][5:]) - 1


def mi_ym(mi):
    return 2000 + mi // 12, mi % 12 + 1


def src_of(y, m):
    key = "%04d-%02d" % (y, m)
    for p in META["src_periods"]:
        if p["from"] <= key and (p["to"] is None or key <= p["to"]):
            return p["src"]
    raise ValueError(key)


def tile_cells(key):
    rel = "tiles/%s.json.gz" % key
    if not os.path.exists(os.path.join(DATA, rel)):
        return {}
    t = load_json(rel)
    out = {}
    for c in t["cells"]:
        out[c["id"]] = c
    return out


def flags_of(bits):
    return [FLAG_LABELS[i] for i in range(4) if bits & (1 << i)]


def build_series(counts, low):
    """Series for both units: dict unit -> list of month dicts, with exact x625 integers."""
    cells = {}
    for cid in counts:
        lat, lon = cell_centre(cid)
        cells[cid] = tile_cells(tile_key(lat, lon)).get(cid)
    out = {}
    for unit in ("hot", "cd"):
        months = []
        for mi in range(FIRST_MI, LAST_MI + 1):
            y, m = mi_ym(mi)
            v = lo = hi = 0
            bits = 0
            for cid, k in counts.items():
                c = cells[cid]
                if c is None:
                    continue
                try:
                    i = c["mi"].index(mi)
                except ValueError:
                    continue
                v += k * c[unit][i]
                lo += k * c[unit + "_lo"][i]
                hi += k * c[unit + "_hi"][i]
                bits |= c["flags"][i]
            fl = flags_of(bits)
            if low:
                fl = fl + ["low_confidence"]
            months.append({"y": y, "m": m, "value": r6(v / 625.0), "lo": r6(lo / 625.0), "hi": r6(hi / 625.0),
                           "src": src_of(y, m), "flags": fl, "value_x625": v, "lo_x625": lo, "hi_x625": hi})
        out[unit] = months
    return out


def make_series():
    P = lambda lat, lon, r: {"kind": "point", "lat": lat, "lon": lon, "radiusKm": r}
    sels = [
        ("Sofia, 50 km", P(42.70, 23.32, 50)),
        ("Plovdiv, 50 km (two tiles)", P(42.15, 24.75, 50)),
        ("Polygon 24.8 to 25.4 E, 42.2 to 42.7 N (two tiles)",
         {"kind": "polygon", "ring": [[24.8, 42.2], [25.4, 42.2], [25.4, 42.7], [24.8, 42.7]]}),
        ("Sofia, radius 0 (small selection, low confidence)", P(42.70, 23.32, 0)),
    ]
    cases = []
    for name, sel in sels:
        counts, raw, low = selection_weights(sel)
        ser = build_series(counts, low)
        n = len(ser["hot"])
        pick = [(2000, 11), (2002, 6), (2002, 7), (2005, 8), (2012, 1), (2012, 2), (2020, 8), (2022, 7), (2025, 12)]
        zero = [(m["y"], m["m"]) for m in ser["cd"] if m["value_x625"] == 0]
        zero_hot = set((m["y"], m["m"]) for m in ser["hot"] if m["value_x625"] == 0)
        both_zero = [ym for ym in zero if ym in zero_hot]
        if both_zero:
            pick.append(both_zero[0])
            pick.append(both_zero[-1])
        pick = sorted(set(pick))
        idx = {(m["y"], m["m"]): i for i, m in enumerate(ser["hot"])}
        named = {}
        for ym in pick:
            i = idx[ym]
            row = {}
            for unit in ("hot", "cd"):
                row[unit] = {k: v for k, v in ser[unit][i].items()}
            named["%04d-%02d" % ym] = row
        exp = {
            "cellCount": len(counts),
            "lowConfidence": low,
            "seriesLength": n,
            "firstMonth": "2000-11",
            "lastMonth": META["last_month"],
            "weights": [{"id": c, "subcells": counts[c]} for c in sorted(counts)],
            "months": named,
            "october_2000": {"inSeries": False},
            "sumOfAllMonths_x625": {u: sum(m["value_x625"] for m in ser[u]) for u in ("hot", "cd")},
            "monthsWithZeroValue": {u: sum(1 for m in ser[u] if m["value_x625"] == 0) for u in ("hot", "cd")},
            "noNullMonths": True,
        }
        cases.append({"name": name, "input": {"selection": sel},
                      "expected": exp})
    # country
    bgr = load_json("countries/BGR.json")
    cm = {}
    for (y, m) in [(2000, 11), (2012, 2), (2024, 7)]:
        row = next(r for r in bgr["months"] if r["y"] == y and r["m"] == m)
        cm["%04d-%02d" % (y, m)] = {
            "hot": {"y": y, "m": m, "value": row["hot"], "lo": row["hot_lo"], "hi": row["hot_hi"], "src": row["src"], "flags": row["flags"]},
            "cd": {"y": y, "m": m, "value": row["cd"], "lo": row["cd_lo"], "hi": row["cd_hi"], "src": row["src"], "flags": row["flags"]},
        }
    cases.append({"name": "Country series, Bulgaria (read as it is)",
                  "input": {"selection": {"kind": "country", "iso3": "BGR"}},
                  "expected": {"cellCount": 1, "lowConfidence": False, "seriesLength": len(bgr["months"]), "months": cm,
                               "firstMonth": bgr["first_month"], "lastMonth": bgr["last_month"]}})
    return cases


# ------------------------------------------------------------------ daily

def md_offset(y, m, d, start=(11, 17)):
    return (date(y, m, d) - date(y, start[0], start[1])).days


def daily_cells(key):
    rel = "daily/%s.json.gz" % key
    if not os.path.exists(os.path.join(DATA, rel)):
        return {}
    return {c["id"]: c for c in load_json(rel)["cells"]}


def daily_sums(counts, year, off0, off1):
    """Exact x625 sums of hot and frp over day offsets off0..off1 inclusive for one year."""
    hot = frp = 0
    for cid, k in counts.items():
        lat, lon = cell_centre(cid)
        c = daily_cells(tile_key(lat, lon)).get(cid)
        if c is None:
            continue
        for yb in c["years"]:
            if yb["y"] != year:
                continue
            for d, h, f in zip(yb["d"], yb["hot"], yb["frp"]):
                if off0 <= d <= off1:
                    hot += k * h
                    frp += k * f
    return hot, frp


def unusual_ref(value, hist):
    """Section 3 with exact arithmetic. Returns pinned and unpinned parts."""
    n = len(hist)
    res = {"years": n}
    stats = None
    if n:
        hs = sorted(Fraction(str(h)) for h in hist)
        mean = sum(hs) / n
        mid = n // 2
        med = hs[mid] if n % 2 else (hs[mid - 1] + hs[mid]) / 2
        v = Fraction(str(value))
        stats = {
            "median": r6(float(med)), "mean": r6(float(mean)),
            "ratioMedian": None if med == 0 else r6(float(v / med)),
            "ratioMean": None if mean == 0 else r6(float(v / mean)),
            "higherThan": sum(1 for h in hs if h < v),
        }
        if med == 0:
            st = "above" if v > 0 else "near"
        elif v > Fraction(5, 4) * med:
            st = "above"
        elif v < Fraction(3, 4) * med:
            st = "below"
        else:
            st = "near"
        stats["status"] = st
    return res, stats


def rich_daily_cell():
    best = None
    for key in ("40_20", "40_25"):
        for cid, c in sorted(daily_cells(key).items()):
            score = 0
            for yb in c["years"]:
                dec = [(d, h) for d, h in zip(yb["d"], yb["hot"]) if 14 <= d <= 44]
                if dec:
                    score += 1
                if yb["y"] == 2025:
                    if any(37 <= d <= 44 for d, _ in dec):
                        score += 1000
                    if any(14 <= d <= 21 for d, _ in dec):
                        score += 100
            if best is None or score > best[0]:
                best = (score, cid)
    return best[1]


def daily_block(sel, label):
    counts, raw, low = selection_weights(sel)
    end = date.fromisoformat(META["daily_window"]["latest_day"])
    days = 8
    start = end - timedelta(days=days - 1)
    years = META["daily_window"]["years"]
    past_rows = []
    for y in years:
        o0, o1 = md_offset(y, start.month, start.day), md_offset(y, end.month, end.day)
        h, f = daily_sums(counts, y, o0, o1)
        past_rows.append({"year": y, "hot": r6(h / 625.0), "frp": r6(f / 625.0), "hot_x625": h, "frp_x625": f,
                          "estimated": y < 2012, "windowStart": "%04d-%02d-%02d" % (y, start.month, start.day),
                          "windowEnd": "%04d-%02d-%02d" % (y, end.month, end.day)})
    cur = next(r for r in past_rows if r["year"] == end.year)
    pasts = [r for r in past_rows if r["year"] != end.year]
    rank = 1 + sum(1 for r in pasts if r["hot_x625"] > cur["hot_x625"])
    cases = [{
        "name": label + ": 8 day window ending on the last data day",
        "input": {"selection": sel, "days": days, "lastDataDay": META["daily_window"]["latest_day"]},
        "expected": {"weights": [{"id": c, "subcells": counts[c]} for c in sorted(counts)], "end": end.isoformat(),
                     "start": start.isoformat(), "current": cur, "past": pasts, "rank": rank, "of": len(pasts) + 1},
    }]
    for D, lab in [(31, "last data day 31 Dec 2025 (D = 31, month complete)"),
                   (20, "pretend the last data day is 20 Dec 2025 (D = 20)"),
                   (8, "pretend the last data day is 8 Dec 2025 (D = 8, shortest allowed)"),
                   (5, "pretend the last data day is 5 Dec 2025 (D = 5, too early)")]:
        cy = 2025
        vals = {}
        for y in years:
            h, f = daily_sums(counts, y, md_offset(y, 12, 1), md_offset(y, 12, D))
            vals[y] = h
        hist = [r6(vals[y] / 625.0) for y in years if y != cy]
        cur_v = r6(vals[cy] / 625.0)
        res, stats = unusual_ref(cur_v, hist)
        exp = {"month": 12, "year": cy, "dayOfMonth": D, "current": cur_v,
               "pastYears": {str(y): r6(vals[y] / 625.0) for y in years if y != cy},
               "pastYears_x625": {str(y): vals[y] for y in years if y != cy}, "current_x625": vals[cy]}
        if D < 8:
            exp.update(no_history_fields(cur_v, res["years"], "too_early"))
        else:
            exp.update(stats)
            exp["years"] = res["years"]
        cases.append({"name": label + ", month to date: " + lab,
                      "input": {"selection": sel, "lastDataDay": "2025-12-%02d" % D},
                      "expected": exp})
    return cases


def make_daily():
    cases = daily_block({"kind": "point", "lat": 42.70, "lon": 23.32, "radiusKm": 50}, "Sofia 50 km")
    rid = rich_daily_cell()
    lat, lon = cell_centre(rid)
    cases += daily_block({"kind": "point", "lat": lat, "lon": lon, "radiusKm": 10}, "Single busy cell %d (radius 10 km, small selection)" % rid)
    # past-year window: the `days` consecutive days ending on the current end's month and day (ruling 5);
    # the row is labelled by the year of its last day (ruling 6)
    def past_window(end_d, n, Y):
        leap = Y % 4 == 0 and (Y % 100 != 0 or Y % 400 == 0)
        md = (end_d.month, end_d.day)
        if md == (2, 29) and not leap:
            md = (2, 28)
        e = date(Y, md[0], md[1])
        st = e - timedelta(days=n - 1)
        return {"label": Y, "start": st.isoformat(), "end": e.isoformat(),
                "days": [(st + timedelta(days=i)).isoformat() for i in range(n)],
                "estimated": Y < 2012}

    for nm, end_d, n, Y in [
            ("Window end 2024-02-29, 8 days: 2023 has no 29 Feb, so the window ends 28 Feb", date(2024, 2, 29), 8, 2023),
            ("Window end 2024-02-29, 8 days: leap year 2020 ends on 29 Feb", date(2024, 2, 29), 8, 2020),
            ("Window end 2024-02-29, 45 days: always exactly 45 days", date(2024, 2, 29), 45, 2021),
            ("Window end 2024-03-02, 8 days: current window holds 29 Feb, past 2023 window does not", date(2024, 3, 2), 8, 2023),
            ("Window end 2025-01-04, 8 days crosses 1 Jan; past year 2020 is labelled 2020", date(2025, 1, 4), 8, 2020),
            ("Window end 2025-01-04, 8 days crosses 1 Jan; past year 2011 is labelled 2011 and is estimated", date(2025, 1, 4), 8, 2011),
            ("Window end 2025-01-04, 8 days crosses 1 Jan; past year 2012 is labelled 2012 and is not estimated", date(2025, 1, 4), 8, 2012),
            ("Window end 2025-12-31, 8 days: no year crossing", date(2025, 12, 31), 8, 2019)]:
        cases.append({"name": nm, "input": {"end": end_d.isoformat(), "days": n, "pastYear": Y},
                      "expected": past_window(end_d, n, Y)})
    return cases


# ------------------------------------------------------------------ unusual

def series_for(month, hist_by_year, extra=None):
    s = [{"y": y, "m": month, "value": v} for y, v in sorted(hist_by_year.items())]
    if extra:
        s += extra
    return s


def unusual_case(name, month, year, value, hist, note=None, distractors=True):
    hbl = dict(hist)
    series = [{"y": y, "m": month, "value": v} for y, v in sorted(hbl.items())]
    series.append({"y": year, "m": month, "value": value})
    if distractors:
        series.append({"y": year - 1, "m": (month % 12) + 1, "value": 999999})
        series.append({"y": year + 1, "m": month, "value": 888888})
    series.sort(key=lambda r: (r["y"], r["m"]))
    nulls = [v for v in hbl.values() if v is None]
    h = [v for v in hbl.values() if v is not None]
    res, stats = unusual_ref(value, h) if value is not None else ({"years": len(h)}, None)
    c = {"name": name, "input": {"series": series, "year": year, "month": month}, "expected": {}}
    exp = c["expected"]
    if value is None or len(h) < 3:
        exp.update(no_history_fields(value, len(h)))
    else:
        exp.update({"status": stats["status"], "value": value, "median": stats["median"], "mean": stats["mean"],
                    "ratioMedian": stats["ratioMedian"], "ratioMean": stats["ratioMean"],
                    "higherThan": stats["higherThan"], "years": res["years"]})
    if note:
        c["note"] = note
    return c


def no_history_fields(value, n_history, status="no_history"):
    return {"status": status, "value": value, "median": None, "mean": None, "ratioMedian": None, "ratioMean": None,
            "higherThan": 0, "years": n_history}


def make_unusual():
    base = {2015: 100, 2016: 120, 2017: 80, 2018: 110, 2019: 90}
    cases = [
        unusual_case("Above: value 200 against median 100", 8, 2020, 200, base),
        unusual_case("Below: value 50 against median 100", 8, 2020, 50, base),
        unusual_case("Near: value 100 against median 100", 8, 2020, 100, base),
        unusual_case("Edge: exactly 1.25 x median is near, not above", 8, 2020, 125, base),
        unusual_case("Edge: just above 1.25 x median is above", 8, 2020, 125.5, base),
        unusual_case("Edge: exactly 0.75 x median is near, not below", 8, 2020, 75, base),
        unusual_case("Edge: just below 0.75 x median is below", 8, 2020, 74.5, base),
        unusual_case("No history: two years", 8, 2020, 100, {2018: 100, 2019: 90}),
        unusual_case("History of exactly 3 years is enough", 8, 2020, 100, {2017: 80, 2018: 100, 2019: 90}),
        unusual_case("Median 0 and value above 0 is above", 8, 2020, 3, {2015: 0, 2016: 0, 2017: 0, 2018: 5, 2019: 0}),
        unusual_case("Median 0 and value 0 is near", 8, 2020, 0, {2015: 0, 2016: 0, 2017: 0, 2018: 5, 2019: 0}),
        unusual_case("Mean and median far apart (one huge year)", 8, 2020, 12, {2015: 10, 2016: 10, 2017: 11, 2018: 10, 2019: 1000}),
        unusual_case("Null history years are left out", 8, 2020, 100,
                     {2012: None, 2013: None, 2014: 100, 2015: 100, 2016: 110, 2017: 90}),
        unusual_case("Even history size (4 years): median rule matters", 8, 2020, 140, {2016: 100, 2017: 120, 2018: 80, 2019: 110}),
        unusual_case("Null current value with 5 history years gives no_history", 8, 2020, None, base),
        unusual_case("Null current value with no history at all", 8, 2020, None, {}),
        unusual_case("No history: no past years", 8, 2020, 100, {}),
        unusual_case("No history: one past year", 8, 2020, 100, {2019: 90}),
        unusual_case("Higher than: ties are not counted (strictly below)", 8, 2020, 100,
                     {2015: 100, 2016: 100, 2017: 50, 2018: 150, 2019: 100}),
        unusual_case("Values with decimals (weighted selections)", 3, 2021, 12.5, {2016: 10.4, 2017: 9.76, 2018: 11.2, 2019: 10.0}),
    ]
    # too early versus allowed, from the daily rule
    for D, nm in ((5, "Day 5 of the month: too_early"), (7, "Day 7: too_early"), (8, "Day 8: allowed"), (9, "Day 9: allowed")):
        cases.append({"name": "Unfinished month, " + nm,
                      "input": {"dayOfMonth": D, "currentSum": 40, "historySums": [30, 35, 38, 45, 50]},
                      "expected": (no_history_fields(40, 5, "too_early") if D < 8 else
                                   {"status": "near", "median": 38.0, "mean": 39.6, "ratioMedian": r6(40 / 38), "ratioMean": r6(40 / 39.6),
                                    "higherThan": 3, "years": 5})})
    return cases


# ------------------------------------------------------------------ chance

def chance_ref(series, month, year):
    ys = [r for r in series if r["m"] == month and r["y"] < year and r["value"] is not None]
    n = len(ys)
    fire = sum(1 for r in ys if r["value"] >= 0.5)
    if n == 0:
        return {"p": None, "lo": None, "hi": None, "fireYears": 0, "years": 0}
    p = fire / n
    lo = 0.0 if fire == 0 else float(beta.ppf(0.05, fire + 0.5, n - fire + 0.5))
    hi = 1.0 if fire == n else float(beta.ppf(0.95, fire + 0.5, n - fire + 0.5))
    return {"p": r6(p), "lo": r6(lo), "hi": r6(hi), "fireYears": fire, "years": n}


def make_chance():
    def mk(vals, month=8, y0=2000):
        return [{"y": y0 + i, "m": month, "value": v} for i, v in enumerate(vals)]
    cases = []

    def add(name, series, month, year, note=None):
        c = {"name": name, "input": {"series": series, "month": month, "year": year},
             "expected": chance_ref(series, month, year)}
        if note:
            c["note"] = note
        cases.append(c)

    add("0 of 20 years", mk([0] * 20), 8, 2020)
    add("20 of 20 years", mk([5] * 20), 8, 2020)
    add("7 of 25 years", mk([3, 0, 0, 1, 0, 0, 9, 0, 0, 0, 2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 7, 0, 0, 12, 0]), 8, 2025)
    add("1 of 3 years", mk([0, 4, 0]), 8, 2003)
    add("No years (first year of the series)", mk([5]), 8, 2000)
    add("No years: month never present", [{"y": 2010, "m": 3, "value": 5}], 8, 2020)
    add("No years: every past year is null", mk([None, None, 5]), 8, 2002)
    add("Threshold: 0.49 does not count as a fire year", mk([0.49] * 10), 8, 2010)
    add("Threshold: 0.5 counts as a fire year", mk([0.5] * 10), 8, 2010)
    add("Threshold edge, mixed (0.49, 0.5, 0.51, 0.4999999, 1)", mk([0.49, 0.5, 0.51, 0.4999999, 1]), 8, 2005)
    add("Null years are left out of the count", mk([5, None, 0, None, 3, 0]), 8, 2006)
    add("Years from the asked year on are ignored", mk([5, 0, 5, 5, 5, 5]), 8, 2002)
    add("Other months are ignored",
        mk([5, 0, 5]) + [{"y": 2000, "m": 9, "value": 100}, {"y": 2001, "m": 7, "value": 100}], 8, 2003)
    add("1 of 1 year", mk([2]), 8, 2001)
    add("0 of 1 year", mk([0]), 8, 2001)
    add("19 of 20 years", mk([2] * 19 + [0]), 8, 2020)
    add("Month 11 starts in 2000 (Nov 2000 is the first month)", [{"y": 2000 + i, "m": 11, "value": v} for i, v in enumerate([1, 0, 2, 0])], 11, 2004)
    return cases


# ------------------------------------------------------------------ window ranking

def make_window():
    def mk(cur, past):
        return {"days": 8, "end": "2025-12-31",
                "current": {"year": 2025, "hot": cur, "frp": cur * 3 if cur is not None else None, "estimated": False},
                "past": [{"year": y, "hot": h, "frp": h * 3 if h is not None else None, "estimated": y < 2012}
                         for y, h in past]}
    cases = []

    def add(name, cur, past, note=None):
        inp = mk(cur, past)
        ranked = [(y, h) for y, h in past if h is not None]
        rank = None if not ranked else 1 + sum(1 for _, h in ranked if h > cur)
        c = {"name": name, "input": inp,
             "expected": {"rank": rank, "of": len(ranked) + 1, "rankedYears": [y for y, _ in ranked],
                          "estimatedByYear": {str(y): y < 2012 for y, _ in past}}}
        if rank is None:
            c["expected"]["rank"] = None
        if note:
            c["note"] = note
        cases.append(c)

    p = [(2008, 30), (2009, 12), (2010, 50), (2011, 7), (2012, 22), (2013, 40)]
    add("Highest: current beats every past year", 100, p)
    add("Lowest: current below every past year", 1, p)
    add("Tie for first: current equals the highest past year", 50, p)
    add("Tie in the middle: current equals two past years", 22, [(2008, 22), (2009, 22), (2010, 50), (2011, 7)])
    add("Tie among past years only (does not change the current rank)", 45, [(2008, 50), (2009, 50), (2010, 7), (2011, 7)])
    add("No past years", 10, [], note="rank is null and of is 1.")
    add("Past years with null left out of the ranking", 25,
        [(2008, 30), (2009, None), (2010, 20), (2011, None), (2012, 26)])
    add("All past years null", 25, [(2008, None), (2009, None)], note="No ranked year: rank null, of 1.")
    add("Current 0 with several past years at 0 (ties for the better rank)", 0, [(2008, 0), (2009, 0), (2010, 4)])
    # date and estimated flags
    cases.append({"name": "Estimated flag: true for years before 2012, false from 2012",
                  "input": {"years": [2010, 2011, 2012, 2013]},
                  "expected": {"estimated": {"2010": True, "2011": True, "2012": False, "2013": False}}})
    # real selection from the example data
    sel = {"kind": "point", "lat": 42.70, "lon": 23.32, "radiusKm": 50}
    return cases


# ------------------------------------------------------------------ trend and extremes

def fit(points):
    n = len(points)
    xs = [Fraction(y) for y, _ in points]
    ys = [Fraction(str(v)) for _, v in points]
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / sxx, my


def trend_ref(table):
    """table: {year: [12 values or None]}; returns Trend + Extremes."""
    complete = {y: sum(v) for y, v in table.items() if len(v) == 12 and all(x is not None for x in v)}
    n = len(complete)
    out = {"years": n}
    if n >= 5:
        pts = sorted(complete.items())
        slope, mean = fit(pts)
        np_slope = float(np.polyfit([y for y, _ in pts], [float(t) for _, t in pts], 1)[0])
        assert abs(np_slope - float(slope)) < 1e-6 * max(1.0, abs(float(slope))) + 1e-9, (np_slope, float(slope))
        out["slopePerYear"] = r6(float(slope))
        out["perDecadeShare"] = None if mean == 0 else r6(float(10 * slope / mean))
    else:
        out["slopePerYear"] = None
        out["perDecadeShare"] = None
    allm = [(y, m + 1, v) for y, vals in sorted(table.items()) for m, v in enumerate(vals) if v is not None]
    ext = {"worstMonth": None, "worstYear": None}
    if allm:
        best = max(v for _, _, v in allm)
        y, m, v = next(t for t in allm if t[2] == best)
        ext["worstMonth"] = {"y": y, "m": m, "value": best}
    if complete:
        bt = max(complete.values())
        by = min(y for y, t in complete.items() if t == bt)
        ext["worstYear"] = {"y": by, "value": bt}
    return out, ext, complete


def make_trend():
    cases = []

    def add(name, table, note=None):
        tr, ex, comp = trend_ref(table)
        c = {"name": name,
             "input": {"years": {str(y): v for y, v in sorted(table.items())}},
             "expected": {"trend": tr, "extremes": ex, "completeYears": {str(y): t for y, t in sorted(comp.items())}}}
        if note:
            c["note"] = note
        cases.append(c)

    rising = {2010 + i: [10 + 2 * i] * 12 for i in range(10)}
    add("Rising series: 10 years, +24 per year", rising)
    flat = {2010 + i: [5] * 12 for i in range(6)}
    add("Flat series: slope 0, share 0", flat)
    add("Flat zero series: mean 0, share null", {2010 + i: [0] * 12 for i in range(6)})
    add("Falling series with noise", {2010 + i: [v + (i % 3)] * 12 for i, v in enumerate([20, 18, 17, 15, 14, 11, 10])})
    add("Fewer than 5 complete years: slope and share null", {2010 + i: [3 + i] * 12 for i in range(4)})
    add("Exactly 5 complete years: slope given", {2010 + i: [3 + i] * 12 for i in range(5)})
    t = {2010 + i: [10 + i] * 12 for i in range(7)}
    t[2013] = [13] * 5 + [None] + [13] * 6
    add("A year with one null month is left out of the trend", t,
        note="2013 is not a complete year: it is out of the slope, the year count and the worst year.")
    t2 = {2010 + i: [10 + i] * 12 for i in range(5)}
    t2[2014] = [14] * 11 + [None]
    add("Only 4 complete years remain after one null month: slope null", t2)
    t3 = {2010: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2011: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
          2012: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 2013: [6] * 12, 2014: [6] * 12}
    add("Ties: worst month is the earliest equal month; worst year the earliest equal year", t3,
        note="Months of 12 appear in 2010 (December) and 2011 (January): the earliest wins. Yearly totals 78 (2010), 78 (2011): 2010 wins.")
    t4 = {2010 + i: [5] * 12 for i in range(5)}
    t4[2015] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, None]
    t4[2015][5] = 900
    add("Worst month in an incomplete year counts; worst year does not", t4,
        note="2015 has a null month, so it is out of the worst year, but its 900 is the worst month.")
    add("All months null", {2010 + i: [None] * 12 for i in range(5)},
        note="Extremes are null; the trend has 0 years.")
    add("Single month present", {2010: [None] * 5 + [7] + [None] * 6})
    return cases


# ------------------------------------------------------------------ csv

def csv_field(s):
    if s is None:
        return ""
    s = str(s)
    if any(ch in s for ch in ',"\n'):
        return '"' + s.replace('"', '""') + '"'
    return s


def round_half_up(x):
    return int(math.floor(x + 0.5))


def make_csv():
    unit = "hot"
    months = [
        {"y": 2000, "m": 11, "value": 238.0, "lo": 167.0, "hi": 309.0, "src": "estimated_terra", "flags": ["example"]},
        {"y": 2000, "m": 12, "value": 0.0, "lo": 0.0, "hi": 0.0, "src": "estimated_terra", "flags": []},
        {"y": 2012, "m": 2, "value": 1234.4, "lo": 1100.0, "hi": 1300.0, "src": "measured", "flags": ["example", "partial_month"]},
        {"y": 2022, "m": 7, "value": None, "lo": None, "hi": None, "src": None, "flags": []},
        {"y": 2025, "m": 12, "value": 7.0, "lo": 7.0, "hi": 7.0, "src": "measured", "flags": ["low_confidence"]},
    ]
    def row(r):
        vals = [str(r["y"]), str(r["m"]), unit,
                "" if r["value"] is None else str(round_half_up(r["value"])),
                "" if r["lo"] is None else str(round_half_up(r["lo"])),
                "" if r["hi"] is None else str(round_half_up(r["hi"])),
                "" if r["src"] is None else r["src"], "|".join(r["flags"])]
        return ",".join(csv_field(v) for v in vals)

    body = "\n".join(row(r) for r in months) + "\n"
    rmonths = [
        {"y": 2020, "m": 1, "value": 2.5, "lo": 0.5, "hi": 3.5, "src": "measured", "flags": []},
        {"y": 2020, "m": 2, "value": 1.5, "lo": 1.49, "hi": 1.51, "src": "measured", "flags": []},
        {"y": 2020, "m": 3, "value": 0.4999, "lo": 0.0, "hi": 0.5, "src": "measured", "flags": []},
        {"y": 2020, "m": 4, "value": 0.0, "lo": 0.0, "hi": 0.0, "src": "measured", "flags": []},
    ]
    half_up = "\n".join(row(r) for r in rmonths) + "\n"
    two_flags = [{"y": 2021, "m": 6, "value": 12.5, "lo": 10.0, "hi": 15.0, "src": "provisional",
                  "flags": ["example", "partial_month"]},
                 {"y": 2021, "m": 7, "value": 3.0, "lo": 3.0, "hi": 3.0, "src": "measured",
                  "flags": ["partial_month", "snpp_gap_filled", "low_confidence"]}]
    cases = [
        {"name": "Tiny series, unit hot: body rows (flags joined with a pipe, half rounds up)",
         "input": {"unit": unit, "months": months},
         "expected": {"bodyRows": body}},
        {"name": "Rounding to whole numbers at exact halves (half rounds up)",
         "input": {"unit": unit, "months": rmonths},
         "expected": {"bodyRows": half_up}},
        {"name": "Two and three flags in one field",
         "input": {"unit": unit, "months": two_flags},
         "expected": {"bodyRows": "\n".join(row(r) for r in two_flags) + "\n"}},
        {"name": "Rules as checks",
         "input": {"unit": unit, "months": months},
         "expected": {"checks": [
             {"rule": "no carriage return anywhere", "type": "doesNotContain", "text": "\r"},
             {"rule": "every line ends with the line feed character", "type": "everyLineEndsWith", "text": "\n"},
             {"rule": "null value, low and high are empty fields", "type": "rowEquals",
              "row": "2022,7,hot,,,,,"},
             {"rule": "zero is the character 0", "type": "rowEquals", "row": "2000,12,hot,0,0,0,estimated_terra,"},
             {"rule": "flags in one field are joined with a pipe", "type": "rowEquals", "row": "2012,2,hot,1234,1100,1300,measured,example|partial_month"},
             {"rule": "a field with a comma is quoted", "type": "csvFieldQuoted", "sample": "a,b", "quoted": "\"a,b\""},
             {"rule": "column count is 8 in every body row", "type": "fieldCount", "count": 8, "note": "except rows where a quoted field holds commas"},
             {"rule": "a fire value is never printed with a decimal point", "type": "doesNotMatch", "pattern": "\\.\\d"},
         ]}},
        {"name": "Summary CSV: columns and quoting",
         "input": {"rows": [["worst month", "2024-07"], ["note, with comma", "x"]]},
         "expected": {"header": "key,value", "bodyRows": "worst month,2024-07\n\"note, with comma\",x\n"},
         "note": "Section 8 does not fix the summary key names, so only the two column names and the quoting are pinned."},
    ]
    return cases


# ------------------------------------------------------------------ main

def main():
    write("selection_weights.json",
          "Section 1. Cells and overlap weights for selections. weight = subcells / 625, 6 decimals. Cells sorted by id. "
          "totalWeight and lowConfidence are after the small-selection rule. Haversine, Earth radius 6371.0088 km, inside means distance <= radius.",
          make_weights())
    write("series_cases.json",
          "Section 2. Monthly series of selections built from the example tiles. value, lo, hi are weighted sums to 6 decimals; "
          "the *_x625 fields are exact integers (value x 625). Flags are listed in the closed-set order example, partial_month, snpp_gap_filled, low_confidence.",
          make_series())
    write("daily_cases.json",
          "Sections 4 and 6 inputs from the example daily files: 8 day window totals per year, month to date with each past year, and window date mapping.",
          make_daily())
    write("unusual_cases.json",
          "Sections 3 and 4. Status, median, mean, ratios, higherThan and years. Ratios to 6 decimals. For no_history and too_early the median, mean and ratios are null and higherThan is 0 (section 9, ruling 4).",
          make_unusual())
    write("chance_cases.json", "Section 5. Chance of fire. Jeffreys range from scipy.stats.beta.ppf at 0.05 and 0.95, 6 decimals.",
          make_chance())
    write("window_cases.json", "Section 6. Ranking of the current window against past years, and the estimated flag.", make_window())
    write("trend_extremes_cases.json", "Section 7. Trend by ordinary least squares on complete years (exact fractions, checked against numpy.polyfit) and extremes.",
          make_trend())
    write("csv_cases.json", "Section 8. Expected text of monthly CSV body rows and the rules as checks.", make_csv())


if __name__ == "__main__":
    main()
