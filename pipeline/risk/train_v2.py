#!/usr/bin/env python3
"""Fit a LightGBM challenger; selection against v1 uses 2024 only."""
import argparse
import datetime as dt
import json
from pathlib import Path
import sys

import duckdb
from lightgbm import LGBMClassifier
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss

from features import FEATURES
from train import DATA, ROOT, load, weighted_quantiles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--model', type=Path, default=DATA / 'model_v2.json')
    args = ap.parse_args()
    if not (ROOT / 'data/raw/gfwed/.download-2021-2023-done').exists():
        sys.exit('Historical download completion marker is missing.')
    train_files = sorted((args.data / 'training_0.25').glob('202[123]-*.parquet'))
    valid_files = sorted((args.data / 'training_0.25').glob('2024-*.parquet'))
    if len(train_files) != 36 or len(valid_files) != 12:
        sys.exit('Expected 36 training months and 12 validation months.')
    con = duckdb.connect()
    con.execute('SET threads=4')
    for files, earliest, latest in ((train_files, dt.date(2021, 1, 1), dt.date(2024, 1, 1)),
                                    (valid_files, dt.date(2024, 1, 1), dt.date(2025, 1, 1))):
        lo, hi = con.execute('SELECT min(day),max(day) FROM read_parquet(?)', [[str(p) for p in files]]).fetchone()
        if lo < earliest or hi >= latest:
            sys.exit('Invalid model date split.')
    print('loading pre-2024 training samples', flush=True)
    x, y, w = load(con, train_files)
    print('loading 2024 validation samples', flush=True)
    vx, vy, vw = load(con, valid_files)
    print('training rows', len(y), 'validation rows', len(vy), flush=True)
    trials = []
    best = None
    for leaves in (15, 31):
        print('fitting leaves', leaves, flush=True)
        fit = LGBMClassifier(n_estimators=120, num_leaves=leaves, max_depth=6,
                             learning_rate=0.08, n_jobs=4, verbosity=-1,
                             random_state=20261114, deterministic=True, force_col_wise=True)
        fit.fit(x, y, sample_weight=w, feature_name=list(FEATURES))
        raw = fit.predict(vx, raw_score=True, num_threads=4)
        pred = 1 / (1 + np.exp(-np.clip(raw, -700, 700)))
        loss = float(log_loss(vy, pred, sample_weight=vw, labels=[0, 1]))
        trials.append({'num_leaves': leaves, 'validation_log_loss': loss})
        print('validation weighted log loss', loss, flush=True)
        if best is None or loss < best[0]:
            best = (loss, fit, leaves, raw)
    _, fit, leaves, raw = best
    del x, y, w, vx
    calibration = LogisticRegression(C=1e6, max_iter=100, solver='lbfgs')
    calibration.fit(raw.reshape(-1, 1), vy, sample_weight=vw)
    prob = calibration.predict_proba(raw.reshape(-1, 1))[:, 1]
    cuts = weighted_quantiles(prob, vw, [0.5, 0.75, 0.9, 0.97])
    booster = args.model.with_suffix('.txt')
    fit.booster_.save_model(str(booster))
    model = {'model_version': 'lightgbm-v2', 'kind': 'lightgbm', 'features': list(FEATURES),
             'booster_file': booster.name, 'calibration_slope': float(calibration.coef_[0, 0]),
             'calibration_intercept': float(calibration.intercept_[0]),
             'level_probability_limits': cuts,
             'level_limit_rule': 'weighted validation probability quantiles 0.50, 0.75, 0.90, 0.97',
             'training_years': [2021, 2022, 2023], 'validation_year': 2024,
             'sample_seed': 20261114, 'negative_sample_rate': 0.05,
             'fuel_class_available_from': '2023-09-23',
             'trials': trials, 'selected_num_leaves': leaves,
             'calibrated_validation_log_loss': float(log_loss(vy, prob, sample_weight=vw, labels=[0, 1])),
             'data_note': 'Majority-class fuel indicators, no NDVI or fuel shares; null weather or history gives null predictions.'}
    args.model.write_text(json.dumps(model, indent=2, allow_nan=False) + '\n')
    print('wrote', args.model, 'and', booster, 'selected leaves', leaves, flush=True)


if __name__ == '__main__':
    main()
