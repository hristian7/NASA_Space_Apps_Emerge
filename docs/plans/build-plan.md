# Emerge: build plan for this weekend

Written Sat 14 Nov 2026, 17:30 EET, after reading the whole repo. This is the **execution plan** for the build computer. It does not replace [`../../specs/specification.md`](../../specs/specification.md) (the master plan) or [`../../specs/features-moscow.md`](../../specs/features-moscow.md) (feature priority). Where this file and the spec disagree, section 1 below says which one to change.

**Plan 2 (next-day fire risk, approved 14 Nov night)** has its own build spec and lanes: [`../../specs/plan-2-fire-risk/specification.md`](../../specs/plan-2-fire-risk/specification.md), section 11. It shares this computer and these checkpoints.

**Tags:** `[V]` verified at a primary source or measured by us · `[D]` directional · `[U]` our inference.

---

## 1. What the repo check found

### 1.1 There are two conversion pipelines on paper, and one half-built in code

| | **Pipeline A** ([`conversion-plan.md`](../conversion-plan.md)) | **Pipeline B** ([`harmonization-pipeline-plan.md`](../harmonization-pipeline-plan.md)) |
|---|---|---|
| Grid | 0.25 degree cells (about 28 km), monthly | 0.1 degree cells (about 10 km), daily rolled up to monthly |
| Which satellites are paired | Aqua with S-NPP (same afternoon pass); Terra gets its own model | Afternoon passes for training; Terra left out of training, yet used in the output (how is not said) |
| Years used to learn | 2012 to 2022 (before the MODIS drift) | 2012 to 2018 |
| Years used to test | 2019 to 2022, then the reverse (learn 2016 to 2022, test 2012 to 2015) | 2019 to 2025 (includes the drift years) |
| Groups | 14 world regions x 16 land types x month, thin groups pulled toward the wider average | 7 continents x 4 land types (28 groups), borrow from the parent group under 20 cell-days |
| First model | Ratio of sums, plus a term for "MODIS saw nothing, VIIRS saw fire" | Ratio of means; then a regression; then the same zero term |
| Score | nRMSE, MAE, bias, r, slope. **No MAPE** (percentage error breaks on zero-fire months) | **MAPE**, best model per group |
| Error range | 90% range, checked for real coverage | 80% range, 200 resamples |
| Daily harmonized values | Won't (NASA warns under 8 days is biased `[V]`) | Yes (daily output table) |
| Extra corrections | NASA's observation and cloud formulas, scan-angle filter (Should) | None |

**Code today** (`pipeline/build_cells.py`) is the shared first step of both: cleaning plus fire cell-days on 0.01 degree cells per satellite. Neither conversion exists yet. Its header still points to the superseded `harmonization-plan.md`.

### 1.2 Other conflicts that would mislead a builder

| # | Conflict | Where | Proposed fix |
|---|---|---|---|
| 1 | Record must run "to today", but our files stop on 31 Dec 2025 `[V]` and have no NOAA-21. S-NPP ended 2 Nov 2026 `[V]`, so 2026 needs firms-catalog | spec 2 (M1), 4.1 vs `data/derived` | Add a 2026 step to the pipeline lane; until it lands the app shows "data to Dec 2025" |
| 2 | `pipeline/export_app.py`, `LICENSE`, `docs/references.md`, `docs/si-usage.md`, `tests/expected/` are named as existing or required; none exist | spec 4.3, 5, 6, 10 | Create all in the first hour. LICENSE (Apache-2.0) is a NASA rule |
| 3 | "Stream A owns it", "Stream D owns it", "six parallel streams": these names are gone; the spec now has lanes A, B, Oracle, Tests, Pipeline | spec 7.3, 11 (D-7); features-moscow build order | Rename to the lane names |
| 4 | Test years: verification-plan says 2019 to 2025 and lists MAPE as the pass measure; spec D-2 says inside 2012 to 2022 and no MAPE | verification-plan vs spec 11 | Settled by the bake-off (section 3) |
| 5 | Recent fires: "last 24 h" (spec S5), "24 h / 7 days" (features, overview), 7 days in the preview, 8 days in M27 | spec 2, features, overview, preview | One rule: map layer shows 24 h and 7 days; every comparison uses 8 days |
| 6 | Push alerts were cut, but the preview still has "Alert me here" and the Vercel guide still lists push-alert keys | `web/preview/index.html`, `docs/vercel-setup.md` | Remove both |
| 7 | Pipeline B's own pass check ("Bulgaria ratio 2.7 to 3.9") would fail on our measured cell-day ratio, 1.7 to 2.6 `[V]`; that published range is for raw detections | pipeline plan step 5 vs first-run findings | Check each unit against its own range |
| 8 | firms-catalog licence: "Apache-2.0" for the data in one file, "data CC0, code Apache-2.0, confirm both" in another | conversion-plan 3 vs spec 4.1 | Read its licence file once, record in references |
| 9 | README lists `harmonization-plan.md` as the plan without its "superseded" note; features M1 links both plans | README, features-moscow | Point to one method doc after the bake-off |
| 10 | Checkpoint CP0 is 18:00 and nothing on its list exists yet | spec 7.3 | Re-timed in section 6 |

