# Sunday plan: the 30-second video and the 3-minute pitch

Written Sat 14 Nov 2026; updated Sun 15 Nov about 11:00 for what is live now: the harmonized history, the next-day risk outlook, the redesigned app and the published test results. Rules come from [`../rules-and-judging.md`](../rules-and-judging.md); competitor facts from [`../research/competitors.md`](../research/competitors.md); every number below comes from [`2026-11-15-submission-draft.md`](2026-11-15-submission-draft.md), the [validation file](../../web/public/data/validation.json) or the [risk scorecard](../../web/public/data/risk/scorecard.json).

## What is required

| Item | Rule | Deadline (Sofia) |
|---|---|---|
| **Demo video** | **Up to 30 s** for NASA (Sofia accepts 30 to 60 s, so one 30 s cut serves both). English or English subtitles. Public link, no login. No one under 18 on screen or in audio | **Sun 14:00** (submit by 13:30) |
| Jury watches every video | Scored on Impact, Creativity, Validity, Relevance, Presentation (1 to 5 each) | Sun 14:30 |
| **Live pitch** (only if we make the top 5) | **3 min + 5 min Q&A**, on site | Top 5 at 15:45, pitch from **16:00** |
| NASA submission | Video link, project link, references, AI-usage note, all fields in English | Sun 23:59 (aim for 22:00) |

The pitch slot is only 15 minutes after the top 5 is announced, so **the pitch is rehearsed before 14:30**, not after.

## The one message

**"NASA's fire record broke in two in 2012. Emerge joins it into one fair record for any place on Earth, then uses it to show where new fires are most likely tomorrow."**

Order matters. The challenge is harmonization, so the joined record comes first (Relevance). Tomorrow's risk comes second, as what the fair record makes possible (Impact). The proof comes third (Validity).

Tagline for the end card: **"25 years of fire. One fair record. Tomorrow's risk."**

---

## Part 1: the 30-second video

### Storyboard

About 68 words of voice-over in 30 s. Every line is also a burned-in subtitle, so the video works muted.

| Time | On screen | Voice-over / subtitle | Criterion |
|---|---|---|---|
| 0:00 to 0:04 | World map, History tab, fire-history glow; drag the timeline from 2001 to 2026 | "NASA satellites have watched Earth burn for 25 years." | Presentation |
| 0:04 to 0:09 | Title card: one chart, hotspots per year, a cliff at 2012. Label on the jump: **"New satellite, not more fire"** | "In 2012 a sharper sensor began seeing almost three times more fire. The record broke in two." | Relevance |
| 0:09 to 0:16 | Bulgaria's calendar (link S3). Point at the legend: measured vs estimated from MODIS. Switch to **Is this unusual?** | "Emerge joins it into one fair record, for any place on Earth, with honest error ranges." | Creativity, Validity |
| 0:16 to 0:23 | Forecast tab, Sofia card (link S4): level, "lower or higher than usual for November", fire weather in words. Cut to the risk screen's top spots (link S5) | "Then it looks ahead: where new fires are most likely tomorrow." | Impact |
| 0:23 to 0:27 | Proof page, next-day risk table (link S6): model against NASA's fire-weather index, history and random | "Tested on a year it never saw, it beat NASA's own fire-weather index." | Validity |
| 0:27 to 0:30 | Logo, **emerge-beta-ten.vercel.app**, "Data: NASA FIRMS (MODIS, VIIRS), NASA GFWED" | "Emerge. One fair record. Tomorrow's risk." | Presentation |

What the lines rest on:
- "Almost three times": 2.7× more fire seen by VIIRS than MODIS, world, our pipeline `[V]` ([`../research/first-run-bulgaria-usa.md`](../research/first-run-bulgaria-usa.md)).
- "Beat NASA's own fire-weather index": 2025 hold-out, forest and wildland, top 5 per region and day. Europe 53.8% against 41.1%, world 20.4% against 11.2%, and the claim rule is met in both `[V]`.
- No other number is spoken. The Sofia level is read off the screen on the day, never scripted, because the forecast files may be refreshed (see below).

### Shot links

Set the language to **English** once in the top-right language menu before recording; the app remembers it. Open each link from a fresh tab so a retake lands on the same state.

| Shot | Link | Checked |
|---|---|---|
| S1 World history | `https://emerge-beta-ten.vercel.app/` | Route answers `[V]` |
| S2 Cliff chart | Title card made in the editor from the 2.7× figure; the app has no single cliff chart | |
| S3 Bulgaria calendar | `https://emerge-beta-ten.vercel.app/?sel=c:BGR` | Opens the calendar `[V]` |
| S4 Sofia forecast card | `https://emerge-beta-ten.vercel.app/?v=f&sel=p:42.6977,23.3219,25` | Opens the Forecast card `[V]` |
| S5 Risk screen | `https://emerge-beta-ten.vercel.app/risk` | Route answers `[V]` |
| S6 Risk proof | `https://emerge-beta-ten.vercel.app/proof#next-day-risk` | Route answers `[V]` |

