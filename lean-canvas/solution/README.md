# Solution

Updated 18 Nov 2026. The product is built; this page is the business view of it. Build details: [`../../README.md`](../../README.md), [`../../specs/`](../../specs/). Proof page: https://emergefire.app/proof.

## What exists today

The free web app at https://emergefire.app does three things:
- **One fair fire record:** MODIS and VIIRS merged into one 25-year record for any place on Earth, with error ranges ([`../../docs/conversion-plan.md`](../../docs/conversion-plan.md)).
- **Data in one place:** more than 25 sources, about half from NASA. On 18 Nov, `web/src/lib/ui/sources.ts` listed 29 sources in use, 14 of them NASA `[V]`; on 15 Nov the count was 22 and 11, which the video and slides still show.
- **Tomorrow's fire risk:** our own machine-learning model (LightGBM v3). It keeps v2's 20 inputs (fire weather, fire history, recent nearby fires, land type, season, latitude) and adds people (population, roads, built-up land) and NOAA GFS forecast weather. It publishes daily forecasts for today and tomorrow `[V]`.

## Forecast results (the numbers to quote)

**Test:** January–October 2026, data the model never saw. Each day, each method picks the top 5 squares (0.25°, about 28 km) per region; we count the share of new forest and wildland fires that land in them `[V]`, from `web/public/data/risk/scorecard.json`.

| Method | World | Europe |
|---|---|---|
| **Emerge v3** | **21.4%** | **57.9%** |
| Past fire history | 17.2% | 54.3% |
| NASA fire-weather index | 11.5% | 43.6% |
| Random picks | 10.9% | 41.7% |

- **World:** 1.9× NASA's index.
- **Europe:** 1.3×. Its percentages are higher because its regions are small, so 5 squares cover more of each one.
- **v3 against v2,** on the same days: 21.39% vs 20.89%, interval +0.40 to +0.61 points. Alarm precision (top 1,000 spots a day) rose from 6.27% to 7.04% `[V]` ([`../../specs/plan-3-model-inputs/v3-test-report.md`](../../specs/plan-3-model-inputs/v3-test-report.md)).
- **Live log, 14–17 Nov:** 620 of 3,219 new fires caught worldwide (19.3%), against 406 (12.6%) for the index `[V]`. The days mix v2 and v3 (v3 took over on 16 Nov). Four days is too few to judge.
- **Bulgaria engine** (branch `prediction-engine`, not live): 1–3 days ahead by municipality. Ranking score (AUC) 0.84–0.85 vs 0.73–0.76 for the index; 3 spots per municipality catch about 80% of fires within about 15 km `[V]`, a generous test.

## Next (not built)

- **A data feed (API)** that customers' own software reads.
- **Alerts** when risk rises near what a customer protects: power-line corridors, insured portfolios, forests.
- **Per-asset fire history and risk reports,** for insurers and carbon projects.

## Limits buyers will ask about

- **Coarse squares:** 28 km is coarse; utilities use sub-kilometre models.
- **Probabilities:** imperfectly calibrated; the app shows levels, not exact chances.
- **One test period** (2026). The 2025 hold-out was used during model selection.
- **People inputs** (population, roads) add little: under 2.2% of the model's splitting gain `[V]`.
