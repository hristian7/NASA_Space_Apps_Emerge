#!/usr/bin/env python3
"""Fetch the fire figures that the app shows next to our satellite detections.

Two kinds of series, kept apart and never renamed:

national_report
    what a country's own authority reported: counts of fires and burned area
    by that authority's own definition.
GWIS and EFFIS satellite_estimate
    an agency's estimate made by mapping burned areas in satellite images. It
    misses small fires, so it is not a report.

Sources, all public and open with no account and no key:

EFFIS statistics
    https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry
    the JSON the EFFIS statistics portal's "Estimates" page loads. The page
    calls these "EFFIS Estimates of Burned Areas, Emissions, Number of Fires
    and Thermal Anomalies" and states "Fires mapped in EFFIS of approx. 30 ha
    or larger". Satellite estimate, Europe, the Middle East and North Africa.
GWIS statistics
    https://api2.effis.emergency.copernicus.eu/statistics/v2/gwis/estimatesbycountry
    the same for the world-wide portal, "GWIS Estimates of Burned Areas and
    Number of Fires". Satellite estimate.
NIFC statistics
    https://www.nifc.gov/fire-information/statistics/wildfires
    the HTML table "Total Wildland Fires and Acres", source the National
    Interagency Coordination Center. A national report. Acres are converted to
    hectares here, 1 acre = 0.40468564224 ha.
EFFIS annual report for 2024
    https://dx.doi.org/10.2760/0649290
    Table 1 holds the number of fires and burned area for 2024 "as reported by
    the contributing countries"; Table 2 holds ten years for Bulgaria from the
    Executive Forest Agency. National reports. Reading them needs the poppler
    tool pdftotext; without it this source is skipped and the run says so.

Run it:

    python3 pipeline/fetch_reported.py --data <the data folder>
    python3 pipeline/fetch_reported.py --data <the data folder> --offline

The online run saves every response under <data>/raw/reported/ and writes one
file per country into <data>/derived/reported/. The offline run rebuilds those
files from the saved responses alone and must produce the same bytes.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ACRE_IN_HECTARES = 0.40468564224

USER_AGENT = "EmergeHackathonResearch/1.0 (NASA Space Apps 2026 research script)"
PAUSE_SECONDS = 0.4
ATTEMPTS = 3

EFFIS_API = "https://api2.effis.emergency.copernicus.eu"
EFFIS_PORTAL = "https://forest-fire.emergency.copernicus.eu/apps/effis.statistics/estimates"
GWIS_PORTAL = "https://gwis.jrc.ec.europa.eu/apps/gwis.statistics/estimates"
NIFC_PAGE = "https://www.nifc.gov/fire-information/statistics/wildfires"
REPORT_DOI = "https://dx.doi.org/10.2760/0649290"
REPORT_PDF = (
    "https://op.europa.eu/o/opportal-service/download-handler"
    "?identifier=1f960275-d187-11f0-8da2-01aa75ed71a1"
    "&format=pdf&language=en&productionSystem=cellar&part="
)

# The licence each source states on its own pages, in its own words, shortened.
EU_LICENCE = (
    "Creative Commons Attribution 4.0 International (CC BY 4.0), as stated on "
    "the EFFIS and GWIS Data License pages. Copyright European Union, 1995-2025."
)
REPORT_LICENCE = (
    "Creative Commons Attribution 4.0 International (CC BY 4.0), as stated on "
    "the report's own copyright page. Copyright European Union, 2025."
)
NIFC_LICENCE = (
    "Terms not stated. The publisher is a United States federal interagency "
    "centre and the site links only a disclaimer of liability, "
    "https://www.doi.gov/disclaimer."
)

EFFIS_NOTE = (
    "Not a report. EFFIS, the European Forest Fire Information System, makes "
    "this estimate by mapping the burned area it can see in satellite images, "
    "and it maps mainly fires of about 30 hectares or more, so smaller fires "
    "are missing."
)
GWIS_NOTE = (
    "Not a report. GWIS, the Global Wildfire Information System, makes this "
    "estimate by mapping the burned area it can see in satellite images "
    "world-wide, so small fires are missing."
)
NIFC_NOTE = (
    "What the National Interagency Coordination Center reported: all wildland "
    "fires and the area they burned, counted from the records of the federal "
    "and state wildland fire agencies, so a fire none of them recorded is "
    "missing. Acres in the source are converted to hectares, 1 acre = "
    "0.40468564224 hectares."
)
REPORT_BULGARIA_NOTE = (
    "What the Executive Forest Agency reported, from its own database of "
    "forest fires, as the EFFIS annual report prints it in its annex and in "
    "Table 2 of its Bulgaria chapter. Forest fires only, so fires on other "
    "land are missing. The agency's own 2025 report later gives 2024 as 565 "
    "fires on the same area, 171 164 decares, which is 17 116.4 hectares "
    "(https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf); the "
    "figure here is the 595 the 2024 report printed."
)

# The names Table 1 of the annual report prints, and the three-letter code for
# each. A name that is not here is listed in the run output and left out:
# never guessed.
REPORT_COUNTRY_CODES = {
    "Austria": "AUT",
    "Bulgaria": "BGR",
    "Croatia": "HRV",
    "Cyprus": "CYP",
    "Czech Republic": "CZE",
    "Estonia": "EST",
    "Finland": "FIN",
    "France": "FRA",
    "Germany": "DEU",
    "Greece": "GRC",
    "Hungary": "HUN",
    "Italy": "ITA",
    "Latvia": "LVA",
    "Lithuania": "LTU",
    "Morocco": "MAR",
    "Netherlands": "NLD",
    "North Macedonia": "MKD",
    "Norway": "NOR",
    "Poland": "POL",
    "Portugal": "PRT",
    "Romania": "ROU",
    "Serbia": "SRB",
    "Slovakia": "SVK",
    "Slovenia": "SVN",
    "Spain": "ESP",
    "Sweden": "SWE",
    "Switzerland": "CHE",
    "Türkiye": "TUR",
    "Ukraine": "UKR",
}

NATIONAL = "national_report"
ESTIMATE = "satellite_estimate"


# ---------------------------------------------------------------------------
# Writing and reading
# ---------------------------------------------------------------------------


def dump(obj: object) -> bytes:
    return json.dumps(obj, ensure_ascii=False, allow_nan=False,
                      separators=(",", ":")).encode()


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(dump(obj) + b"\n")


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Being polite to the sources
# ---------------------------------------------------------------------------


class Fetcher:
    """Fetches one address at a time, with a pause between requests."""

    def __init__(self, raw: Path, offline: bool) -> None:
        self.raw = raw
        self.offline = offline
        self.last = 0.0
        self.calls = 0

    def get(self, url: str, name: str, text: bool = False) -> bytes | None:
        """The saved response for `name`, fetching it first unless offline."""
        path = self.raw / name
        if self.offline:
            if not path.is_file():
                return None
            return path.read_bytes()
        wait = PAUSE_SECONDS - (time.monotonic() - self.last)
        if wait > 0:
            time.sleep(wait)
        body = None
        for attempt in range(1, ATTEMPTS + 1):
            try:
                request = urllib.request.Request(
                    url, headers={"User-Agent": USER_AGENT,
                                  "Accept": "text/html,application/json,*/*"})
                with urllib.request.urlopen(request, timeout=180) as response:
                    body = response.read()
                break
            except (urllib.error.URLError, TimeoutError, OSError) as problem:
                if attempt == ATTEMPTS:
                    print(f"  could not fetch {name}: {problem}", flush=True)
                    return None
                time.sleep(2.0 * attempt)
        self.last = time.monotonic()
        self.calls += 1
        if body is None:
            return None
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return body

    def get_json(self, url: str, name: str) -> object | None:
        body = self.get(url, name)
        if body is None:
            return None
        try:
            return json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as problem:
            print(f"  {name} is not the JSON we expected: {problem}", flush=True)
            return None


# ---------------------------------------------------------------------------
# The estimates portals
# ---------------------------------------------------------------------------


def estimate_countries(fetcher: Fetcher, which: str) -> list[str]:
    """Every three-letter code the portal offers, in order."""
    codes: list[str] = []
    if which == "effis":
        regions = fetcher.get_json(
            f"{EFFIS_API}/statistics/utils/aoi?scope=effis", "effis_regions.json")
        if not isinstance(regions, list):
            return []
        for region in regions:
            code = region.get("code")
            if not code:
                continue
            rows = fetcher.get_json(
                f"{EFFIS_API}/statistics/utils/countriesbyaoi?aoi={code}",
                f"effis_countries_{code}.json")
            if isinstance(rows, list):
                codes += [r["iso3"] for r in rows if r.get("iso3")]
    else:
        rows = fetcher.get_json(
            f"{EFFIS_API}/statistics/utils/countriesbyaoi?aoi=gwis",
            "gwis_countries.json")
        if isinstance(rows, list):
            codes += [r["iso3"] for r in rows if r.get("iso3")]
    return sorted(set(codes))


def estimate_series(fetcher: Fetcher, which: str,
                    codes: list[str]) -> dict[str, list[tuple[int, float | None, int | None]]]:
    """Per country, the (year, burned hectares, number of fires) rows."""
    out: dict[str, list[tuple[int, float | None, int | None]]] = {}
    for code in codes:
        rows = fetcher.get_json(
            f"{EFFIS_API}/statistics/v2/{which}/estimatesbycountry?country={code}",
            f"{which}_estimates_{code}.json")
        if not isinstance(rows, list) or not rows:
            continue
        kept = []
        for row in rows:
            year = row.get("year")
            if not isinstance(year, int):
                continue
            kept.append((year, number(row.get("ba")), whole(row.get("nf"))))
        if kept:
            out[code] = sorted(kept)
    return out


def number(value: object) -> float | int | None:
    """A figure as the source gives it, whole where the source is whole."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return tidy(round(float(value), 2))
    return None


