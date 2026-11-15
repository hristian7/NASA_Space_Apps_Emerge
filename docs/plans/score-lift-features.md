# Features and fixes that lift our judging score (MoSCoW)

Sun 15 Nov 2026, 14:00. Builds on [`../research/judging-simulation.md`](../research/judging-simulation.md) (scores and reasons) and the [post-event roadmap](2026-11-15-post-event-roadmap.md) (model work). The live app was checked at 13:00 and 13:45. Tags: `[V]` verified (official page or repo file) · `[D]` directional · `[U]` our estimate. All gains and hours are `[U]`.

**Not in this list (the team does these):**
- the NASA project page;
- the v2 video ([script](video-script-30s.md)).

## Score: now and after each group

NASA scores five criteria, each 1–5, for a maximum of **25** `[V]`.

| Criterion | Now | After Must (+ team tasks) | After Should | After Could | What caps it |
|---|---|---|---|---|---|
| Impact | 4 | 4 | 4.5 | 4.5 | Proof that a fire service uses it |
| Creativity | 4 | 4 | 4.5 | 4.5 | Something no one else has (farm vs forest fires, human causes) |
| Validity | 4 | 4.5 | 4.5 | 5 | Gain over history is only about 3 points `[V]`; parts still unscored |
| Relevance | 5 | 5 | 5 | 5 | — |
| Presentation | 3 | 4.5 | 4.5 | 4.5 | Video and project page quality |
| **Total / 25** | **20** | **22** | **23** | **23.5** | |

"Gain/h" below means score points gained per hour of work.

## Must have: before the NASA deadline (23:59 today)

| # | Feature or fix | What it does, in plain words | Lifts | Gain | Hours | Gain/h |
|---|---|---|---|---|---|---|
| L1 | **Fix the risk page's first load** | Today it opens on "Northern Cyprus, no spots" under a Bulgaria selector `[V]`, seen live. Match the region to the country. If a region has no spots, say why ("out of fire season") and suggest a region that has some | Validity, Presentation | +0.5 | 0.5 | **1.0** |
| L2 | **Fix the About page** | It says Emerge "does not predict fires" `[V]`, but the app has a next-day outlook. Rewrite it in two lines and add the firefighter's need | Presentation, Validity | +0.15 | 0.25 | **0.6** |
| L3 | **Welcome card on the home screen** | The home screen opens on a dark globe with no words `[V]`, seen 13:45. Add one sentence plus three buttons: "Bulgaria's fire calendar", "Los Angeles, Jan 2025", "Tomorrow's risk". A judge then sees the value in one click | Presentation, Validity (ease of use) | +0.5 | 1 | **0.5** |
| L4 | **Fix stale and mismatched text** | The README and submission draft still call the week outlook "unscored", but it is now scored by lead day `[V]`. The Sofia card says "Valid for November 14" on 15 Nov `[V]`. Add one line on why the calendar shows fire days by default (more accurate in tests `[V]`) and point to the Hotspots tab | Validity, Presentation, Relevance | +0.2 | 0.5 | **0.4** |
| L5 | **Get the firefighter's feedback on the live app** | Send him the link and ask: would you use this, and what's missing? Put one quote on the project page. Real user feedback is what lifts Impact | Impact, Validity | +0.35 | 1 | **0.35** |
| L6 | **Verdict chart on the proof page** | One bar chart on top: our model, history, NASA's index and random, for Europe and the world. The text stays below it | Presentation, Validity | +0.35 | 1 | **0.35** |
| L7 | **Explain Bulgaria's 12× drop** | The calendar falls from 18,058 fire days (2001) to 1,515 (2025), while reported forest fires fell from 825 to 546 `[V]` (live app). Check the farm vs forest split. Add one line to the proof page before a judge asks | Validity | +0.15 | 0.75 | 0.2 |
| L8 | **Turn on the daily scorecard** | The job exists but is switched off until the owner adds storage `[V]`. Each day it checks yesterday's forecast against real fires and publishes the result, which answers the firefighter's "how accurate is it?" The record grows before the finalists are chosen (17 Dec) | Validity, Impact | +0.35 | 1.5 | 0.23 |

