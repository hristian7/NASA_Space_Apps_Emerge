# Specification interview: questions for the team (6 people)

**Goal:** answer these questions together, so we can write the project specification and start building fast.
Each question has a **proposed default** from our research. If you agree, write "OK". If not, write your answer.
Background: [`../docs/challenge-brief.md`](../docs/challenge-brief.md) · [`../docs/firms-data.md`](../docs/firms-data.md) · [`../docs/rules-and-judging.md`](../docs/rules-and-judging.md) · [`../docs/verification-plan.md`](../docs/verification-plan.md)

## How to run it (about 45 minutes)

1. **10 min, all 6 together:** answer every **P0** question (marked 🔴). These block everything else.
2. **25 min, in parallel:** split the rest by section. Suggested owners are shown per section. Each owner proposes answers.
3. **10 min, all together:** read the answers aloud, resolve disagreements, and fill in the **Decisions** table at the end.
4. **Then:** Claude turns the answers into `specs/specification.md`.

**Priority:** 🔴 P0 = decide in the first hour · 🟡 P1 = decide before building that part · ⚪ P2 = nice to decide.

---

## A. Goal and story (all 6)

**A1 🔴 In one sentence, what problem do we solve, and for whom?**
- *Why:* every other decision follows from this.
- *Default:* "Fire managers and the public can't compare today's fires with 25 years of history, because two satellite sensors count fires differently. We merge both records into one fair fire calendar for any area."
- **Answer:**

**A2 🔴 Who is our main user?**
- *Options:* emergency responders · land and forest managers · scientists · journalists and the public · students.
- *Default:* emergency and forest managers first, the public second.
- **Answer:**

**A3 🔴 What is the "wow" moment in the demo?**
- *Default:* draw an area around a Bulgarian region. A 25-year fire calendar appears, and this month lights up as "unusual vs the historical median".
- **Answer:**

**A4 🟡 What real story do we tell?**
- *Why:* judges reward storytelling (Presentation), and Sofia judges are local.
- *Default:* one real Bulgarian fire season the team picks after looking at the data.
- **Answer:**

**A5 🟡 What is the project called?**
- **Answer:**

**A6 🔴 Which Global Award do we aim for first?**
- *Options:* Local Impact · Best Use of Data · Galactic Impact · Best Use of Science · Best Use of Technology.
- *Default:* Local Impact (Earth/map-data projects won it in 2023–2025), with Best Use of Data as the backup.
- **Answer:**

## B. Users and use cases (suggested owner: product / design)

**B1 🟡 What are the top 3 tasks a user must be able to do?**
- *Default:* (1) pick an area and dates; (2) see which months and years burned most, and whether now is unusual; (3) download the data.
- **Answer:**

**B2 🟡 What decision does the user make with our tool?**
- *Example:* where to pre-position crews, or when to warn people.
- **Answer:**

**B3 🟡 Language: English only, or English plus Bulgarian?**
- *Default:* English UI (required for judging), with Bulgarian labels as a stretch goal.
- **Answer:**

**B4 ⚪ Device: desktop only, or mobile too?**
- *Default:* desktop first; it should not break on mobile.
- **Answer:**

**B5 ⚪ How expert are users? Do we explain terms like "hot spot", "FRP" and "anomaly"?**
- *Default:* yes, with short tooltips.
- **Answer:**

## C. Scope (all 6)

**C1 🔴 Geography: what areas do we support?**
- *Options:*
  - Bulgaria only;
  - Bulgaria plus neighbours;
  - any country on demand;
  - any drawn area worldwide.