def tidy(value: float) -> float | int:
    return int(value) if float(value).is_integer() else value


def whole(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


# ---------------------------------------------------------------------------
# The national coordination centre's table for the USA
# ---------------------------------------------------------------------------


def nifc_series(body: bytes) -> tuple[list[tuple[int, int, float]], str, str]:
    """The (year, fires, hectares) rows of the wildland fires table.

    A figure the page marks with an asterisk is kept, and the asterisk's own
    sentence is returned so the series note can carry it.
    """
    page = body.decode("utf-8", errors="replace")
    rows: list[tuple[int, int, float]] = []
    title = ""
    starred: list[int] = []
    for block in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = [re.sub(r"<[^>]+>", "", cell).replace(" ", " ").strip()
                 for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", block, re.S)]
        if len(cells) == 1 and "Wildland Fires and Acres" in cells[0]:
            title = cells[0]
        if len(cells) != 3:
            continue
        year, fires, acres = (c.replace(",", "").strip() for c in cells)
        if not re.fullmatch(r"\d{4}", year):
            continue
        star = fires.startswith("*") or acres.startswith("*")
        fires, acres = fires.lstrip("*"), acres.lstrip("*")
        if not re.fullmatch(r"\d+", fires) or not re.fullmatch(r"\d+", acres):
            continue
        if star:
            starred.append(int(year))
        rows.append((int(year), int(fires),
                     tidy(round(int(acres) * ACRE_IN_HECTARES, 1))))
    footnote = ""
    if starred:
        flat = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page))
        mark = re.search(r"\*\s*((?:19|20)\d\d fires and acres[^.]{0,200}\.)", flat)
        footnote = (" The source marks "
                    + ", ".join(str(y) for y in sorted(starred))
                    + " with an asterisk"
                    + (": " + re.sub(r"\s+", " ", mark.group(1)).strip()
                       if mark else "."))
    return sorted(rows), title, footnote


