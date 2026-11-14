# Interview answers and decisions (Sat 14 Nov 2026)

The team's answers to [`interview-questions.md`](interview-questions.md), summarised. Where the team asked for research or a recommendation, Claude's answer follows. Open items are marked **⏳**.

## Decisions taken by the team

| # | Topic | Team decision |
|---|---|---|
| A1 | Problem | Default accepted: one fair fire record from two satellite sensors, for any area |
| A2 | Users | Firefighters (professionals and volunteers), people protecting property in danger areas, and the general public. It must also win the NASA challenge |
| A3 | Wow moment | **The whole world** on a globe, not just one Bulgarian region |
| A4 | Story | Must cover **Bulgaria**, so local crews and volunteers can use it |
| A5 | Name | **Emerge** |
| B1 | Top tasks | Pick an area and dates; a world overview map; a **fire-risk outlook** for the coming days or months with a certainty level ("like a weather forecast for fires"); a heat map of risk zones with levels; a globe like Google Earth; navigation like [everydayweather.com/lab/hazards](https://everydayweather.com/lab/hazards) |
| B2 | Decisions supported | Warn people in danger areas in advance; advise crews and volunteers on where and when to pre-position |
| B3 | Language | **English and Bulgarian** |
| B4 | Device | Desktop and mobile; a **PWA** (installable web app) if the extra time is small |
| B5 | Expertise | Professionals and the general public: every term explained in plain language |
| C1 | Geography | **Bulgaria and USA are must-haves**; the rest of the world depends on the time cost |
| C2 | Time range | 2000–2025 for sure; research data after 2025 and before 2000 |
| C3 | Resolution | Daily where the data allows |
| C4 | MVP | Asked for a MoSCoW feature list → [`features-moscow.md`](features-moscow.md). **⏳ The team picks the features** |
| C6 | Out of scope | User accounts |
| D1 | Sensors | MODIS (Terra, Aqua); VIIRS S-NPP 2012–2025; NOAA-20 2018 onwards; NOAA-21 for 2026. Research more sensors |
| D2 | Filters | Defaults accepted (`type 0`; MODIS confidence ≥ 30; VIIRS `n` or `h`; day and night) |
| D8 | Intensity | Nice visualisation (show FRP intensity, not only counts) |
| G6 | Shareable links | Yes, if cheap |
| G8 | 3D globe | Yes, like Google Earth |
| H2 | Hosting | Virtual machine and/or Vercel |
| H5 | Tests | Unit tests for all hot paths (what users do most) |
| J1 | Pitch | 8 judges; the presentation must be very smooth and polished |

## Claude's answers to the team's questions

### E3: are we turning low-resolution into high-resolution?

**Almost, but with numbers, not pictures.** NASA gives us **points**, not photos: every point is one detected fire pixel.
- **What differs between the sensors:** VIIRS (375 m pixels) sees more and smaller fires than MODIS (1 km pixels).
- **What we use:** from 2012 to 2025 both sensors watched the same fires, so we can learn how many VIIRS detections match a given number of MODIS detections. We learn that for each area and month, with an error range.
- **What we do with it:** apply that to the MODIS-only years (2000–2011) to estimate **what VIIRS would have counted**.
- **Result:** one fair series from 2000 to today, in "VIIRS-equivalent" units.
- **We don't sharpen images.** We scale counts statistically and say how sure we are.

**Training and testing:** learn the conversion on 2012–2018, test it on 2019–2025 (the test years are never used for learning). That test is our proof.

**E1 (units):** VIIRS-equivalent, as you described. **E2 (model):** start with a ratio per region and month, compare it with a regression, and keep whichever predicts the test years better.

### D3: how do we compare like with like? Five options, one pick

| # | Option | Fair? | Note |
|---|---|---|---|
| 1 | Raw counts per sensor | ❌ | VIIRS always looks 3–5× worse `[D]`. Misleading |
| 2 | **Fire cell-days:** count each small grid cell (about 1 km) once per day if it had any detection | ✅ | Removes most of the pixel-size difference; simple and robust |
| 3 | Coarse cell-days (about 10 km cells) | ✅ | Even fairer, but loses local detail |
| 4 | Fire energy (sum of FRP) instead of counts | ◑ | More physical, but small fires add little energy and VIIRS sees more small fires |
| 5 | **Same-time pairs:** fit the conversion only on overpasses at about the same afternoon time (Aqua MODIS and VIIRS) | ✅ | The fairest way to *learn* the conversion |

**Pick:** option **2 for display**, and option **5 to learn the conversion**. **User control:** a toggle for "Raw counts per sensor / Harmonized / Fire energy (FRP)", so experts can see the raw data and the public sees the fair series.

### A6: which awards to aim for, and how to raise the odds

Based on the 30 Global Winners of 2023–2025 `[V]` and our new scope (history, forecast, alerts, globe):

| Award | Fit | Why |
|---|---|---|
| **Local Impact** | Strong | Earth/map-data projects won it 3 years running `[V]`; Bulgarian crews and volunteers are a real local use |
| **Galactic Impact** ("improve life on Earth") | Strong | Fire warnings and risk outlooks protect people and property; a farm Earth-observation tool won it in 2024 `[V]` |
| **Best Use of Data** | Strong | Harmonizing two NASA sensors is literally the data challenge |
| Best Use of Science | Medium | Our back-tests and error ranges show the scientific method |
| Global Connection | Medium | Worldwide, in two languages |
| Best Use of Technology | Medium | 3D globe and PWA, but many teams show flashy tech |

**Recommendation:** pitch for **Local Impact plus Galactic Impact**, with Best Use of Data as the backup. All three share one story: *"25 fair years of NASA fire data, turned into warnings people in Bulgaria and the US can act on."*

**How to raise the odds** `[U]`:
1. **Proof first:** the "How we know it's right" page answers the judges' Validity question.
2. **A real user:** a quote from a Bulgarian firefighter or volunteer who tried it.
3. **A polished 30-second video:** rendered with HyperFrames, checked with Impeccable or Taste for design.
4. **Honest wording:** "not an official warning service" builds trust.

Awards are judged across all challenges and the scoring weights aren't published, so the odds can't be calculated.

### F2: which of the 137 verification methods we use

See [`../docs/verification-plan.md`](../docs/verification-plan.md), section "Methods selected from the 137 (MoSCoW)".

### B4: how much extra time is a PWA?

These are rough estimates with AI coding agents `[U]`, not yet researched.

| Version | Extra time vs a plain mobile-friendly web app |
|---|---|
| **Installable PWA** (add to home screen, fast start, offline shell) | **about +5–10%** of front-end time (about 1–2 hours) |
| **PWA with push notifications** (alerts for danger areas) | **about +25–35%** more. It needs a notification server, subscriptions stored per location, and testing on iPhone, which only allows push for apps added to the home screen |

**Recommendation:** build an installable PWA (cheap). Push alerts stay a Could-have (feature C1 in [`features-moscow.md`](features-moscow.md)).

### C1: how much more time for other countries?

This is from facts already checked; no new research.
- **Bulgaria plus USA:** the download is small for Bulgaria (all years: 5.3 MB MODIS, 7.4 MB S-NPP, 3.4 MB NOAA-20 `[D]`) but much bigger for the USA, and the work is the same scripts either way.
- **The whole world:** NASA's global yearly files total about 10.7 GB (MODIS), 27.2 GB (S-NPP) and 15.4 GB (NOAA-20) `[D]`. Downloading and pre-computing that on a server adds **roughly 3–5 hours** `[U]`.
  - **Less if a small ready-made global grid exists.** That is part of the data-source research the team will do later.

### Open: research later (team decision, 14 Nov)

The team chose to do these later; no research has been started:
- **C2 and D1:** extra data sources (before 2000, after 2025, more satellites).
- **D5:** storage options, ranked (after the data sources are known).
- **H1:** stack options, ranked.

**Already done, before the stop:** a forecasting note, [`../docs/research/forecast-options.md`](../docs/research/forecast-options.md). Its summary:
- **Show official forecasts** (Copernicus GWIS/EFFIS for 1–9 days worldwide; the NIFC 4-month outlook for the USA).
- **Add our own "historical chance of fire this month"**, checked on held-out years.
- **Label it** "Risk outlook (unofficial)".
- **Caveat:** most of its numbers are `[D]`, from search summaries.