- *Default:* any country on demand (download only that country's files). Demo on Bulgaria; pre-load Greece, North Macedonia and Turkey.
- *Avoid:* the whole world, which is tens of GB `[D]`.
- **Answer:**

**C2 🔴 Time range: 2000–2025 only, or up to today?**
- *Default:* 2000–2025 from the yearly files. Add 2026 from the FIRMS API (needs a free key) as a stretch goal.
- **Answer:**

**C3 🔴 Time resolution: monthly, weekly or daily?**
- *Default:* monthly for the calendar; daily points for the map and CSV.
- **Answer:**

**C4 🔴 What is in the MVP (must work by Sun 12:00)?**
- *Default:*
  - harmonized monthly series for the selected area;
  - calendar heatmap;
  - this month vs median;
  - map of hot spots;
  - CSV download;
  - validation page.
- **Answer:**

**C5 🟡 What is a stretch goal (only if time allows)?**
- *Default options:* 2026 live data; Bulgarian language; a 3D globe; EFFIS comparison; alerts.
- **Answer:**

**C6 🟡 What is explicitly OUT of scope?**
- *Default:* fire prediction or forecasting; user accounts; burned-area mapping.
- **Answer:**

## D. Data (suggested owner: data / science)

**D1 🔴 Which sensors do we use?**
- *Default:* MODIS (Terra and Aqua), plus VIIRS from S-NPP (2012–2025) and NOAA-20 (2018–2025). NOAA-20 and NOAA-21 for 2026, because S-NPP ended on 2 Nov 2026 `[V]`.
- **Answer:**

**D2 🔴 Which detections do we keep?**
- *Default:*
  - `type == 0` (vegetation fires only);
  - MODIS confidence ≥ 30;
  - VIIRS confidence `n` or `h`;
  - both day and night.
- **Answer:**

**D3 🟡 Do we merge nearby detections, to soften the pixel-size difference (1 km vs 375 m)?**
- *Default:* test both: raw counts, and one count per 0.1° cell per day.
- **Answer:**

**D4 🟡 Who registers the free FIRMS MAP_KEY, and where is it kept?**
- *Rule:* never in the repo; use a local `.env` file that is git-ignored.
- **Answer:**

**D5 🟡 Storage format?**
- *Options:* CSV · Parquet · SQLite · DuckDB · pre-computed JSON.
- *Default:* raw CSV cache plus pre-computed monthly aggregates (Parquet or JSON).
- **Answer:**

**D6 🟡 Do we pre-process offline, or compute live in the app?**
- *Default:* pre-compute the aggregates for the demo countries; compute on demand for other countries.
- **Answer:**

**D7 ⚪ Do we add other datasets?**
- *Options:* EFFIS burned area (as a second check); land cover (to vary the conversion by vegetation type); population (impact).
- **Answer:**

**D8 ⚪ Do we show hot-spot intensity (FRP) or only counts?**
- **Answer:**

## E. Harmonization method (suggested owner: data / science)

**E1 🔴 Which units does the final series use?**
- *Options:* "MODIS-equivalent" (convert VIIRS down to MODIS) or "VIIRS-equivalent" (convert MODIS up).
- *Default:* VIIRS-equivalent. VIIRS is the future, so old MODIS years are scaled up.
- **Answer:**

**E2 🔴 What model?**
- *Options:* one ratio per month · per season · per area and land cover · a linear regression · a log-linear regression.
- *Default:* start with a monthly ratio, compare it with a regression, and keep the one with the lower back-test error.
- **Answer:**

**E3 🔴 Which years train the model, and which test it?**
- *Default:* train 2012–2018, test 2019–2025. Or train 2012–2020, test 2021–2025.
- **Answer:**

**E4 🟡 How do we handle small numbers (0–5 fires a month)?**
- *Default:* show raw counts, and flag converted values as "low confidence" below a minimum count.
- **Answer:**

**E5 🟡 How do we keep VIIRS continuous across S-NPP, NOAA-20 and NOAA-21?**
- *Default:* check S-NPP against NOAA-20 over 2018–2025 (M21), then use NOAA-20 going forward.
- **Answer:**

**E6 🟡 Do we fit one global conversion, or a separate one per country or region?**
- *Default:* per country; the factor varies by region `[D]`.
- **Answer:**

## F. Verification and proof (suggested owner: QA / verification)

**F1 🔴 What error is "good enough" to ship?**
- *Default:* we set a threshold for the monthly back-test error (MAPE) in areas with enough fires, and we show the real number either way.
- **Answer:**

**F2 🟡 Which checks do we run?** (See `docs/verification-plan.md`.)
- *Default:* M44 (hold-out), M114 (error bands), M124 (by month and region), M21 (S-NPP vs NOAA-20), M38 (published ratios). M41 (EFFIS) if time allows.
- **Answer:**

**F3 🟡 Who writes the expected answers before the code?**
- *Rule:* not the same person or agent who writes the code.
- **Answer:**

**F4 🟡 Do we include a "How we know it's right" page in the app?**
- *Default:* yes. It's our Validity proof for judges.
- **Answer:**

**F5 ⚪ What do we say honestly about limits?**
- *Default:* pre-2012 values are estimates, small areas are noisy, and industrial hot spots are filtered out.
- **Answer:**

## G. Features and user experience (suggested owner: frontend / design)

**G1 🔴 How does the user choose an area?**
- *Options:* draw a polygon · draw a rectangle · pick a country or region · type lat/lon · search a place name.
- *Default:* country picker plus draw a rectangle or polygon.
- **Answer:**

**G2 🟡 What does the calendar look like?**
- *Default:* rows = years (2000 to now), columns = months, colour = harmonized fire count. Click a cell to see that month's hot spots on the map.
- **Answer:**

**G3 🟡 Which colour ramp?**
- *Default:* an accessible one (cividis or viridis), with a legend and the numbers on hover.
- **Answer:**

**G4 🟡 How do we define "unusual"?**
- *Default:* this month vs the median of the same month across all years, shown as a percentage above or below. Mark it "unusual" above a threshold, for example the 90th percentile.
- **Answer:**

**G5 🟡 What does the CSV contain?**
- *Options:* raw hot spots (with sensor) · harmonized monthly counts · both.
- *Default:* both, plus a README line that explains the columns.
- **Answer:**

**G6 ⚪ Do we support shareable links (area and dates in the URL)?**
- *Default:* yes, if cheap.
- **Answer:**

**G7 ⚪ Accessibility?**
- *Default:* colour-blind-safe colours, keyboard use, text alternatives for charts.
- **Answer:**

**G8 ⚪ A 3D globe view?**
- *Default:* stretch goal only.
- **Answer:**

## H. Architecture and tech stack (suggested owner: backend / tech lead)

**H1 🔴 Stack?**
- *Options:*
  - Streamlit (fastest, Python only);
  - a React/Vite + Leaflet (or MapLibre) front end with a small Python API (FastAPI);
  - a static site with pre-computed JSON.
- *Default:* decide by team skills. Streamlit if most of us are Python people; React + Leaflet if we have front-end people.
- **Answer:**

**H2 🔴 Where do we host it (it must be public)?**
- *Options:* Streamlit Community Cloud · Vercel · Cloudflare Pages/Workers · GitHub Pages · Hugging Face Spaces.
- **Answer:**

**H3 🟡 Repo setup?**
- *Default:* one public GitHub repo, Apache-2.0 licence, `main` branch protected, one folder each for data, model, app and docs.
- **Answer:**

**H4 🟡 Performance target?**
- *Default:* the calendar appears within 3 seconds for a pre-loaded country `[U]`.
- **Answer:**

**H5 🟡 Tests?**
- *Default:* tests that compare our numbers with expected answers written first. Data checks on row counts and filters.
- **Answer:**

**H6 ⚪ Do we use Graphify to map the code for the AI agents?**
- *Default:* yes, after the first build session.
- **Answer:**

## I. AI (SI) usage (suggested owner: tech lead)

**I1 🟡 Which AI tools do we use to build?**
- *Example:* Claude Code with skills.
- *Why:* the submission must describe this.
- **Answer:**

**I2 🟡 Is there any AI inside the product?**
- *Example:* a plain-language explanation of an unusual month.
- *Rule:* if so, it must be grounded in our numbers and checkable.
- *Default:* no AI in the product for the MVP.
- **Answer:**

**I3 🟡 Who writes the "how we used SI" text for the submission?**
- **Answer:**

## J. Demo and presentation (suggested owner: storytelling / pitch)

**J1 🔴 Who is on site on Sunday for the 16:00 live pitch?**
- *Why:* only the top 5 pitch, and they must be present.
- **Answer:**

**J2 🟡 What is the 30-second video script?**
- *Default:* problem (5 s) → wow moment (15 s) → proof it's right (5 s) → impact (5 s).
- **Answer:**

**J3 🟡 Who records and edits the video, and with what?**
- *Options:* screen recording · HyperFrames (renders video from HTML) · voice-over.
- **Answer:**

**J4 🟡 What does the 3-minute pitch cover, and who answers which Q&A topics?**
- **Answer:**

**J5 🟡 Who fills in the NASA project page?**
- *Fields:* summary, demo link, final project link, references, SI usage.
- **Answer:**

**J6 ⚪ Slides?**
- *Default:* only if needed for the live pitch; up to 7.
- **Answer:**

## K. Team and plan (all 6)

**K1 🔴 Who owns what?**
- *Suggested roles:*
  1. data and science (harmonization);
  2. data pipeline and backend;
  3. front end and map;
  4. design and UX;
  5. verification and QA;
  6. story, pitch and submission.
- **Answer (name → role):**

**K2 🔴 Our checkpoints?**
- *Default:*
  - Sat 13:00: data downloaded and cleaned;
  - Sat 19:00: harmonization back-tested;
  - Sun 09:00: app complete;
  - Sun 12:00: video recorded;
  - **Sun 14:00: Sofia demo submitted;**
  - **Sun 23:59: NASA submission.**
- **Answer:**

**K3 🟡 Who is on site, and who works remotely, and when?**
- *Rule:* everyone must be registered for Sofia and **not waitlisted**.
- **Answer:**

**K4 🟡 How do we communicate and hand over?**
- *Options:* a Discord or Slack channel; one decision log in the repo.
- **Answer:**

**K5 🟡 Who clicks "Submit for Judging", and when?**
- *Default:* the team owner, by Sun 22:00, leaving a buffer.
- **Answer:**

## L. Risks and fallbacks (all 6)

**L1 🟡 What if the conversion error is too high?**
- *Default:* show raw counts per sensor side by side, flag the conversion as experimental, and keep the validation page.
- **Answer:**

**L2 🟡 What if a download or the FIRMS site fails during the event?**
- *Default:* cache everything we need on Saturday morning.
- **Answer:**

**L3 🟡 What if the hosted app fails during judging?**
- *Default:* the demo video plus a backup recording.
- **Answer:**

**L4 ⚪ What do we cut first if we run out of time?**
- *Default:* 2026 live data, then the 3D globe, then Bulgarian language.
- **Answer:**

## M. Legal and submission (suggested owner: pitch / submission)

**M1 🟡 Which open-source licence?**
- *Default:* Apache-2.0 (NASA's default anyway).
- **Answer:**

**M2 🟡 What goes in References?**
- *Default:* FIRMS data, every library, every paper we used, every reused code snippet.
- **Answer:**

**M3 🟡 Are all third-party parts open source?** (Leaflet: BSD; check the others.)
- **Answer:**

**M4 ⚪ Does the demo contain any person under 18, or any personal data?**
- *Must be:* no.
- **Answer:**

---

## Decisions (fill in at the end)

| # | Decision | Chosen answer | Owner | Time |
|---|---|---|---|---|
| A1 | Problem statement | | | |
| A2 | Main user | | | |
| A6 | Target award | | | |
| C1 | Geography | | | |
| C2 | Time range | | | |
| C4 | MVP list | | | |
| D1 | Sensors | | | |
| D2 | Filters | | | |
| E1 | Units | | | |
| E2 | Model | | | |
| E3 | Train and test years | | | |
| F1 | "Good enough" error | | | |
| G1 | Area selection | | | |
| H1 | Stack | | | |
| H2 | Hosting | | | |
| J1 | Who pitches on site | | | |
| K1 | Roles | | | |
| K2 | Checkpoints | | | |
