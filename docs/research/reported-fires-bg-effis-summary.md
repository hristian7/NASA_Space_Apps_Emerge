# Reported fires: ИАГ and EFFIS — summary

Full version: [`reported-fires-bg-effis.md`](reported-fires-bg-effis.md). Feeds M28 ("detected vs reported") and V-M41 (triangulation).

**Bulgaria's Executive Forest Agency (ИАГ) publishes a full annual fire report, 2021–2025 read directly `[V]`:**

| Year | Fires | Area (ha) | Crown fires (ha) |
|---|---|---|---|
| 2021 | 349 | 3,143 | 414 |
| 2022 | 516 | 8,126 | 645 |
| 2023 | 448 | 6,388 | 690 |
| 2024 | 595 (revised to 565 in the 2025 report) | 17,116 | 1,462 |
| 2025 | 546 | 15,459 | 2,746 |

No API, no stable filename pattern — each year is a one-off manual PDF fetch. Each report also breaks fires down by 16 regions, cause, fire type (ground/crown) and land cover — detail EFFIS does not have.

**EFFIS/Copernicus publishes a 31 KB spreadsheet (`report_2024.xlsx`) with 45 years (1980–2024) of burnt area and fire count for every member country**, fixed URL, no login. Parsed directly: Bulgaria's burnt-area figures in it **match IAG's own numbers to the hectare for 2020–2024**. Fire counts don't match (EFFIS: ~100–250/year, IAG: ~350–600/year) because EFFIS only counts fires large enough for its satellite burn-scar algorithm to map; IAG counts every fire reported on the ground. That's a real methodological split, worth stating plainly rather than treating as error.

**Resolved: why there are three different "Bulgaria 2024" numbers from EFFIS.** A screenshot of EFFIS's Current Situation Viewer layer panel shows its `BURNT AREAS` group has two distinct products: an automated **"MODIS & VIIRS NRT"** layer (fast, coarse, thermal-anomaly clustering) and a human-**"MODIS/SENTINEL2 (supervised)"** layer (analyst-reviewed, what the official statistics are built on). The automated layer gives 44,745 ha (EFFIS's `estimatesbycountry` API — also what the committed `web/public/data/reported/BGR.json` placeholder uses) and 45,435 ha (an earlier-season press figure). The supervised layer gives 17,116 ha, in `report_2024.xlsx` — and that's the one that matches IAG's own government report to the hectare. **Key fact: VIIRS burnt-area data is explicitly not used in EFFIS's official statistics, only displayed in the viewer** — so the automated layer's name is a bit misleading about what actually counts.

**The committed example `web/public/data/reported/BGR.json` carries the automated-layer number (133 fires / 44,745 ha) for 2024.** It's flagged `"example": true`, so it's a known stand-in, but worth a deliberate choice: switch to the supervised/final number (17,116 ha, matching IAG) for the "reported" card, or keep the NRT number labelled explicitly as the fast estimate.

**EFFIS also has, live and downloadable but unused in the spec:** a 136 MB burnt-area polygon shapefile (not just totals), yearly fire-severity GeoTIFFs, and a fuel-type map.

**The EFFIS Data License page resolves `specification.md`'s open decision D-4: content is CC BY 4.0**, not a separate EU Data Licence.

**One EFFIS layer is not independent and shouldn't be used as a cross-check:** its "active fire" layer is literally NASA FIRMS (the same MODIS/VIIRS data Emerge already uses) passed through EFFIS's own filter. The genuinely independent checks are EFFIS's Rapid Damage Assessment totals and IAG's ground reports.

**GWIS Country Profile** (`gwis.jrc.ec.europa.eu/apps/country.profile/`) claims worldwide, not EU-only, historical fire-regime data back to 2002 — the one lead here that could help M14's non-Europe test points (Mato Grosso, Punjab, Siberia). Its page is a JS app that didn't yield content to a headless fetch; worth a direct look in a browser.

**Environment note:** every `*.effis.emergency.copernicus.eu` / `*.copernicus.eu` host failed TLS verification from this sandbox (`curl -k` needed to confirm anything above is real). Test unmodified from the real build environment before depending on it.
