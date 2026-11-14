# NASA Space Apps 2026: Harmonization of MODIS and VIIRS Hot Spots

Team project for the [official challenge](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/) at the Sofia local event, 14–15 Nov 2026.

**Goal:** merge 25 years of NASA satellite fire detections from two sensors (MODIS and VIIRS) into one consistent record, and show it as a fire calendar for any area in a web app.

## Status

- **Live:** [Emerge](https://emerge-beta-ten.vercel.app), with real world fire data from Nov 2000 to 14 Nov 2026 `[V]`. The A3 conversion model was tested on held-out years for every country `[V]`; national reports and satellite estimates are labelled separately.
- **In progress:** [plan 2](specs/plan-2-fire-risk/overview.md), next-day fire risk, started Sat 14 Nov at 23:00 Sofia time `[V]`.
- **Freeze:** Sun 15 Nov at 08:00 Sofia time `[U]`.

## Read first

| File | What it is |
|---|---|
| [`specs/overview.md`](specs/overview.md) | **Start here:** Emerge in one page (what we build now, what comes later) |
| [`specs/specification.md`](specs/specification.md) | **The build spec:** scope, data, design, tests, order of work, open decisions |
| [`specs/plan-2-fire-risk/overview.md`](specs/plan-2-fire-risk/overview.md) | **Plan 2 in one page:** next-day fire risk per region, worldwide |
| [`specs/plan-2-fire-risk/specification.md`](specs/plan-2-fire-risk/specification.md) | **Plan 2 build spec:** data sources (checked 14 Nov), engine, scorecard, screens, file contract, tests, order of work |
| [`docs/research/firefighter-interview.md`](docs/research/firefighter-interview.md) | Interview with a Bulgarian firefighter, the source of plan 2 |
| [`docs/challenge-brief.md`](docs/challenge-brief.md) | NASA's challenge text (source of truth) |
| [`docs/data-sources-master.md`](docs/data-sources-master.md) | **All data sources in one register:** in use, in development, planned, future; ranked by value for fire prediction. Add new sources here |
| [`docs/firms-data.md`](docs/firms-data.md) | Deep dive on the FIRMS fire data for this challenge: download URLs, columns, cleaning rules, sizes, how different the sensors are |
| [`docs/challenges-overview.md`](docs/challenges-overview.md) | All 14 challenges at a glance, plus key rules (added by a teammate) |
| [`docs/challenges-full.md`](docs/challenges-full.md) | Full NASA text and resources for all 14 challenges (added by a teammate) |
| [`docs/data-sources.md`](docs/data-sources.md) | Plain-language guide to every data source named in the 14 challenges (added by a teammate) |
| [`docs/rules-and-judging.md`](docs/rules-and-judging.md) | Deadlines, submission rules, open-source rules, judging criteria, awards |
| [`docs/conversion-plan.md`](docs/conversion-plan.md) | **Research-based conversion plan** (MODIS → VIIRS-level), with sources. Replaces the method in harmonization-plan.md |
| [`docs/harmonization-plan.md`](docs/harmonization-plan.md) | The plan to convert MODIS (low resolution) into VIIRS-level (high resolution) numbers, step by step |
| [`docs/verification-plan.md`](docs/verification-plan.md) | How we prove the conversion and the app are right |
| [`specs/interview-questions.md`](specs/interview-questions.md) | Questions the 6 of us answered to shape the spec |
| [`specs/interview-answers.md`](specs/interview-answers.md) | The team's decisions, plus answers to the team's questions |
| [`specs/features-moscow.md`](specs/features-moscow.md) | All features in priority order (MoSCoW), 2–3 sentences each |
| [`specs/research-tasks.md`](specs/research-tasks.md) | Open research tasks with briefs, and what's still waiting on the team |
| [`docs/research/forecast-options.md`](docs/research/forecast-options.md) | First pass on fire-risk forecasting options |
| [`docs/prediction-engine.md`](docs/prediction-engine.md) | **Prediction engine:** which factors (dryness, ocean/El Niño, fuel growth, trend) drive fire where and how far ahead; validation; live outlook for Dec 2026 – Feb 2027 |
| [`docs/daily-outlook.md`](docs/daily-outlook.md) | **Daily outlook, Bulgaria:** where to pre-position a station team 1–3 days ahead, which municipalities need reinforcements; honest scores against simple rules; GPU runbook |
| [`docs/daily-outlook-v2.md`](docs/daily-outlook-v2.md) | **Daily outlook v2:** NASA GEOS-5 weather model (GFWED), land cover, terrain, 10-epoch neural network; team plan-2 protocol (top 5 per province, new fires, test 2025); measured weight of each data group; live outlook 15–17 Nov |
| [`docs/research/storage-options.md`](docs/research/storage-options.md) | 15 storage options ranked, and the pick for Vercel |
| [`docs/research/stack-options.md`](docs/research/stack-options.md) | 20 stack options ranked, and the recommended stack |
| [`docs/research/data-sources-satellites.md`](docs/research/data-sources-satellites.md) | Data before 2000, 2026 data, other satellites, country statistics |
| [`docs/research/push-alerts.md`](docs/research/push-alerts.md) | Push-alert design on Vercel (S11) |
| [`docs/research/reported-fires-bg-effis.md`](docs/research/reported-fires-bg-effis.md) | Bulgaria's Executive Forest Agency (ИАГ) annual reports 2021–2025, and a full crawl of the Copernicus/EFFIS site, for M28 "detected vs reported" |
| Short versions for review (≤ 500 words each) | [storage](docs/research/storage-options-summary.md) · [stack](docs/research/stack-options-summary.md) · [data sources](docs/research/data-sources-summary.md) · [push alerts](docs/research/push-alerts-summary.md) · [reported fires](docs/research/reported-fires-bg-effis-summary.md) |

## Key deadlines (Sofia time)

- **Sun 15 Nov, 14:00:** Sofia demo video (30–60 s).
- **Sun 15 Nov, 23:59:** NASA submission (video of up to 30 s, or up to 7 slides).

## Tools

**Graphify** maps this folder into a knowledge graph for AI agents. Run `/graphify .` here; the output goes to `graphify-out/`.
