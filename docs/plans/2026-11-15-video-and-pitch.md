# Sunday plan: the 30-second video and the 3-minute pitch

Written Sat 14 Nov 2026. Rules come from [`../rules-and-judging.md`](../rules-and-judging.md); the competitor facts from [`../research/competitors.md`](../research/competitors.md).

## What is required

| Item | Rule | Deadline (Sofia) |
|---|---|---|
| **Demo video** | **Up to 30 s** for NASA (Sofia accepts 30 to 60 s, so one 30 s cut serves both). English or English subtitles. Public link, no login. No one under 18 on screen or in audio | **Sun 14:00** (build plan CP5: submitted by 13:30) |
| Jury watches every video | Scored on Impact, Creativity, Validity, Relevance, Presentation (1 to 5 each) | Sun 14:30 |
| **Live pitch** (only if we make the top 5) | **3 min + 5 min Q&A**, on site | Top 5 at 15:45, pitch from **16:00** |
| NASA submission | Video link, project link, references, AI-usage note, all fields in English | Sun 23:59 (build plan CP6: 22:00) |

The pitch slot is only 15 minutes after the top 5 is announced, so **the pitch is rehearsed before 14:30**, not after.

## The one message

**"NASA's fire record broke in two in 2012. Emerge joins it into one fair record, for any place on Earth."**

Every shot and every pitch minute serves this sentence. Two things must be on screen in the first 10 seconds, because they are what no other tool does (see the competitor table): **one harmonized record** and **any place**.

Tagline for the end card: **"25 years of fire. One fair record."**

---

## Part 1: the 30-second video

### Storyboard

About 65 words of voice-over in 30 s (a calm pace). Every line is also a burned-in subtitle, so the video works muted.

| Time | On screen | Voice-over / subtitle | Judges' criterion |
|---|---|---|---|
| 0:00 to 0:04 | Globe at night, fires lighting up (recent fires layer, or the time-lapse if C5 exists) | "NASA satellites have watched Earth burn since 2000." | Presentation |
| 0:04 to 0:10 | Simple chart: raw hotspots per year, a cliff at 2012. Label on the jump: **"New satellite, not more fire"** | "But in 2012 a sharper sensor began seeing almost three times more fire. The record broke in two." | Relevance |
| 0:10 to 0:17 | Type a latitude and longitude (or tap Bulgaria), the fire calendar fills in. Hover one old cell: the value with its error range | "Emerge joins them into one fair record, for any place on Earth, with an honest error range." | Creativity, Validity |
| 0:17 to 0:24 | Anomaly colour mode on; the card **"This month: above normal"**; "This fire vs past fires" rank; click **Download CSV** | "See when fires peak, whether this month is unusual, and take the data with you." | Impact |
| 0:24 to 0:27 | Proof page: predicted vs real for years the model never saw | "Tested on years it never saw." | Validity |
| 0:27 to 0:30 | Logo, **emerge-beta-ten.vercel.app**, "Data: NASA FIRMS (MODIS, VIIRS)" | "Emerge. 25 years of fire. One fair record." | Presentation |

The 2.7× figure is `[V]` (world, our pipeline, [`../research/first-run-bulgaria-usa.md`](../research/first-run-bulgaria-usa.md)); the voice-over rounds it to "almost three times".

### Shot rules
- **Only real numbers on screen.** If a view still shows the placeholder conversion, it carries its "placeholder" label or it is not filmed.
- **Each shot opens from a prepared link** (share links, S10, or URL parameters), so a retake lands on the same state. Write the list of links in a team note before recording.
- Use the same place throughout the video (one Bulgarian place with a clear fire season reads best for a Sofia jury; check the calendar first and pick a place where the worst month is obvious).
- Cursor slow and deliberate; no typing mistakes on camera (cut them out).

### If a feature is not ready at the 08:00 freeze

| Missing | Film instead |
|---|---|
| Globe or time-lapse | 2D map with the night base map |
| Point + distance | Country calendar (spine step 1) |
| "This fire vs past fires" | Anomaly colour mode alone |
| Proof page | One honest number on a title card: "Tested on years it never saw: error X %" (from the bake-off scores) |
| Everything after spine step 3 | The preview at `/preview` with the placeholder label visible, and say "prototype" in the voice-over |

### Production
- **Screen:** browser window at exactly 1920 × 1080, browser bars hidden, recorded with the Mac's screen recorder (Cmd-Shift-5) or OBS, 30 fps or more.
- **Voice:** one teammate (18 or over), quiet room, phone or headset mic close to the mouth, 2 to 3 takes. If an AI voice is used instead, it goes into [`../si-usage.md`](../si-usage.md).
- **Music:** optional, low, royalty-free with a licence that allows reuse; add it to [`../references.md`](../references.md). Silence is fine.
- **Editor:** whatever the editing teammate knows (CapCut, iMovie, DaVinci Resolve). Subtitles burned in, white on a dark band, large enough for a projector.
- **Export:** MP4 (H.264), 1080p, **29 s or less** (leave a margin under 30).
- **Upload:** YouTube "Unlisted" (opens without login), plus a backup copy on a public Drive link. **Test both links in a private window, logged out**, before submitting.

### Sunday timeline (video)

