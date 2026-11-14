#!/usr/bin/env bash
# Version 2, end to end, from engine/daily/v2 (needs engine/daily/cells.csv and engine/daily/viirs/
# from version 1: python3 ../grid.py, and the FIRMS yearly CSVs as in ../gpu_run.sh).
# About 40 minutes on 2 CPU cores, mostly downloads. GPU optional (XGBoost uses CUDA if present).
set -euo pipefail
cd "$(dirname "$0")"
python3 gfwed.py analysis 2014 2026          # GEOS-5 fire weather, Bulgaria subset by byte ranges
python3 gfwed.py forecast 2017 2026
python3 static.py                            # ESA WorldCover, Copernicus DEM, provinces
python3 features2.py                         # builder2.pkl
for L in 1 2 3; do for lab in all new; do
  python3 -W ignore train2.py $L $lab xgb
  python3 -W ignore train2.py $L $lab mlp    # 10 epochs
  python3 -W ignore ensemble.py $L $lab L${L}_${lab}_xgb L${L}_${lab}_mlp
done; done
# group weights: remove one group at a time
for g in weather_fc weather_now weather_fc+weather_now fuel terrain fuel+terrain history_recent history_calendar season; do
  python3 -W ignore train2.py 1 all xgb $g; done
WX=power python3 -W ignore train2.py 1 all xgb fuel+terrain     # version-1 weather for comparison
NOLOYO=1 python3 -W ignore train2.py 1 all xgb                  # without the climatology fix
EPOCHS=30 python3 -W ignore train2.py 1 all mlp                 # 30 epochs vs 10
python3 summarize.py test2025
python3 fetch_viirs_2026.py && python3 -W ignore live2.py "$(date +%F)"
python3 -m pytest tests -q