More findings from an independent read of the remaining files are in section 1.3.

### 1.3 Independent review of the other files (17:35)

A separate agent read the specs, guides, summaries and the preview page. Its main claims were spot-checked against the files `[V]`. Items already in 1.2 are not repeated.

**The preview does not follow the data contract.** The preview is the design starting point, so lane A must not copy its data code.

| # | Preview today | Spec 4.3 | Fix |
|---|---|---|---|
| 11 | One series, fields `harm, lo, hi` | Two series: `hot, hot_lo, hot_hi` and `cd, cd_lo, cd_hi` | The contract freeze (step 1) uses the spec names |
| 12 | Grid squares counted from 0 degrees, with negative numbers (`gx = -361`) | `cell_id` counted from the top-left corner, never negative | Spec rule wins; the oracle writes cell-id tests first |
| 13 | `src` is just `"estimated"` | Five labels (`estimated_terra`, `estimated_modis`, `measured`, `measured_calibrated`, `provisional`) | Exporter writes the five labels |
| 14 | No `precision_radius_km`; recent fires are bare arrays with no `type` | M29: every record has `type`, `lat`, `lon`, `precision_radius_km` | Contract test runs on the real export |
| 15 | Search distance fixed at 50 km; default unit "fire days" | 0 to 500 km, set by the user; hotspots by default (D-7) | Lane A wires the control; D-7 from the bake-off |
| 16 | Credits fire danger as "CC BY 4.0" | Licence still open (D-4) | Say "licence under review" until D-4 closes |

**Other conflicts**

| # | Conflict | Fix |
|---|---|---|
| 17 | The query function is "one Python function" (spec 5) but lane B owns `web/src/app/api/`, which is TypeScript | Spike (a) decides Python or TypeScript; the answer goes into the contract |
| 18 | Proof-method IDs: the spec says they carry a `V-` prefix; `verification-plan.md` uses bare `M11, M19, M20, M21, M24`, which are also feature IDs | Use `V-M..` in the verification plan |
| 19 | Cut features still read as in scope in `research-tasks.md` and `interview-answers.md` (installable app, push alerts, combined data). The old suggestion file was removed by a teammate at 17:40 | One "superseded 16:50" line at the top of each |
| 20 | Old estimates kept beside measured values: download size 53 GB `[D]` vs 43.5 GB `[V]`; Bulgaria ratio 2.7 to 3.9 `[D]` vs 2.5 to 3.5 `[V]` | Keep the measured value |
| 21 | Added-scope hours: "15 to 22 h" in the spec vs "11 to 18 h after the removals" in the feature list | Use 11 to 18 h |
| 22 | January 2012 has no label: M1 says estimated through Jan 2012, the label rule ends "estimated" in 2011 | Both say "through Jan 2012" |
| 23 | MapLibre 5.6 in the preview vs "current 6.x" in the spec | Scaffold on 6.x; spike (b) and (c) run on 6.x |

**For the team to decide (submission risk, not build work)**

| # | Finding | Why it matters |
|---|---|---|
| 24 | Three docs say their facts were copied or checked on 13 Nov (`challenge-brief.md`, `rules-and-judging.md`, `firms-data.md`). The rule is no work on the challenge before Sat 14 Nov 09:00. All commits start on 14 Nov `[V]` | Judges read the repo. Reading public rules beforehand is likely fine; a data deep-dive dated the day before may raise a question. One honest line of explanation in those files is safer than silence |
| 25 | 20 of 46 commits carry real email addresses (6 different ones) `[V]`; the repo rule is "no contacts" | Only the repo owner can rewrite history; decide before the submission |
| 26 | About 34 lines in the specs have a number with no tag; the one that matters is "150 MB gzipped" behind D-9 | Tag when touched |

**Checked and consistent `[V]`:** no broken links in any markdown file; the public address; both deadlines; every measured figure (43.5 GB, 10,095 files, 461,501,221 detections, 324,312,197 cell-days, 2.7x, about 1%); the 8-day window; the reported-fires numbers; no keys, emails or machine paths in tracked files.

---

## 2. Decisions proposed (spec section 11)

