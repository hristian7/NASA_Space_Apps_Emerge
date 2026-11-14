# Reported fires: Bulgaria's Executive Forest Agency (ИАГ) and the Copernicus/EFFIS site

Feeds feature **M28** ("detected vs reported") and verification method **V-M41** (triangulation) in [`../verification-plan.md`](../verification-plan.md). Researched 14 Nov 2026, cross-checking two sources against each other and against the files already committed under `web/public/data/reported/`.

Tags: `[V]` read directly at the primary source (a fetched document or a file I downloaded and parsed myself) · `[D]` from a secondary source (news, search-result summary) · `[U]` our inference.

## Summary

- **Bulgaria's Executive Forest Agency (ИАГ, iag.bg) publishes a full annual fire report every year**, with a fire-count, burnt-area, regional (16-RDG), cause, fire-type and land-cover breakdown. Five years (2021–2025) were read directly from the primary PDFs; see the table below. There is no API and no stable filename pattern, so each year is a one-off manual fetch.
- **Correction to my own earlier claim, now resolved:** I first thought the committed `{"fires": 133, "burned_ha": 44745}` placeholder in `web/public/data/reported/BGR.json` (hardcoded in `pipeline/export_examples.py` line 486) matched no known source. It does — and a screenshot of EFFIS's Current Situation Viewer layer panel (`BURNT AREAS` group: "MODIS & VIIRS NRT", "MODIS/SENTINEL2 (supervised)", "FIRE SEVERITY") explains exactly why there are **three different, all-real EFFIS numbers** for Bulgaria 2024:
  1. **44,745 ha / 133 fires** — EFFIS's live `estimatesbycountry` API, sourced from the **automated "MODIS & VIIRS NRT" layer** (thermal-anomaly clustering, fast, coarse, includes VIIRS).
  2. **45,435 ha** (quoted in the press, an "advance report") — the same automated-stage figure, at an earlier point in the season, before analyst review.
  3. **17,116 ha** — `report_2024.xlsx`'s final country total, sourced from the **human-supervised "MODIS/SENTINEL2 (supervised)" layer**, which is what EFFIS's official statistics are actually built on, and which agrees with IAG's own government report to the hectare.

  **Decide which EFFIS product M28 should read before wiring it up.** The supervised/final figure (17,116 ha) is the one that matches Bulgaria's own government report; the automated NRT figure (44,745 ha) does not, by a factor of 2.6×, because VIIRS burnt-area data is explicitly **not used in EFFIS's official statistics — it's display-only in the viewer** `[V]`. Showing the live NRT number as "detected" and the supervised/IAG number as "reported" would make that distinction a feature rather than a data-pick problem, since the two genuinely measure different things (automated vs. analyst-reviewed).
- **EFFIS/Copernicus publishes a tiny (31 KB) spreadsheet with 45 years (1980–2024) of burnt area and fire count for every member country**, at a fixed URL, no login, no PDF parsing. It is a far better primary source for M28 than scraping national PDFs country by country.
- **EFFIS's final, reconciled burnt-area number for Bulgaria matches IAG's own number to the hectare for every year 2020–2024.** Fire *counts* do not match (EFFIS counts only satellite-mappable fires, ~100–250/year; IAG counts every fire reported on the ground, ~350–600/year) — this is a real methodological difference, not an error, and is worth stating on the proof page rather than treated as noise.
- EFFIS also publishes a 136 MB burnt-area **polygon** shapefile (not just totals) and GeoTIFF fire-severity rasters, both live and downloadable, neither currently used anywhere in the spec.
- **The GWIS Country Profile tool is the one EFFIS-family resource that could help M14** (whole-world coverage) rather than just Bulgaria — it claims historical fire-regime data for 2002–2019, worldwide, not EU-only. Its page is a JS app that did not yield content to a headless fetch; it needs a follow-up look, ideally from a browser.
- **The EFFIS Data License page resolves `specification.md`'s open decision D-4**: it states EU-owned content on the site is **CC BY 4.0**, not a separate "EU Data Licence."

---

## 1. Bulgaria's Executive Forest Agency (ИАГ) — primary-source numbers

Each year is a separate PDF with no consistent filename (confirmed by probing ~40 filename guesses before finding the real ones):

