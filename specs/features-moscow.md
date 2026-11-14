# Emerge: feature list, in priority order (MoSCoW)

**MoSCoW** sorts features into four groups:
- **Must have:** without it the project fails the challenge or the demo.
- **Should have:** important; build it if the Musts are on track.
- **Could have:** only if time is left.
- **Won't have this weekend.**

**Effort** (with AI coding agents) `[U]`: **S** = 1–2 hours · **M** = 3–5 hours · **L** = 6+ hours.

**This file is the single authority on feature priority.** Research notes may suggest different priorities; changes are made here.

**Team: tick the features you want.** The recommended cut for about 24 hours is all the Musts plus the Shoulds marked ⭐.

Written 2026-11-14 from the team's interview answers ([`interview-answers.md`](interview-answers.md)). The research files are linked where a feature depends on them.

## Must have

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| M1 | **Harmonized fire history** | The core of the NASA challenge. The older MODIS sensor saw fewer fires than the newer VIIRS sensor. We learn the difference from the years both flew (2012–2025) and convert the old years, so 2000 to today becomes one fair record. Every converted number carries an error range. Plan: [`../docs/harmonization-plan.md`](../docs/harmonization-plan.md) | L |
| M2 | **Data pipeline: whole world** | Scripts that download NASA fire data for the whole world (about 53 GB of yearly files `[D]`, processed on a server), with Bulgaria and the USA checked first, keep only real vegetation fires, and pre-compute daily and monthly totals. This makes the app fast and the numbers repeatable | M |
| M3 | **Map with area selection** | A map where you pick a country or draw an area. Everything else (calendar, charts, downloads) follows that selection | M |
| M4 | **Fire calendar** | A grid of years × months, coloured by how much burned. You see at a glance which months and years were worst. Click a cell to see those fires on the map | M |
| M5 | **"Is this unusual?" indicator** | Compares this month with the normal level for the same month in past years, and says in plain words whether it is above or below normal and by how much | S |
| M6 | **"How we know it's right" page** | Shows how well our conversion predicted years it never saw, with honest error numbers. This is our proof for the judges (Validity) and what makes the project trustworthy | M |
| M7 | **Plain-language explanations** | Short tooltips and one-line explanations for every term ("hot spot", "anomaly", "FRP"), so firefighters, volunteers and the general public all understand | S |
| M8 | **English and Bulgarian** | The whole interface in both languages, switchable. English is required for judging; Bulgarian serves local crews and volunteers | S |
| M9 | **Works on phones** | The layout adapts to a phone screen, so people in the field can use it | S |
| M10 | **Public web address** | The app runs online (a virtual machine or Vercel) at a link judges can open. It's required for submission | S |
| M11 | **Data download** | Download the data behind what you see (CSV). The columns depend on the dataset and are explained in the file | S |
| M12 | **Tests on the main paths** | Automatic tests for the things users do most: select an area, load the calendar, convert numbers, download. They check against expected answers written before the code | M |
| M13 | **"Chance of fire this month" from history** | For any area, how often fires happened in this month over 25 years, as a probability with a certainty range. It's the honest core of the team's "forecast" wish: checkable on past years (Brier score and a calibration chart) and built on our harmonized data. **Moved up from Should** after the double-check | S–M |
| M14 | **Worldwide coverage** | Any area on Earth. **Team decision 14 Nov: the whole world is a Must.** Needs either big downloads processed on a server or small ready-made global grids. Time cost about +3–5 hours `[U]`; see interview answer C1 | M–L |
| M15 | **Installable app (PWA)** | People can add Emerge to their phone's home screen like an app, and it opens quickly. **Team decision 14 Nov: Must.** Extra time about +5–10% `[U]` (interview B4). Push alerts stay a Could (C1) | S–M |

## Should have

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| S1 ⭐ | **3D globe view** | A spinning Earth like Google Earth, with fires and risk zones on it. It's the "wow" for judges and the world overview the team wants. The 2D map stays as the fast fallback | M–L |
| S3 ⭐ | **Fire-risk outlook (official forecasts)** | Shows the next days' fire danger from official forecasts as coloured risk zones with levels, like a weather map. Sources: worldwide from Copernicus GWIS (fire weather index map layers `ecmwf.fwi` and `nasa_geos5.fwi` `[V]`), and USA from the NIFC 4-month outlook. We display and credit trusted forecasts rather than inventing our own. Details: [`../docs/research/forecast-options.md`](../docs/research/forecast-options.md) | M |
| S5 ⭐ | **Recent fires (last 24 h / 7 days)** | The latest NASA detections on the map, so the app shows today, not only history | S |
| S6 ⭐ | **Hazard-style navigation** | A layer menu like everydayweather.com/lab/hazards: switch between History, Recent fires, Risk outlook and Calendar. Clean and familiar | M |
| S8 | **Advice for crews and volunteers** | A plain panel: "High risk and historically active area: consider pre-positioning". It's built from rules on the risk outlook plus history, with a clear disclaimer and links to official services | S–M |
| S9 | **Fire-intensity visuals** | Shows how strong fires are (FRP, the fire's heat output), not just how many, with good colour scales and size or glow effects | S |
| S10 | **Shareable links** | The link remembers the area, dates and layers, so you can send exactly what you see | S |

## Could have

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| C1 | **Push alerts for people in danger areas** | Phone notifications when the risk near your saved location becomes high. It needs the PWA plus a server that sends messages. On iPhones it works only for apps added to the home screen, iOS 16.4+ `[V]`. Wording must never copy official warnings | M–L |
| C2 | **Our own forecast model** | A model that predicts fire chance from weather and history, checked on past years with standard scores. Only credible if it beats the simple historical chance (S4) | L |
| C3 | **Second source of truth** | Compare our record with Europe's EFFIS (for Bulgaria) or US fire records (for the USA) to show they agree | M |
| C4 | **Data before 2000 or from more satellites** | Older sensors (AVHRR, ATSR) or other satellites (Sentinel-3, geostationary) to extend or densify the record. Depends on the data research | L |
| C5 | **Time-lapse animation** | Play 25 years of fires on the globe as a short animation. Great for the demo video | S–M |
| C6 | **Bulgarian regions view** | Statistics per Bulgarian province (oblast) for local crews | S |

## Won't have this weekend

| # | Feature | Why not |
|---|---|---|
| W1 | **User accounts and login** | The team decided: out for now |
| W2 | **An official warning service** | We are not an emergency agency. We point to official services and say so clearly |
| W3 | **Native app-store apps** | The PWA covers phones without the app stores |
| W4 | **Making blurry images sharp** | Not needed: we convert fire counts statistically, not pictures (see interview answer E3) |
| W5 | **Burned-area mapping from imagery** | A different, much bigger problem |

## Recommended cut for about 24 hours `[U]`

- **Core:** all 15 Musts (including worldwide and the installable PWA), plus S1 (globe), S3 (official risk outlook), S5 (recent fires) and S6 (navigation).
- **If on track by Sunday 09:00:** add S8 (advice).
- **First to cut if late:** S1 (falling back to a 2D map). Worldwide is now a Must, so start the global download and processing first, on Saturday.
