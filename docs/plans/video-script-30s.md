# 30-second video script, v3 (Sun 15 Nov, 14:40)

Follows the owner's structure: who we are → the problem and why now → the firefighter → what we built. It builds on the team's [video and pitch plan](2026-11-15-video-and-pitch.md); v2 is in git history. App shots were checked on the live app on 15 Nov. Every number is tagged and sourced in the table at the end.

**Rules:** 29 s or less (a demo over 30 s is ineligible for global judging `[V]`), English subtitles, no one under 18 on screen or in audio.

## Shot-by-shot

79 spoken words, about 2.6 words per second: brisk but clear. Every voice-over line is also a burned-in subtitle.

| Time | Screen | Voice-over | On-screen text |
|---|---|---|---|
| **0:00–0:04** Who we are | Logo over the world fire-history glow (live app home, after it draws) | "We're Emerge: five people from Sofia, on NASA's satellite fire challenge." | **Team Emerge · 5 people · Sofia, Bulgaria** / Challenge: *Harmonization of MODIS and VIIRS Hot Spots* / **One fair fire record since 2000, anywhere on Earth** |
| **0:04–0:10** Problem + why now | Fast cards on black, about 1 s each, cut on the beat: France/Spain → EU → USA → Bulgaria | "Fires are growing. This July, over 300,000 people fled fires in France and Spain." | **July 2026: 300,000+ displaced in France and Spain** / **EU 2025: worst fire year on record, 1.08 M ha** / **USA 2026: 9.5 M acres burned, nearly 2× 2025** / **Bulgaria 2025: 546 forest fires** |
| **0:10–0:18** The firefighter | The cycle strip **Prevention ▸ Preparedness ▸ Response ▸ Recovery**, with Prevention lit, then 10 website icons collapsing into one | "A 20-year firefighter told us: data sits on ten websites. His top need is prevention: tomorrow's fire spots, to place crews early." | **"Predict tomorrow, one day ahead": his top need** / **10 websites → 1 app** |
| **0:18–0:21** Solution: the record | **OBS clip A:** Bulgaria's fire calendar; cursor down the striped rows (2000–2011) | "We merged two NASA satellite records into one," | **MODIS (2000→) + VIIRS (2012→) = one record** / Striped = MODIS converted to VIIRS level |
| **0:21–0:24** Solution: one place | **OBS clip B:** Forecast tab, Sofia point card; slow scroll over risk level, wind, rain, soil moisture, history | "joined 22 data sources in one app," | **22 open data sources · 11 from NASA** |
| **0:24–0:28** Solution: prediction | **OBS clip C:** Risk outlook, Australia → Northern Territory, numbered spots; click spot 1. Overlay bar chart: Emerge 20.4% · history 16.7% · NASA index 11.2% | "and our next-day forecast catches nearly twice the fires of NASA's index." | **82% more new fires caught than NASA's fire-weather index** / small: *Tested on 2025, a year it never saw. World, top 5 squares per region per day* |
| **0:28–0:30** End | Logo, link | "Emerge." | **emerge-beta-ten.vercel.app** / *One place, not ten websites* / Data: NASA FIRMS, GFWED, GIBS, POWER |

## OBS click path (3 clips, about 3–4 s each)

Record each clip on its own and cut them together in the editor. Never record typing live. Set language to EN first.

| Clip | Before recording | Record |
|---|---|---|
| A, calendar | Open `https://emerge-beta-ten.vercel.app/?sel=c:BGR`; wait 5 s for the calendar | Slow cursor down the striped rows 2000–2011 |
| B, one place | Open `https://emerge-beta-ten.vercel.app/?v=f&sel=p:42.6977,23.3219,25` (Sofia, Forecast tab) | Slow scroll down the card: risk level, wind, rain, soil moisture |
| C, risk | Open `https://emerge-beta-ten.vercel.app/risk`; choose **Australia**, then **Northern Territory**; wait for the numbered spots | Click spot **1**; hold on the card ("Level 3", "Consider a standby team near here tomorrow") |

**Don't film:**
- the risk page as it first loads (it shows "Northern Cyprus, no spots", a bug);
- Bulgaria's risk in November (every spot is Level 1);
- any blank map or placeholder.

## English subtitles (SRT)