| Year | File | Fires | Area (dka) | Area (ha) | Crown fires (dka) | Negligence / Unknown / Natural / Intentional |
|---|---|---|---|---|---|---|
| 2020 | quoted inside the 2021 report, not its own file | 499 | 52,579 | 5,258 | 3,365 | — |
| 2021 | [godishen_doklad2021.pdf](https://www.iag.bg/data/docs/godishen_doklad2021.pdf) `[V]` | 349 | 31,434 | 3,143 | 4,137 | 65.3 / 23.8 / 8.0 / 2.9 |
| 2022 | [gd2022.pdf](https://www.iag.bg/data/docs/gd2022.pdf) `[V]` | 516 | 81,260 | 8,126 | 6,446 | 62.2 / 30.6 / 4.1 / 3.1 |
| 2023 | [Doklad_23_posleden_16.05.2024.pdf](https://www.iag.bg/data/docs/Doklad_23_posleden_16.05.2024.pdf) `[V]` | 448 | 63,883 | 6,388 | 6,896 | 56.7 / 32.6 / 6.9 / 3.8 |
| 2024 | [Doklad_24.pdf](https://www.iag.bg/data/docs/Doklad_24.pdf) `[V]` | 595 (revised to **565** in the 2025 report's own recap `[V]`) | 171,164 | 17,116 | 14,624 | 65.7 / 24.9 / 6.4 / 3.0 |
| 2025 | [Doklad25_01str_final_08.05.2026.pdf](https://www.iag.bg/data/docs/Doklad25_01str_final_08.05.2026.pdf) `[V]` | 546 | 154,588 | 15,459 | 27,456 | 58 / 32 / 9 / 1 |
| 2026 | does not exist yet — the calendar year is not over. IAG's own cadence (the 2025 report landed 5 months after year-end) means a 2026 report is not expected before spring 2027 `[U]` | | | | | |

Units: IAG reports area in **дка (decares, 1 dka = 0.1 ha)** — needs a ×0.1 conversion to match the hectares used everywhere else in this project.

Notable: **2025's biggest single fire was in RDG Blagoevgrad (39,746 dka, 17,542 dka crown)** — the Strumyani/Kresna/Sandanski area, matching the "Pirin fire" reported in the press (25 Jul – 22 Aug 2025, `[D]` from news, not independently confirmed inside the PDF beyond the regional total). Natural causes jumped to 9% that year (vs 3–8% in other years), consistent with the drought/lightning conditions reported.

Each report also carries, per year, a 16-region (RDG) breakdown, land-cover split, ground-vs-crown split, and ownership split — none of which is available from EFFIS at any resolution. This is the one thing worth the manual yearly PDF pull even after wiring up the EFFIS spreadsheet below.

**Two more things found, not yet usable:**
- `iag.bg/fires/lang/1/index` — a live, date-filterable "forest fires by region" registry. JS/session-driven; a headless fetch returns the empty filter form, not data. Someone would need to drive it from a browser.
- `pojarishta2025.rar` (confirmed real, 66 KB, valid RAR5 archive, filename inside is `Pozharishta_spravka_UOGS-2025.x...` — almost certainly an `.xlsx`) — this sandbox has no RAR5-capable extractor, so the contents are unconfirmed. Likely just a burnt-area tally for state teaching forestries, not GIS polygons, based on the filename alone.

---

## 2. Copernicus/EFFIS — full site inventory

| Tool / page | URL | What it is | Status |
|---|---|---|---|
| Data License | `/about-effis/data-license` | States verbatim that EU-owned content is **CC BY 4.0** | `[V]` — resolves D-4 |
| Legal Background | `/about-effis/legal-background` | Regulatory history only (Regulation (EC) No 2152/2003); points back to Data License for real terms | `[V]` |
| Active Fire Detection | `/about-effis/technical-background/active-fire-detection` | **EFFIS's "active fire" layer is NASA FIRMS (MODIS+VIIRS) run through EFFIS's own filter — not an independent sensor** | `[V]` — do not use it as an independent check on our own FIRMS data |
| Rapid Damage Assessment (RDA) | `/about-effis/technical-background/rapid-damage-assessment` | Burn-scar mapping, **two distinct layers, confirmed from the Current Situation Viewer's own layer panel** (screenshot, `BURNT AREAS` group): **"MODIS & VIIRS NRT"** — fully automated, from spatial-temporal clustering of MODIS+VIIRS thermal anomalies, fast but coarse; and **"MODIS/SENTINEL2 (supervised)"** — the automated product then visually verified and corrected by an analyst against MODIS (250m, twice daily, ≥30ha) and Sentinel-2 (20m, since 2018, catches fires <30ha) imagery. A third layer, **"FIRE SEVERITY (weekly updated)"**, is the Sentinel-2 NBR/dNBR product from the Fire Severity page below. A "BA Yearly" control aggregates the burnt-area layers by period | `[V]` — **this resolves the three-different-numbers puzzle below.** The supervised layer is ~95% of EU burned area and is what feeds the official statistics; **VIIRS burnt-area data is display-only in the viewer and is explicitly NOT used to compute EFFIS's official burnt-area statistics** `[V]` (corrects an earlier draft of this doc, which credited VIIRS as part of the official ~95% figure) |
| Fire Severity | `/about-effis/technical-background/fire-severity` | Sentinel-2 NBR/dNBR, 20 m, ready ~30 days post-fire, 5 severity classes | `[V]` |
| Seasonal Forecast | `/about-effis/technical-background/seasonal-forecast-explained` | ECMWF SEAS5, 51-member ensemble, ~28 km, monthly initialization, 7 months ahead | `[V]` — not referenced anywhere in the current spec; same ambition as C2 without building a model, EU-wide |
| Wildfire Risk Assessment | `/about-effis/technical-background/wildfire-risk-assessment` | Hazard × vulnerability (people / ecological / economic), semi-quantitative classes | `[V]` page exists, little detail published |
| European Fire Database | `/about-effis/technical-background/european-fire-database` | Per-fire "Common Core" records, 22 countries, since 2004 | `[V]` exists, but **no public download or API** — raw records require emailing `jrc-effis@ec.europa.eu` |
| Fuels | `/about-effis/technical-background/fuels` | Fuel-type map, 42 vegetation complexes mapped to 13 NFFL/Anderson classes | `[V]` — download confirmed live: `FuelMap_LAEA.zip` |
| Statistics Portal | `/apps/effis.statistics` | A Nuxt.js SPA; its bundle calls a public (undocumented) API at `api2.effis.emergency.copernicus.eu` | `[V]` — see below |
| GWIS Country Profile | `gwis.jrc.ec.europa.eu/apps/country.profile/` | Claims historical fire-regime data **per country, worldwide, 2002–2019** | unconfirmed `[D]` — another JS SPA shell; the one lead most relevant to M14's whole-world test points (Mato Grosso, Punjab, Siberia) and worth a direct look in a browser |
| Fire Emissions, Fire Damage Assessment, Monthly Forecast, Under Development | `/about-effis/technical-background/{fire-emissions, fire-damage-assessment, monthly-forecast-explained, under-development}` | Paths confirmed from the page's own nav | not individually opened this pass |

### The hidden API behind the Statistics Portal

`api2.effis.emergency.copernicus.eu` is a live FastAPI with four routes (found via the SPA's JS bundle, confirmed with a real request):

- **`/rda-stats?year=YYYY&country=XXX`** — live Rapid Damage Assessment stats. `?year=2024` (no country) returned real numbers in hectares, broken down EU / non-EU-Europe / Middle-East+Africa / total. **`country=BGR` throws a 500 error** — broken or unfinished server-side. Don't build on it without testing live first.
- `/geocoder?address=` — address → coordinates
- `/healtz`, `/status` — health checks

### Bulk downloads, all confirmed live by direct request

| File | Size | Contents |
|---|---|---|
| [`report_2024.xlsx`](https://data.effis.emergency.copernicus.eu/effis/applications/data-and-services/report_2024.xlsx) | 31 KB | **Burnt area (ha) and fire count, every EFFIS country, 1980–2024, two sheets, one file.** Parsed directly: Bulgaria's column matches IAG's own numbers to the hectare for 2020–2024 (see table below). `report_2025.xlsx` does not exist yet (checked: 404) |
| [`effis_layer.zip`](https://data.effis.emergency.copernicus.eu/apps/data.request.form/effis_layer.zip) | 136 MB | Burnt-area **polygons** (shapefile), not just totals |
| [`effis_layer.db.zip`](https://data.effis.emergency.copernicus.eu/apps/data.request.form/effis_layer.db.zip) | 152 MB | Same, as SpatiaLite |
| `severity_2018.tiff` … `severity_2025.tiff` | — | Per-year fire-severity GeoTIFFs, same path as the xlsx above |
| `FuelMap_LAEA.zip` | — | Fuel-type map |

**Bulgaria, EFFIS's own `report_2024.xlsx` vs IAG's own PDFs — burnt area, hectares:**

| Year | EFFIS (`report_2024.xlsx`) | IAG (annual report) | Match |
|---|---|---|---|
| 2020 | 5,258 | 5,258 | exact |
| 2021 | 3,143 | 3,143 | exact |
| 2022 | 8,126 | 8,126 | exact |
| 2023 | 6,388 | 6,388 | exact |
| 2024 | 17,116 | 17,116 | exact |

Fire *counts* in the same file are much lower than IAG's (e.g. 2024: EFFIS 106 vs IAG 595/565) — EFFIS only counts satellite-mappable fires; see the RDA note above.

**Environment note:** every `*.effis.emergency.copernicus.eu` and `*.copernicus.eu` host failed TLS verification from this sandbox (`curl -k` was needed throughout to confirm any of the above). Likely a missing CA in this sandbox's trust store, not a real site problem — **but test it unmodified from the actual build/deploy environment before any pipeline code depends on it.**

---

## 3. What this changes

1. **Replace the plan to scrape EFFIS's JSON API/per-country pages for M28 with `report_2024.xlsx`.** One 31 KB file gives 45 years of reconciled totals for every EFFIS member, not just Bulgaria — strictly simpler than what [`../../specs/specification.md`](../../specs/specification.md) section 4.1 currently describes.
2. **Mark D-4 decided: CC BY 4.0**, not "under review," in `specification.md` section 11.
3. **Pick a lane for the committed `BGR.json` placeholder (133 fires / 44,745 ha) before wiring in real data:** that's the automated "MODIS & VIIRS NRT" layer's number. Switching to the supervised layer's final total (17,116 ha, where EFFIS and IAG agree) makes the reported card match the government figure; keeping the NRT number and labelling it clearly as the fast/automated estimate is also defensible — just pick one on purpose rather than by accident of which EFFIS endpoint got called first.
4. **Don't use EFFIS "active fire" as an independent cross-check** in `validation.json` — it's literally our own FIRMS data, filtered. The genuinely independent checks are EFFIS's Rapid Damage Assessment / country totals and IAG's ground reports.
5. **GWIS Country Profile is worth a follow-up look for M14** specifically — it's the only thing found so far that claims worldwide (not EU-only) historical fire-regime data, which is exactly what the spec's non-Europe test points (Mato Grosso, Punjab, Siberia) need for an outside check.
6. The IAG regional (16-RDG), cause, and fire-type breakdowns are Bulgaria-only value that EFFIS's file does not carry — worth the one manual yearly pull specifically for the demo, not worth generalizing to every country on this timeline.

---

## 4. Sources

- EFFIS Current Situation Viewer 2.0 (source of the `BURNT AREAS` layer screenshot): https://forest-fire.emergency.copernicus.eu/apps/effis.csv/
- EFFIS Rapid Damage Assessment page: https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment
- EFFIS user guide (layer definitions, MODIS/Sentinel-2 supervised vs. NRT): https://data.effis.emergency.copernicus.eu/effis/reports-and-publications/effis-related-publications/effis-userguide-23.pdf
- GWIS user guide (MODIS & VIIRS NRT methodology, confirms VIIRS is display-only and not used for official statistics): https://effis-gwis-cms.s3-eu-west-1.amazonaws.com/apps/gwis.viewer/userguide.pdf
- Copernicus Atmosphere Monitoring Service, "Wildfire impact: how is it monitored & measured?" (independent confirmation of the MODIS ≥30ha / Sentinel-2 <30ha split since 2018): https://atmosphere.copernicus.eu/wildfire-impact-how-it-monitored-measured