**Forecast refresh:** NASA had not yet published the 13 Nov fire-weather run at 10:30, so the live outlook still shows 14 and 15 Nov. If that run arrives and the forecast is refreshed, the Sofia card's numbers change. Film S4 and S5 after that decision, or keep them free of spoken numbers (as scripted).

### Shot rules
- **Only real numbers on screen.** Nothing filmed may show a placeholder or example label.
- Keep "Risk outlook (unofficial)" and the safety line visible when the risk screen is on camera.
- Same place throughout: Bulgaria for history, Sofia for tomorrow.
- Cursor slow and deliberate; cut typing mistakes.

### If a shot fails on the day

| Missing | Film instead |
|---|---|
| Timeline drag looks jumpy | A still of the world history glow with a slow zoom in the editor |
| Forecast card blank | The risk screen alone (S5) |
| Proof page slow | Title card: "Tested on 2025, a year it never saw: 53.8% of new fires in Europe caught, against 41.1% for NASA's fire-weather index" |

### Production
- **Screen:** browser window at exactly 1920 × 1080, browser bars hidden, recorded with the Mac's screen recorder (Cmd-Shift-5) or OBS, 30 fps or more.
- **Voice:** one teammate (18 or over), quiet room, phone or headset mic close to the mouth, 2 to 3 takes. If an AI voice is used instead, it goes into [`../si-usage.md`](../si-usage.md).
- **Music:** optional, low, royalty-free with a licence that allows reuse; add it to [`../references.md`](../references.md). Silence is fine.
- **Editor:** whatever the editing teammate knows (CapCut, iMovie, DaVinci Resolve). Subtitles burned in, white on a dark band, large enough for a projector.
- **Export:** MP4 (H.264), 1080p, **29 s or less**.
- **Upload:** YouTube "Unlisted" plus a backup on a public Drive link. **Test both links in a private window, logged out**, before submitting.

### Timeline from now

| Time | Step |
|---|---|
| 11:15 | Voice-over text locked (above); language set to English; shot links open in tabs |
| 11:15 to 12:00 | Record S1 to S6, two takes each; record the voice-over |
| 12:00 to 13:00 | Edit, subtitles, cliff title card, end card |
| 13:00 | Whole team watches once; one round of fixes only |
| 13:15 | Export, upload, test links logged out |
| **13:30** | **Submit to Sofia** |
| 14:00 | Deadline |

---

## Part 2: the 3-minute pitch (if we make the top 5)

### Running order

| Time | Part | What is said or shown |
|---|---|---|
| 0:00 to 0:20 | **Hook** | "Europe has just had its two worst fire years in a row. Each summer the EU sends hundreds of firefighters to stand where fire is expected. Where and when should they stand?" NASA has 25 years of data to answer that, and joined naively it gives the wrong answer. |
| 0:20 to 0:40 | **Problem** | The 2012 cliff chart. MODIS sees 1 km, VIIRS 375 m and finds about 2.7× more fire `[V]`. Join them naively and fire seems to triple when only the instrument changed. |
| 0:40 to 1:20 | **Demo 1: the fair record** | Bulgaria's calendar: measured months vs months estimated from MODIS, each with a range. "Is this unusual?" Search a town and a distance. "This fire against past fires". Download the CSV. |
| 1:20 to 1:55 | **Demo 2: tomorrow** | Forecast tab on Sofia: the level, "lower or higher than usual for November here", fire weather in words. The risk screen's top spots per region. Drag the timeline to later days: from day 2 the app shows NASA's fire-weather index and says it is not our score. |
| 1:55 to 2:25 | **Why trust it** | History: tested on 2019 to 2022, years it never saw; Bulgaria misses by about 20% of an average month, the USA by about 14%, and the 90% ranges held about 95% of the time `[V]`. Tomorrow: on 2025, Europe, the model caught 53.8% of new fires in its top 5, history 51.0%, NASA's index 41.1%, random 39.4% `[V]`. **Weak spot, said first:** in 2023 to 2025, the years of satellite drift, Bulgaria's history error rises to about 56% `[V]`; and the model overstates some city squares, Sofia about 4 times its own history `[V]`. |
| 2:25 to 2:45 | **What is new and next** | One record from 2000 to today for any place, plus a next-day outlook scored in public against NASA's own index. Next: use yesterday's fires, human activity and plant dryness ([roadmap](2026-11-15-post-event-roadmap.md)); a daily job that scores every forecast against the next day's satellite fires. |
| 2:45 to 3:00 | **Close** | Who uses it: fire services, land managers, scientists, in English and Bulgarian. Tagline. |

Say "random 39.4%" out loud: it shows that a big percentage proves nothing on its own, and that beating the right baselines is the claim.

