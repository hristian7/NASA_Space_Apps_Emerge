# 30-second video script, v2 (Sun 15 Nov, 13:10)

Builds on the team's [video and pitch plan](2026-11-15-video-and-pitch.md) and the finished v1 video ([`../video/emerge-demo-30s.mp4`](../video/emerge-demo-30s.mp4)). What v2 adds: the team name first (NASA's own outline starts with it), both differentiators in the first 5 s, a "why now" with verified numbers, and the firefighter's need. Every app shot below was checked on the live app at 13:00 on 15 Nov.

**Time is short.** If v2 cannot be recorded, edited and uploaded by 13:30, send v1 to Sofia and use v2 for the NASA submission (due 23:59).

## Structure

| Part | Time | Goal |
|---|---|---|
| Who we are + differentiators | 0:00–0:05 | Team name; "one fair MODIS+VIIRS record since 2000, any place on Earth" |
| Problem + why now | 0:05–0:15 | Fires are growing; a firefighter's top need is tomorrow's risk in one place |
| Live app (OBS capture) | 0:15–0:28 | Calendar → tomorrow's risk spots → proof |
| End card | 0:28–0:30 | Name, link, future vision |

NASA's [submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) suggests: team and name, the challenge, title and tagline, how it works with NASA data, future vision. This script covers all five in 30 s `[V]`.

## Shot-by-shot

About 70 spoken words, read at a brisk 2.5 words per second. Every voice-over line is also a burned-in subtitle.

| Time | Screen | Voice-over | On-screen text |
|---|---|---|---|
| 0:00–0:05 | Two timeline bars, "MODIS 2000→" (orange) and "VIIRS 2012→" (yellow), slide together into one bar; the world fire-history glow fades in behind (live app home screen, S1) | "We're Emerge: one fair NASA fire record since 2000, anywhere on Earth." | **Team Emerge · Sofia** / MODIS + VIIRS → **one record, 2000 to today** |
| 0:05–0:10 | Title cards on black, cut on the beat | "2025 was the EU's worst fire year on record." | **2025: EU's worst fire season on record. 1.08 million ha burned** / small: *Los Angeles, Jan 2025: 31 lives lost* |
| 0:10–0:15 | The cycle strip **Prevent ▸ Prepare ▸ Respond ▸ Recover**; the first two light up. Then "10 websites" icons collapse into one Emerge icon | "A firefighter of 20 years told us: he checks ten websites, and needs tomorrow's risk most." | **We focus on prevention: one day ahead** / **10 websites → 1** |
| 0:15–0:20 | **OBS, History:** Bulgaria's fire calendar (25 years × 12 months). Cursor runs down the striped rows (before 2012) | "Pick any place. Twenty-five years in one calendar; striped years are converted from MODIS." | **Fire calendar, Bulgaria, 2000 to 2026** / Striped = MODIS converted to VIIRS level |
| 0:20–0:25 | **OBS, Risk outlook:** Australia → Northern Territory, numbered spots on the map; click spot 1, the card shows "Level 3 … Consider a standby team near here tomorrow" | "Then tomorrow's top risk spots, ranked, each with a reason." | **Tomorrow's top 5 spots per region** / *Unofficial research outlook* |
| 0:25–0:28 | Editor bar chart: Emerge **20.4%** · history 16.7% · NASA fire-weather index **11.2%** · random 10.5% | "Tested on 2025: nearly twice the fires NASA's fire-weather index caught." | **Tested on 2025, a year it never saw** / small: *World, new forest and wildland fires, top 5 squares per region per day* |
| 0:28–0:30 | End card: logo, link, data credits | "Emerge." | **emerge-beta-ten.vercel.app** / Next: a daily forecast, scored every day / *Data: NASA FIRMS, GFWED, GIBS* |

## OBS click path (15 s of capture, 3 short clips)

Record each clip separately (5–8 s each) and cut in the editor. Never record typing live.

