# Fire-risk forecast options for Emerge

Researched 2026-11-14 under an 8-minute time box. Tags: `[V]` verified at a primary source · `[D]` directional (secondary or search summary, not opened in full) · `[U]` our inference. Most items here are `[D]`, because the time box allowed search summaries only. Before demo day, open the links marked "check".

## Executive summary

- **Don't invent a fire-danger forecast. Show the official ones.** EFFIS/GWIS (Copernicus, run by ECMWF for the EU's Joint Research Centre) already give worldwide fire danger for 1–9/10 days and a seasonal outlook up to 7 months. NIFC gives US outlooks for 7 days and 4 months. Bulgaria's weather service, NIMH, publishes a daily fire-danger map by district.
- **Our own add-on should be climatology from the harmonized FIRMS record:** "in the last 25 years, how often did this cell burn in this month?" It is honest, quick to build and checkable with a backtest on held-out years.
- **Stretch goal:** blend climatology with the official 10-day Fire Weather Index (FWI, a standard number for how weather favours fire) and score it with a Brier score (the average squared error of a probability forecast) against later FIRMS detections. Also score it against the climatology-only baseline.
- **Published skill:** 10-day weather-based FWI is good for about **1–2 days** and fades after that. Seasonal FWI anomalies have some skill in some regions, such as the Mediterranean. For months ahead, climatology is the honest default. `[D]`
- **Warnings:** use the official agencies' class names and colours (the EFFIS FWI classes). Always link to the official service. Label everything "unofficial, for information, not for safety decisions."

## 1. Existing open fire-danger forecasts (display these)