# ---------------------------------------------------------------------------
# The annual report's own tables
# ---------------------------------------------------------------------------


def pdf_text(pdf: Path, out: Path, layout: bool) -> str | None:
    """The report's text, extracted once and then read from the saved file."""
    if out.is_file():
        return out.read_text(encoding="utf-8", errors="replace")
    if not pdf.is_file() or shutil.which("pdftotext") is None:
        return None
    command = ["pdftotext"] + (["-layout"] if layout else []) + [str(pdf), str(out)]
    try:
        subprocess.run(command, check=True, capture_output=True)
    except (subprocess.CalledProcessError, OSError) as problem:
        print(f"  could not read the report: {problem}", flush=True)
        return None
    return out.read_text(encoding="utf-8", errors="replace")


def report_table1(text: str) -> tuple[dict[str, tuple[int, float]], list[str]]:
    """2024 as the contributing countries reported it, from Table 1."""
    start = text.find("Table 1. Overview of the number of fires and burnt areas")
    if start < 0:
        return {}, []
    end = text.find("elaboration of the country reports.", start)
    if end < 0:
        return {}, []
    found: dict[str, tuple[int, float]] = {}
    unknown: list[str] = []
    for line in text[start:end].splitlines():
        line = line.replace(" ", " ").rstrip()
        # The name, then an optional footnote marker (one space, one digit),
        # then the gap before the first value.
        head = re.match(
            r"^\s*([A-Za-z][A-Za-z&.À-ɏ'\- ]+?)(?:\s\d)?\s{2,}(\d.*)$",
            line)
        if not head:
            continue
        name = re.sub(r"\s+", " ", head.group(1)).strip()
        if name not in REPORT_COUNTRY_CODES:
            if name not in ("Country", "Source", "Number of fires", "Burnt area"):
                unknown.append(name)
            continue
        tokens = re.findall(r"\d+(?:\.\d+)?|\S+", head.group(2))
        values: list[str] = []
        for token in tokens:
            if re.fullmatch(r"\d+(?:\.\d+)?", token):
                values.append(token)
            else:
                break
        # A single leading digit is a footnote marker, not a fire count.
        if len(values) >= 7 and re.fullmatch(r"\d", values[0]):
            values = values[1:]
        if len(values) < 6:
            continue
        found[REPORT_COUNTRY_CODES[name]] = (int(float(values[0])),
                                             tidy(round(float(values[3]), 2)))
    return found, sorted(set(unknown))


