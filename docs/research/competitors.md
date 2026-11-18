# Who else does this? Competitors and similar tools

Checked on 14 Nov 2026 from public pages. Tags: `[V]` seen on the tool's own page or an official source, `[D]` from a dated or secondary source (may have changed), `[U]` our reading.

*18 Nov 2026: commercial and prediction competitors (Technosylva, OroraTech, Pano AI, insurance catastrophe models, European wildfire scores) and the accuracy comparison are in [`../../lean-canvas/competition/README.md`](../../lean-canvas/competition/README.md). This file covers fire-calendar and harmonization tools.*

## The short answer

**Nobody publishes one comparable MODIS + VIIRS hotspot record and lets you ask "is this unusual?" for any point or drawn area on Earth.** `[U]`

- The big official tools (NASA FIRMS, GWIS, Global Forest Watch) show MODIS and VIIRS **side by side, never converted into one record**. GWIS even compares each sensor with its own 10-year average, separately. `[V]`
- The one tool called a "fire calendar" (Greenpeace) uses **MODIS only, stops in 2022, and covers 20 countries**. `[V]`
- Scientists are working on harmonization, but for **burned area** or **fire heat**, not hotspot counts, and none of it is a web app a fire manager can use. `[V]`

That gap is exactly NASA's challenge, and it is our pitch.

## Comparison table

| Tool | Run by | Years | MODIS + VIIRS | One harmonized record? | Any point or drawn area? | Fire calendar (years × months) | "Is this unusual?" | CSV download |
|---|---|---|---|---|---|---|---|---|
| **Emerge (us)** | Space Apps team | Nov 2000 → now | Both | **Yes, with error ranges** | **Yes, worldwide** | **Yes** | **Yes, median and average, any month** | **Yes** |
| NASA FIRMS Fire Map | NASA | 2000 → now (archive by request form) | Both, as separate layers | No | Area for downloads and email alerts | No | No | Yes (archive form) |
| NASA Worldview | NASA | Daily imagery | Both, as separate layers | No | No | No | No | No |
| GWIS Current Statistics + Country Profile | EU JRC / Copernicus | Profiles 2002 → 2019 `[V]`; statistics current year | Both, **each vs its own 10-year average** | No | Countries and a few regions only | Seasonality charts from burned area, not hotspots | Yes, country level, vs 10-year average | Yes |
| EFFIS Current Statistics | EU JRC / Copernicus | 2006 → now | Burned areas outlined by analysts on satellite images, fires of about 30 ha or more; hotspots only help find them | Not hotspots | Countries in Europe, Middle East and North Africa | Weekly cumulative chart | Yes, vs 2006-2025 average | Yes (CSV, JSON, PDF) |
| Global Forest Watch (redirects to Global Nature Watch) | WRI | MODIS 2000 →, VIIRS 2012 → | Pick one | No | Countries, admin areas, own areas `[D]` | Weekly and cumulative year-on-year charts `[D]` | "Significant fires" vs average `[D]` | Yes `[D]` |
| Greenpeace Global Fire Calendar | Greenpeace | 2001 → 2022 | MODIS only | No | 20 countries + global | **Yes, monthly risk levels** | No (static) | No |
| fire.ai | Private company | Global history from 2026 only; US incidents from 2004 | Both, as toggles | No | Preset regions; drawn alert zones | No | No | No |
| Watch Duty | Non-profit, US | Live | Satellite is one input among 911, scanners, cameras | No | US only | No | No | No |
| Windy, Ventusky, Zoom Earth | Weather apps | Live | FIRMS layer | No | No | No | No | No |

Sources for each row are in the list at the end.

## The closest rivals, and our honest answer to each

### GWIS (the one judges might name)
- **What it does well:** official EU and GEO service, every country, compares current fire counts with a 10-year average, fire danger forecasts, downloads. `[V]`
- **Where we are different:**
  - GWIS keeps the sensors apart (VIIRS vs 10-year average, MODIS vs 10-year average). We make one record from 2000, so 25 years can be compared, not 10.
  - GWIS works by **country**. We work for **any point, radius or drawn area**: a valley, a reserve, a municipality.
  - GWIS country profiles stop at 2019 on its applications page. `[V]`
