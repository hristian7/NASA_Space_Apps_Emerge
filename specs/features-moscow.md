# Emerge: feature list, in priority order (MoSCoW)

**MoSCoW** sorts features into four groups:
- **Must have:** without it the project fails the challenge or the demo.
- **Should have:** important; build it if the Musts are on track.
- **Could have:** only if time is left.
- **Won't have this weekend.**

**Effort** (with AI coding agents) `[U]`: **S** = 1–2 hours · **M** = 3–5 hours · **L** = 6+ hours.

**This file is the single authority on feature priority.** Research notes may suggest different priorities; changes are made here.

**Team choices (14 Nov):**
- All Musts and all Shoulds. Hosting is Vercel.
- **Removed to save time (16:50):** push alerts (S11), combined data (M22) and the installable app (M15). They are listed under Won't. (Suggestion 2 still lists M22; this file decides.)
- **Suggestion 2 merged (evening):** adds M18–M26, C7–C10, and widens M3, M4 and M11. Its numbering is kept. **Updated 16:45** to the teammate's latest version: a points-only data model (M18, M20), and several base maps and data layers moved to Could (C9, C10).
- **Every item on NASA's challenge page is a Must (evening):** added M27 and M28, and widened M3, M4, M5 and M11. The checklist is in [`specification.md`](specification.md), section 2 ("Challenge-page checklist").
- **Plan 2 added (14 Nov, night): next-day fire risk**, from an interview with a Bulgarian firefighter ([`../docs/research/firefighter-interview.md`](../docs/research/firefighter-interview.md)). Approved: Musts M30–M35 and Shoulds S12–S15 (section "Plan 2" below). Recorded for later: Coulds C11–C13 and C15, Won'ts W9–W12. Dropped: a fire-spread hint. Build plan: [`plan-2-fire-risk/overview.md`](plan-2-fire-risk/overview.md) (short) and [`plan-2-fire-risk/specification.md`](plan-2-fire-risk/specification.md) (build spec).

Written 2026-11-14 from the team's interview answers ([`interview-answers.md`](interview-answers.md)) and updated the same day. The research files are linked where a feature depends on them. The build details are in [`specification.md`](specification.md).

**Feature groups:**
- **M23, Statistics and visualisation:** M1, M4, M5, M13.
- **M24, Verification:** M6.
- **"Using fetched data":** everything a user does with a selection (M3, M4, M5, M11, M13, S3, S8–S10, C2, C5, C6).

## Must have