# The annex tables print one column per country, in this order, and the order
# is checked against the document before any row is read.
ANNEX_SOUTHERN = ["PORTUGAL", "SPAIN", "FRANCE", "ITALY", "GREECE"]
ANNEX_SOUTHERN_CODES = ["PRT", "ESP", "FRA", "ITA", "GRC"]
ANNEX_OTHER = [
    "Algeria", "Austria", "Bulgaria", "Croatia", "Cyprus", "Czech", "Estonia",
    "Finland", "Germany", "Hungary", "Latvia", "Lebanon", "Lithuania",
    "Morocco", "Netherlands", "North", "Norway", "Poland", "Romania", "Serbia",
    "Slovakia", "Slovenia", "Sweden", "Switzerland", "T\u00fcrkiye", "Ukraine",
]
ANNEX_OTHER_CODES = [
    "DZA", "AUT", "BGR", "HRV", "CYP", "CZE", "EST", "FIN", "DEU", "HUN",
    "LVA", "LBN", "LTU", "MAR", "NLD", "MKD", "NOR", "POL", "ROU", "SRB",
    "SVK", "SVN", "SWE", "CHE", "TUR", "UKR",
]

ANNEX_TITLES = {
    "fires_southern": "Table 101. Number of forest fires in five Southern "
                      "Member States (1980-2024).",
    "area_southern": "Table 102. Burnt area (hectares) in five Southern "
                     "Member States (1980\u20132024).",
    "fires_other": "Table 103. Number of forest fires in other countries "
                   "(1990-2024).",
    "area_other": "Table 104. Burnt area (hectares) in other countries "
                  "(1990\u20132024).",
}

REPORT_ANNEX_NOTE = (
    "What the countries' own national fire services reported, year by year, as "
    "the annex of the EFFIS annual report prints it (JRC's wording: its "
    "elaboration of the country reports). Each country counts fires and burned "
    "area by its own rules, so a fire its service does not record is missing "
    "and countries are not directly comparable."
)