- **We use GWIS ourselves** for the 9-day fire danger (S3). Say so: we build on it, we don't replace it.

### Global Forest Watch
- **Strong on:** forests, overlays (protected areas, Indigenous lands), year-on-year cumulative charts.
- **Different:** the user picks MODIS **or** VIIRS; VIIRS history starts in 2012. We give one record from 2000 and show how sure we are. Note: GFW pages now redirect to "Global Nature Watch" `[V]`, so name it carefully on stage.

### Greenpeace Global Fire Calendar
- **The same idea of a calendar,** but MODIS only, ends in 2022, 20 countries, risk levels set by hand per country, non-commercial licence. `[V]`
- **Our line:** "A fire calendar exists for 20 countries until 2022. Ours covers every place on Earth until today, and it uses the sharper satellite too."

### NASA FIRMS
- **It is our data source,** not a rival. FIRMS is the best live map; it does not answer "is this season worse than usual?" Saying "we turn FIRMS into answers" is respectful and true.
- **Notice on the FIRMS map (seen 14 Nov 2026):** "Delivery of Suomi NPP satellite observations will cease on November 2, 2026", users should move to NOAA-20 and NOAA-21 `[V]`. Our harmonization uses S-NPP as the reference, so the record from November 2026 on must continue on NOAA-20/21 (they agree with S-NPP within about 1% `[V]`, per the overview). Good answer to "what happens next?" in the Q&A.

## Full feature map of 16 sites (14 Nov, evening)

