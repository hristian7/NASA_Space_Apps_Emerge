#!/usr/bin/env bash
# One-shot run on a rented GPU box (RunPod / Vast.ai, any CUDA image with Python 3.10+).
# Rebuilds the inputs from public data, searches settings on 2021 only, then scores
# 2022-2025 once. Copy results/ back before you stop the box.
#
#   bash gpu_run.sh 200        # 200 search trials per lead (about 30-60 min on an RTX 4090)
#
# Needs no key: FIRMS yearly country CSVs, NASA POWER and geoBoundaries are open.
set -euo pipefail
TRIALS=${1:-200}
cd "$(dirname "$0")"

pip install -q "xgboost>=2.0" "xclim==1.0.0" pandas pyarrow duckdb scipy shapely numpy scikit-learn

# 1. Inputs (skip what already exists)
[ -f bgr_adm2.geojson ] || curl -sSL -o bgr_adm2.geojson \
  https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/BGR/ADM2/geoBoundaries-BGR-ADM2.geojson
mkdir -p viirs
for y in $(seq 2012 2025); do
  f=viirs/viirs-snpp_${y}_Bulgaria.csv
  [ -s "$f" ] || curl -sS -C - --retry 20 --retry-all-errors -o "$f" \
    https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/${y}/viirs-snpp_${y}_Bulgaria.csv
done
for y in $(seq 2018 2025); do
  f=viirs/viirs-jpss1_${y}_Bulgaria.csv
  [ -s "$f" ] || curl -sS -C - --retry 20 --retry-all-errors -o "$f" \
    https://firms.modaps.eosdis.nasa.gov/data/country/viirs-jpss1/${y}/viirs-jpss1_${y}_Bulgaria.csv
done
[ -f cells.csv ] || python3 grid.py
[ -f weather_daily.parquet ] || python3 weather.py
[ -f builder.pkl ] || python3 features.py

nvidia-smi || echo "no GPU found - everything still runs on CPU, just slower"

# 2. Search on 2021 only, 3. test once on 2022-2025
mkdir -p results
for L in 1 2 3; do
  python3 -W ignore search_gpu.py "$TRIALS" "$L"
  cp best_config.json "results/best_config_L${L}.json"
  for v in forecast noforecast; do
    CONFIG_JSON="results/best_config_L${L}.json" python3 -W ignore train_eval.py "$L" "$v"
  done
  CONFIG_JSON="results/best_config_L${L}.json" LIVE=1 python3 -W ignore train_eval.py "$L" forecast
done
cp result_*.json model_*.json results/
echo "done - copy engine/daily/results/ off the box"