```srt
1
00:00:00,000 --> 00:00:03,900
We're Emerge: five people from Sofia,
on NASA's satellite fire challenge.

2
00:00:04,000 --> 00:00:09,900
Fires are growing. This July, over 300,000 people
fled fires in France and Spain.

3
00:00:10,000 --> 00:00:13,400
A 20-year firefighter told us:
data sits on ten websites.

4
00:00:13,500 --> 00:00:17,900
His top need is prevention:
tomorrow's fire spots, to place crews early.

5
00:00:18,000 --> 00:00:23,900
We merged two NASA satellite records into one,
joined 22 data sources in one app,

6
00:00:24,000 --> 00:00:27,900
and our next-day forecast catches
nearly twice the fires of NASA's index.

7
00:00:28,000 --> 00:00:29,500
Emerge.
```

## What each number rests on

| Claim | Number | Source | Tag |
|---|---|---|---|
| France and Spain, July 2026 | Over 300,000 displaced. France more than 250,000 (220,000 in Gironde); Spain 79,000 evacuated plus 30,000 confined. The EU called it "one of the biggest evacuation operations in Europe" | [AP via PBS](https://www.pbs.org/newshour/world/historic-wildfires-in-france-and-spain-have-forced-hundreds-of-thousands-of-people-to-evacuate-heres-what-to-know) | `[V]` |
| EU 2025 | 1,079,538 ha, worst season on record (EFFIS records began in 2006) | [JRC, 31 Mar 2026](https://joint-research-centre.ec.europa.eu/jrc-news-and-updates/2025-was-eus-most-destructive-wildfire-season-record-2026-03-31_en) | `[V]` |
| USA 2026 so far | 68,753 fires, 9,484,195 acres by 13 Nov, against 4,899,305 acres by the same date in 2025 (1.9×) | [NIFC](https://www.nifc.gov/fire-information/nfn) | `[V]` |
| Bulgaria 2025 | 546 forest fires, 15,459 ha (national report) | [Forest Agency 2025 report](https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf), page 35, shown in the app | `[V]` |
| Firefighter: 10 websites; prediction one day ahead is the top need | His words | [`../research/firefighter-interview.md`](../research/firefighter-interview.md) | `[U]` his figures |
| "20-year firefighter" | Service length | The teammate who held the interview; not in the written notes | `[U]` |
| Prevention, preparedness, response, recovery | The emergency-management cycle; FEMA calls the first phase "mitigation" | Secondary sites (the FEMA page didn't load) | `[D]` |
| Five people, Sofia | Team size and event | Owner; public team page | `[U]` |
| Two NASA satellite records merged | MODIS since Nov 2000 and VIIRS since 2012, converted to one scale | [`../../README.md`](../../README.md), `web/public/data/validation.json` | `[V]` |
| 22 data sources, 11 from NASA | Rows in the Data table used by the live app or published model, not counting planned or experimental rows; Open-Meteo counted once; the NASA count includes two public mirrors of NASA data (firms-catalog, MCD12Q1 on Zenodo) | [`../references.md`](../references.md), counted 15 Nov | `[V]` |
| Nearly twice / 82% more than NASA's index | 20.4% vs 11.2% of new fires caught (world, 2025 hold-out); history alone 16.7%; Europe 53.8% vs 41.1% (31% more) | `web/public/data/risk/scorecard.json`, [proof page](https://emerge-beta-ten.vercel.app/proof#next-day-risk) | `[V]` |

**Other numbers, if a card needs swapping:**
- **Canada 2023:** over 230,000 people evacuated, 14.6 M ha burned ([NRCan](https://natural-resources.canada.ca/forest-forestry/wildland-fires/forest-fires)) `[V]`.
- **Los Angeles, Jan 2025:** 31 deaths and 16,246 structures destroyed ([PBS/AP citing Cal Fire](https://www.pbs.org/newshour/nation/a-year-after-the-la-wildfire-disaster-key-numbers-show-how-it-unfolded-and-the-toll-left-behind)) `[V]`.
- **Smoke deaths:** about 1.53 M a year worldwide from landscape-fire smoke, 2000–19 (Lancet 2024) `[D]`.
- **Extreme fires:** 2.2× more frequent over 2003–2023 (Nature Ecology & Evolution 2024) `[D]`.
- **Bulgaria:** villages evacuated in the July 2024 and July 2025 fires `[D]` (BTA).

**Don't say:**
- **"400,000 evacuated":** no source matches it; AP says "over 300,000".
- **"Better than NASA's prediction model":** say "NASA's fire-weather index". GFWED is a fire-weather index, not a fire-prediction model.
- **"Twice as good as history":** our gain over history is about 3.7 points worldwide.
- **Greenness or soil moisture as model inputs:** they are map layers only.

## Production

- **Voice:** an adult teammate, or the same AI voice as v1 (logged in [`../si-usage.md`](../si-usage.md)).
- **Export:** MP4 1080p, ≤ 29 s.
- **Upload:** YouTube Unlisted plus a Drive backup; test both links logged out.