Total ≈ 6.5 hours.

## Should have: today if time allows, otherwise first after submission

| # | Feature or fix | What it does, in plain words | Lifts | Gain | Hours | Gain/h |
|---|---|---|---|---|---|---|
| L9 | **Check the colour ramp for colour blindness** | NASA's brief asks for accessible colour ramps `[V]`. Test the calendar colours with a colour-blindness simulator, fix them if needed, and say so in the legend | Relevance, Presentation | +0.1 | 0.5 | 0.2 |
| L10 | **Farm vs forest split** (feature S15) | Split every month and every risk spot into farm burns vs wildfires, using the land type we already have. Shows how many fires people light on farms, and explains Bulgaria's trend (L7) | Creativity, Validity, Impact | +0.4 | 2.5 | 0.16 |
| L11 | **Label the "chance of fire" card as unscored**, then score it | It has no test result yet `[V]`. Add a label now (10 min); score it on held-out years later (2 h) | Validity | +0.1 | 0.25 → 2 | 0.4 → 0.05 |
| L12 | **Printable daily brief** (C13) | Tomorrow's top spots for one region on one page, for the morning crew briefing. Strengthens the Local Impact story | Impact, Presentation | +0.25 | 2 | 0.12 |
| L13 | **City-square warning** | Mark built-up squares, where the model overstates risk (Sofia about 4× its own history `[V]`) | Validity | +0.1 | 1 | 0.1 |
| L14 | **Rule for fires already burning** (roadmap 4.5) | For fires that are already burning, show "fire nearby yesterday", which beats our model there (Europe 58.7% vs 50.2% `[V]`) | Validity | +0.1 | 1.5 | 0.07 |

## Could have: after submission (model roadmap and human data)

Every new model must first pass a fresh test period (from Jan 2026), because the 2025 test year is used up `[V]`.