The detailed map is in [`feature-map.md`](feature-map.md): 16 sites (EFFIS and its viewers, JRC, DW, fire.ai, Google's boundary tracking, EFFIS annual reports, FIRMS, Watch Duty, NIFC, Ready.gov, NOAA NCEI, CAL FIRE, OroraTech), 47 feature rows with effort, a table of their data sources, and a ranked shortlist.

**Most important finding:** our "Detected vs reported" panel (M28) shows EFFIS **satellite-mapped** estimates for Bulgaria (2024: 133 fires, 44,745 ha) under the word "reported". Bulgaria's own national figures, from the Executive Forest Agency in the EFFIS 2024 annual report, are **595 forest fires and 17,116 ha** `[V]`. They count different things. Both files in `web/public/data/reported/` are still marked as examples with one year each `[V]`. Filling them from the national report (Bulgaria) and the NIFC table (USA, 1983 to 2025 `[V]`) is the top recommendation.

**Shortlist before the freeze** (ranked; S = 1 to 2 h, M = 3 to 5 h):

| # | What | Effort | Raises |
|---|---|---|---|
| 1 | Real national reported numbers in M28, labelled apart from EFFIS satellite estimates | M | Relevance, Validity |
| 2 | Data date and source next to the result (history date vs live map date) | S | Validity, Presentation |
| 3 | Name the comparison years in "Is this unusual?" | S | Validity |
| 4 | A short verdict above the proof tables, including what failed | S | Validity, Presentation |
| 5 | Show the fire heat (FRP) the "this fire vs past fires" card already receives, with units | S | Relevance, Validity |
| 6 | Say plainly that "chance of fire" is a historical frequency, not yet scored (its Brier score is still empty) | S | Validity |
| 7 | A cumulative season chart, this year against the median | M | Presentation, Impact |

**Not worth taking:** dispatch and evacuation features, alerts (cut already), accounts, spread simulation, buying private satellite data, AI-written safety advice.

**Geostationary satellites (Meteosat, GOES):** see [their own section](#geostationary-satellites-meteosat-and-goes-checked-14-nov) below.

## Geostationary satellites: Meteosat and GOES (checked 14 Nov)

Polar satellites (MODIS, VIIRS) pass over a place a few times a day. Geostationary weather satellites stay above one spot and scan every 10 to 15 minutes, at the cost of bigger pixels.

- **GOES** (NOAA, the US satellites) sees only the Americas, so it cannot help with Bulgaria `[V]`. GOES-19 has an open fire product every 10 minutes with 2 km bands, public domain `[V]`. Japan's Himawari covers Asia and Australia.
- **Meteosat** (EUMETSAT) covers Europe and Africa. Its fire products come from the LSA SAF service, licensed CC BY 4.0 (free with credit) `[V]`:

| | MSG, SEVIRI instrument | MTG, FCI instrument (Meteosat-12) |
|---|---|---|
| Pixel size | 3 km at the equator, larger over Bulgaria `[U]` | 1 km `[V]` |
| Repeats every | 15 min `[V]` | 10 min `[V]` |
| History | Data record 2004 to 2015, near real time from 2016 `[V]` | From January 2025 `[V]` |
| Status | Operational `[V]` | Demonstration since October 2025: availability not guaranteed, validation ongoing `[V]` |
| Live map service (WMS) | `https://adaguc.lsasvcs.ipma.pt/adagucserver?dataset=MSG-FRP` | `https://adaguc.lsasvcs.ipma.pt/adagucserver?dataset=MTG-FRP` |

**Tested on 14 Nov:** both map services answer without a login and allow use from any website (CORS open); each keeps a rolling year of time steps; the newest MTG image was about 35 minutes old `[V]`. Bulk data (HDF5 files) needs a free LSA SAF account.

**The catch:** bigger pixels catch only larger fires and miss most small farm burns. A different instrument with a different detection limit cannot go into our MODIS and VIIRS calendar; it complements the record, it does not extend it.

**Three ways to use it, best first:**

| Use | Effort | Raises | When |
|---|---|---|---|
| A live "fires in the last hour" layer over Europe and Africa, using the same map-tile mechanism as the GWIS fire danger layer, labelled "demonstration product" | S | Presentation, Impact | Could be before the freeze; great in the video |
| Time of day: polar satellites pass at fixed times (Terra mid-morning, Aqua and VIIRS early afternoon). Meteosat sees the whole day, so it shows how much burning happens between passes and helps explain the Terra and Aqua gap | M to L | Validity | Later |
| An independent check of our trend: one instrument type (SEVIRI) runs from 2004 to today across the 2012 switch to VIIRS. If its trend agrees with ours, the jump is not caused by the sensor change | L | Validity | After the hackathon; a good "next step" line for the pitch |

## EFFIS, the JRC and the EU response: what we learn (checked 14 Nov)

The European Forest Fire Information System (EFFIS) is run by the EU's Joint Research Centre (JRC) and has been part of Copernicus Emergency Management since 2015 `[V]`. Its expert group has members from 43 countries in Europe, the Middle East and North Africa `[V]`.

### 1. EFFIS and Emerge measure different things, so we complement each other
- **EFFIS:** analysts draw the outline of each burned area on satellite images (MODIS, VIIRS, Sentinel-2), then refine it with 20 m Sentinel-2 images. Only fires of **about 30 ha or more** are mapped. Hotspots "help locate fires but are not the primary data source". The mapped fires cover about 95% of the EU's burned area each year `[V]`.
- **Emerge:** counts every satellite hotspot, small fires and farm burns included, for any point on Earth since 2000.
- **So:** EFFIS answers "how much land burned in big fires"; Emerge answers "how often, when in the year, and how unusual". Our "detected vs reported" panel (M28) must label the two units clearly (hotspots vs hectares in fires of 30 ha or more) and compare **rankings of years**, not raw numbers. The team's [`data-sources-satellites.md`](data-sources-satellites.md) already has the EFFIS JSON for Bulgaria.

### 2. Their wording is a template, and a warning
- EFFIS compares this year **to the same date** in other years and to a 2006-2025 average, and updates daily at the peak of the season, monthly in winter `[V]`. That matches our "month to date vs the same days in past years" (M5). Copy the reference-period wording ("average 2006-2025") and show a "data as of" date on every number.
- On 14 Nov the JRC page said 2,335 fires were "below the 2 193 fires recorded by 4 November 2025". 2,335 is higher. `[V]` **Lesson:** our "above/below normal" sentences must be generated from the numbers and covered by a test (M12), never typed by hand.
- The JRC also warns that its values may be refined after publication and may differ from national systems. We need the same caveat.

### 3. The numbers make the impact case for us
- EU burned area by 4 Nov 2026: **703,709 ha**, against a 2006-2025 average of **386,483 ha** for the same date `[V]`, about **82% above normal** (our arithmetic).
- 2025 was the **worst year on record** for the EU: 1,032,700 ha by the same date `[V]`.
- **Pitch line:** "Europe has just had its two worst fire years in a row. Knowing whether a season is unusual is no longer a research question."

### 4. Who would use a fire calendar (EU Civil Protection, DW, 28 Jul 2026)
- A country in trouble asks the EU's coordination centre in Brussels (ERCC), which checks which of **37 participating countries** can send help `[V]`.
- For summer 2026 the EU **pre-positioned 777 firefighters from 14 countries** in France, Spain, Portugal, Italy, Greece and Cyprus `[V]`.
- **13 of the 22** EU firefighting aircraft were tied up in France and Spain at once; the Commission said the resources were likely not enough `[V]`.
- The mechanism was first activated at the end of April and could stay active until early November: a **longer season** `[V]`.
- DW: aircraft "are most effective when fires are detected early"; prevention (firebreaks, building rules) matters as much as response `[V]`.
- **What this means for Emerge:**
  - Pre-positioning is a decision about **where and in which months** fires usually come. That is exactly our calendar and "chance of fire this month" (M4, M13), and the advice panel's "consider pre-positioning" (S8). Use this as the user story in the pitch: "Each summer Europe sends 777 firefighters to stand where fire is expected. Where and when should they stand? That is a question about fire history."
  - A longer season is visible in a calendar. A future feature: **fire season length per year** (first and last month above normal), not for this weekend.

### 5. Other ideas from EFFIS (later, not this weekend)
- **Wildfire Risk Viewer:** risk = fire danger × what is exposed (people, ecosystems, assets). Our calendar could later feed the "how likely" half.
- **Current Situation Viewer 2.0** works on phones `[V]`: for official tools a phone view is now expected, so "works on phones" is not a selling point on its own.
- **Partnerships:** Bulgaria's national expert in the EFFIS group, and the JRC's science collaborations, are a natural route for "partner with Bulgarian fire services" after the hackathon `[U]`.
- EFFIS includes prescribed and controlled burns in its maps `[V]`; hotspots include them too. Say so when someone asks "is every hotspot a wildfire?".

The European Commission's JRC page itself only describes the JRC (independent science for EU policy, open data catalogue); nothing about fires `[V]`.

## What they have that we don't (prototype state, Sat 14 Nov evening)

What our prototype has (updated late on 14 Nov): the map, place selection, layer menu and share links; the report (fire calendar, "Is this unusual?", "This fire vs past fires", chance of fire, detected vs reported, trend chart, CSV and PNG downloads, glossary, links to FIRMS, GWIS and EFFIS for the same place, English and Bulgarian); and a proof page with real test results `[V]`. The history now runs to 14 Nov 2026 `[V]`. Still open: the "reported" numbers are placeholder examples (see the feature map finding above), and the chance of fire has no test score yet.

| They have | Who | Do we need it this weekend? |
|---|---|---|
| **Fire danger forecast from weather** (1 to 10 days) and **seasonal outlooks** (temperature and rain, months ahead) | EFFIS, GWIS | No. We show the official GWIS danger as a layer (S3) and link to it |
| **Machine-learning "probability of fire"** up to 10 days, using fuel and dryness | ECMWF (2025) `[D]` | No. Out of our league for a weekend; name it if asked |
| **Burned-area outlines** (how big each fire was) and **fire severity** | EFFIS, GWIS | No. A different product (W5) |
| **What burned:** forest, farmland, protected areas (Natura 2000) | EFFIS, GWIS, Global Forest Watch | Would answer "is this hotspot a wildfire or a farm burn?". Later |
| **Emissions** (CO2, smoke) | EFFIS, GWIS (Copernicus atmosphere service) | No |
| **Live data within about 3 hours, every day** | FIRMS, Windy, fire.ai | Our "recent fires" is a snapshot from our last data pull. Say so on screen |
| **Alerts for my area** (email, push) | FIRMS, Global Forest Watch, fire.ai, Watch Duty | Cut by the team (W6). Mention as next step |
| **Human-checked incidents**, evacuation notices, aircraft | Watch Duty, fire.ai | No. We are not an emergency service |
| **Satellite pictures** (true colour, smoke, burn scars) | Worldview, FIRMS | Could be one more base map (C7/C9). Nice for the video, not needed |
| **Wind and weather next to fires** | Windy, Ventusky | Later (C8) |
| **Overlays:** forests, protected areas, Indigenous lands; upload your own shape | Global Forest Watch | Later |
| **Written context per country** (why fires happen there) | Greenpeace calendar | A short line per country would help the story; later |
| **Official trust:** years of operation, 43 national experts, annual reports, map services for other tools | EFFIS, GWIS | Only time gives this. We link to them and show their numbers |

**Where we lead** (nobody else has these together): one harmonized record from 2000; any point, radius or drawn area worldwide; a years × months hotspot calendar; "unusual?" against both median and average for any place; this fire ranked against the same 8 days of every past year; a chance of fire with its uncertainty range; "no data" kept apart from "zero"; downloads for the exact selection; Bulgarian.

## Is our prediction better? No, and it is a different kind of prediction

> **Plan 2 note (14 Nov night):** the team has since approved plan 2, a next-day fire-risk engine built on the weather, scored daily against NASA detections and two baselines ([`../../specs/plan-2-fire-risk/specification.md`](../../specs/plan-2-fire-risk/specification.md)). For next-day risk, plan 2 decides; this file is the earlier research.


| | Their forecasts (EFFIS, GWIS, ECMWF) | Our "chance of fire this month" (M13) |
|---|---|---|
| Question | "How dangerous is the weather in the next days?" | "In how many past years did this place have fire in this month?" |
| Input | Weather forecasts, fuel, dryness | Our harmonized fire record only |
| Horizon | 1 to 10 days (useful for about 2 days, `[D]`, Field 2020) and seasonal | The month, any year ahead |
| Where | Grid cells and countries | Any point, radius or area |
| Method | Fire Weather Index, machine learning | Share of fire years with a 90% range (Jeffreys interval) |

- **Our model does not beat theirs at what they do,** and it should not try (`forecast-options.md` agrees). Within a few days, the weather decides; only their models see the weather.
- **Beyond about two weeks, history is the honest default,** and a place-level base rate is something their tools do not give. That is our honest claim: "a fire base rate for any place, with its uncertainty", not "a better forecast".
- **We can't claim even that until it is scored.** The plan (M13) is a backtest on past years: Brier score and a calibration check ("when we said 30%, did fire happen about 30% of the time?"). Those numbers do not exist yet.
- **What is new is the harmonization, not the forecast.** Bake-off results (`bakeoff-results.md`) give the conversion error for whole countries per month of about 0.10 to 0.32 (nRMSE, fire days) `[V]`, about 0.8 to 1.4 for 50 km circles, and 1.7 to 3.8 for single 0.25° cells per month `[V]` (winning pipeline A): small places are much noisier. The world gate failed one check (Bulgaria, 0.32 against a limit of 0.30) `[V]`. Say this honestly in the pitch; it is our Validity score.
- **"We build on them" is now visible:** every report links to FIRMS, GWIS and EFFIS for the same place (built 14 Nov).

## Research we should mention (it proves the problem is real)

- **NASA science team (Boschetti):** planned a harmonized MODIS/VIIRS **burned area** product at 0.25°; 2023 slides report a critical delay. `[D]`
- **Fused MODIS + VIIRS fire heat (FRP), 2012-2024** (Remote Sensing, 2026): about 3.8 times more fire pixels than MODIS alone, but only for the years both flew. `[V]`
- **GFED5NRT** (ESSD, 2026): turns VIIRS counts into burned area for the post-MODIS era; the authors call it "a first step" toward merged VIIRS and MODIS records. `[V]`

Line for the pitch: **"Scientists are still working on this for burned area. Nobody has done it for hotspots in a tool people can use. We did, and we publish how accurate it is."**

## Past Space Apps fire projects

Spot That Fire (2018-2020) and "Help Fight Fires" (2017) teams built real-time detection, crowdsourcing and damage estimates on FIRMS data. `[V]` None of them harmonized the record or built a history calendar. The real competition this year is **other teams on this same challenge worldwide**; we cannot see them before judging, so our two differentiators (one fair record, any place) must be visible in the first 10 seconds of the video.

## Where rivals beat us (know it before the Q&A)

- GWIS, EFFIS and GFW are trusted official services with years of operation; we are a weekend research tool. We say so and link to them.
- EFFIS counts **mapped burned area and reported fires**; hotspots are not the same thing (a hotspot can be a gas flare or a small farm burn). Our "detected vs reported" panel (M28) turns this into a feature.
- FIRMS refreshes within about 3 hours of a satellite pass; our "recent fires" is as fresh as our last data pull.
- Watch Duty has human-verified incidents; we do not.

## Sources

- NASA FIRMS tools: https://earthdata.nasa.gov/learn/articles/firms-data-tool-focus
- NASA FIRMS: https://firms2.modaps.eosdis.nasa.gov/
- NASA Worldview fire layers: https://www.earthdata.nasa.gov/topics/human-dimensions/wildfires/near-real-time-data
- GWIS applications: https://gwis.jrc.ec.europa.eu/applications
- GWIS country profiles (UN-SPIDER): https://un-spider.org/news-and-events/news/gwis-launches-country-profiles-support-wildfire-risk-management-lac-region
- EFFIS: https://forest-fire.emergency.copernicus.eu/applications
- EFFIS current situation (JRC): https://joint-research-centre.ec.europa.eu/projects-and-activities/natural-and-man-made-hazards/forest-fires/current-wildfire-situation-europe_en
- EFFIS home page: https://forest-fire.emergency.copernicus.eu/
- JRC, current wildfire situation in Europe (read 14 Nov 2026, data of 4 Nov): https://joint-research-centre.ec.europa.eu/scientific-activities/natural-and-man-made-hazards/forest-fires/current-wildfire-situation-europe_en
- European Commission, JRC page: https://commission.europa.eu/about/departments-and-executive-agencies/joint-research-centre_en
- DW, "EU civil protection mechanism: help with fighting wildfires" (28 Jul 2026): https://www.dw.com/en/eu-civil-protection-mechanism-coordinating-europes-firefighters/a-78145189
- Global Forest Watch fire trends (2020 article): https://globalnaturewatch.org/blog/data-and-tools/wildfire-trends-gfw-fire-data/
- Global Forest Watch, VIIRS on GFW: https://www.globalforestwatch.org/blog/fires/fighting-fires-with-satellites-viirs-fire-data-now-available-on-global-forest-watch
- Greenpeace Global Fire Calendar: https://maps.greenpeace.org/projects/firecal/
- fire.ai: https://fire.ai/
- Watch Duty (secondary): https://firerisk.ai/firerisk-vs-watch-duty
- Windy fire layers: https://www.windy.com/-how-to-track-wildfires-with-windy/articles/43910
- Ventusky fire monitoring: https://my.ventusky.com/guide/news/ventusky-introduces-global-fire-monitoring-68/
- NASA harmonized burned area plan (Boschetti, 2022 and 2023): https://modis.gsfc.nasa.gov/sci_team/meetings/202305/presentations/boschetti.pdf
- Fused MODIS + VIIRS FRP: https://www.mdpi.com/2072-4292/18/10/1650
- GFED5NRT: https://essd.copernicus.org/articles/18/7535/2026/
- LSA SAF fire products: https://lsa-saf.eumetsat.int/data/products/fire-products/
- MTG fire product released as demonstration: https://lsa-saf.eumetsat.int/en/news/news/2025/10/01/release-of-mtg-fire-radiative-power-product-as-demonstration/
- LSA SAF map service: https://lsa-saf.eumetsat.int/data/map-service/
- GOES-19 fire product (Earth Engine catalogue): https://developers.google.com/earth-engine/datasets/catalog/NOAA_GOES_19_FDCF
- Past Space Apps fire teams: https://2020.spaceappschallenge.org/challenges/confront/spot-fire-3/teams/fierr and https://2017.spaceappschallenge.org/challenges/warning-danger-ahead/and-you-can-help-fight-fires/teams/hotmap
