# NASA Space Apps 2026: Harmonization of MODIS and VIIRS Hot Spots

Team project for the [official challenge](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/) at the Sofia local event, 14–15 Nov 2026.

**Goal:** merge 25 years of NASA satellite fire detections from two sensors (MODIS and VIIRS) into one consistent record, and show it as a fire calendar for any area in a web app.

## Status (Sat 14 Nov)

- **Interview answered:** decisions are in [`specs/interview-answers.md`](specs/interview-answers.md).
- **Features chosen (14 Nov evening):** [`specs/features-moscow.md`](specs/features-moscow.md): all Musts and Shoulds; push alerts, combined data and the installable app removed to save time. Hosting on Vercel.
- **Research done (14 Nov):** data sources, storage, tech stack, forecasting checks and push alerts → [`specs/research-tasks.md`](specs/research-tasks.md).
- **Code:** data pipeline started (download and fire cell-days, [`docs/research/first-run-bulgaria-usa.md`](docs/research/first-run-bulgaria-usa.md)); app not started.

## Read first

| File | What it is |
|---|---|
| [`specs/overview.md`](specs/overview.md) | **Start here:** Emerge in one page (what we build now, what comes later) |
| [`specs/specification.md`](specs/specification.md) | **The build spec:** scope, data, design, tests, order of work, open decisions |
| [`docs/challenge-brief.md`](docs/challenge-brief.md) | NASA's challenge text (source of truth) |
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
| [`docs/research/storage-options.md`](docs/research/storage-options.md) | 15 storage options ranked, and the pick for Vercel |
| [`docs/research/stack-options.md`](docs/research/stack-options.md) | 20 stack options ranked, and the recommended stack |
| [`docs/research/data-sources-satellites.md`](docs/research/data-sources-satellites.md) | Data before 2000, 2026 data, other satellites, country statistics |
| [`docs/research/push-alerts.md`](docs/research/push-alerts.md) | Push-alert design on Vercel (S11) |
| Short versions for review (≤ 500 words each) | [storage](docs/research/storage-options-summary.md) · [stack](docs/research/stack-options-summary.md) · [data sources](docs/research/data-sources-summary.md) · [push alerts](docs/research/push-alerts-summary.md) |

## Key deadlines (Sofia time)

- **Sun 15 Nov, 14:00:** Sofia demo video (30–60 s).
- **Sun 15 Nov, 23:59:** NASA submission (video of up to 30 s, or up to 7 slides).

## Tools

**Graphify** maps this folder into a knowledge graph for AI agents. Run `/graphify .` here; the output goes to `graphify-out/`.