### Data and selection (the core)

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| M1 | **Harmonized fire history** | The core of the NASA challenge. The older MODIS sensor saw fewer fires than the newer VIIRS sensor. We learn the difference from the years both flew and convert the old years, so 2000 to today becomes one fair record. Every converted number carries an error range. Plans: [`../docs/conversion-plan.md`](../docs/conversion-plan.md), [`../docs/harmonization-pipeline-plan.md`](../docs/harmonization-pipeline-plan.md) | L |
| M2 | **Data ready in advance: whole world** | We download and process NASA fire data for the whole world **before the demo**, so the app shows data straight away. Only real vegetation fires are kept; daily and monthly totals are pre-computed. Size: 43.5 GB of yearly country files `[V]`, done on 14 Nov: [`../docs/research/first-run-bulgaria-usa.md`](../docs/research/first-run-bulgaria-usa.md) | M |
| M14 | **Worldwide coverage** | Any place on Earth. Built from NASA's global FIRMS files, prepared in advance (M2). Ready-made burned-area grids were ruled out because they measure something different ([`../docs/research/data-sources-fire.md`](../docs/research/data-sources-fire.md)) | M–L |
| M18 | **Points-only data model** | Every kind of data is stored and fetched as **points**, never as shapes. Each point has a `precision-radius`: how sharp that measurement is (about 1 km for MODIS, 375 m for VIIRS). Our harmonized monthly values are points too, at the centre of each grid square, with a precision-radius about the size of the square. Shapes (heat maps, region totals) are only drawn **after** fetching, for display | M |
| M3 | **Pick a place** | Choose by **a point plus a search distance** (tap the map, or **type a latitude and longitude**, which NASA's brief suggests), or by **an area**: drawn, or ready-made like a country. The search distance is measured along the Earth's curved surface. Whatever the choice, the result is always points (M18). The calendar, charts, table and export follow that selection. If no fires were recorded there, the app says so instead of showing an empty chart | M |
| M19 | **"No data" is not "zero"** | The app tells apart "measured, and no fire was seen" (zero) and "no measurement was made" (no data: before Nov 2000, or a satellite gap), and shows them differently | S |
| M29 | **Minimum point format** | Every data point has at least: `type`, `location`, `precision-radius` and one measurement; more measurements and other precision fields (scan angle, confidence) can be added | S |
| M20 | **Several data types per point** | Every kind of data (fire, temperature, wind, humidity…) is stored as a point measurement, and one point can carry several at once, for example fire and temperature | S |
| M21 | **Get simple data** | For the selected place and time range, from today back to the start of MODIS and VIIRS: show one data type as raw rows, as a table, or on the map | M |

### Map and layers

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| M25 | **Room for more base maps** | Built so new base maps can be added later without redesigning the app (a simple list of map sources) | S |
| M26 | **Room for more data layers** | Built so new data layers can be added later without redesigning the app (each layer described once: what it is, point or area, units, source, time step) | S–M |

### What users see and do

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| M4 | **Fire calendar** | For a point or area: a grid of years × months showing the **number of hotspots** (harmonized to VIIRS level, as NASA's brief asks), coloured so the worst months and years show at a glance. A switch shows **fire days** (cell-days, our fairer unit) or raw counts per satellite. Statistics and charts included. Click a cell to see those fires on the map | M |
| M5 | **"Is this unusual?" indicator** | Compares this month with the same month in past years, using **both the median and the average** (both named in NASA's brief). Says in plain words whether it is above or below normal and by how much. The calendar has an **anomaly colour mode**: above normal in one colour, below in another. For the unfinished current month, it compares month-to-date with the same days in past years | S |
| M13 | **"Chance of fire this month" from history** | For any place, how often fires happened in this month over 25 years, as a probability with a certainty range. Checkable on past years (Brier score and a calibration chart) | S–M |
| M27 | **This fire vs past fires** | NASA's brief asks how a current fire compares with previous ones. For the selected place: the **last 8 days** (number of hotspots and fire heat, FRP) vs the **same 8 days in every past year**, with a rank ("2nd highest since 2000"). 8 days because NASA warns that shorter periods are biased `[V]`. Tapping a recent fire on the map compares that fire's area the same way | M |
| M28 | **Detected vs reported** | NASA's brief mentions fires detected **and reported**. Next to our satellite numbers, show the official reported numbers where they exist: EFFIS for EU countries including Bulgaria (2006–2026 `[V]`), and NIFC for the USA (1983–2025 `[V]`). Elsewhere: "No official reported numbers available". These are national totals, labelled as such for a point or drawn area | M |
| M6 | **"How we know it's right" page** | Shows how well our conversion predicted years it never saw, with honest error numbers. Our proof for the judges (Validity) | M |
| M11 | **Downloads** | For the current selection and dates (NASA's brief asks for these): (1) **CSV of the hotspots found**, one row per detection; (2) CSV of the monthly numbers; (3) an **analytics summary** (key figures: worst month and year, trend, anomaly, chance of fire); (4) the **calendar and charts as images** (PNG). The columns are explained in each file. Not the same as our NASA download (M2) | M |
| M7 | **Plain-language explanations** | Short tooltips and one-line explanations for every term ("hot spot", "anomaly", "FRP", "radius", "no data") | S |
| M8 | **English and Bulgarian** | The whole interface in both languages, switchable | S |
| M9 | **Works on phones** | The layout adapts to a phone screen, so people in the field can use it | S |
| M10 | **Public web address** | The app runs online on **Vercel** at a link judges can open: https://emerge-beta-ten.vercel.app | S |
| M12 | **Tests on the main paths** | Automatic tests for what users do most: choose a place (point + radius, area, country), load the calendar, convert numbers, export. They check against expected answers written before the code | M |

## Should have

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| S1 ⭐ | **3D globe view** | A spinning Earth with fires and risk zones on it: the "wow" for judges. The 2D map stays as the fast fallback | M–L |
| S3 ⭐ | **Fire-risk outlook (official forecasts)** | The next days' fire danger from official forecasts as coloured zones with levels. Worldwide from Copernicus GWIS (`ecmwf.fwi` `[V]`), USA from the NIFC 4-month outlook. We display and credit trusted forecasts rather than inventing our own ([`../docs/research/forecast-options.md`](../docs/research/forecast-options.md)) | M |
| S5 ⭐ | **Recent fires (last 24 h / 7 days)** | The latest NASA detections on the map, so the app shows today, not only history | S |
| S6 ⭐ | **Hazard-style navigation** | A compact layer menu over a full-screen globe: layers on and off, base-map switcher, short legends | M |
| S8 | **Advice for crews and volunteers** | A plain panel: "High risk and historically active area: consider pre-positioning". Built from rules, with a clear disclaimer and links to official services | S–M |
| S9 | **Fire-intensity visuals** | Shows how strong fires are (FRP, the fire's heat output), not just how many | S |
| S10 | **Shareable links** | The link remembers the place, radius or area, dates and layers | S |

## Plan 2: next-day fire risk (approved 14 Nov, night)

From the firefighter interview. The same logic works for every country in the world; Bulgaria is the demo example. Build details: [`plan-2-fire-risk/specification.md`](plan-2-fire-risk/specification.md).

**Must have**

| # | Feature | What it means, in one sentence | Effort |
|---|---|---|---|
| M30 | **Top risk spots per region** | Any fire service in any country opens its own area and sees the places most likely to catch fire today and tomorrow, ranked from number one down. | M |
| M31 | **Next-day risk engine** | The engine gives every small square of land on Earth a fire-risk score for tomorrow, learned from that place's own seasons and past fires. | M–L |
| M32 | **All the data that drives fire** | For every place on Earth we collect temperature, wind, humidity, rain, how dry the plants are, whether it is forest or grass, and 25 years of past fires. | L |
| M33 | **Scorecard: predicted vs what happened** | Every day we check yesterday's predictions against the fires NASA satellites actually saw, and publish how often we were right compared with the official fire-danger index. | M |
| M34 | **"Why this spot"** | Each risky spot comes with a short plain reason, such as "very hot, strong wind, dry forest, burned in 6 of the last 25 Julys." | S |
| M35 | **One screen instead of 10 websites** | Tomorrow's danger, fires burning now, fire history and links to the official services sit on one simple page, so crews stop switching between ten websites. Needs S3 and S5 from plan 1, so build those early. | S |

**Should have**

| # | Feature | What it means, in one sentence | Effort |
|---|---|---|---|
| S12 | **Week outlook** | Shows the risk for the next 7 days, clearly marked as less certain than tomorrow. | S |
| S13 | **Wind on the map** | Arrows show how strong the wind is and which way it blows, now and tomorrow. | S–M |
| S14 | **Crew suggestion** (builds on S8) | Gives a plain suggestion such as "consider a standby team near spot 1", which the fire service is free to follow or ignore. | S |
| S15 | **Fire type label** | Tags every fire and risky spot as forest, farmland or grass, so crews know what kind of fire to expect. | S |

**Links to plan 1:** M31 uses the chance of fire this month (M13) as one input, replaces our own forecast model (C2), and covers the Bulgarian provinces view (C6) for every country.

## Could have

| # | Feature | What it is (plain language) | Effort |
|---|---|---|---|
| C2 | **Our own forecast model** | Predicts fire chance from weather and history. Only credible if it beats the simple historical chance (M13) | L |
| C3 | **Second source of truth** | A statistical comparison of our record with EFFIS and US records on the proof page. Showing the reported numbers themselves is now M28 | M |
| C4 | **Data before 2000 or from more satellites** | Older sensors or other satellites (Sentinel-3, geostationary). Research says no honest pre-2000 extension: [`../docs/research/data-sources-summary.md`](../docs/research/data-sources-summary.md) | L |
| C5 | **Time-lapse animation** | Play 25 years of fires on the globe. Great for the demo video | S–M |
| C6 | **Bulgarian regions view** | Statistics per Bulgarian province (oblast) for local crews | S |
| C7 | **More base maps, actually added** | Offer more base maps than NASA and OpenStreetMap, not just room for them (M25) | S |
| C9 | **Several base maps** (was M16) | Switch the background, 2D or 3D: NASA imagery, OpenStreetMap and others. The layer menu (S6) already switches NASA day and night views | S |
| C10 | **Several data layers** (was M17) | Show and use different kinds of data: MODIS, VIIRS, temperature, wind and more | M |
| C8 | **More data layers, actually added** | Add layers beyond fire, such as temperature, wind, humidity and drought, not just room for them (M26) | M–L |
| C11 | **Model that improves each season** (plan 2) | After the weekend, the engine keeps learning from every new fire season and gets more accurate | L |
| C12 | **Sharper spots** (plan 2) | Narrows risky spots from about 10 km squares to 1–2 km, closer to "this slope of this mountain" | L |
| C13 | **Printable daily brief** (plan 2) | Puts tomorrow's top spots for a region on one page, ready for the morning crew briefing | S |
| C15 | **Method sheet for fire chiefs** (plan 2) | A short document on how the prediction works and how accurate it is, so fire-service managers can approve official use | S |

## Won't have this weekend

| # | Feature | Why not |
|---|---|---|
| W1 | **User accounts and login** | The team decided: out for now |
| W2 | **An official warning service** | We are not an emergency agency. We point to official services and say so clearly |
| W3 | **Native app-store apps** | The website works on phones without the app stores |
| W6 | **Push alerts** (was S11) | Removed 14 Nov to save time (6–10 h `[U]`). Design kept in [`../docs/research/push-alerts.md`](../docs/research/push-alerts.md) for later |
| W7 | **Combined data** (was M22) | Several data types in one table. Removed 14 Nov to save time (3–5 h `[U]`) |
| W8 | **Installable app (PWA)** (was M15) | Add to home screen. Removed 14 Nov to save time (2–3 h `[U]`); the site still works on phones (M9) |
| W4 | **Making blurry images sharp** | Not needed: we convert fire counts statistically, not pictures (interview answer E3) |
| W5 | **Burned-area mapping from imagery** | A different, much bigger problem |
| W9 | **Fire-station locations** (plan 2) | Distance from each fire station to the risky spots; maybe later |
| W10 | **Firebreak planning** (plan 2) | Planning the ploughed strips that stop a fire jumping between blocks of forest or farmland |
| W11 | **Web cameras** (plan 2) | Spotting smoke with cameras on hills |
| W12 | **Live response coordination** (plan 2) | Dispatching and coordinating teams during a fire; we focus on prevention |

## Build order and cuts `[U]`

- **Before building:** freeze the data contract and run four short risk tests (see [`specification.md`](specification.md), sections 7 and 8).
- **First, the core:** M2, M14, M18–M20 (data model), M25–M26 (room for more maps and layers), then M1, M3–M6, M11, M13, M27, M28 and the rest of the Musts.
- **Then the Shoulds, in this order:** S6 → S1 → S5 → S3 → S10 → S9 → S8.
- **Scope check:** suggestion 2 and the challenge-page items add about 15–22 hours of work (less about 11–18 h after the 16:50 removals) `[U]`, spread across six parallel streams ([`specification.md`](specification.md), section 7).
- **First to cut if late, in order:**
  1. S8 advice;
  2. S9 intensity;
  3. globe polish (the 2D map stays as the fallback);
  4. the raw-hotspots download, limited to Bulgaria and the USA.
- **Never cut:** drawn areas and the latitude/longitude box (NASA's challenge page names them), and anything in the challenge-page checklist.
