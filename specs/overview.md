# Emerge in one page

Short version for newcomers (14 Nov 2026). Feature list: [`features-moscow.md`](features-moscow.md). Build details: [`specification.md`](specification.md). **Plan 2** (next-day fire risk, from a firefighter interview): [`plan-2-fire-risk/overview.md`](plan-2-fire-risk/overview.md).

## Part 1: what we build this weekend

### The problem

NASA satellites have spotted fires from space since 2000. Each detection is a **hot spot**: a small patch of ground burning when a satellite passed over. Two instruments did the spotting:
- **MODIS** (since Nov 2000): sees patches of about 1 km.
- **VIIRS** (since 2012): sees about 375 m, so it catches many more small fires.

Worldwide, VIIRS records about **2.7 times** the fire activity of MODIS `[V]`. Joined naively, fires seem to "rise" when only the instrument changed.

### Our answer: Emerge

A free website, built for phones too, that turns 25 years of NASA fire data into **one fair record** for any place on Earth:
1. Count hotspots, and also **fire days per small square**, which removes part of the instrument difference.
2. Learn how MODIS numbers relate to VIIRS numbers from the years both flew, per region, land type and month.
3. Convert the MODIS-only years into "what VIIRS would have seen", with an error range on every number.
4. Test it on years it never learned from, and publish the results.

### Must-haves (without these we fail the challenge)

| Feature | What it does |
|---|---|
| **Fair 25-year record** | MODIS converted to VIIRS level, with error ranges |
| **Whole world, ready in advance** | 461 million detections already processed `[V]`, so answers are instant |
| **Choose a place** | A point plus a search distance (tap or type latitude/longitude), a drawn area, or a country |
| **Choose dates, see the data** | Any range from Nov 2000; as rows, a table or a map |
| **"No data" is not "zero"** | Shown differently, so gaps are never mistaken for "no fire" |
| **Fire calendar** | Years × months of hotspots (or fire days, if hotspots fail their test), coloured so the worst months and years stand out |
| **"Is this unusual?"** | This month vs the median and average of past years |
| **This fire vs past fires** | The last 8 days vs the same days in every past year |
| **Chance of fire this month** | How often this place had fires in this month, with a certainty range |
| **Detected vs reported** | Satellite numbers next to official reported fires (Europe, USA) |
| **Downloads** | Hotspots found (CSV), monthly numbers, a summary, charts as images |
| **"How we know it's right"** | Test results, including weak spots; automatic tests on the main paths |
| **Plain language, English and Bulgarian** | Every term explained |
| **Works on phones, public link** | https://emerge-beta-ten.vercel.app |
| **Built to grow** | All data stored as points; one place can carry several data types; new maps and layers plug in without redesign |

### Should-haves (if the Musts are on track)

| Feature | What it does |
|---|---|
| **3D globe** with a layer menu | Fires and fire danger on a spinning Earth; the 2D map is the fallback |
| **Recent fires** | NASA detections from the last 24 hours and 7 days |
| **Official fire danger** | Copernicus forecasts for 9 days (world), NIFC outlook for 4 months (USA) |
| **Share links** | Send exactly what you see |
| **Fire-intensity visuals** | How strong fires are (heat output), not just how many |
| **Advice panel** | Plain hints for crews and volunteers |

### Exact data sources

| Data | Source | Years |
|---|---|---|
| Hotspots, MODIS | NASA FIRMS, Collection 6.1 (Terra, Aqua) | Nov 2000 → now |
| Hotspots, VIIRS | NASA FIRMS, 375 m (S-NPP, NOAA-20, NOAA-21) | 2012 → now |
| 2026 hotspots | firms-catalog (free online copy of FIRMS) | up to today `[V]` |
| Fire danger | Copernicus GWIS (EU service, worldwide); NIFC (USA) | next days and months |
| Background maps | NASA GIBS (Blue Marble, Black Marble) | — |
| Reported fires | EFFIS (Europe), NIFC (USA) | 2006 → 2026 / 1983 → 2025 |

All free; every source is credited.

### How we prove it, and how it's built

The conversion must predict years it never learned from; the two VIIRS satellites agree within about 1% `[V]`; we compare with published studies and official statistics. Built on Vercel with Next.js, MapLibre and deck.gl.

**Emerge is a research tool, not an official warning service.** It always points to official services and to 112.

## Part 2: later

| Could have | What it adds |
|---|---|
| **Our own forecast** | Fire chance from weather and history, only if it beats the historical chance |
| **Deeper official comparison** | Statistical agreement with European and US records |
| **More satellites** | Sentinel-3 and weather satellites (Meteosat, GOES) |
| **Time-lapse** | 25 years of fires played on the globe |
| **Bulgarian provinces** | Statistics per province (oblast) for local crews |
| **More maps and layers** | OpenStreetMap and other backgrounds; temperature, wind, humidity, drought |

**Ideas beyond the list:**
- continue the record on VIIRS after MODIS ends in 2027 `[V]`;
- partner with Bulgarian fire services;
- publish the record as open data;
- an offline field mode;
- "new fire near you" alerts.

**Not this weekend:** push alerts, combined data tables and an installable app (removed to save time). **Not planned:** user accounts, an official warning service, app-store apps, sharpening satellite images, burned-area mapping.
