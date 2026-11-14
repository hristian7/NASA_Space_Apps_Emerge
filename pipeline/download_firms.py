#!/usr/bin/env python3
"""Download NASA FIRMS yearly country files (MODIS, VIIRS S-NPP, VIIRS NOAA-20).

No key or login is needed for these files. Files already on disk with the size
listed in NASA's index are skipped, so the script can be stopped and rerun.

Usage:
  python3 pipeline/download_firms.py --countries Bulgaria United_States
  python3 pipeline/download_firms.py --all
"""

import argparse
import csv
import io
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

BASE = "https://firms.modaps.eosdis.nasa.gov/data/country"
INDEX = f"{BASE}/yearly_summary_files.txt"
NAME = re.compile(r"(modis|viirs-snpp|viirs-jpss1)_(\d{4})_(.+)\.csv$")
UA = {"User-Agent": "nasa-space-apps-emerge/1.0 (hackathon research)"}
ROOT = Path(__file__).resolve().parent.parent / "data" / "raw"


def fetch(url: str, timeout: int = 120) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()


def read_index() -> list[dict]:
    rows = []
    for r in csv.DictReader(io.StringIO(fetch(INDEX).decode())):
        m = NAME.match(r["filename"])
        if m:
            sensor, year, country = m.groups()
            rows.append({"file": r["filename"], "size": int(r["size"]), "sensor": sensor,
                         "year": year, "country": country})
    return rows


def target(row: dict) -> Path:
    return ROOT / row["sensor"] / row["year"] / row["file"]


def download(row: dict, tries: int = 4) -> tuple[str, str]:
    path = target(row)
    if path.exists() and path.stat().st_size == row["size"]:
        return row["file"], "skip"
    path.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/{row['sensor']}/{row['year']}/{row['file']}"
    for attempt in range(1, tries + 1):
        try:
            tmp = path.with_suffix(".part")
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r, open(tmp, "wb") as out:
                while chunk := r.read(1 << 20):
                    out.write(chunk)
            if tmp.stat().st_size != row["size"]:
                raise IOError(f"size {tmp.stat().st_size} != index {row['size']}")
            tmp.replace(path)
            return row["file"], "ok"
        except Exception as e:  # noqa: BLE001
            if attempt == tries:
                return row["file"], f"FAILED: {e}"
            time.sleep(5 * attempt)
    return row["file"], "FAILED"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--countries", nargs="*", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    rows = read_index()
    if not a.all:
        rows = [r for r in rows if r["country"] in set(a.countries)]
    # Small files first so most countries finish early.
    rows.sort(key=lambda r: r["size"])
    total = sum(r["size"] for r in rows)
    print(f"{len(rows)} files, {total / 1e9:.2f} GB -> {ROOT}", flush=True)
    done = failed = 0
    got = 0
    start = time.time()
    with ThreadPoolExecutor(a.workers) as pool:
        futures = {pool.submit(download, r): r for r in rows}
        for f in as_completed(futures):
            r = futures[f]
            name, status = f.result()
            done += 1
            got += r["size"]
            if status.startswith("FAILED"):
                failed += 1
                print(f"{name}: {status}", flush=True)
            if done % 200 == 0 or done == len(rows):
                rate = got / max(1, time.time() - start) / 1e6
                print(f"{done}/{len(rows)} files, {got / 1e9:.2f}/{total / 1e9:.2f} GB, "
                      f"{rate:.1f} MB/s, {failed} failed", flush=True)
    print("DONE" if failed == 0 else f"DONE with {failed} failures (rerun to retry)", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
