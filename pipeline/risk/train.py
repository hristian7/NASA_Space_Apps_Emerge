#!/usr/bin/env python3
"""Fit one world logistic model and select settings on 2024 only."""
import argparse
import datetime as dt
import json
from pathlib import Path
import sys

import duckdb
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.preprocessing import StandardScaler
from features import FEATURES

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/derived/risk'


def load(con, paths):
    if not paths:
        raise ValueError('training table missing')
    names = ','.join(FEATURES)
    valid = ' AND '.join(f'{n} IS NOT NULL AND isfinite({n})' for n in FEATURES)
    frame = con.execute(f'SELECT {names},target,sample_weight FROM read_parquet(?) WHERE {valid}', [[str(x) for x in paths]]).fetchdf()
    x = frame[list(FEATURES)].to_numpy(dtype=np.float64)
    y = frame['target'].to_numpy(dtype=np.int8)
    weights = frame['sample_weight'].to_numpy(dtype=np.float64) / 20.0
    return x, y, weights


def weighted_quantiles(values, weights, quantiles):
    order = np.argsort(values)
    values, weights = values[order], weights[order]
    cdf = np.cumsum(weights) / weights.sum()
    return np.interp(quantiles, cdf, values).tolist()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', type=Path, default=DATA)
    ap.add_argument('--model', type=Path, default=DATA / 'model_v1.json')
    args = ap.parse_args()
    marker = ROOT / 'data/raw/gfwed/.download-2021-2023-done'
    if not marker.exists():
        sys.exit('The 2021 to 2023 download completion marker is missing; training is prohibited.')
    train_files = sorted((args.data / 'training_0.25').glob('202[123]-*.parquet'))
    valid_files = sorted((args.data / 'training_0.25').glob('2024-*.parquet'))
    if len(train_files) != 36 or len(valid_files) != 12:
        sys.exit(f'Expected 36 training months and 12 validation months; found {len(train_files)} and {len(valid_files)}.')
    con = duckdb.connect()
    con.execute('SET threads=4')
    dates = con.execute('SELECT min(day),max(day) FROM read_parquet(?)', [[str(p) for p in train_files]]).fetchone()
    if dates[0] < dt.date(2021, 1, 1) or dates[1] >= dt.date(2024, 1, 1):
        sys.exit('Invalid training date split')
    validation_dates = con.execute('SELECT min(day),max(day) FROM read_parquet(?)', [[str(p) for p in valid_files]]).fetchone()
    if validation_dates[0] < dt.date(2024, 1, 1) or validation_dates[1] >= dt.date(2025, 1, 1):
        sys.exit('Invalid validation date split')
    print('loading training samples', flush=True)
    x, y, w = load(con, train_files)
    print('training rows', len(y), 'new fires', int(y.sum()), flush=True)
    scaler = StandardScaler().fit(x, sample_weight=w)
    x = scaler.transform(x)
    print('loading validation samples', flush=True)
    vx, vy, vw = load(con, valid_files)
    vx = scaler.transform(vx)
    print('validation rows', len(vy), 'new fires', int(vy.sum()), flush=True)
    best = None
    trials = []
    for c in (0.1, 1.0):
        print('fitting C', c, flush=True)
        fit = LogisticRegression(C=c, max_iter=150, solver='lbfgs', tol=1e-5)
        fit.fit(x, y, sample_weight=w)
        pred = fit.predict_proba(vx)[:, 1]
        loss = log_loss(vy, pred, sample_weight=vw, labels=[0, 1])
        trials.append({'C': c, 'validation_log_loss': float(loss), 'iterations': int(fit.n_iter_[0])})
        print('validation weighted log loss', loss, 'iterations', int(fit.n_iter_[0]), flush=True)
        if best is None or loss < best[0]:
            best = (loss, fit, c)
    _, fit, c = best
    del x, y, w
    # Calibrate the selected model using only the validation year and the same
    # inverse sampling weights. The unscaled score is the raw linear predictor.
    raw = fit.decision_function(vx)
    calibration = LogisticRegression(C=1e6, max_iter=100, solver='lbfgs')
    calibration.fit(raw.reshape(-1, 1), vy, sample_weight=vw)
    slope = float(calibration.coef_[0, 0])
    intercept = float(calibration.intercept_[0])
    prob = calibration.predict_proba(raw.reshape(-1, 1))[:, 1]
    cuts = weighted_quantiles(prob, vw, [0.5, 0.75, 0.9, 0.97])
    model = {'model_version': 'logistic-v1', 'features': list(FEATURES),
             'mean': scaler.mean_.tolist(), 'scale': scaler.scale_.tolist(),
             'coefficients': fit.coef_[0].tolist(), 'intercept': float(fit.intercept_[0]),
             'calibration_slope': slope, 'calibration_intercept': intercept,
             'level_probability_limits': cuts, 'level_limit_rule': 'weighted validation probability quantiles 0.50, 0.75, 0.90, 0.97',
             'training_years': [2021, 2022, 2023], 'validation_year': 2024,
             'sample_seed': 20261114, 'negative_sample_rate': 0.05,
             'trials': trials, 'selected_C': c,
             'calibrated_validation_log_loss': float(log_loss(vy, prob, sample_weight=vw, labels=[0, 1])),
             'data_note': 'Majority-class fuel indicators, no NDVI or fuel shares; null weather or history gives null predictions.'}
    args.model.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.model.with_suffix('.tmp')
    tmp.write_text(json.dumps(model, indent=2, allow_nan=False) + '\n')
    tmp.replace(args.model)
    print('wrote', args.model, 'selected C', c, 'level limits', cuts, flush=True)


if __name__ == '__main__':
    main()