| # | Proposal | Why | Final when |
|---|---|---|---|
| **D-1 grid** | **0.25 degree for the numbers the app shows**, whichever method wins. 0.1 degree only as a display layer | The app contract can freeze now and does not wait for the bake-off. NASA's own grid; single small cells are too noisy (61% error per cell vs 8% per region `[V]`) | Bake-off result |
| **D-2 years** | Learn inside 2012 to 2022, test both directions; S-NPP gap days (34 `[V]`) dropped from the pairs; 2023 to 2025 reported apart as a drift check | Terra drift shows from 2022 `[V]` | Bake-off result |
| **D-7 default unit** | Run the same hold-out test on hotspot counts and on fire days. Hotspots become the default only if their error is within 1.25x of the fire-day error `[U]` | The brief says "hotspots"; fire days are steadier (Bulgaria ratio 1.7 to 2.6 vs 2.5 to 3.5 `[V]`) | Bake-off result |
| **D-9 data home** | **Static files first.** Country files, globe, validation and reported numbers are small. Cell tiles: only the harmonized values and ranges, as whole numbers, fire months only, packed per 5 degree square. Measure at the first world export. Over 85 MB gzipped: move tiles to a few packed files on Blob | The 150 MB measured `[V]` included every satellite's raw series, which only the "per satellite" view needs; those go in the country files. A trial of the slim layout on the real world table (11.9 million cell-months in 187,266 cells `[V]`, six value columns with stand-in ranges) came to **58 MB gzipped** as plain rows `[D]`, so static files should fit | First world export |

**D-9 settled (Sat 14 Nov, evening): static files.** The first world export measured 106 MB in 2,348 files `[V]` (tiles 60 MB, daily files 18 MB, globe 16 MB, country files 12 MB). The 100 MB limit in the hosting documentation applies to deployments made with the command-line tool, not to deployments built from the repository: "When using the CLI to deploy, the maximum size of the source files that can be uploaded is limited to 100 MB for Hobby", and "there is no upper limit for output files created during a build" `[V]` (vercel.com/docs/limits, read 14 Nov). Our site deploys from the repository, so the files stay static and the Blob store is not needed. The practical proof is the first push that carries the world files.

---

## 3. The bake-off: both pipelines on Bulgaria and the USA

**Aim:** let data, not opinion, pick the conversion method, and settle D-1, D-2 and D-7 in one run.