| Product | Lead time | Resolution | Coverage | Update | Access | Licence |
|---|---|---|---|---|---|---|
| **EFFIS fire danger forecast** (Copernicus CEMS, the EU's Emergency Management Service) | 1–9/10 days `[D]` | ECMWF ~8 km, Météo-France ~10 km `[D]` | Europe and Mediterranean, including Bulgaria | Daily `[U]` | Web viewer plus WMS, a standard map-tile service `[D]`. Real-time data comes "exclusively" via the EFFIS/GWIS sites or by contacting the JRC `[D]` | Copernicus licence: free, full, open `[D]`. Check the exact WMS terms |
| **GWIS fire danger forecast** (global version of EFFIS) | 1–9 days `[D]` | ECMWF ~8 km, Météo-France ~10 km, NASA GEOS-5 ~28 km `[D]` | Worldwide, including the USA and Bulgaria | Daily `[U]` | Web viewer plus WMS `[D]` | Copernicus licence `[D]` |
| **CEMS seasonal fire danger** (GEFF model on SEAS5, ECMWF's seasonal system) | Up to 7 months `[D]` | ~1° (about 100 km) for SEAS5 `[U]`. Check | Worldwide | Monthly. The CDS copy lags real time by a few months `[D]` | EWDS/CDS download with a free account `[D]` | Copernicus licence `[D]` |
| **CEMS historical fire danger** (ERA5-based reanalysis, i.e. past weather reconstructed by a model) | Past only, 1940s/1979 to now | ~0.25° `[U]` | Worldwide | Monthly extension `[D]` | EWDS/CDS with a free account. DOI 10.24381/cds.0e89c522 `[D]` | Copernicus licence `[D]` |
| **NASA GFWED / GEOS-5 FWI** | 0–8 days `[D]` | 0.5° × 0.625° (~50 km) for the reanalysis `[D]` | Worldwide | Daily `[D]` | data.giss.nasa.gov/impacts/gfwed (download). Also in the GEE community catalog `[D]` | NASA open data `[U]` |
| **NIFC 7-Day Significant Fire Potential** | 7 days | Predictive Service Areas (PSAs), i.e. forecast zones | USA | Daily by 12:00 MDT, in fire season only `[D]` | Web viewer | US government, public domain `[U]` |
| **NIFC Monthly/Extended Outlook** | Current month plus 3 more (4 months) `[D]` | PSA polygons | USA | Monthly `[U]` | **ArcGIS REST, JSON/GeoJSON** (`fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/Outlooks_Monthly_Extended/MapServer`, layers 0–3), max 2,000 records per query `[D]` | US government `[U]` |
| **Bulgaria NIMH fire-danger map** | Today, maybe +1 day `[U]` | Districts (oblasti) | Bulgaria | Daily in summer `[D]` (news reports) | meteo.bg web map. No API found `[U]` | Unclear. Link to it, don't copy it |

**Simplest integration `[U]`:** embed the GWIS WMS layer (worldwide, 1–9 days) and the NIFC outlook GeoJSON (USA, 4 months), and link out to NIMH (Bulgaria). That covers the must-haves without inventing anything.

## 2. Forecast methods we could add on top of the FIRMS history

| Method | What it is | Build time `[U]` | Data | How to verify | Expected skill `[D]`/`[U]` |
|---|---|---|---|---|---|
| **(a) Climatology** | The share of past years in which this grid cell (e.g. 0.25°) had at least one FIRMS hotspot in this calendar month | 3–5 h | The harmonized FIRMS record only | Leave-years-out backtest, e.g. train 2001–2020 and test 2021–2025. Brier score, reliability diagram (whether predicted 30% happens about 30% of the time), hit rate | The baseline that must be beaten. It is the honest default for 1–3 months `[U]` |
| **(b) Climatology + FWI blend** | Adjust the monthly climatology up or down using the FWI forecast anomaly (today's FWI minus normal), e.g. with a logistic regression | 6–10 h | FIRMS plus CEMS historical FWI (for training) plus the GWIS/EFFIS forecast (live) | Same backtest. Report the Brier skill score against climatology | FWI forecasts are skilful for 1–2 days and decay after that (Field 2020) `[D]` |
| **(c) Simple ML** | Gradient boosting (e.g. LightGBM) on FWI, past fires, month, land cover | 12–20 h, with high risk of leakage bugs | As (b) plus land cover | Time-split backtest only (never a random split), with the Brier skill score against (a) | ECMWF's ML "Probability of Fire" (2025): up to 10 days, +30% skill over weather-only inputs. It says fuel and dryness data matter most `[D]` |

**What studies say about skill by lead time `[D]`:**
- **1–10 days:** GEOS-5 FWI forecasts are skilful about 2 days ahead, and skill drops faster at high latitudes ([Field 2020, NHESS](https://nhess.copernicus.org/articles/20/1123/2020/)).
- **1–7 months:** SEAS5 fire-danger anomalies show skill in some regions. The Mediterranean is the best studied, with good detection of above-normal seasons in Attica, Greece. Skill is lower at longer leads and is region- and season-dependent ([Di Giuseppe et al. 2024, Scientific Data](https://www.nature.com/articles/s41597-024-02948-3.pdf); [ECMWF Newsletter 177](https://www.ecmwf.int/node/28893); [NHESS 23, 429, 2023](https://nhess.copernicus.org/articles/23/429/2023/nhess-23-429-2023.pdf)).
- **Ignition is random.** ECMWF itself says fire ignition remains a stochastic (chance-driven) process. So we forecast **chance**, never "a fire will happen here" ([ECMWF, PoF](https://www.ecmwf.int/en/about/media-centre/news/2025/scientists-present-new-ml-tool-improved-fire-prediction)).

**Our certainty level `[U]`:** show the backtested reliability. For example, "in past years, when we said 30%, fire happened 27% of the time (2021–2025, this region)." That is an outside check, because FIRMS observations are the source of truth, not the model judging itself.

## 3. Alerts: responsible wording and thresholds

**FWI danger classes (EFFIS, 6 classes) `[D]`:** very low < 5.2 · low 5.2–11.2 · moderate 11.2–21.3 · high 21.3–38.0 · very high 38.0–50.0 · extreme ≥ 50.0. The last two bounds were not confirmed in the time box; check [Camia & Amatulli 2010](https://data.effis.emergency.copernicus.eu/effis/reports-and-publications/effis-related-publications/Camia_and_Amatulli_2010__ICFFR-2010_B04.pdf) and [ECMWF user guide](https://confluence.ecmwf.int/spaces/CEMS/pages/340779714/User+Guide+for+Fire+danger+indices+historical+data+from+the+Copernicus+Emergency+Management+Service). Studies found the EFFIS thresholds too low for Greece. Local calibration matters `[D]`.

**US wording:** NIFC uses "above normal / normal / below normal significant fire potential." The NWS uses "Red Flag Warning" (official, not to be reused by us) `[D]`.

**Bulgaria:** NIMH and the Fire Safety and Civil Protection Directorate publish district-level levels up to "extreme" ([BNR report](https://bnr.bg/en/post/100848492/extreme-fire-danger-across-bulgaria-announced)) `[D]`.

**Rules for an unofficial tool `[U]`:**
1. Never use official warning words ("Warning", "Red Flag", "Code Red") for our own output. Say "**Historical fire likelihood**" or "**Risk outlook (unofficial)**".
2. Show the official product next to ours, and link it on every alert card, e.g. "Official: EFFIS / NIMH / NIFC →".
3. Put a fixed disclaimer: "Research prototype. Not an official warning. In an emergency, follow local authorities (112 in the EU, 911 in the US)."
4. Pre-positioning advice for crews and volunteers is framed as "places with high historical fire frequency this month", for planners to consider. It is not an instruction.
5. Show uncertainty (the backtest reliability) and the data date on every map.

## 4. Recommendation (~20 h build)

**Most credible feature:** a **"Fire Season Outlook"** panel in three layers:
1. **Official now** (display only): the GWIS/EFFIS 1–9-day danger layer via WMS, and the NIFC 4-month outlook via GeoJSON. We built neither. We show and credit them.
2. **Our climatology:** the monthly hotspot probability per cell from the harmonized 25-year FIRMS record, with the backtest reliability diagram and Brier score shown on screen.
3. **Honest framing:** EFFIS-style class colours, a disclaimer and links to the official services.

### MoSCoW for forecasting

| Priority | Feature |
|---|---|
| **Must** | Monthly climatology probability from harmonized FIRMS (worldwide, demo zoom on Bulgaria and the USA) · Backtest on held-out years with Brier score and reliability diagram · Disclaimer and links to EFFIS/GWIS, NIFC and NIMH |
| **Should** | GWIS/EFFIS 1–9-day danger WMS overlay · NIFC 4-month outlook GeoJSON overlay (USA) · Plain-language "this month vs normal" card |
| **Could** | Climatology + FWI blend (logistic regression), scored against climatology · "High historical frequency" pre-positioning list per region for planners · CEMS seasonal FWI anomaly layer |
| **Won't** (this hackathon) | Our own ML fire-occurrence model · Push alerts or SMS · Any wording that copies official warnings · Claims of daily-scale prediction beyond what the backtest shows |

## Not verified (open before the demo)

- The exact WMS endpoint URLs and layer names for the EFFIS/GWIS forecast, and their licence terms.
- The FWI class bounds 38 and 50.
- The SEAS5 seasonal grid resolution.
- Whether NIMH offers machine-readable data.
- The ECMWF PoF verification numbers against FWI (the paper is in Nature Communications, 2025).

## Sources

- GFWED / GEOS-5 evaluation: https://nhess.copernicus.org/articles/20/1123/2020/ · https://gee-community-catalog.org/projects/gfwed/
- EFFIS forecast: https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-danger-forecast
- GWIS forecast: https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/fire-danger-forecast · https://gwis.jrc.ec.europa.eu/applications
- CEMS data access: https://confluence.ecmwf.int/spaces/CEMS/pages/382667784/CEMS-Fire+Data+access
- CEMS seasonal: https://ewds.climate.copernicus.eu/datasets/cems-fire-seasonal · historical: https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1
- Seasonal skill: https://www.nature.com/articles/s41597-024-02948-3.pdf · https://www.ecmwf.int/node/28893 · https://nhess.copernicus.org/articles/23/429/2023/nhess-23-429-2023.pdf
- ECMWF PoF (ML): https://www.ecmwf.int/en/about/media-centre/news/2025/scientists-present-new-ml-tool-improved-fire-prediction
- NIFC outlooks: https://www.nifc.gov/nicc/predictive-services/outlooks · https://www.nifc.gov/sites/default/files/document-media/7-Day_Product_Description.pdf · https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/Outlooks_Monthly_Extended/MapServer
- FWI classes: https://confluence.ecmwf.int/spaces/CEMS/pages/340779714/User+Guide+for+Fire+danger+indices+historical+data+from+the+Copernicus+Emergency+Management+Service · https://data.effis.emergency.copernicus.eu/effis/reports-and-publications/effis-related-publications/Camia_and_Amatulli_2010__ICFFR-2010_B04.pdf
- Bulgaria (news): https://bnr.bg/en/post/100848492/extreme-fire-danger-across-bulgaria-announced