| Time | Step | Who |
|---|---|---|
| 08:00 | Feature freeze (CP4). Lock the voice-over text and the list of shot links | Writer + director |
| 08:30 to 10:00 | Record all shots, 2 takes each; record the voice-over | Demo driver + voice |
| 10:00 to 11:45 | Edit, subtitles, end card | Editor |
| 11:45 | Whole team watches once; one round of fixes only | All |
| 12:30 | Export, upload, test links logged out | Editor |
| **13:30** | **Submit to Sofia** (CP5) | Team lead |
| 14:00 | Deadline | |

---

## Part 2: the 3-minute pitch (if we make the top 5)

### Running order

| Time | Part | What is said or shown |
|---|---|---|
| 0:00 to 0:20 | **Hook** | "Europe has just had its two worst fire years in a row (EFFIS: 2025 the worst on record, 2026 about 82% above the 2006-2025 average by 4 Nov). Each summer the EU sends 777 firefighters to stand where fire is expected. Where and when should they stand?" NASA has 25 years of data to answer that, and today it gives the wrong answer. |
| 0:20 to 0:50 | **Problem** | The 2012 cliff chart. MODIS sees 1 km, VIIRS sees 375 m and finds about 2.7× more fire. Join them naively and fire seems to triple when only the instrument changed. MODIS ends soon, so the old record is about to lose its own continuation. |
| 0:50 to 1:50 | **Live demo** (the demo spine) | 1. type a latitude and longitude, pick a distance; 2. the fire calendar; 3. "Is this unusual?" in anomaly mode; 4. this fire vs past fires; 5. download the CSV. Phone-sized view for 5 seconds: "built for the field". |
| 1:50 to 2:15 | **Why trust it** | Learned from the years both satellites flew; tested on years it never saw; the two VIIRS satellites agree within about 1% `[V]`; every old number has an error range; "no data" is never shown as "zero". Name one weak spot ourselves (for example the S-NPP gaps in 2022 and 2024). |
| 2:15 to 2:35 | **What is new** | One slide, three rows: GWIS keeps the sensors apart and works by country; the only fire calendar (Greenpeace) is MODIS only, 20 countries, ends 2022; **Emerge: one record from 2000 to today, any place on Earth, open source.** We build on FIRMS and GWIS, we don't replace them. |
| 2:35 to 3:00 | **Impact and close** | Who uses it: fire services, land managers, scientists, in English and Bulgarian. Next: continue the record on VIIRS after MODIS, Bulgarian provinces, partnering with Bulgarian fire services. Close on the tagline. |

### Seven slides (also the NASA backup demo, which allows up to 7)
1. Title: Emerge, tagline, link, team name.
2. The 2012 cliff (one chart, one sentence).
3. Emerge in one sentence + one screenshot of the calendar.
4. Demo (live; screenshots underneath in case the network fails).
5. Why trust it (proof chart + the honest weak spot).
6. What is new (the three-row comparison).
7. Impact and next steps, link and QR code to the app.

### Stage roles (team to decide)
- **Storyteller:** hook, problem, close.
- **Demo driver:** runs the laptop; does not talk much.
- **Scientist:** "Why trust it" and most science questions in the Q&A.

### Safety nets
- Laptop on a phone hotspot as backup; all demo links open in tabs before going on stage.
- The video file stored offline on the laptop: if the live demo fails, play it and keep talking.
- Browser zoom checked on the projector; dark mode off if the projector washes it out.
- Rehearse twice with a stopwatch before 14:30. Cut words, never speed up.

### Likely questions, short answers

Fill the `[after bake-off]` items once the conversion plan is chosen.

| Question | Answer |
|---|---|
| Why not just use VIIRS? | It only starts in 2012: half the record. Fire managers need the 2000s too, especially the big years. |
| How does the conversion work? | We learn how MODIS numbers relate to VIIRS numbers in the years both flew, per region, land type and month, then convert the MODIS-only years. `[after bake-off: method and grid]` |
| How accurate is it? | `[after bake-off: error on held-out years]`. Every converted number shows its range. |
| Isn't this what GWIS already does? | GWIS compares each sensor with its own 10-year average, by country. We make one 25-year record, for any point or drawn area. We use GWIS ourselves for fire danger. |
| How is this different from EFFIS? | EFFIS maps the burned area of fires of about 30 ha or more, in Europe and its neighbours. We count every hotspot, small fires included, anywhere on Earth since 2000, and show when in the year fires come and whether now is unusual. We show EFFIS numbers next to ours. |
| What about clouds, or satellites missing days? | Gaps are shown as "no data", never as zero. Known gaps (S-NPP 2022 and 2024) are marked. |
| A hotspot is not a wildfire. | Correct: it can be a farm burn or a gas flare. We keep vegetation fires only, and show reported fires (EFFIS, NIFC) beside our numbers. |
| What happens when MODIS ends? | That is the point: the record continues on VIIRS, and the old years stay comparable. |
| Why the Terra drop after 2022? | Terra's orbit has been drifting; that is our likely explanation, not yet confirmed `[U]`. |
| Is it a warning system? | No. A research and planning tool; it always points to official services and to 112. |
| Who would use it in Bulgaria? | Fire services and forestry planning before the season; municipalities checking whether a season is unusual. |
| What did AI do? | Coding assistants under our direction; expected answers written before the code by a separate agent; results checked against real data ([`../si-usage.md`](../si-usage.md)). |

---

## Decisions the team needs to make tonight
1. **Who speaks** (storyteller, demo driver, scientist) and **whose voice** is on the video.
2. **Which place** the video and the demo use (check the calendar for a clear example).
3. **Who edits** the video and on which tool.