| Part | Rule |
|---|---|
| Same input for both | `data/derived/bg_us/cell_days.parquet` (cleaned, 7.3 M cell-days `[V]`). Truth is measured S-NPP; its gap days are removed for both |
| Two builders | One agent builds A from its doc, another builds B from its doc, each in its own working copy. Neither sees the other's code. First model only (the ratio), about 60 to 90 min each `[U]` |
| A third, separate scorer | Writes the scoring script and 3 hand-computed cell-months from the raw CSVs in plain Python, **before** either pipeline has output. It never sees the pipelines' code |
| Same tests for both | Test 1: learn 2012 to 2018, predict 2019 to 2022. Test 2: learn 2016 to 2022, predict 2012 to 2015. B's own 2019 to 2025 test is also run and shown apart |
| Scored on what users ask | (a) country x month, (b) 0.25 degree cell x month (B's 0.1 degree cells summed up), (c) 20 fixed circles of 50 km `[U]`. B is also scored on its own 0.1 degree cells |
| Measures | nRMSE (typical error as a share of the average), MAE, bias of totals, r, slope, and whether a 90% range really holds about 90% of values. MAPE on non-zero months, for information only |
| Winner, fixed now | Lower nRMSE in most of (a), (b), (c) x 2 tests x 2 countries. A tie goes to A (smaller files, NASA's grid). The rule is committed before any score exists (V-M58) |
| Land type | Both plans group by land type; no land-type map is in the repo yet. Spike (e) finds one. Until then both use region x latitude band x month, so the comparison stays fair |

**Gate to the whole world.** The world run starts only when all of these hold for Bulgaria and the USA:
1. control totals match (daily = monthly = kept raw rows, V-M125);
2. the scorer's 3 hand-computed cell-months match;
3. country x month nRMSE at or under 30% `[U]` and total bias within 10% `[U]` on both tests;
4. the 90% range holds 80 to 97% of test values `[U]`;
5. the app shows both countries correctly from the exported files.

If a number misses, it is reported with the result, and the team decides. The world build itself takes about 3 minutes `[V]`.

---

## 4. Order of work

| Step | What | Runs with | Done when |
|---|---|---|---|
| 0 | Housekeeping: LICENSE, `docs/references.md`, `docs/si-usage.md`, fixes 3, 5, 6, 9 from section 1.2, a Python environment (`.venv`, git-ignored) | First | One small commit |
| 1 | **Freeze the data contract** (spec 4.3): TypeScript types, example files for Bulgaria and the USA made by a small generator, a contract test | Steps 2, 3 | Example files load in a test page |
| 2 | **Bake-off** (section 3) | Steps 1, 3 | Scores table committed; D-1, D-2, D-7 final |
| 3 | **Five risk spikes**, 30 min each, in parallel: (a) DuckDB in a Vercel function reading firms-catalog; (b) drawing an area on the MapLibre globe; (c) NASA, OpenStreetMap and fire-danger layers on the globe; (d) calendar and charts saved as PNG; (e) a land-type and region map at 0.25 degree with no login | Steps 1, 2 | Each answers yes, no, or fallback, in one paragraph |
| 4 | **Next.js in `web/`**, the preview kept at `/preview`, `web/vercel.json` with `"framework": "nextjs"` | After step 0 | Live on the public address |
| 5 | **Lanes** (spec 7.2), each in its own working copy and branch, one owner per folder | After 1 and 4 | Checkpoints in section 6 |
| 6 | **World gate** (section 3), world conversion, export, size measured, D-9 final | After 2 | Whole world live |

### Lanes and who builds them

| Lane | Owns | Agent |
|---|---|---|
| A. Design and app | `web/src/app/` (not `api/`), `web/src/components/`, styles, `web/messages/`, `basemaps.ts`, `package.json` | Strongest coding model, high effort |
| B. Data and logic | `web/src/lib/data/`, `web/src/types/`, `web/src/app/api/`, `web/public/data/`, `layers.ts`, `pipeline/export*` | Strongest coding model, high effort |
| Pipeline | `pipeline/` | Strongest coding model, high effort |
| Oracle | `tests/expected/` | A separate, cheaper model; never sees lane B or pipeline code |
| Tests and proof | `tests/` (not `expected/`), `docs/references.md`, `docs/si-usage.md` | Cheaper model |
| Director | Briefs, reviews, merges, checkpoint reports | This session; writes no feature code |

**Build order inside the lanes (the demo spine first):**
1. country calendar with real numbers;
2. point + distance, and the latitude/longitude box;
3. "Is this unusual?";
4. downloads (monthly CSV, summary, PNG);
5. proof page;
6. drawn area;
7. this fire vs past fires;
8. detected vs reported;
9. chance of fire;
10. raw rows and table views;
11. hotspots CSV.

English first; Bulgarian in one pass at the text freeze. Then the Shoulds in the spec's order.

**Every merge to `main`:** pull first, build passes, tests pass with counts logged, a check that no personal information, machine path or key is in the change. `main` deploys on every push.

---

## 5. Rules carried from the spec

- No personal information or keys in git; keys only in `.env` and Vercel settings.
- Every number tagged `[V]`, `[D]` or `[U]`.
- Expected answers come first, from a separate agent (spec 6).
- Musts before Shoulds; the cut list decides when late (spec 7.3).
- Every outside resource goes into `docs/references.md` when first used; every use of AI into `docs/si-usage.md` at each checkpoint.
- Never show official warning words; every risk view carries the disclaimer (spec 9).

---

## 6. Checkpoints, re-timed (Sofia time)

| When | Evidence that must exist |
|---|---|
| **Sat 19:30 · CP0** | Contract and example files; five spikes answered; bake-off scored; D-1, D-2, D-7 decided; Next.js live; oracle tests written and failing |
| **Sat 21:45 · CP1** | Globe and 2D map, layers, every selection mode and both languages work on a phone, on the example files |
| **Sun 00:30 · CP2** | Bulgaria and the USA end to end with real numbers on the public address: calendar, cards, downloads. World gate checked |
| **Sun 04:00 · CP3** | Whole world live; proof page with real validation; recent fires and fire danger; all Must tests green with counts logged |
| **Sun 06:00** | Data refresh; English text freeze; Bulgarian pass starts |
| **Sun 08:00 · CP4** | Feature freeze; smoke test passes; Bulgarian reviewed |
| **Sun 13:30 · CP5** | Sofia video submitted (due 14:00) |
| **Sun 22:00 · CP6** | NASA submission (due 23:59) |

Each checkpoint gets a short, plain report: what is done, what is late, what was cut.

---

## 7. Risks

| Risk | Answer |
|---|---|
| **The scope is larger than the time.** The spec's own estimate is about 57 h of agent work for the Musts `[U]`, against about 14 h to the freeze | Demo spine first (section 4). At CP2, anything not started from the end of the spine is cut, in the spec's cut order |
| The build computer sleeps at night | Keep it awake until the freeze |
| Teammates push to `main` while agents merge | Only the director merges; pull before every merge; lanes own separate folders |
| No land-type map without a login | Spike (e); fallback is region x latitude band x month for the whole world |
| 2026 data needs firms-catalog over the network | Start it early in the pipeline lane; the app says "data to Dec 2025" until then |
| The query function does not run on Vercel | Fallback in the spec: a small static points file for Bulgaria and the USA |