| # | Feature | What it does | Lifts | Hours |
|---|---|---|---|---|
| L15 | **Human activity as model inputs** (roadmap 4.2) | Holiday and weekend flags, population, roads and farmland share per square (sources below) | Validity, Creativity | 1–5 each |
| L16 | **Use yesterday's fires** (roadmap 4.1) | Forecast in the evening using that afternoon's detections. Roadmap: "largest gain for the effort" | Validity | 3–5 |
| L17 | **Plant dryness as inputs** (roadmap 4.3) | Soil moisture and greenness as numbers. Needs a free NASA Earthdata account | Validity | 4–6 |
| L18 | **Terrain slope** | Steep slopes spread fire faster (teammates' research, [`../research/prediction/new-input-features.md`](../research/prediction/new-input-features.md)) | Validity | 2–3 |
| L19 | **Lightning climatology** | Separates natural from human ignitions (LIS/OTD, below) | Validity | 1–2 |
| L20 | **ECMWF Probability of Fire as a third baseline** (roadmap 4.4) | "Beats history, NASA's index and ECMWF's AI model" would be our strongest claim | Validity, Creativity | 1 to check |
| L21 | **Fresh 2026 test period** | Needed before any new model is claimed | Validity | 2–3 |
| L22 | **Human-pressure map layer** | Population, roads and farmland on the map, beside the fire layers | Creativity, Impact | 2 |
| L23 | **25-year time-lapse on the globe** (C5) | A striking shot for the video and pitch | Presentation | 2–3 |
| L24 | **Smaller squares, 0.1°** (roadmap 4.6) | Closer to "this slope of this mountain"; only after L15–L17 | Validity | 5+ |

## Won't have (this round)

| What | Why not |
|---|---|
| Retraining or republishing the model before 23:59 | It can't be tested in time, and it could break published numbers |
| Neural networks | The teammates' research shows that non-neural models are enough for now |
| An 80–90% accuracy target | Those figures come from balanced test sets, so they aren't comparable `[D]` ([roadmap section 3](2026-11-15-post-event-roadmap.md)) |
| Global wildland-urban interface map at 10 m, US fire-cause records (FPA-FOD), power lines | Heavy (about 14.8 GB `[D]`), US only, or mainly California |
| Already ruled out in [`../../specs/features-moscow.md`](../../specs/features-moscow.md) | Official warnings, accounts, app-store apps, push alerts, fire stations, firebreaks, cameras, live coordination |

## Human-caused fires: data sources to add (for L15 and L22)

**Why it matters:** people start almost all of Bulgaria's forest fires. The Forest Agency's reports for 2021–2025 give these cause shares `[V]` ([`../research/reported-fires-bg-effis.md`](../research/reported-fires-bg-effis.md), iag.bg reports):

| Cause | Share of fires |
|---|---|
| Negligence | 57–66% |
| Unknown | 24–33% |
| Natural | 4–9% |
| Intentional | 1–4% |

Our model has no human input today `[V]`.

Ranked by value per hour. Checked 15 Nov by a research agent; effort `[U]`: S = up to 2 h, M = 3–5 h, L = more than 5 h.

| # | Source | Measures | Resolution, years | Licence and access | Effort |
|---|---|---|---|---|---|
| 1 | Python [`holidays`](https://pypi.org/project/holidays/) package | Public holidays per country, plus weekends | Daily, past and future | MIT `[D]`, no login, works offline | S |
| 2 | NASA SEDAC [GPWv4 population density](https://www.earthdata.nasa.gov/data/catalog/sedac-ciesin-sedac-gpwv4-popdens-r11-4.11) | People per km² | **0.25° version matches our grid** `[V]`; 2000–2020 every 5 years `[V]` | Open, no restriction `[V]` | S |
| 3 | JRC [GHSL population and built-up](https://human-settlement.emergency.copernicus.eu/download.php) | Population, built-up surface | About 1 km `[D]`; 2020 `[V]` | Reuse allowed with credit `[V]` | S |
| 4 | [GRIP global roads](https://dataportaal.pbl.nl/GRIP4) | Road density | About 8 km raster `[D]`; 2018 | CC-BY 4.0 `[D]` | S |
| 5 | [ESA WorldCover](https://zenodo.org/records/7254221) | Farmland and other land classes | 10 m; 2021 `[V]` | CC-BY 4.0 `[D]`, no login | M (average up to 0.25°) |
| 6 | SEDAC [Global Human Modification](https://sedac.ciesin.columbia.edu/data/set/Lulc-human-modification-terrestrial-systems) | One 0–1 index from 13 human pressures | About 1 km; about 2016 `[D]` | Open (SEDAC copy, not the Earth Engine copy) `[D]` | S |
| 7 | NASA [Black Marble](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP46A2/) night lights | Human activity at night | 500 m, daily `[D]` | Free Earthdata login | M |
| 8 | OpenStreetMap roads (Geofabrik extracts) | Exact roads, for "distance to road" | Vector, updated continuously | ODbL, share-alike `[D]` | M (Europe); L (world) |
| 9 | [LIS/OTD lightning climatology](https://ghrc.nsstc.nasa.gov/pub/lis/climatology/LIS-OTD/HRAC/doc/LISOTD_climatology_dataset.pdf) | Natural-ignition background | 0.5° monthly; 1995–2014 `[D]` | NASA open `[U]` | S |

**Add first:**
1. holiday and weekend flags (1);
2. population at 0.25° (2);
3. road density (4);
4. farmland share (5).

All four are free, global and quick to add.

**Could not verify:**
- whether SEDAC downloads need a login;
- the GHSL population resolution;
- the licence of the Black Marble page (it returned 404);
- the licences for FPA-FOD and the wildland-urban interface map;
- a cause dataset for the EU: none found; Bulgaria's causes are national totals only, without locations.

## Award targeting (for the global finalists)

Judges don't pick a category for us. Expert judges choose about 45 finalists `[D]` on the five scores, then NASA executives assign each finalist to one of the 10 awards `[V]`. We frame for:
1. **Best Use of Data:** L3, L6 and L10 make the data's value obvious;
2. **Local Impact:** L5, L12 and the Bulgarian story; the only fire project to win a global award, G.R.O.W. (2024), won this one `[D]`;
3. **Best Use of Science:** L6, L8 and L21.

Past winners are listed in [`../research/judging-simulation.md`](../research/judging-simulation.md), section 3.
