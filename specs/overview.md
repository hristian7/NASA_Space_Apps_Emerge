# Emerge in one page

Short version for newcomers (14 Nov 2026). Full build details: [`specification.md`](specification.md).

## Part 1: what we are building this weekend

### The problem

NASA satellites have spotted fires from space since 2000. Each detection is a **hot spot**: one small patch of ground that was burning when a satellite passed over.

Two instruments did the spotting:
- **MODIS** (since Nov 2000): sees patches of about 1 km.
- **VIIRS** (since 2012): sees patches of about 375 m, so it catches many more small fires.

Worldwide, VIIRS records about **2.7 times** as much fire activity as MODIS in the same years `[V]`. Joined naively, fires seem to "rise" when only the instrument changed, so 2005 can't be fairly compared with 2024.

### Our answer: Emerge

A free website and phone app that turns 25 years of NASA fire data into **one fair record**, for any place on Earth.

**Making the record fair:**
1. We count hotspots, and also **fire days per small square**, which removes part of the instrument difference.
2. Both instruments flew together from 2012. From the years they overlap, we learn how MODIS numbers relate to VIIRS numbers, per region, land type and month.
3. We convert the MODIS-only years (2000–2011) into **"what VIIRS would have seen"**, with an honest error range on every number.
4. We test it on years it never learned from, and publish the results.

### What you can do in the app

| Feature | What it does |
|---|---|
| **3D globe or 2D map** | NASA satellite background, day or night; switch layers on and off |
| **Choose a place** | A point plus a search distance (tap or type latitude/longitude), a drawn area, or a country. "No data" is shown differently from "zero fires" |
| **Choose dates** | Any range from Nov 2000 to today |
| **Fire calendar** | Years × months showing the number of hotspots, coloured so the worst months and years stand out |
| **"Is this unusual?"** | This month vs the median and the average for the same month in past years |
| **This fire vs past fires** | The last 8 days vs the same days in every past year |
| **Detected vs reported** | Our satellite numbers next to official reported fires (Europe, USA) |
| **Chance of fire this month** | How often this place had fires in this month, with a certainty range |
| **Recent fires and fire danger** | NASA's last 24 hours, plus official forecasts |
| **Push alerts** | A phone notification when danger near a saved place turns high |
| **Downloads** | Hotspots found (CSV), monthly numbers, a summary, and the charts as images |
| **"How we know it's right"** | Our test results, including weak spots |
| **Advice, share links, English and Bulgarian** | Works on phones; installs like an app |

### Exact data sources

| Data | Source | Years |
|---|---|---|
| Fire hot spots, MODIS | NASA FIRMS, Collection 6.1 (Terra and Aqua satellites) | Nov 2000 → now |
| Fire hot spots, VIIRS | NASA FIRMS, 375 m (S-NPP, NOAA-20, NOAA-21 satellites) | 2012 → now |
| 2026 hot spots | firms-catalog, a free online copy of NASA FIRMS | up to today `[V]` |
| Last 24 hours | NASA FIRMS free daily files | live |
| Fire-danger forecast | Copernicus GWIS fire weather index (EU service, worldwide) | next 9 days |
| USA outlook | NIFC (US interagency fire centre) | next 4 months |
| Background maps | NASA GIBS (Blue Marble by day, Black Marble at night) | — |
| Outside checks | EFFIS (Bulgaria), NIFC statistics (USA), NASA MODIS burned-area maps | various |

All free; every source is credited.

### How we prove it works

The conversion must predict years it never learned from. The two VIIRS satellites agree within about 1% `[V]`, and we compare with published studies and official statistics.

### How it's built

A Vercel website (Next.js, MapLibre, deck.gl). All data is processed in advance (461 million detections kept `[V]`), so answers are instant.

**Emerge is a research tool, not an official warning service.** It always points to official services and to 112.

## Part 2: what comes later

| Idea | What it adds |
|---|---|
| **Our own forecast** | Predict fire chance from weather and history, but only if it beats the simple historical chance |
| **More satellites** | Europe's Sentinel-3 and weather satellites (Meteosat, GOES) for more frequent looks and an extra cross-check |
| **Life after MODIS** | MODIS ends in 2027 `[V]`; the record continues on the VIIRS satellites |
| **Time-lapse** | Play 25 years of fires on the globe |
| **Bulgarian provinces** | Statistics for each province (oblast) for local crews |
| **More layers and maps** | Temperature, wind, humidity and drought layers, plus more background maps (the app is built to take them) |
| **Fire intensity series** | A second record based on how much heat fires give off, not just how many there are |
| **Partners** | Work with Bulgarian fire services and volunteer groups to test and improve it |
| **Open data** | Publish the harmonized record as files scientists can download and reuse |
| **Field mode** | Offline maps and saved places for crews with poor mobile signal |
| **Smarter alerts** | "New fire near you" alerts from NASA's live detections, as well as fire-danger alerts |
