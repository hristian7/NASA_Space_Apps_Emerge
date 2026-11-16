#!/bin/zsh
# Prepare the plan 3 test period inputs (valid days 1 Jan to 31 Oct 2026) with the
# same scripts used for 2021 to 2025. Downloads only; nothing here scores 2026.
# Usage: pipeline/risk/v3_test_data.sh   (resumable: existing files are skipped)
set -e
cd "${0:A:h}"
PY=${PYTHON:-python3}
ROOT=../..
RAW=$ROOT/data/raw/gfwed
BASE=https://portal.nccs.nasa.gov/datashare/GlobalFWI/v2.0/fwiCalcs.GEOS-5/Default/GEOS-5

echo "1/4 NASA fire-weather forecasts, runs 2025-12-29 to 2026-10-28 (lead 3)"
run=2025-12-29
while [[ "$run" < "2026-10-29" ]]; do
  day=$(date -j -v+3d -f %Y-%m-%d "$run" +%Y%m%d)
  r=${run//-/}
  file=FWI.GEOS-5.Daily.Default.${r}00.${day}.nc
  if [[ ! -s $RAW/$file ]]; then
    if curl -sf --retry 4 --retry-delay 10 -o $RAW/$file.part "$BASE/${r[1,4]}/${r}00/$file"; then
      mv $RAW/$file.part $RAW/$file
    else
      rm -f $RAW/$file.part
      echo "missing on the portal: $file"
    fi
  fi
  run=$(date -j -v+1d -f %Y-%m-%d "$run" +%Y-%m-%d)
done

echo "2/4 regrid fire weather to the 0.25 degree land grid"
$PY fwi_to_parquet.py

echo "3/4 fire history for each 2026 test day (observations through D-2)"
$PY build_history.py --start 2026-01-01 --end 2026-10-31

echo "4/4 NOAA GFS runs 2025-12-01 to 2026-10-29 (valid days to 31 Oct 2026)"
$PY v3_weather.py --start 2025-12-01 --end 2026-10-29
$PY v3_inputs.py weather
echo "test-period inputs ready"