| Clip | Before recording | Record |
|---|---|---|
| A, calendar | Open `https://emerge-beta-ten.vercel.app/?sel=c:BGR`, language EN, wait 5 s until the calendar draws | Slow cursor down the calendar's striped rows (2000–2011), then rest on the bright 2007 row |
| B, risk | Open `https://emerge-beta-ten.vercel.app/risk`, choose **Country: Australia**, then **Region: Northern Territory**; wait until the numbered spots draw | Click spot **1** on the map; hold 2 s on the card ("Level 3", "Consider a standby team near here tomorrow") |
| C, proof (optional) | Open `https://emerge-beta-ten.vercel.app/proof#next-day-risk` | 1 s scroll over "The model caught 20.4% …". Use the editor bar chart if this looks too text-heavy |

**Don't film:**
- The risk page as it first loads: it shows "Northern Cyprus, no spots" under a Bulgaria selector (seen 13:00, a bug).
- Bulgaria's risk in November: every spot is Level 1, so it looks empty. Northern Territory is in its fire season and shows Level 3 spots.
- Any placeholder, example label or blank map.

## English subtitles (SRT)

```srt
1
00:00:00,000 --> 00:00:04,800
We're Emerge: one fair NASA fire record
since 2000, anywhere on Earth.

2
00:00:05,000 --> 00:00:09,600
2025 was the EU's worst fire year on record.

3
00:00:10,000 --> 00:00:14,800
A firefighter of 20 years told us: he checks
ten websites, and needs tomorrow's risk most.

4
00:00:15,000 --> 00:00:19,800
Pick any place. Twenty-five years in one calendar;
striped years are converted from MODIS.

5
00:00:20,000 --> 00:00:24,800
Then tomorrow's top risk spots,
ranked, each with a reason.

6
00:00:25,000 --> 00:00:27,800
Tested on 2025: nearly twice the fires
NASA's fire-weather index caught.

7
00:00:28,000 --> 00:00:29,500
Emerge.
```

## What each claim rests on

| Claim | Number | Source | Tag |
|---|---|---|---|
| EU's worst fire season on record | 1,079,538 ha in 2025, highest since EFFIS records began in 2006 | [JRC, 31 Mar 2026](https://joint-research-centre.ec.europa.eu/jrc-news-and-updates/2025-was-eus-most-destructive-wildfire-season-record-2026-03-31_en) | `[V]` |
| Los Angeles fires | 31 deaths, 16,246 structures destroyed, Jan 2025 | [PBS/AP citing Cal Fire](https://www.pbs.org/newshour/nation/a-year-after-the-la-wildfire-disaster-key-numbers-show-how-it-unfolded-and-the-toll-left-behind) | `[V]` |
| Firefighter: 10 websites; tomorrow's risk is the top need | His words | [`../research/firefighter-interview.md`](../research/firefighter-interview.md) | `[U]` his figures |
| "Of 20 years" | Service length | The team member who held the interview; not in the written notes | `[U]` |
| Prevent, prepare, respond, recover | The emergency-management cycle; FEMA names the first phase "mitigation" | FEMA (page not reachable on 15 Nov; seen only on secondary sites) | `[D]` |
| One record since 2000 | Record runs Nov 2000 to 14 Nov 2026 | [`../../README.md`](../../README.md), `web/public/data/meta.json` | `[V]` |
| Striped = converted from MODIS | App legend: "Estimated from MODIS" | Live app, checked 13:00 | `[V]` |
| Nearly twice NASA's index | 20.4% vs 11.2% (1.8×); history 16.7%, random 10.5% | `web/public/data/risk/scorecard.json`, [proof page](https://emerge-beta-ten.vercel.app/proof#next-day-risk) | `[V]` |

**Don't say:**
- "400,000 evacuated in France and Spain" (the firefighter's figure). No official source matches it. The nearest is one news report of about 325,000 evacuated in July 2026 `[D]`.
- That the model uses greenness or soil moisture. It doesn't.
- "Early warning" or "official". It is an unofficial research outlook.
- "Twice as good as history." The gain over history is about 3.7 points worldwide `[V]`. "Nearly twice" applies only to NASA's index.

## Production

- **Voice:** an adult teammate, or the same AI voice as v1 (log it in [`../si-usage.md`](../si-usage.md)). No faces and no one under 18.
- **Export:** MP4, 1080p, **29 s or less** (videos over 30 s are ineligible for global judging `[V]`).
- **Upload:** YouTube Unlisted plus a public Drive backup. Test both links logged out.