def annex_cells(line: str) -> list[str] | None:
    """One row of an annex table: the year, then one value or "-" per column.

    The tables separate columns by two spaces or more and write thousands with
    a single space, so a cell of digit groups of three is one number and any
    other cell holding a space is two columns the layout pushed together.
    """
    cells = [c.strip() for c in re.split(r"\s{2,}", line.strip()) if c.strip()]
    if not cells or not re.fullmatch(r"(19|20)\d\d", cells[0]):
        return None
    values = [cells[0]]
    for cell in cells[1:]:
        if re.fullmatch(r"\d{1,3}(?: \d{3})+", cell):
            values.append(cell.replace(" ", ""))
        else:
            values += cell.split()
    return values


def report_annex(layout: str) -> tuple[dict[str, dict[int, dict[str, float | int]]], list[str]]:
    """Fires and burned area per country per year, from Tables 101 to 104."""
    found: dict[str, dict[int, dict[str, float | int]]] = {}
    trouble: list[str] = []
    # The five-country tables carry a TOTAL column, the wide ones do not.
    tables = [
        ("fires_southern", ANNEX_SOUTHERN, ANNEX_SOUTHERN_CODES, "fires", 1),
        ("area_southern", ANNEX_SOUTHERN, ANNEX_SOUTHERN_CODES, "burned_ha", 1),
        ("fires_other", ANNEX_OTHER, ANNEX_OTHER_CODES, "fires", 0),
        ("area_other", ANNEX_OTHER, ANNEX_OTHER_CODES, "burned_ha", 0),
    ]
    marks = {key: layout.rfind(ANNEX_TITLES[key]) for key, *_ in tables}
    if any(at < 0 for at in marks.values()):
        return {}, ["an annex table title is not in the report"]
    order = sorted(marks.values()) + [len(layout)]
    for key, names, codes, field, extra in tables:
        at = marks[key]
        segment = layout[at:order[order.index(at) + 1]]
        head = segment[:segment.find("\n19")] if "\n19" in segment else segment
        position = -1
        for name in names:
            position = head.find(name, position + 1)
            if position < 0:
                trouble.append(f"{key}: the column order is not the one expected")
                break
        else:
            width = len(names) + extra
            for line in segment.splitlines():
                values = annex_cells(line)
                if values is None:
                    continue
                if len(values) - 1 != width:
                    trouble.append(
                        f"{key} {values[0]}: {len(values) - 1} columns, not {width}")
                    continue
                year = int(values[0])
                for code, raw in zip(codes, values[1:]):
                    if raw == "-" or not re.fullmatch(r"\d+(?:\.\d+)?", raw):
                        continue
                    row = found.setdefault(code, {}).setdefault(year, {})
                    row[field] = (int(raw) if field == "fires"
                                  else tidy(round(float(raw), 2)))
    return found, trouble


def report_bulgaria(layout: str, plain: str) -> list[tuple[int, int, float]]:
    """Ten years of Bulgarian forest fire statistics, from Table 2."""
    start = layout.find("Table 2. Fire statistics for Bulgaria")
    if start < 0:
        return []
    end = layout.find("Source: Executive Forest Agency", start)
    if end < 0:
        return []
    rows: list[tuple[int, int, float]] = []
    for line in layout[start:end].splitlines():
        cells = re.findall(r"\d+(?:\.\d+)?", line.replace(" ", " "))
        if len(cells) < 3 or not re.fullmatch(r"(19|20)\d\d", cells[0]):
            continue
        rows.append((int(cells[0]), int(float(cells[1])), tidy(round(float(cells[2]), 2))))
    if not rows:
        return []
    # The Bulgaria chapter states 2024 to one decimal place; the table rounds.
    exact = re.search(
        r"number of forest fires in Bulgaria is ([\d ]+?) and the burnt area "
        r"is estimated to be ([\d ]+(?:\.\d+)?) ha",
        re.sub(r"\s+", " ", plain))
    if exact:
        fires = int(exact.group(1).replace(" ", ""))
        hectares = tidy(float(exact.group(2).replace(" ", "")))
        for position, (year, table_fires, table_ha) in enumerate(rows):
            if year == 2024 and table_fires == fires and abs(table_ha - hectares) < 1:
                rows[position] = (year, fires, hectares)
    return sorted(rows)


# ---------------------------------------------------------------------------
# Putting a country's file together
# ---------------------------------------------------------------------------


