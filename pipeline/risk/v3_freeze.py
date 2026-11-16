#!/usr/bin/env python3
"""Freeze model v3 before any test-period score (PROTOCOL.md, plan 3).

Takes the settings-search winner (trained on 2021 to 2024), calibrates it on
the 2025 settings sample with the same logistic calibration as lightgbm-v2,
writes data/derived/risk/model_v3.json and model_v3.txt, and writes the
freeze record pipeline/risk/v3_frozen.json (code commit and SHA-256 hashes),
which is committed before the test is scored. lightgbm-v2 files are untouched.
"""
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

import lightgbm as lgb
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'
V3 = DATA / 'v3'
RECORD = Path(__file__).resolve().parent / 'v3_frozen.json'


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    state = json.loads((V3 / 'auto_2025.json').read_text())
    chosen = state['chosen']
    name = f"search_{chosen['config_index']:02d}"
    fit = state['fits'][name]
    groups = state['final_groups']
    source = V3 / f'model_{name}.txt'
    booster = lgb.Booster(model_file=str(source))
    if booster.feature_name() != fit['features']:
        raise SystemExit('booster inputs differ from the recorded feature list')
    cache = V3 / 'train_cache_2025' / '+'.join(groups)
    vx, vy, vw = (np.load(cache / f'{part}.npy') for part in ('vx', 'vy', 'vw'))
    raw = booster.predict(vx, raw_score=True, num_threads=4)
    calibration = LogisticRegression(C=1e6, max_iter=100, solver='lbfgs')
    calibration.fit(raw.reshape(-1, 1), vy, sample_weight=vw)
    prob = calibration.predict_proba(raw.reshape(-1, 1))[:, 1]
    target = DATA / 'model_v3.txt'
    shutil.copyfile(source, target)
    model = {'model_version': 'lightgbm-v3', 'kind': 'lightgbm', 'features': fit['features'],
             'input_groups': groups, 'booster_file': target.name,
             'calibration_slope': float(calibration.coef_[0, 0]),
             'calibration_intercept': float(calibration.intercept_[0]),
             'params': chosen['params'], 'training_years': [2021, 2022, 2023, 2024], 'settings_year': 2025,
             'sample_seed': 20261114, 'negative_sample_rate': 0.05,
             'calibrated_settings_log_loss': float(log_loss(vy, prob, sample_weight=vw, labels=[0, 1])),
             'settings_year_result': {k: chosen[k] for k in ('capture', 'alarm_precision',
                                                             'capture_vs_v2_refit', 'alarm_precision_vs_v2_refit')},
             'data_note': 'v2 inputs plus people maps and NOAA GFS weather (00 UTC run of D-2); '
                          'missing added inputs stay missing; null v2 inputs give null predictions.'}
    model_json = DATA / 'model_v3.json'
    model_json.write_text(json.dumps(model, indent=2, allow_nan=False) + '\n')
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    record = {'frozen_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
              'code_commit_before_freeze': commit,
              'model_json_sha256': sha256(model_json), 'booster_sha256': sha256(target),
              'search_trial': name, **{k: model[k] for k in ('input_groups', 'params', 'calibration_slope',
                                                              'calibration_intercept', 'settings_year_result')},
              'test_period': ['2026-01-01', '2026-10-31'],
              'note': 'Written before any test-period score was computed.'}
    RECORD.write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
