# Switching the app to model v3

16 Nov 2026. Code on branch `model-v3`; nothing is live until the steps below are done.

## How the switch works

The daily job (`.github/workflows/risk-daily.yml`, 04:30 UTC) reads one GitHub variable, `RISK_V3_MODE`:

| Mode | What the job does | What users see |
|---|---|---|
| `off` (default, also when unset) | Exactly what it does today | v2 |
| `shadow` | Computes v3 every day next to v2 and saves it (`v3/shadow/<day>.parquet` in the saved state) | v2 |
| `on` | Shows v3 once both published days have v3; any day v3 is missing (NOAA forecast late or broken, or a v3 step fails) publishes v2 as before | v3, with v2 as fallback |

Rehearsed on copies of the live state for 16 Nov 2026 [V]: `off` and `shadow` publish identical spot files (566 of 566), and `on` publishes `lightgbm-v3` with weather values and reasons filled in.

## One-time setup (needs someone with the Blob key and repo admin)

1. **Upload the v3 starting files** (frozen model, people map, usual values, dry-spell state; 25.8 MB, SHA-256 `3d253e26af339c5e8ebcb31b9eb9e251891e6b509fae18c4c3f8057b0a853985`), built by `python pipeline/risk/v3_live.py seed`:

   ```bash
   python -c "import os,sys; sys.path.insert(0,'pipeline/risk'); import daily; from pathlib import Path; daily.blob_put(os.environ['NEXT_PUBLIC_RISK_DATA_URL'], '_state/v3_seed.tar.gz', Path('data/derived/risk/v3/v3_seed.tar.gz'), os.environ['BLOB_READ_WRITE_TOKEN'])"
   ```

2. **Set three repository variables:** `RISK_V3_SEED_URL` = the risk data URL followed by `/_state/v3_seed.tar.gz`; `RISK_V3_SEED_SHA256` = the hash above; `RISK_V3_MODE` = `shadow`.
3. **Merge `model-v3` into `main`.** The workflow then installs GDAL (the free tool that reads NOAA's GRIB files) only while v3 is enabled.

After a few days in `shadow`, compare the saved v3 days with v2 on the fires that happened, update the proof page (below), then set `RISK_V3_MODE` to `on`. Setting it back to `off` returns to v2 the next morning.

## Still to do before `on`

| Item | Why |
|---|---|
| Proof page | It shows the 2025 test of v2. The 2026 test of v3 in the same format is ready: `data/derived/risk/v3/scorecard_model_{world,europe}_{v2,v3}_2026.json`, from the registered scorer `backtest.py` (world: v3 21.39% vs v2 20.89%; Europe: 57.91% vs 56.60%) [V]. The page copy names v2 and 2025 and needs rewording |
| Week outlook | Leads 4 to 8 keep v2 and fire history: v3 was trained on the D-2 forecast only [V] |
| Shadow comparison script | Scores the saved v3 days and v2 on the same fires after a few days |

## Plain-sense limits on weather reasons

A weather reason appears only when it is also true in plain terms: Hot weather at 30 C or more; Strong wind at 30 km/h or gusts of 50 km/h; Little recent rain after 7 dry days with under 1 mm forecast; low humidity counts as dry at 35% or less [U]. Without these limits a 9 C November day in Bulgaria read "Hot weather" in the rehearsal [V].