def dense(rows: list[tuple[int, float | None, int | None]]) -> tuple[list[dict], list[int]]:
    """One entry per year from the first to the last, gaps as null."""
    by_year = {year: (fires, hectares) for year, hectares, fires in rows}
    first, last = min(by_year), max(by_year)
    years = []
    for year in range(first, last + 1):
        fires, hectares = by_year.get(year, (None, None))
        years.append({"y": year, "fires": fires, "burned_ha": hectares})
    return years, [first, last]


def make_series(kind: str, name: str, url: str, fetched: str, licence: str,
                note: str, rows: list[tuple[int, float | None, int | None]]) -> dict:
    years, covers = dense(rows)
    return {
        "kind": kind,
        "source": {"name": name, "url": url, "fetched": fetched,
                   "licence": licence, "covers": covers, "note": note},
        "years": years,
    }


def build(data: Path, offline: bool) -> dict[str, int]:
    raw = data / "raw" / "reported"
    derived = data / "derived" / "reported"
    fetcher = Fetcher(raw, offline)

    manifest_path = raw / "manifest.json"
    if offline:
        if not manifest_path.is_file():
            raise SystemExit(
                f"no saved responses to rebuild from: {manifest_path} is missing.\n"
                "Run this script without --offline once first."
            )
        fetched = str(read_json(manifest_path)["fetched"])
    else:
        fetched = date.today().isoformat()

    by_country: dict[str, list[dict]] = {}

    def add(iso3: str, series: dict) -> None:
        by_country.setdefault(iso3, []).append(series)

    # The two estimates portals.
    counts = {"effis": 0, "gwis": 0}
    for which, portal, note in (("effis", EFFIS_PORTAL, EFFIS_NOTE),
                                ("gwis", GWIS_PORTAL, GWIS_NOTE)):
        label = ("EFFIS (European Forest Fire Information System), estimates "
                 "of burned areas and number of fires"
                 if which == "effis" else
                 "GWIS (Global Wildfire Information System), estimates of "
                 "burned areas and number of fires")
        if offline:
            codes = sorted(p.stem.split("_")[-1]
                           for p in raw.glob(f"{which}_estimates_*.json"))
        else:
            codes = estimate_countries(fetcher, which)
            print(f"{which}: {len(codes)} countries offered", flush=True)
        series = estimate_series(fetcher, which, codes)
        counts[which] = len(series)
        for iso3, rows in series.items():
            add(iso3, make_series(ESTIMATE, label, portal, fetched, EU_LICENCE,
                                  note, rows))
        print(f"{which}: {len(series)} countries with a series", flush=True)

    # The United States national report.
    usa = fetcher.get(NIFC_PAGE, "nifc_wildfires.html")
    national = 0
    if usa is None:
        print("no national report for the USA: the page could not be read",
              flush=True)
    else:
        rows, title, footnote = nifc_series(usa)
        if not rows:
            print("no national report for the USA: no table rows were found",
                  flush=True)
        else:
            add("USA", make_series(
                NATIONAL,
                "NIFC (National Interagency Fire Center), "
                + (title or "total wildland fires and acres")
                + ", source the National Interagency Coordination Center",
                NIFC_PAGE, fetched, NIFC_LICENCE, NIFC_NOTE + footnote,
                [(year, hectares, fires) for year, fires, hectares in rows]))
            national += 1
            print(f"USA national report: {len(rows)} years "
                  f"{rows[0][0]} to {rows[-1][0]}", flush=True)

    # The annual report's national tables.
    pdf = raw / "effis_annual_report_2024.pdf"
    if not offline:
        fetcher.get(REPORT_PDF, pdf.name)
    layout = pdf_text(pdf, raw / "effis_annual_report_2024.layout.txt", True)
    plain = pdf_text(pdf, raw / "effis_annual_report_2024.plain.txt", False)
    if layout is None or plain is None:
        print("no national reports from the annual report: the file could not "
              "be read (the poppler tool pdftotext is needed)", flush=True)
    else:
        table1, unknown = report_table1(layout)
        if unknown:
            print("  names in Table 1 with no code, left out: "
                  + ", ".join(unknown), flush=True)
        annex, trouble = report_annex(layout)
        for line in trouble:
            print(f"  annex row left out, nothing guessed: {line}", flush=True)
        bulgaria = report_bulgaria(layout, plain)
        report_name = ("EFFIS annual report, Forest Fires in Europe, Middle "
                       "East and North Africa 2024, Publications Office of the "
                       "European Union, annex Tables 101 to 104 with Table 1 "
                       "for 2024, source JRC's elaboration of the country "
                       "reports")

        # The annex is the long series; Table 1 is the same data for 2024 and
        # prints it to the tenth of a hectare, so it is laid over the annex's
        # rounded 2024; Bulgaria's own chapter table is laid over that.
        national_rows: dict[str, dict[int, dict[str, float | int]]] = {
            code: dict(years) for code, years in annex.items()
        }
        for iso3, (fires, hectares) in table1.items():
            row = national_rows.setdefault(iso3, {}).setdefault(2024, {})
            row["fires"], row["burned_ha"] = fires, hectares
        for year, fires, hectares in bulgaria:
            row = national_rows.setdefault("BGR", {}).setdefault(year, {})
            row["fires"], row["burned_ha"] = fires, hectares

        for iso3, years in sorted(national_rows.items()):
            note = REPORT_ANNEX_NOTE
            name = report_name
            if iso3 == "BGR" and bulgaria:
                name += ", and Table 2 for Bulgaria"
                note = REPORT_BULGARIA_NOTE
            add(iso3, make_series(
                NATIONAL, name, REPORT_DOI, fetched, REPORT_LICENCE, note,
                [(year, row.get("burned_ha"), row.get("fires"))
                 for year, row in sorted(years.items())]))
            national += 1
        spans = [len(y) for y in national_rows.values()]
        print(f"annual report: {len(national_rows)} countries, "
              f"{min(spans)} to {max(spans)} years each "
              f"({len(table1)} of them in Table 1 for 2024)", flush=True)

    if not by_country:
        raise SystemExit("nothing was fetched, so no files were written.")

    # One file per country. The national report leads when there is one.
    def rank(series: dict) -> tuple[int, int, str]:
        span = series["source"]["covers"]
        return (0 if series["kind"] == NATIONAL else 1,
                -(span[1] - span[0]),
                series["source"]["name"])

    if derived.is_dir():
        for stale in derived.glob("*.json"):
            stale.unlink()
    written = 0
    with_report = 0
    for iso3 in sorted(by_country):
        series = sorted(by_country[iso3], key=rank)
        primary = series[0]
        if primary["kind"] == NATIONAL:
            with_report += 1
        write_json(derived / f"{iso3}.json", {
            "schema": "emerge-reported-2",
            "example": False,
            "built": fetched,
            "iso3": iso3,
            "scope": "national",
            "kind": primary["kind"],
            "source": primary["source"],
            "units": {"fires": "count", "burned_ha": "hectares"},
            "years": primary["years"],
            "series": series,
        })
        written += 1

    if not offline:
        write_json(manifest_path, {"fetched": fetched, "requests": fetcher.calls})

    return {"countries": written, "with_report": with_report,
            "estimate_only": written - with_report,
            "national_series": national,
            "effis": counts["effis"], "gwis": counts["gwis"]}


def main() -> None:
    here = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(
        description="Fetch reported and estimated fire figures per country.")
    parser.add_argument("--data", default=str(here / "data"),
                        help="the data folder: responses are saved under "
                             "<data>/raw/reported and files are written to "
                             "<data>/derived/reported")
    parser.add_argument("--offline", action="store_true",
                        help="rebuild from the saved responses, fetching nothing")
    args = parser.parse_args()

    counts = build(Path(args.data), args.offline)
    print("", flush=True)
    print(f"{counts['countries']} countries have a file", flush=True)
    print(f"  {counts['with_report']} of them lead with a national report",
          flush=True)
    print(f"  {counts['estimate_only']} have a satellite estimate only",
          flush=True)
    print(f"  {counts['national_series']} national report series in all",
          flush=True)
    print(f"  EFFIS estimates {counts['effis']}, GWIS estimates {counts['gwis']}",
          flush=True)


if __name__ == "__main__":
    main()
