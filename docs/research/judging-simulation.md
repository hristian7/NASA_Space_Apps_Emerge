# Judging simulation: how NASA judges would score Emerge (Sun 15 Nov, 13:20)

Inputs: the live app (checked 13:00), the repo (scorecard, validation, submission draft, roadmap), and 3 time-boxed research agents reading official sources. Tags: `[V]` verified at a primary source or repo file, `[D]` directional, `[U]` our judgement.

**Outcome (18 Nov 2026):** Emerge took 2nd place at the Sofia local round `[V]` (organiser's email, week of 16 Nov); global nominees are announced 3 Dec 2026.

## Summary

| | Now | After today's top fixes (≈5 h) | After the model roadmap (post-event) |
|---|---|---|---|
| Impact | 4 | 4 | 4 |
| Creativity | 4 | 4 | 4 |
| Validity | 4 | 4.5 | 5 |
| Relevance | 5 | 5 | 5 |
| Presentation | 3 | 4.5 | 4.5 |
| **Total (of 25)** | **20** | **22** | **22.5** |

All scores `[U]`. NASA scores each criterion 1–5 and doesn't publish how they are combined `[V]`, so the totals assume equal weight `[U]`.

**The answer:**
1. **Don't spend today on the prediction model.** Presentation is our lowest score and the cheapest to lift. Model gains are small, can't be proven before 23:59 (the 2025 test year has already been used), and could break published numbers.
2. **Build next, in order:**
   - fix the risk page's first load (0.5 h);
   - finish the NASA project page (1 h);
   - record the v2 video ([script](../plans/video-script-30s.md));
   - turn on the daily scorecard, so accuracy is checked in public every day.
3. **Target awards:**
   - **Best Use of Data** (first);
   - **Local Impact** and **Best Use of Science** (next).

## 1. NASA's judging criteria

Source: [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) (2026 edition) `[V]`.

| Criterion | What judges look for |
|---|---|
| Impact | How important the problem is, and how many people it helps or inspires |
| Creativity | Original, or a meaningful improvement on what exists |
| Validity | Grounded in science, feasible, could work in the real world, easy to use |
| Relevance | Answers the chosen challenge; NASA data is core, not decoration |
| Presentation | A clear, engaging story. Judged from the demo **and** the project page together |

Facts that shape the plan `[V]`:
- The guide says teams usually do the first four well and should give Presentation equal effort.
- A demo over 30 s, or over 7 slides, is **ineligible for global judging**.
- **Path to a global award:**
  - Sofia jury picks the nominees (3 Dec);
  - expert judges pick the finalists (17 Dec);
  - NASA executives pick the 10 winners (26 Jan 2027).
- **Odds in 2025:** about 1,290 nominees `[V]`, then 45 finalists `[D]`, then 10 winners `[V]` ([rules](../rules-and-judging.md)).
- About 1,200 teams entered this challenge worldwide (13 Nov count `[D]`).

## 2. Emerge scored as a judge would

| Criterion | Score | Why | Evidence |
|---|---|---|---|
| **Impact** | **4** | **For:** a big, growing problem with a named user: a firefighter's top need is tomorrow's risk in one place. It works worldwide. **Against:** no 5 because one interview isn't adoption, and it's a research prototype. | 2025 was the EU's worst fire season on record, 1,079,538 ha `[V]` ([JRC](https://joint-research-centre.ec.europa.eu/jrc-news-and-updates/2025-was-eus-most-destructive-wildfire-season-record-2026-03-31_en)). LA, Jan 2025: 31 deaths `[V]` ([PBS/AP](https://www.pbs.org/newshour/nation/a-year-after-the-la-wildfire-disaster-key-numbers-show-how-it-unfolded-and-the-toll-left-behind)). [Firefighter interview](firefighter-interview.md) |
| **Creativity** | **4** | **For:** no public tool merges MODIS and VIIRS hotspots into one record for any point or drawn area. Adding a next-day ranking scored against NASA's own index is new. **Against:** the conversion is a careful ratio method, not a new science idea, and fire-danger maps already exist. | [Competitors](competitors.md): GWIS keeps the sensors apart; Greenpeace's calendar is MODIS only, 20 countries, ends 2022 `[V]` |
| **Validity** | **4** | **For:** held-out tests, error ranges, baselines and a public proof page. **Against:** weak spots a judge can find. | Bulgaria misses by about 20% of an average month (nRMSE, a normalised error, 0.198) and the USA by about 14% (0.141); 90% ranges held 93.6–96.5% of the time `[V]` (`web/public/data/validation.json`). Risk model, 2025: 20.4% of new fires caught, against history 16.7% and NASA's index 11.2% `[V]` (`scorecard.json`). Weak spots in the list below |
| **Relevance** | **5** | Every ask in the brief is met; NASA FIRMS is the core, with NASA GFWED, GIBS and POWER on top. | Harmonized series, calendar with colour ramp, draw or lat/lon, date range, CSV, anomaly vs median and average, detected vs reported: all live `[V]` (repo inventory and app check) |
| **Presentation** | **3** | **For:** the app is polished and v1 of the video exists. **Against:** v1 lacks the team name and a "why now", and the project page draft has gaps. The proof page is a wall of text, and the risk page opens on an empty region. | Draft still has a `FILL-PUBLIC-SOURCE-LINK` marker and calls the week outlook "unscored", which is now stale `[V]`. Risk-page bug seen live at 13:00 `[V]` |

**Validity weak spots a judge could find** `[V]` unless tagged:
- **Risk page first load:** it shows "Northern Cyprus, no spots" under a Bulgaria selector. Bulgaria in November is all Level 1.
- **Small gain over history:** the model beats history by about 3 points (Europe 2.8, world 3.7). For fires already burning, history wins (Europe 58.7% vs 50.2%).
- **Unscored and unfinished parts:**
  - the chance-of-fire card has no score;
  - the daily scorecard is switched off and has 1 day;
  - Bulgaria's t1 gate (a pass/fail limit set before the test) failed: 0.3233 against 0.30 ([bake-off](bakeoff-results.md)).
- **Drift and calibration:**
  - in 2023–25, Bulgaria's history error rises to about 56%;
  - city squares are overstated: Sofia is about 4× its own history;
  - at the low end, "0.5%" happened 4.1% of the time.
- **Bulgaria's calendar shows a 12× fall,** 18,058 fire days in 2001 to 1,515 in 2025 (live app). National reported forest fires fell much less, 825 to 546. A judge may ask whether the MODIS conversion overstates the 2000s. A likely answer is the end of farm stubble burning under EU rules after 2007 `[U]`; prepare it, and check it if time allows.

## 3. Award categories ranked by our fit

Award text paraphrased from the [2026 guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) `[V]`. Fit is `[U]`.

| Rank | Award | Rewards | Fit (1–5) | Why |
|---|---|---|---|---|
| 1 | **Best Use of Data** | Making space data accessible, or using it in a unique way | **5** | 461 million NASA detections made comparable and searchable for any place `[V]`. Earth-data tools won this award in 2024 (Waterwise, farm water) and 2023 (Storm Prophet) `[D]` |
| 2 | **Local Impact** | Greatest potential to help the team's own community | **4** | Bulgarian firefighter need, Bulgarian national figures, Bulgarian language, oblast regions. **The one fire-related global winner found, G.R.O.W. (Team I.O., 2024), won this award** with a plain-language wildfire site `[D]` ([NASA](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)). The local story must be visible in the video and on the page |
| 3 | **Best Use of Science** | Best, most valid use of science or the scientific method | **4** | Held-out tests, expected answers written first, baselines, error ranges. Our strongest criterion, but recent winners were space-biology and orbit tools `[D]` |
| 4 | **Galactic Impact** | Most potential to improve life on Earth | **3** | Wildfires are global; a 2024 farm Earth-observation app won it `[D]`. Needs a stronger "lives and money" story |
| 5 | Best Use of Technology | Most innovative technology | 3 | LightGBM (a tree-based machine-learning model) and a WebGL globe are solid but common. A 2025 weather web app won `[D]` |
| 6 | Global Connection | Connecting people worldwide | 2 | Covers 235 countries, but nothing connects people |
| 7 | Best Storytelling | Creative storytelling with open data | 2 | Only if the video becomes a story; winners were children's stories and climate tales `[D]` |
| 8 | Most Inspirational | "Captures our hearts" | 2 | Possible with the firefighter story; not our core |
| 9 | Art & Technology | Technical and creative skill combined | 1 | Not our angle |
| 10 | Best Mission Concept | Most plausible mission design | 1 | We have no mission or hardware concept |

**Past global winners** (team or project names only; ✅ = used Earth data). Sources: NASA's announcements for [2025](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/) and [2024](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/) `[V]`.

| Award | 2025 | 2024 |
|---|---|---|
| Best Use of Data | Resonant Exoplanets: AI scanning telescope data | ✅ Waterwise: drought and water tool for farmers |
| Local Impact | ✅ QUEÑARIS: forest restoration in Peru with satellite data | ✅ G.R.O.W. (Team I.O.): plain-language wildfire info site |
| Best Use of Science | SpaceGenes+: space-biology dashboard | WMPGang: near-Earth-object web app |
| Galactic Impact | Astro Sweepers: space-debris risk scores | ✅ 2plant: soil-moisture planting-risk app |
| Best Use of Technology | ✅ Twisters: hyperlocal weather app | 42 QuakeHeroes: seismic AI |
| Best Storytelling | HerCode Space: children's space-weather story | ✅ TerraTales: climate stories |
| Art & Technology | ✅ Zumorroda-X: farm-climate games | ✅ Connected Earth Museum |
| Most Inspirational | Photonics Odyssey: broadband for remote India | ✅ Eco-Metropolis: city game with environmental data |
| Global Connection | Gaia+LEO: orbital data centres | Asteroid Destroyer: exoplanet map |
| Best Mission Concept | PureFlow: habitat design | ✅ Landsat Connect: satellite tracker |

2023: Storm Prophet won Best Use of Data (space-weather prediction) `[D]`, from earlier notes, not re-checked.

**Past-winner patterns:**
- **Earth data is common among winners:** 7 of 10 winners used it in 2024 and 3 of 10 in 2025 `[D]`.
- **Fire projects rarely win:** only one fire project won from 2019 to 2025, G.R.O.W. in 2024 (Local Impact). The 2020 "Spot That Fire" teams reached finalist at best `[D]`.
- **Winners are working tools with a clear user** (farmers, residents, children), told in plain language `[U]`.
- **Local framing wins Local Impact:** both 2024 and 2025 Local Impact winners were tied to one place `[D]`.

## 4. What to build or fix next, ranked by score gain per hour

Gains are `[U]` estimates on the 1–5 scale; hours are for one person with AI agents. **Updated list, sorted into Must, Should, Could and Won't, with human-fire data sources:** [`../plans/score-lift-features.md`](../plans/score-lift-features.md).

| # | Action | Hours | Criterion gain | Gain per hour | When |
|---|---|---|---|---|---|
| 1 | **Fix the risk page's first load:** match region to country, and open on a region that has spots (or say "No forest spots in season here; try …") | 0.5 | Validity +0.25, Presentation +0.25 | **1.0** | Before 23:59 |
| 2 | **Finish the NASA project page:** fill `FILL-PUBLIC-SOURCE-LINK`, fix the stale "week outlook unscored" line (it is scored by lead day now `[V]`), remove tags, use public links, add the firefighter quote and the Bulgarian use case | 1 | Presentation +0.5, Impact +0.1 | **0.6** | Before 23:59 (submission requirement) |
| 3 | **Record the v2 video:** team name, both differentiators by 0:05, why now, firefighter ([script](../plans/video-script-30s.md)) | 1.5 | Presentation +0.5, Impact +0.25 | **0.5** | Sofia 14:00 if possible, else NASA 23:59 |
| 4 | **Proof page "verdict" chart:** one bar chart on top (model, history, index, random), with the text below | 1 | Presentation +0.25, Validity +0.1 | 0.35 | Before 23:59 |
| 5 | **Prepare the Bulgaria 12× answer:** compare the calendar with reported fires and EU stubble-burning rules; one line on the proof page | 0.5 | Validity +0.15 (defensive) | 0.3 | Before the pitch |
| 6 | **Turn on the daily scorecard** (owner adds storage; the job exists `[V]`). Answers the firefighter's "how accurate is it?" with a growing public record | 1.5 | Validity +0.25, Impact +0.1 | 0.23 | Today, so the record grows before 17 Dec |
| 7 | Persistence rule for fires already burning (roadmap 4.5), so history's edge there is used | 1.5 | Validity +0.1 | 0.07 | After submission |
| 8 | Model: use yesterday's fires (roadmap 4.1, "largest for the effort") | 3–5 | Validity +0.1–0.25 | ≈0.05 | After submission; needs a fresh test period |
| 9 | Model: greenness and soil moisture as inputs (4.3), human activity (4.2) | 4–6 each | Validity +0.1–0.25 | ≈0.03 | Post-event roadmap |

**Why the model ranks last for today:**
- **Judges can't see it:** they score a 30 s video and a project page, and the model's few points of gain over history are invisible there.
- **It can't be proven by tonight:** the 2025 test year has already been used twice, so a new version needs a fresh test period (2026 forecasts are not downloaded yet `[V]`).
- **The daily scorecard proves more:** a public, growing record of hits shows accuracy better than a retrain.
- **Whether the app may change after the deadline is unclear.** The rules don't say if the linked app may change after 23:59 `[U]`. Safest: freeze features at submission and let the daily log run.

## 5. Could not verify

- **Nominee and finalist counts for 2024–25:** the official lists load with JavaScript. Only search snippets were found (2025: 18,860 teams `[D]`; 2024: "940+ nominees" `[D]`).
- **Details on past winners:**
  - the 2022 winners: NASA's page returned 404;
  - G.R.O.W.'s data sources and location: press only `[D]`;
  - whether any 2020 "Spot That Fire" team won a global award.
- **Statistics and definitions:**
  - the four-phase emergency cycle: FEMA's page was unreachable, so it was seen only on secondary sites `[D]`;
  - Cunningham et al. 2024, which found extreme fires doubled: the paper was not opened `[D]`;
  - official 2025 Europe death and evacuation totals: only Wikipedia-derived numbers were found.
- **The firefighter's "400,000 evacuated in France and Spain":** no official match. The nearest is one news report of about 325,000 in July 2026 `[D]`.
- **How the five criterion scores are combined:** not published.
