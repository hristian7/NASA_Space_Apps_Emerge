# Wildfire prediction sources: overview and relevance ranking

Researched 2026-11-15 by opening every linked URL. Tags: `[V]` read at the source on 15 Nov · `[D]` directional (paywall, secondary source) · `[U]` our inference.

The 23 sources were reviewed to answer: **can we improve the one-day-ahead prediction without training a neural network?** Short answer: yes. The highest-accuracy non-NN approach in this list (BC model #13) uses lasso-penalised logistic regression and achieves >0.90 AUC on all three sub-models. Our spec is already using the right model type.

## Relevance ranking (for our build)

| Rank | Source | Why relevant | Architecture | Accuracy |
|---|---|---|---|---|
| 1 | **BC model (#13)** | Same model type (logistic regression), three sub-models, 72–83 features, lasso feature selection — template for our build | Lasso-LR, 500-bootstrap | >0.90 AUC `[V]` |
| 2 | **SIMERF (#5)** | Non-NN, logistic/ML, human-caused fires, confirms road proximity as top feature | Logistic/ML | 77.5% ROC-AUC `[D]` |
| 3 | **Open-Meteo (#12)** | Free API that provides lightning density, temperature, humidity, wind — closes the "optional raw weather" gap in our spec | Data source | — |
| 4 | **CSIRO methodology (#16)** | Evaluation guidelines: switch primary metric to AUC-PR; spatial block cross-validation; mandatory calibration check | Evaluation research | — |
| 5 | **Mesogeos datacube (#2)** | Feature-domain template: weather + fuel + human factors + topography. Random Forest and XGBoost baselines available | Deep learning + RF/XGBoost baselines | >81% F1 `[V]` |
| 6 | **West Coast XGBoost (#17)** | Non-NN ignition model with 11-channel input set (includes KBDI, terrain, soil moisture); open source | XGBoost | ROC-AUC 0.785 `[V]` |
| 7 | **OroraTech/LMU (#3)** | 37-feature RF baseline on 0.1° daily grid; PR-AUC results confirm FWI alone is weak | RF + UNet | PR-AUC 7.8–25% `[V]` |
| 8 | **NOAA GLM (#20)** | Free lightning data; real-time + archive; enables lightning-cause modelling | Data source | — |
| 9 | **BEYOND Greece (#4)** | Operational daily 500 m system; confirms weather + terrain + land cover + history is sufficient; no open code | ML (unspecified) | "High accuracy" `[V]` |
| 10 | **PNNL lightning (#14)** | Lightning-specific model; confirms lightning should be modelled separately | XGBoost or RF `[D]` | 82% `[D]` |
| 11 | **FPA-FOD US Fire DB (#10)** | Free US fire occurrence records with cause field (human vs lightning) — labels for US training | Data source | — |
| 12 | **LANDFIRE (#19)** | Free 30 m fuel model maps for USA; more detailed fuel description than our MCD12C1 for US-only regions | Data source | — |
| 13 | **WISP (#6)** | Non-publicly-available code; validates 48-hour meteorological lookback and spatial capture-rate metric | Deep learning | 54.1% within 5 km `[V]` |
| 14 | **Source #15 (eimirjihad)** | Logistic regression explicitly compared with RF/XGBoost; LR underperforms on ignition specifically | LR + RF + XGBoost | RF F2=0.608 `[V]` |
| 15 | **ECMWF Open Data (#11)** | Free CC-BY 15-day forecast; only last 2–3 days free without MARS account | Data source | — |
| 16 | **ERA5-Land (#21)** | Historical reanalysis at 0.1°; free CDS account needed; 5-day lag | Reanalysis | — |
| 17 | **Athens deep-learning (#9)** | Confirms same feature set as ours; neural network only; no open code | CNN/LSTM | 80.6–87.9% F1 `[D]` |
| 18 | **Global lightning XGBoost (#18)** | Lightning → ignition; paywall; confirms XGBoost for lightning cause | XGBoost | 91.6% `[D]` |
| 19 | **WEF FireAId (#7)** | Marketing claim (80%); no open code; no novel inputs | Unknown | 80% `[D]` |
| 20 | **WISP sequel FireCastRL (#22)** | Neural network; **confirmed data leakage** (15 post-ignition days in input) — accuracy figure invalid | CNN-BiLSTM | 73.1% (unreliable) `[V]` |
| 21 | **NIFC (#23)** | US government fire occurrence database; ArcGIS portal (JS-heavy); useful for training labels | Data source | — |
| 22 | **ECMWF AI-Probability-of-Fire (#1)** | Jupyter sandbox notebook; CDS data access pattern is borrowable; main model not open | Educational NN notebook | Not published `[V]` |
| 23 | **WISP paper (#6)** | Deep learning, code not released; evaluation metric (spatial capture rate) is borrowable | Deep learning | 38.2% AP `[V]` |

## Which sources to act on immediately

**This weekend (before demo):**
- Open-Meteo API (#12): add to `build_inputs.py` — 1–2 hours
- CSIRO metric change (#16): update `PROTOCOL.md` and `backtest.py` to use AUC-PR — 30 min
- BC model feature list (#13): use as a checklist when writing `build_grid.py`

**After the weekend (future work):**
- LANDFIRE fuel models (#19): replace MCD12C1 for US-only subgrid — significant improvement for USA regions
- Separate lightning vs human sub-models (BC approach) — Version 2 of the engine
- FPA-FOD cause labels (#10): enable cause-stratified accuracy reporting

## Sources that are NOT useful for our build

- **Mesogeos datacube (#2):** Mediterranean-only; we need global. But the feature categories are a useful checklist.
- **FireCastRL (#22):** Data leakage confirmed; accuracy invalid. Do not cite or compare against.
- **Athens model (#9):** Neural network; no open code; inputs already match ours.
- **ECMWF AI-Probability-of-Fire (#1):** Educational notebook; main operational model not open.
- **WEF FireAId (#7):** Marketing; no technical substance available.