### Seven slides (also the NASA backup demo, which allows up to 7)
1. Title: Emerge, tagline, link.
2. The 2012 cliff (one chart, one sentence).
3. The fair record: screenshot of Bulgaria's calendar, measured vs estimated.
4. Tomorrow: screenshot of the Sofia card and the risk screen.
5. Why trust it: two small tables (history test, risk test) and the weak spot.
6. What is new: GWIS keeps sensors apart and works by country; the only fire calendar elsewhere (Greenpeace) is MODIS only, 20 countries, ends 2022; **Emerge: one record from 2000 to today, any place, plus a scored next-day outlook, open source.** We build on FIRMS and GWIS, we do not replace them.
7. Next steps, link and QR code to the app.

### Stage roles (team to decide)
- **Storyteller:** hook, problem, close.
- **Demo driver:** runs the laptop; says little.
- **Scientist:** "Why trust it" and most questions in the Q&A.

### Safety nets
- Laptop on a phone hotspot as backup; all demo links open in tabs, language already English.
- The video file stored offline on the laptop: if the live demo fails, play it and keep talking.
- Browser zoom checked on the projector.
- Rehearse twice with a stopwatch before 14:30. Cut words, never speed up.

### Likely questions, short answers

| Question | Answer |
|---|---|
| Why not just use VIIRS? | It only starts in 2012: half the record. Fire managers need the 2000s too, especially the big years. |
| How does the conversion work? | On squares of 0.25° (about 28 km), month by month. For each country, 5° latitude band and calendar month we learn how VIIRS numbers relate to MODIS numbers in the years both flew (fitted on 2012 to 2018), pulled towards the country and world average where data is thin, plus a small background term for months MODIS saw nothing. Then the MODIS-only years, Nov 2000 to early 2012, are converted to VIIRS level `[V]`. |
| How accurate is the history? | Tested on 2019 to 2022, years the model never saw, with the rules fixed before the test. Whole countries, month by month: Bulgaria misses by about 20% of an average month with 6% bias, the USA by about 14% `[V]`. Across 203 countries with enough fire, the middle country misses by about 40%; big fire countries about 22%, the smallest third about 107% `[V]`. In Bulgaria and the USA the 90% range held about 95% of the time, square by square `[V]`. |
| How does the risk model work? | A gradient-boosted tree model (LightGBM) ranks forest and wildland squares using NASA's fire-weather forecast made 3 days ahead, earlier fire history, recent nearby fires and land type. It only uses data up to two days before the forecast day `[V]`. |
| How accurate is tomorrow's risk? | On 2025, a year it never saw: Europe 53.8% of new fires in the top 5 squares per region against 41.1% for NASA's fire-weather index; world 20.4% against 11.2% `[V]`. The gain over NASA's index is 12.7 points in Europe, with a 95% interval of 11.2 to 14.2 `[V]`. |
| Why not 80 or 90%? | Picking 5 squares at random already catches 39.4% in Europe, because some regions are small `[V]`. Published 80 to 90% figures come from tests with equal shares of fire and no-fire days; strict published measures for next-day ignitions are 8 to 25% `[D]`. We publish the baselines so the number can be judged. |
| Is the probability reliable? | Better than history (Brier skill 0.593 in Europe `[V]`), but not well calibrated at the low end: where it says 0.5%, fire happened 4.1% of the time `[V]`. That is why the levels are bands with "usual for this month", not exact chances. |
| Has it been checked live? | The proof page logs each published forecast against the next day's satellite fires. First day, 14 Nov, worldwide: our model caught 156 of 752 new fires, NASA's index 99 `[V]`. One day is a start, not proof. |
| Isn't this what GWIS or EFFIS already does? | GWIS compares each sensor with its own 10-year average, by country, and shows fire danger. EFFIS maps burned areas of fires of about 30 ha or more. We make one 25-year hotspot record for any point or area, and rank where new fires are most likely tomorrow, scored against NASA's own index. We use GWIS ourselves. |
| What about clouds, or satellites missing days? | Gaps are shown as "no data", never as zero. Known gaps are marked. |
| A hotspot is not a wildfire. | Correct: it can be a farm burn or a gas flare. We keep vegetation fires only and show reported fires beside our numbers. |
| What happens when MODIS ends? | The record continues on VIIRS, and the old years stay comparable. |
| Is it a warning system? | No. A research prototype: "Risk outlook (unofficial)". Follow local authorities (112). Decisions rest with the fire service. |
| Who would use it in Bulgaria? | Fire services and forestry planning before the season; municipalities checking whether a season is unusual; crews looking at tomorrow's ranked spots. |
| What did AI do? | Coding assistants under our direction; expected answers written before the code by a separate agent; results checked against real satellite data ([`../si-usage.md`](../si-usage.md)). |

---

## Decisions the team needs before recording
1. **Who speaks** (storyteller, demo driver, scientist) and **whose voice** is on the video.
2. **Who edits** the video and on which tool.
3. **Which model is presented** if the teammates' Bulgaria model is kept alongside ours: the pitch above uses the published one; the other can appear under "next" until both are scored on the same test.
