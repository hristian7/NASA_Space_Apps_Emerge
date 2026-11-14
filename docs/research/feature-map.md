> **How this was made (14 Nov 2026):** an AI research agent read the 16 sites in a headless browser and this repo at commit `1f9c1bc`, then wrote this report. A second AI check confirmed a sample of its claims against the sites and the code. **Since then, main's historical data was refreshed to 14 Nov 2026**, so the statements below that the history stops in December 2025 are out of date. Effort and priority calls are `[U]` recommendations, not changes to `specs/features-moscow.md`.

This review maps 16 [V] sites into 47 [V] feature groups, with evidence from Emerge's current code.  
Keep Emerge focused on comparable fire history, local analysis and visible uncertainty.  
The highest-value addition is genuine national reported-fire data; EFFIS satellite estimates must carry a different label.  
Emerge's historical files end in December 2025 [V]; its recent-fire map is a separate current feed.  
Take the ranked shortlist only after Must gates, before Sunday 15 [V] November 2026 [V], 08:00 [V] Sofia.

# Fire information feature map

## Reading this report

[V] means verified in a primary public source or observed local code/data. [D] means secondary, inherited or directional evidence. [U] means our judgement or effort estimate. Model identifiers, feature IDs, paths, URLs and commit hashes are identifiers rather than numerical claims.

Effort follows `specs/features-moscow.md`: S = 1 [U] to 2 [U] hours; M = 3 [U] to 5 [U] hours; L = 6 [U] or more hours, with AI coding agents. Effort includes integration, copy in both languages and a focused check, not merely adding a button. Existing features can be marked yes with S for a small enhancement, not a rebuild.

Scope: read-only review of the app at commit `1f9c1bc` [V]. No application changes, commits, installs or publication were made.

## Emerge baseline from the checkout

The current checkout includes the shell/map/selection code, report cards, downloads, proof UI, English and Bulgarian messages, and configurable map layers [V]. Existing competitor notes saying the map is not merged are stale. Code presence is not a fresh browser or end-to-end validation; this research does not certify runtime behaviour.

Evidence read: `CLAUDE.md`, `README.md`, `specs/features-moscow.md`, `docs/research/competitors.md`, `docs/plans/build-plan.md` work order and checkpoints, `docs/data-contract.md`, and application modules cited below. No `handoffs/` directory was found [V].

| Baseline finding | Evidence and consequence |
|---|---|
| Global historical files exist, but stop before the current year | `web/public/data/meta.json`: `example=false`, 235 [V] country entries, November 2000 [V] through December 2025 [V]. Do not describe the historical calendar as current to today. |
| Recent fires are a separate live route | `web/src/app/api/recent/route.ts`, `web/src/lib/layers/firms.ts`, `web/src/lib/layers/recent.ts`. This does not extend the harmonized history. |
| Reported figures remain examples | `web/public/data/reported/BGR.json` and `USA.json` each have 1 [V] non-null year, 2024 [V], and null source URL/fetched fields. The USA burned-area value is null. |
| Proof is no longer empty | `web/public/data/validation.json` has `example=false`, populated holdouts and explicit limitations. Its method note says the independently tested fit covered Bulgaria and the USA, not the worldwide fit. |
| Downloads have stated limits | `web/src/components/app/adapter.ts`, `web/messages/app.en.json`: raw hotspots use a bounding box for country/polygon, cap a point at 200 [V] km, span at most 366 [V] days and have a row cap. Monthly exports follow the analytical selection. |
| Existing features need no duplicate implementation | `OutsideLinks.tsx`, `lib/outside-links.ts`, `config/layers.ts`, `lib/ui/selection-url.ts`, `lib/ui/view-url.ts`, `lib/layers/url-state.ts` already provide official links, layer registration and URL state. |

## Site: EFFIS home

Run by the European Commission JRC within Copernicus Emergency Management, for European and neighbouring forest/fire services, policymakers and the public.

Features found:

- The [home page](https://forest-fire.emergency.copernicus.eu/) is a service directory, with current situation maps, current national statistics, longer-range fire-weather forecasts, wildfire risk, data requests, publications, partner network and technical explanations. It explicitly includes some intentional vegetation-management fires.
- The [applications page linked from home](https://forest-fire.emergency.copernicus.eu/applications) distinguishes live maps, statistics and planning products. The [statistics portal](https://forest-fire.emergency.copernicus.eu/apps/effis.statistics) offers country/group comparisons, seasonal cumulative trends and downloadable statistics, extending the existing research rather than introducing a new competitor.
- [Data and services](https://forest-fire.emergency.copernicus.eu/applications/data-and-services) lists downloadable/service layers for settlements, protected areas, land cover, fuels, danger indices, lightning, active fires and burned areas. The data-request form is a separate route, not an instant public download of everything.
- [Technical background](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background) links explanations of detection, damage, severity, emissions, risk, forecasts and the national-report database.

Data: MODIS and VIIRS detections; supervised satellite damage assessment; ECMWF and Meteo-France forecasts; CORINE land cover, human settlements, protected areas and European fuels; national submissions to the European Fire Database. Cadence differs by layer. [EU-owned site content is CC BY 4.0 [V], unless indicated otherwise](https://forest-fire.emergency.copernicus.eu/about-effis/data-license); third-party rights remain separate. The dataset table below separates these inputs.

What Emerge could learn: make the distinction between detection, history, forecast and impact clear before the user reads any numbers.

## Site: EFFIS CSV viewer

Run by JRC/Copernicus for operational fire monitoring and public map exploration. Here CSV means Current Situation Viewer, not a spreadsheet viewer.

Features observed in the [viewer](https://forest-fire.emergency.copernicus.eu/apps/effis.csv/?c=1000000,6200000&z=5&t=sentinel2):

- Map search, zoom-to-area, geolocation, map types, legend, link sharing, theme change, demonstration and user-guide link.
- Context switches for human settlements, protected areas, CORINE land cover and fuels.
- Forecast model selector: ECMWF at about 8 [V] km and Meteo-France at about 10 [V] km. Index selector: FWI, spread, fuel-moisture and drought components, anomaly, ranking, KBDI, Australian fire-danger indices and US NFDRS indices. There is a lightning forecast and a date stepper.
- Active-fire toggles for MODIS, combined VIIRS, separate NOAA-20/NOAA-21/S-NPP, and Sentinel-3. Time filters include last day, week, month, season and custom dates.
- Supervised MODIS/Sentinel burned areas, near-real-time MODIS/VIIRS burned areas, yearly burned areas, weekly fire severity and a burned-area locator.

Data: [forecast method](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-danger-forecast), [layer catalogue](https://forest-fire.emergency.copernicus.eu/applications/data-and-services), and [licence](https://forest-fire.emergency.copernicus.eu/about-effis/data-license). Forecasts, hotspots, mapped scars and static context are different products. A layer appearing in the menu proves availability as a control, not that every tile loaded or that it has the same spatial accuracy.

What Emerge could learn: a compact layer explanation should show what the colours measure, whose data they are and which date they represent. Emerge already has much of this in its layer panel.

## Site: EFFIS Wildfire Risk Viewer

Run by JRC/Copernicus for continental risk assessment and planning, rather than an incident alert service.

Features found in the [viewer](https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/): switchable Sentinel cloudless and CCI land-cover backgrounds; national and subnational boundaries; grouped wildfire risk, administrative risk, danger, vulnerability, fuels and land-cover layers; a point-value inspection action. Expanding the groups revealed high/intermediate/low risk; weather-based and thermal-anomaly danger; population, ecological and economic vulnerability; burnable-land share; wildland-urban interface (WUI); protected-area fraction and irreplaceability; population density; fuel classes from grass and shrub to forest litter; and detailed CORINE land-cover classes.

The [method page](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/wildfire-risk-assessment) explains people, ecological and economic exposure; combines hazard and vulnerability using Pareto ranking; and assesses agreement across uncertainty simulations. It warns against treating a continental prototype as a precise local decision tool.

Data: pan-European risk assessment, danger proxies, exposure/vulnerability proxies, fuel and land-cover layers, administrative areas; Sentinel cloudless from EOX/Copernicus and CCI land cover are named in the viewer. The method links the [risk assessment publication](https://doi.org/10.2760/9429). No live refresh cadence or open point-query API was documented in the inspected view. EU-owned reuse follows the EFFIS licence, with third-party exceptions.

What Emerge could learn: call historical occurrence a base rate, and weather-based danger a forecast. Neither is a complete measure of risk to people or assets.

## Site: European Commission JRC page

The European Commission's organisational page describes its Joint Research Centre, for people seeking institutional information.

[The requested page](https://commission.europa.eu/about/departments-and-executive-agencies/joint-research-centre_en) returned an HTTP 429 [V] message in the single [V] permitted headless attempt. No retry was made. The earlier repo review describes its research mission and open-data catalogue, with no fire-specific feature [D] (inherited from `docs/research/competitors.md`). No wildfire dataset, feed or refresh schedule can be verified here.

What Emerge could learn: cite the relevant JRC fire product directly, not this organisational page.

## Site: JRC current wildfire situation

JRC's public briefing page translates EFFIS data into a short EU-wide situation report for policymakers and readers.

Features on the [current situation page](https://joint-research-centre.ec.europa.eu/scientific-activities/natural-and-man-made-hazards/forest-fires/current-wildfire-situation-europe_en): dated headline totals for burned area, fires and emissions; same-date comparison with the previous record season; cumulative burned-area chart against the historical average; chart fullscreen, pattern and data-table controls; weather outlook; method links and caveats. Updates are weekly in summer, daily at peak activity and monthly in winter [V].

Data: EFFIS mapped fires above 30 [V] ha, EFFIS seasonal statistics and CAMS/GFAS emissions. The displayed reporting date is 4 [V] November 2026 [V], not the date of this review. The baseline is 2006 [V] to 2025 [V]. Values may be revised and differ from national systems. Reuse is subject to the linked EU/third-party terms.

New finding beyond the repo: chart pattern and table controls are useful accessibility patterns. The repo's arithmetic warning still holds: the page describes 2,335 [V] fires as below 2,193 [V]. This is a source wording error, not evidence that Emerge should copy the sentence.

What Emerge could learn: show the cutoff date and reference years beside each comparison, and generate the direction of change from the numbers.

## Site: DW article

Deutsche Welle provides a news explainer for the public, not a fire map or data service.

The [article](https://www.dw.com/en/eu-civil-protection-mechanism-coordinating-europes-firefighters/a-78145189) explains coordination, requests for international help, pre-positioning, aircraft limits and prevention. It offers a share link and related video. Its fire-response facts are already summarised in `docs/research/competitors.md`; this review does not repeat those figures.

Data: reporting and statements about the EU Civil Protection Mechanism/ERCC, with NASA credited for an illustration. There is no reusable incident feed, statistics API or refresh commitment. DW editorial material has publisher copyright; cite and paraphrase rather than copy. It is secondary evidence [D] for the team's user story.

What Emerge could learn: explain who benefits from seasonal history and what planning question it answers. Do not turn that story into dispatch advice.

## Site: fire.ai

Operated by Lamarr, Inc., for public fire watchers and subscribed users who monitor places and incidents.

Features observed in the [public map and built-in guide](https://fire.ai/):

- Separate agency incidents and satellite detections; confidence filtering; clusters; presets for world regions; map preferences saved locally and synced if signed in.
- Live and gated history views; named incidents with acreage, containment and responding agencies; pins; minimum-size filtering; layers for wildfires, heat detections, unconfirmed/contained incidents, prescribed burns, perimeters, estimated wind and structures.
- Alert zones by county, place search or drawn polygon; email/SMS delivery and plan tiers; AI briefs are advertised. No account was created and no delivery was tested.
- AQI, camera links and a camera-detection beta; community-camera and smoke-sensor layers are labelled beta. Resource directory links to FIRMS, NIFC, AirNow, Ready.gov, NOAA and CAL FIRE. It has a safety acknowledgment and correction/feedback route.
- The guide says global confirmed clusters start in 2026 [V] and US named incidents in 2004 [V]. Its broad history headline is therefore not evidence of a harmonized global archive. Future predictive risk and Red Flag views are described as coming, not shipped.

Data: NASA FIRMS NOAA-21/S-NPP VIIRS and Terra/Aqua MODIS; NIFC incidents; ALERTCalifornia/ALERTWest camera links; airport weather reports with an ECMWF fallback; Open-Meteo CAMS model air quality; AirNow as a resource link rather than the stated AQI-card input; OSM/OpenFreeMap/OpenMapTiles/Esri backgrounds. The public page mentions dispatch, cameras and other sources without documenting every feed. Guide refresh intervals and plan-table refresh intervals conflict; no reliable service-level rate is established. NASA/NIFC input access does not grant reuse of fire.ai's clustered products or AI summaries. No public fire.ai API/download licence was found.

What Emerge could learn: distinguish a heat detection from a confirmed incident, and make source coverage visible. Do not copy its unvalidated future-mode promises.

## Site: Google Research boundary tracking

Google Research supplies wildfire boundaries to Search, Maps and nearby-user notifications, for affected communities and fire authorities.

The [product page](https://sites.research.google/gr/wildfires/boundary-tracking/) describes estimated boundaries in Maps/Search, including driving navigation, nearby push notifications and a public explanation/video. It reports coverage in more than 34 [V] (provider claim) countries across 5 [V] (provider claim) continents, output at 1 [V] (provider claim) square km and updates every 10 [V] (provider claim) to 15 [V] (provider claim) minutes.

Named inputs: GOES-18/GOES-19, Himawari-9, GK2A and VIIRS imagery from S-NPP and NOAA-20. Satellite identifiers are not resolution claims. The linked [research method article](https://research.google/blog/real-time-tracking-of-wildfire-boundaries-using-satellite-imagery/) describes geostationary imagery, a NOAA fire product, MODIS/VIIRS training labels, separate fire/cloud classification, and validation against local-authority fire scars and later unseen fires. Its older satellite list differs from the current page; use the current page for present product coverage.

Research/data follow-up: the article links the [NOAA fire algorithm document](https://www.star.nesdis.noaa.gov/goesr/docs/ATBD/Fire.pdf), [MODIS active-fire documentation](https://modis.gsfc.nasa.gov/data/dataprod/mod14.php) and a [generic focal-loss paper](https://arxiv.org/abs/1708.02002). The focal-loss abstract was opened and is a general object-detection method, not a wildfire data release. The NOAA document returned HTTP 404 [V] and the MODIS documentation fetch returned HTTP 502 [V] through the web reader. No public export of Google's operational boundary feed, trained model, or boundary-training dataset was linked from the inspected pages. Do not confuse a paper citation with permission to reuse the operational map.

What Emerge could learn: validate against independent observations and disclose where training labels share sensor errors. Google's boundaries are not an independent oracle for MODIS/VIIRS hotspot counts.

## Site: EFFIS annual fire reports

JRC compiles national fire-service reports and its own satellite analysis for researchers, governments and fire managers.

The [annual-report catalogue](https://forest-fire.emergency.copernicus.eu/reports-and-publications/annual-fire-reports) currently ends with the full report for 2024 [V]. The [publication record](https://doi.org/10.2760/0649290) links the document viewer, PDF, metadata and citation export. A related advance report for the following year is listed separately; it is not the latest full annual report in this catalogue.

I opened the actual contents and selected Bulgaria pages, using small byte-range reads rather than downloading the complete large PDF. The contents separate national-service reports, longer southern-European time series, the EFFIS system, EFFIS country assessments, applications, references, definitions and annexed summary statistics. National and EFFIS chapters are distinct evidence, not duplicate presentations of the same totals.

Statistics presentation observed in the [report](https://doi.org/10.2760/0649290): country tables by year, fire count, burned hectares and cause; time-series charts; maps; monthly figures; FWI plots; land-cover breakdowns; protected-area impact. Printed page 19 [V] gives Bulgaria's national Executive Forest Agency series for 2015 [V] to 2024 [V], with 595 [V] forest fires and 17,116 [V] ha in the rounded final-year table. The prose gives 17,116.4 [V] ha. Printed page 203 [V] instead gives the EFFIS assessment: 256 [V] mapped fires and 45,435 [V] ha, including agricultural land. These do not share a denominator.

Data: national service submissions, European Fire Database context, EFFIS satellite damage mapping, land cover, protected areas and fire-weather indices. Annual publication; figures can be revised between live estimates and final reports. Downloadable PDF and publisher metadata, not a ready-made harmonized API. EU reuse terms and original source attribution apply.

What Emerge could learn: use the actual national report for the reported side of M28, and preserve EFFIS mapped estimates as a separately named comparator. This is stronger evidence for M6 than relabelling satellite estimates as reports from crews.

## Site: NASA FIRMS map

NASA LANCE/FIRMS serves global satellite fire data to researchers, managers and the public; the US/Canada service is a NASA/USDA Forest Service collaboration.

Features observed:

- [Global map](https://firms.modaps.eosdis.nasa.gov/map/): date/timeline controls, recent windows, separate Landsat/VIIRS/MODIS detections, true-colour imagery, static backgrounds, overlays, measurement, location search, capture, sharing, help and view modes. It explains clouds, other heat sources and the limitations of a detection.
- [Alerts](https://firms.modaps.eosdis.nasa.gov/alerts/): world, country, protected area or custom box/polygon; near-real-time, daily or weekly emails; optional CSV/KML attachments. Authentication is required. This run inspected the information only.
- [Archive](https://firms.modaps.eosdis.nasa.gov/download/): CSV, shapefile and JSON request downloads, plus yearly country summaries. Requests use Earthdata or email verification. Near-real-time records are replaced by science-quality data with about 5 [V] months' lag.
- [API](https://firms.modaps.eosdis.nasa.gov/api/): area/date/sensor CSV, availability, missing-data dates, fire footprints and MAP_KEY setup. Country and country-list endpoints are explicitly marked unavailable in the current API menu [V].
- [Web services](https://firms.modaps.eosdis.nasa.gov/web-services/): API, files, WFS and WMS with tutorials. [US/Canada](https://firms.modaps.eosdis.nasa.gov/usfs/) adds low-latency regional products, imagery subsets, email/text alerts and Fire Data Academy examples. Its [regional map](https://firms.modaps.eosdis.nasa.gov/usfs/map/) additionally exposes US IMSR active fires, Canada DIP active fires, US perimeters, Fire Weather Watches and Red Flag Warnings.

Data: Terra/Aqua MODIS, NOAA VIIRS, Landsat active fire, GIBS imagery and regional supporting layers. MODIS starts November 2000 [V]; the archive explicitly ends S-NPP on 2 [V] November 2026 [V]. The site directs users to NOAA-20/NOAA-21. NASA data are openly distributed with acknowledgement and use disclaimers; particular APIs and archive requests require a key or authentication. Near-real-time latency is not continuous observation and varies by product/location; the data table separates archive, NRT and regional rapid delivery.

What Emerge could learn: keep acquisition time, processing state, sensor and known gaps visible. FIRMS already does distribution well, so Emerge should add interpretation and validity.

## Site: Watch Duty

Watch Duty is a nonprofit serving the public and professional US incident-monitoring users, with human-verified information.

Features on [home](https://www.watchduty.org/): verified incident maps and alerts; wildfires, prescribed burns and flooding; river gauges; perimeters; evacuation/shelter information; wind, precipitation and air conditions; power-outage and Red Flag information; member aircraft tracking; user-submitted photos/updates reviewed by the service; web and mobile access.

[How it works](https://www.watchduty.org/how-it-works/overview) explains monitoring of dispatch, radio, cameras, satellites and official local announcements, followed by trained human review and continuing incident updates. This is an editorial operation, not merely a satellite-data wrapper.

[Professional solutions](https://www.watchduty.org/solutions/overview) advertise private asset/context integration, shared GIS/dashboard use, internal alerts and data delivery into customer systems. Named buyers include utilities, telecoms, public safety and insurance. Named partners include Planet weekly imagery mosaics, Overstory vegetation risk and Wet Dog Weather radar/weather. The linked [satellite-feed article](https://www.watchduty.org/blog/watch-duty-strengthens-early-wildfire-detection-with-enhanced-satellite-feeds) loaded on retry. It names NOAA/CIMSS Next Generation Fire System (NGFS), Landsat, and MODIS/VIIRS via NASA ultra-real-time direct readout. It says NGFS supplies contiguous-US imagery every 5 [V] (provider claim) minutes; that is not a guaranteed human-alert delay.

Data: official reports, field/dispatch observations, satellite imagery, camera feeds, weather, river/evacuation information and commercial partner layers. Updates follow incidents; no universal latency guarantee was established. Public app access does not mean its edited incident stream or partner imagery is openly licensed. Enterprise integration is advertised, but no unrestricted public API licence was found.

What Emerge could learn: name the provenance of a report and distinguish confirmation from detection. Do not try to reproduce a human reporting network this weekend.

## Site: NIFC fire information

The US National Interagency Fire Center and NICC support fire agencies, resource coordination and public information.

Features found:

- [Fire information](https://www.nifc.gov/fire-information): national fire news, preparedness levels and their explanations, seasonal preparedness context, situation reports, archives, InciWeb, maps and prevention resources.
- [Statistics](https://www.nifc.gov/fire-information/statistics): annual fires and acres, human/lightning causes, suppression costs and drone incursions. The [fires-and-acres table](https://www.nifc.gov/fire-information/statistics/wildfires) gives national annual totals from 1983 [V] to 2025 [V], with a reporting discontinuity caveat and a state-land omission footnote for 2004 [V].
- [Outlooks](https://www.nifc.gov/nicc/predictive-services/outlooks): daily significant-fire-potential maps for 7 [V] days, seasonal availability warnings, and above/near/below-normal monthly potential for the next 4 [V] months. Monthly outlooks update on the first working day, with text, map, archive and podcast links.
- [Open data hub](https://data-nifc.opendata.arcgis.com/): current/historical fires, operational history, weather, progression, fuels, boundaries and satellite-sensor categories; links to WFIGS, wildfire situational awareness, InciWeb and a data-user guide. Dataset item licences and dates must be checked before choosing a service.

Data: NICC reported national statistics and incident situation reports; interagency WFIGS incident/perimeter services; predictive-service outlooks; agency weather/fuel inputs. Public HTML tables, PDF reports, ArcGIS services and downloadable data exist, but the hub is not a single uniform feed. US federal data are generally reusable; verify item-level partner restrictions rather than label every hub layer public domain.

What Emerge could learn: populate its existing USA reported file from the annual table and retain the scope and footnotes. A preparedness level measures resource strain, not local fire probability.

## Site: Ready.gov wildfires

FEMA's Ready campaign provides public preparedness information, not a detection or forecasting service.

The [wildfire page](https://www.ready.gov/wildfires) groups advice into preparing, staying safe during a fire and returning afterwards. Features include preparedness checklists, document/insurance planning, home protection, evacuation planning, household supplies, smoke-information links, multilingual content, videos, graphics and links to FEMA/Red Cross resources and official alerts.

Data: authored federal guidance and links to emergency information. No fire observations, forecast dataset, incident API or fixed refresh schedule is named. Federal guidance can be linked; do not assume linked partner photos/materials share the same reuse terms. This review inventories the resource rather than republishing safety instructions.

What Emerge could learn: provide a clearly labelled route to official preparedness information, appropriate to the user's country. A US guidance link must not appear to be Bulgarian emergency instructions.

## Site: NOAA NCEI wildfires

NOAA NCEI presents climate-monitoring statistics for researchers and the public, using NIFC fire data.

The [wildfire dashboard](https://www.ncei.noaa.gov/access/monitoring/wildfires/) offers month and timescale selectors, multi-year graphs, burned acres, number of fires, acres per fire, a reference-period average, a matching numeric table, and [CSV](https://www.ncei.noaa.gov/access/monitoring/wildfires/1/10/data.csv), [JSON](https://www.ncei.noaa.gov/access/monitoring/wildfires/1/10/data.json) and [XML](https://www.ncei.noaa.gov/access/monitoring/wildfires/1/10/data.xml) exports for the selected view.

Data: NIFC statistics for the contiguous US, January 2000 [V] through October 2026 [V] in the inspected page, updated monthly. The displayed normal is 2001 [V] to 2020 [V]. This is not a NOAA satellite-detection archive and not an independent second sensor. Federal reuse with attribution is the reasonable starting point; preserve NIFC's provenance and NOAA's geographic definition.

What Emerge could learn: link chart and table, name the baseline years, and offer monthly reported context later. Do not compare this contiguous-US series directly with Emerge's all-USA country total.

## Site: CAL FIRE

California's Department of Forestry and Fire Protection provides state incident and preparedness information for the public and response partners.

The [home page](https://www.fire.ca.gov/) and [incident page](https://www.fire.ca.gov/incidents) both returned Access Denied in headless Chrome. These were the permitted 2 [V] attempts; no further request to the site was made. Actual menus, incident filters, downloads and update intervals could not be verified.

The independently inspected [fire.ai resource directory](https://fire.ai/) describes CAL FIRE as offering California incidents, fire prevention, warnings and burn permits [D] (secondary description). Those are leads, not a claim that this run exercised them. No CAL FIRE dataset licence, API or current-feed specification was verified. The NIFC open-data hub is a separately accessible source of US interagency data, not a substitute claim about CAL FIRE's website.

What Emerge could learn: link to the relevant state authority for local operational context; do not promise to ingest a blocked and unverified feed before the freeze.

## Site: OroraTech

OroraTech is a commercial thermal-satellite and wildfire-intelligence company selling to civil protection, infrastructure/energy, forestry and carbon-project customers.

The [Wildfire Solution page](https://ororatech.com/all-products/wildfire-solution) advertises:

- Before a fire: hazard forecast, weather, vegetation, terrain, land cover and fuel-moisture context.
- During a fire: detection, confidence, coordinates, intensity, estimated affected area, monitored-area alerts, incident overview, fire clusters/front progression, spread simulation and public snapshots that do not require the recipient to have an account.
- After a fire: burned-area/severity mapping, vegetation damage, origin/evolution review, historical dashboards and impact analysis.
- API integration, email/SMS/WhatsApp/Telegram/in-app notifications, demo recordings, wildfire library and sales/reseller access. This review did not sign in or test paid controls.

Named customer examples on that page include ARAUCO, SOPFEU, the European Commission and Tasmania Parks & Wildlife Service. These are provider testimonials, not independent product-performance tests. Its [technology page](https://ororatech.com/company/technology) describes its own thermal cameras/satellites, onboard processing, direct downlink and a combined public/private observation network.

Data versus FIRMS: FIRMS distributes public scientific satellite detections. OroraTech adds proprietary thermal observations, its own processing, ground/downlink infrastructure, fusion and paid operational analytics. It is not just another FIRMS map. Its public pages do not enumerate every satellite, weather model or fuel-data provider, and do not publish an open licence for its detection stream. The product page claims more than 35 [V] (provider claim) satellites, while its FAQ says more than 25 [V] (provider claim). Smallest-detectable-fire and spatial-resolution claims also differ across page sections. Do not use those marketing numbers as interchangeable resolution or guaranteed-latency specifications.

| Comparison | FIRMS | OroraTech public claims |
|---|---|---|
| Main source | Public NASA/NOAA/USGS sensor products | Public satellites plus proprietary thermal observations and processing |
| Spatial detail | Map labels distinguish MODIS about 1 [V] km, VIIRS 375 [V] m and Landsat 30 [V] m | Product FAQ says up to 20 [V] m, while smallest-fire claims elsewhere are 10 [V] by 10 [V] m or 4 [V] by 4 [V] m. These are provider claims about different concepts, not a verified pixel-size comparison. |
| Timeliness | Depends on overpass and NRT/rapid regional delivery | Technology page advertises onboard processing and a 30 [V] minute revisit for its expanding network; a guaranteed local revisit or delivery time was not verified. |
| Access | Public files/services; some routes need a key or login | Paid platform/API; no unrestricted raw-data licence found |
| Best fit | Reproducible research input and open detection distribution | Monitoring customer areas, assets and response workflows |

What Emerge could learn: public snapshots and clear incident context help communication. Buying proprietary thermal data or building spread simulation is outside this weekend's data contract and time budget.

## Feature matrix

This table groups similar features. “Yes” means the implementation is present in the inspected checkout, not that this run re-tested it live. “Now” means a candidate after the existing Musts pass their gates. “No” can mean keep an existing feature, avoid duplicate work, or reject the feature; the Why column says which. Effort is incremental [U]. All source links point to the feature or its documented product description.

| Feature | Sites that have it | Emerge has it? | Take it? | Effort | Why | Source |
|---|---|---|---|---|---|---|
| Recent hotspot map and date windows | NASA FIRMS map; EFFIS CSV viewer; fire.ai; Watch Duty | yes, S5 `lib/layers/recent.ts`, `app/api/recent/route.ts` | no | n/a | Keep it. Existing live route, acquisition dates and cap disclosure already cover the basic need. | https://firms.modaps.eosdis.nasa.gov/map/ |
| Separate sensor switches | NASA FIRMS map; EFFIS CSV viewer; fire.ai | partly, M21 `SatelliteTable.tsx` is country-only; recent payload has satellite IDs | later | S | Add client-side switches using the existing `sat` column and translated legends. Do not change the harmonized analytical record when hiding map points. | https://fire.ai/ |
| User-selectable detection confidence | fire.ai; NASA FIRMS map | partly, `lib/layers/recent.ts` applies a fixed confidence rule | later | S | Add a stricter display filter over existing retained rows. Showing rejected low-confidence rows would need a data-route change and a revised estimate. | https://fire.ai/ |
| Fire intensity and event heat details | fire.ai; OroraTech; NASA FIRMS map | partly, S9 sizes recent points by FRP; M27 `WindowCard.tsx` does not render its FRP values | now | S | Expose available FRP and the sensor caveat in the existing comparison card. Judges: Relevance and Validity. Heat is not burned area or spread speed. | https://ororatech.com/all-products/wildfire-solution |
| Date-specific satellite imagery | NASA FIRMS map; EFFIS CSV viewer | partly, C7/C9 `config/basemaps.ts` has backgrounds, not a full daily imagery timeline | later | M | Add dated imagery source, time controls, attribution and missing-image handling. The current registry helps but does not provide the imagery archive. | https://firms.modaps.eosdis.nasa.gov/map/ |
| Layer menu, legends and background switching | EFFIS CSV viewer; NASA FIRMS map; fire.ai | yes, S6/M25/M26 `shell/layer-panel.tsx`, `config/layers.ts`, `config/basemaps.ts` | no | n/a | Already built. More menus would distract from the analysis. | https://forest-fire.emergency.copernicus.eu/apps/effis.csv/ |
| Drawn areas and coordinates | NASA FIRMS alerts; fire.ai alert zones; EFFIS CSV viewer | yes, M3 `selection/selection-tools.tsx`, `lib/ui/latlon.ts`, `lib/data/selection.ts` | no | n/a | Keep existing analysis selection. Competitors use shapes for different purposes, including subscriptions. | https://firms.modaps.eosdis.nasa.gov/alerts/ |
| Share a place and view | EFFIS CSV viewer; NASA FIRMS map; OroraTech | yes, S10 `lib/ui/selection-url.ts`, `view-url.ts`, `lib/layers/url-state.ts` | no | n/a | Existing URLs restore view state. They are not immutable snapshots of future-refreshing data. | https://ororatech.com/all-products/wildfire-solution |
| Public immutable incident snapshots | OroraTech | partly, S10 URLs and M11 images exist; no stored immutable report | later | M | Package data version, analysis and image into a stable artifact; storage/version handling is additional to URL sharing. | https://ororatech.com/all-products/wildfire-solution |
| Pin favourite places/incidents | fire.ai | no, W1 accounts omitted; no pin store in `components/app` | later | S | Local-browser saved selections can reuse URL state without accounts. Cloud sync remains out. | https://fire.ai/ |
| Dated headline, provenance and freshness | JRC current wildfire situation; NOAA NCEI wildfires | partly, `report-view.tsx` has data date near downloads; `ReportedCard.tsx` omits source URL/fetched date | now | S | Move existing metadata beside headline results and show separate history, report and live-layer dates. Judges: Validity and Presentation. | https://joint-research-centre.ec.europa.eu/scientific-activities/natural-and-man-made-hazards/forest-fires/current-wildfire-situation-europe_en |
| Explicit baseline years beside “unusual” | JRC current wildfire situation; NOAA NCEI wildfires | partly, M5 `UnusualCard.tsx` shows comparisons and count of years, not their exact span | now | S | Derive included years from the same non-null history used by `stats/unusual.ts`; show missing years honestly. Judges: Validity. | https://www.ncei.noaa.gov/access/monitoring/wildfires/ |
| Cumulative season compared with past seasons | JRC current wildfire situation; EFFIS home statistics | partly, M4/M5 `TrendChart.tsx` shows annual totals; no cumulative monthly overlay | now | M | Reuse monthly Series, add cumulative monthly paths and a median band, preserving nulls and matched completed months. Judges: Presentation and Impact. Optional after the core. | https://joint-research-centre.ec.europa.eu/scientific-activities/natural-and-man-made-hazards/forest-fires/current-wildfire-situation-europe_en |
| Monthly reported-fire charts | NOAA NCEI wildfires | no, M28 contract is annual national rows | later | M | Requires monthly reported schema and contiguous-US coverage alignment. This is not a drop-in USA series. | https://www.ncei.noaa.gov/access/monitoring/wildfires/ |
| National reported-fire history | NIFC fire information; EFFIS annual fire reports | partly, M28 `ReportedCard.tsx`; `reported/BGR.json` and `USA.json` remain examples | now | M | Populate existing schema from actual national tables, preserve forestry scope and source dates, check extraction independently. Judges: Relevance and Validity. | https://www.nifc.gov/fire-information/statistics/wildfires |
| Distinguish reported, detected and mapped burned area | EFFIS annual fire reports; Watch Duty; fire.ai | partly, M28 has a non-comparability note but labels EFFIS satellite estimates as reported | now | S | Correct names and source notes in the existing card; no new measurement model. Fold into national-series work. Judges: Validity. | https://doi.org/10.2760/0649290 |
| Burned area and average fire size | NIFC fire information; NOAA NCEI wildfires; EFFIS annual fire reports | partly, M28 holds `burned_ha`, not per-incident size analytics | later | S | After official series are populated, compute area per reported incident from the same source and scope. Never divide by hotspot counts. | https://www.ncei.noaa.gov/access/monitoring/wildfires/ |
| Cause breakdown and suppression costs | NIFC fire information; EFFIS annual fire reports | no, M28 type has fires and burned area only | later | M | Add separately sourced national context and extend the contract deliberately. Not a weather inference from hotspots. | https://www.nifc.gov/fire-information/statistics |
| Official fire-weather forecast | EFFIS CSV viewer; OroraTech | yes, S3 `config/layers.ts`, `lib/layers/danger.ts` | no | n/a | Existing GWIS raster dates and legends already supply it. Verify final attribution separately from inventing a forecast. | https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-danger-forecast |
| Several weather models and danger indices | EFFIS CSV viewer | partly, S3 offers FWI only | later | M | Registry reuse helps, but each index needs a correct legend, date behaviour and explanation. | https://forest-fire.emergency.copernicus.eu/apps/effis.csv/ |
| Monthly seasonal fire-potential outlook | NIFC fire information; EFFIS home | partly, S3 has a daily GWIS layer; no seasonal US panel | later | M | Ingest or link monthly official products with publication dates and geography. Do not represent categorical outlook as calibrated local probability. | https://www.nifc.gov/nicc/predictive-services/outlooks |
| Explain historical chance versus forecast risk | EFFIS Wildfire Risk Viewer; EFFIS CSV viewer | partly, M13 `ChanceCard.tsx` and S3 are separate; probability calibration is null in `validation.json` | now | S | Add a clear historical-frequency label and proof link; retain uncertainty and existing large-area behaviour. Judges: Validity and Impact. | https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/wildfire-risk-assessment |
| Independent validation with failure disclosure | Google Research boundary tracking | partly, M6 `app/proof/tables.tsx` has measured holdouts and limits, but no concise verdict first | now | S | Summarise existing tested geography, scale, failed checks and unmeasured chance score above the tables. Do not generate new scores. Judges: Validity. | https://research.google/blog/real-time-tracking-of-wildfire-boundaries-using-satellite-imagery/ |
| Independent sensor or fire-scar cross-check | Google Research boundary tracking; EFFIS annual fire reports | partly, C3/M6 has validation structure but no completed independent perimeter test | later | L | Spatial/temporal matching and independent expectations require new data and methodology. Shared FIRMS-derived products are not independent truth. | https://research.google/blog/real-time-tracking-of-wildfire-boundaries-using-satellite-imagery/ |
| Accessible chart with matching table | NOAA NCEI wildfires; JRC current wildfire situation | yes, M4/M21 `DataTable.tsx`, `FireCalendar.tsx` | no | n/a | Preserve the existing table and labelled charts. Pattern controls could wait until a measured accessibility gap exists. | https://www.ncei.noaa.gov/access/monitoring/wildfires/ |
| CSV and image exports | NOAA NCEI wildfires; NASA FIRMS map | yes, M11 `DownloadsMenu.tsx`, `lib/csv`, `lib/export/png.ts` | no | n/a | Existing exports already include provenance and missing-value definitions. Do not rebuild them. | https://www.ncei.noaa.gov/access/monitoring/wildfires/ |
| Archive download by place and date | NASA FIRMS archive/area workflows | partly, M11 `app/adapter.ts` exports a bounding box for polygons/countries | later | M | Add geometry filtering to the raw query pipeline with streaming limits and dateline checks. Monthly export is already selection-based. | https://firms.modaps.eosdis.nasa.gov/download/ |
| Public data/API distribution | NASA FIRMS map; NIFC fire information; EFFIS home | partly, `api/hotspots`, `api/recent` and static files; no supported third-party API contract | later | M | Document endpoint limits, versioning, examples and terms without promising an operational service-level agreement. | https://firms.modaps.eosdis.nasa.gov/web-services/ |
| Quick links to official services | fire.ai; EFFIS home | yes, `OutsideLinks.tsx`, `lib/outside-links.ts` | no | n/a | Already links FIRMS, GWIS and EFFIS with place/country/world scope. Earlier research's suggested new feature is done. | https://fire.ai/ |
| Preparedness and local-authority guidance | Ready.gov wildfires; Watch Duty; CAL FIRE via secondary directory | partly, M7 glossary and `shell/disclaimer.tsx`; S8 not implemented | later | S | Add curated country-appropriate links, not generated tactical advice. Useful but lower priority than data validity. | https://www.ready.gov/wildfires |
| Mobile web and language support | EFFIS CSV viewer; Ready.gov wildfires; Watch Duty | yes, M8/M9 shell and `web/messages/*.json`; not runtime-certified here | no | n/a | Existing responsive/bilingual work should be verified by the implementation lane, not replaced. | https://www.ready.gov/wildfires |
| Land cover and fuel context | EFFIS CSV viewer; EFFIS Wildfire Risk Viewer; OroraTech | no, C8/C10; only current fire/history/danger entries in `config/layers.ts` | later | M | Add a display overlay with its legend and terms. Per-hotspot land classification is a separate L effort, not included. | https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/ |
| Population, WUI, protected areas and asset exposure | EFFIS Wildfire Risk Viewer; OroraTech; Watch Duty professional | no, C8 context absent | later | L | Requires boundary/exposure data, joins and uncertainty. The current point model does not calculate affected populations. | https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/ |
| Fire perimeters and burn severity | EFFIS CSV viewer; NASA FIRMS regional service; Watch Duty; OroraTech | no, W5; layer registry has no perimeter source | later | L | Display official perimeters only after adding suitable loading/style support; deriving them from imagery remains out. | https://ororatech.com/all-products/wildfire-solution |
| Wind, humidity and temperature context | fire.ai; OroraTech; Watch Duty | no, C8 and M20 extensibility only | later | M | Fetch a bounded weather series, timestamp it and disclose model/station provenance. Declared multi-measurement types do not supply a weather feed. | https://fire.ai/ |
| Smoke and air-quality card | fire.ai; Watch Duty | no, C8 not built | later | M | Integrate a named AQI feed with units, geographic scale, source terms and stale-data states. Avoid implying measured smoke from hotspots. | https://fire.ai/ |
| Fire emissions | JRC current wildfire situation; EFFIS home | no, C8 not built | later | L | GFAS is a separate assimilated emissions product. Matching its grid/time and explaining uncertainty exceeds a decorative layer. | https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-emissions |
| Time-lapse and fire progression | NASA FIRMS map timeline; OroraTech | partly, C5 history has manual year selection; no autoplay | later | M | Existing annual files help, but playback needs loading, cancellation, accessible controls and date consistency. | https://ororatech.com/all-products/wildfire-solution |
| Named incidents and containment | fire.ai; Watch Duty; NIFC fire information | no, M18 points do not include incident identity | later | L | Incident matching, overlapping perimeters and source reconciliation need a separate model. Hotspots are not incidents. | https://fire.ai/ |
| Geostationary rapid detection | Google Research boundary tracking; Watch Duty NGFS | no, C4 not built | later | L | New sensor, regional coverage, timing and validation work; cannot silently add observations to the calibrated record. | https://www.watchduty.org/blog/watch-duty-strengthens-early-wildfire-detection-with-enhanced-satellite-feeds |
| Human-verified live reporting network | Watch Duty | no, W2 | no | n/a | Not Emerge's role. Staffing and official coordination cannot be replaced by an AI summary. | https://www.watchduty.org/how-it-works/overview |
| Evacuation orders, shelter routing and aircraft tracking | Watch Duty; Google Research boundary tracking provides navigation context | no, W2 | no | n/a | Not our job: Emerge is a research tool, not an emergency service. Link authorities instead. | https://www.watchduty.org/ |
| Personal email, SMS or push alerts | NASA FIRMS map; fire.ai; Watch Duty; OroraTech | no, W6 explicitly cut | no | n/a | Team already removed this work. Delivery, subscriptions and reliability consume time without improving harmonization. | https://firms.modaps.eosdis.nasa.gov/alerts/ |
| Native apps, login and paid account tiers | Watch Duty; fire.ai | no, W1/W3/W8 | no | n/a | No value to the frozen hackathon scope; public mobile web is sufficient. | https://www.watchduty.org/ |
| Fire-spread prediction | OroraTech | no, C2 is a different forecast concept; no spread model | no | n/a | Requires fuels, terrain, weather, calibrated physics and operational validation. No credible weekend implementation. | https://ororatech.com/all-products/wildfire-solution |
| Buy proprietary thermal observations | OroraTech | no, C4 | no | n/a | Paid access, undisclosed terms and sensor calibration add procurement and science work beyond this task. | https://ororatech.com/company/technology |
| AI-written live incident brief and camera/smoke-sensor network | fire.ai | no, W2 | no | n/a | Generated safety summaries and unverified sensor inputs add risk and distract from explainable history. | https://fire.ai/ |

## Data sources behind these sites

This inventory includes named measurements, derived products and context layers. Repeated inputs are grouped. “Not stated” means the inspected public page did not establish the detail; it does not mean the data have no licence. Access describes the source, not permission to redistribute a commercial site's enriched output. M28 flags reported-context candidates; M6 flags possible validation evidence. A shared input is not an independent validation source.

| Dataset or feed | Provider and sites using/naming it | Coverage | Update rate | Access | Licence or terms | Emerge could use it? |
|---|---|---|---|---|---|---|
| [MODIS active-fire/thermal anomalies](https://firms.modaps.eosdis.nasa.gov/download/) | NASA Terra/Aqua via FIRMS; EFFIS, fire.ai, Google training, Watch Duty | Global, from November 2000 [V]; sensor pixels about 1 [V] km in FIRMS map | Satellite passes; NRT then science-quality replacement | CSV/SHP/JSON, area API, WMS/WFS | NASA open distribution with acknowledgement/disclaimer; API key or archive authentication on some routes | yes, already core M1/M2. Same input cannot independently prove M6. |
| [VIIRS active-fire detections](https://firms.modaps.eosdis.nasa.gov/download/) | NASA/NOAA, S-NPP, NOAA-20, NOAA-21; FIRMS, EFFIS, fire.ai, Google, Watch Duty | Global, about 375 [V] m; S-NPP archive ends 2 [V] Nov 2026 [V] | Pass-based NRT and science products | CSV/SHP/JSON, API, WMS/WFS | NASA acknowledgement; API/archive access conditions | yes, existing calibration reference and recent feed. Check availability per spacecraft/product; source pages disagree on NOAA-21 start date. |
| [FIRMS rapid regional MODIS/VIIRS delivery](https://firms.modaps.eosdis.nasa.gov/usfs/) | NASA/USDA Forest Service; Watch Duty names direct readout | US/Canada receiving-station coverage | Low latency after a pass; not continuous imagery | Regional map, downloads and services | NASA/USFS attribution and accuracy disclaimer | maybe, later freshness improvement. Does not solve historical conversion or global coverage. |
| [Landsat OLI active-fire detections](https://firms.modaps.eosdis.nasa.gov/download/) | NASA/USGS, distributed by FIRMS; Watch Duty | FIRMS product coverage must be checked; archive from June 2022 [V]; 30 [V] m map label | Orbital acquisition, not frequent geostationary revisits | FIRMS map, files and archive | NASA/USGS source terms and acknowledgement | maybe, M6 case study later. High spatial detail does not give complete daily truth. |
| [Sentinel active-fire layer](https://forest-fire.emergency.copernicus.eu/apps/effis.csv/) | Copernicus Sentinel-3/SLSTR; named by EFFIS viewer | Layer coverage/edition not exposed in inspected menu | Not stated in menu | EFFIS map; raw-product access is separate | Copernicus product terms must be checked | maybe, independent sensor for M6 later; not a plug-in replacement for VIIRS counts. |
| [MODIS/VIIRS true-colour imagery, GIBS and Worldview subsets](https://firms.modaps.eosdis.nasa.gov/usfs/) | NASA; FIRMS global/regional maps, Google illustrations | Global where clear observations exist | Acquisition-dependent daily imagery | GIBS tiles, Worldview image subsets | NASA attribution; imagery limitations | yes, later visual context via basemap registry; not proof that every obscured fire was detected. |
| [Sentinel cloudless background](https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/) | EOX using Copernicus Sentinel imagery; EFFIS viewers | Global composite; viewer names 2024 [V] edition | Composite release, not live | Basemap tiles | EOX/Copernicus attribution; check tile-service terms | maybe, existing basemap extension. Must not imply the background shows current damage. |
| [EFFIS rapid damage assessment and severity](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/rapid-damage-assessment) | JRC/EFFIS supervised MODIS/VIIRS/Sentinel imagery; EFFIS maps and reports | Europe and surrounding region; coverage and minimum-size rules vary by product | Operational revisions; viewer labels severity weekly [V] | Map/WMS, download/request services | EU-owned CC BY 4.0 [V], subject to dataset notices | maybe, M28 context and M6 cross-check with matching scope. It shares satellite inputs and measures area, not hotspot accuracy. |
| [EFFIS country estimates and weekly seasonal statistics](https://api2.effis.emergency.copernicus.eu/statistics/v2/effis/estimatesbycountry?country=BGR) | JRC mapped-fire estimates; EFFIS portal/JRC briefing | Country aggregates; BGR response covers 2006 [V] to 2026 [V] | Current-season updates; endpoint gives no cadence guarantee | Public JSON, statistics portal exports | EFFIS data licence and attribution | yes, M28 context if explicitly labelled satellite-mapped. Not a national-service report. The live API and annual PDF differ. |
| [National reports in EFFIS annual publication](https://doi.org/10.2760/0649290) | National services, compiled by JRC; Bulgaria source is Executive Forest Agency | Participating countries; Bulgaria table spans 2015 [V] to 2024 [V] and forest fires | Annual, publication lag | PDF tables/charts | EU publication reuse plus national-source credit | yes, highest-value M28 addition; M6 independent reported context. Preserve forest-only scope and rounded table units. |
| [European Fire Database](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/european-fire-database) | National submissions checked/managed by JRC | Participating European countries; Bulgaria included | Annual submissions | Public general maps; detailed data via requests/conditions | EFFIS licence; detailed-record access must be established | maybe, stronger M28 source after hackathon. Do not assume an unrestricted incident API. |
| [NICC national annual fires and acres](https://www.nifc.gov/fire-information/statistics/wildfires) | NICC/NIFC | USA, 1983 [V] to 2025 [V]; historical comparability caveat | Annual | Public HTML table | Federal reuse expected [U]; retain source and exclusions; no blanket licence inferred for all NIFC content | yes, M28 now using existing annual schema. M6 external context, not equal units to hotspots. |
| [NIFC cause, suppression-cost and drone-incursion statistics](https://www.nifc.gov/fire-information/statistics) | NIFC and contributing agencies | USA; dates vary by series | Annual/statistical releases | Linked tables/reports | Federal/agency source terms; verify each table | maybe, later explanatory context. Not a measure of harmonization correctness. |
| [Incident Management Situation Report and preparedness levels](https://www.nifc.gov/fire-information) | NICC/NMAC/interagency reporting | National operational picture | Operational reports; season-dependent | PDF, archives and linked map | Official report attribution; revisions possible | maybe, link only now. Resource readiness is not local fire danger. |
| [WFIGS/interagency incident locations, perimeters and progression](https://data-nifc.opendata.arcgis.com/) | Interagency NIFC open-data contributors; named by fire.ai | Primarily US operational incidents; current and historical categories | Source/incident-dependent | ArcGIS services and dataset downloads, item-specific | Check item licence, authoritative status and update timestamp | maybe, M6 case-study context later. New incident/perimeter model required; no raw-count equality test. |
| [InciWeb public incident information](https://data-nifc.opendata.arcgis.com/) | US interagency public-affairs reporting; NIFC and fire.ai links | Participating incidents | As incident teams publish | Website/incident links; public API not established here | Agency attribution and linked-content terms | yes as links; no need to ingest operational text for the hackathon. |
| [Canada active fires labelled DIP](https://firms.modaps.eosdis.nasa.gov/usfs/map/) | Canadian incident source identified as DIP in FIRMS; upstream agency/feed metadata not opened | Canada active incidents | Operational, exact cadence not stated | FIRMS regional map; direct source API not verified | Source-specific terms unresolved | maybe, future reported context. Not sufficient evidence for a new national archive before freeze. |
| [US Fire Weather Watches and Red Flag Warnings](https://firms.modaps.eosdis.nasa.gov/usfs/map/) | Official US weather warnings displayed by FIRMS; feed endpoint not opened | US warning areas | As issued/updated | Regional map overlay; raw feed not verified here | Issuer attribution and product terms | no for an Emerge warning service; link the official source. |
| [NOAA NCEI monthly wildfire statistics](https://www.ncei.noaa.gov/access/monitoring/wildfires/) | NIFC data presented by NOAA NCEI | Contiguous US, January 2000 [V] to October 2026 [V] observed | Monthly | CSV/JSON/XML per selected month/timescale | Federal data with NOAA/NIFC attribution; preserve scope | maybe, M28 later after a matching contiguous-US selection. Not independent of NIFC for M6. |
| [ECMWF and Meteo-France fire-danger indices](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-danger-forecast) | ECMWF/Meteo-France weather, EFFIS/GWIS derived indices | Europe via EFFIS, global GWIS FWI already used by Emerge | Daily forecast steps; model-dependent horizon | WMS/maps and EFFIS download catalogue | EU-owned derived content CC BY 4.0 [V]; third-party/model-specific terms still need confirmation | yes, S3 already present. Additional indices need their own explanations; do not change all credits based on the generic licence alone. |
| [Lightning forecast](https://forest-fire.emergency.copernicus.eu/applications/data-and-services) | EFFIS catalogue; upstream model not specified in inspected row | EFFIS forecast area | Daily forecast product; issue details not stated | Viewer and service/download catalogue | Check product notice, not assumed identical to FWI | maybe, later C8. Lightning is an ignition factor, not a detected fire. |
| [EFFIS monthly/seasonal weather outlook](https://forest-fire.emergency.copernicus.eu/) | EFFIS long-term forecast application | Regional/seasonal climate context | Product issue cycle; not verified here | Linked long-term forecast viewer | Model and derived-product terms must be checked | maybe, later S3 context; not a local probability replacement. |
| [Significant fire potential, short range](https://www.nifc.gov/nicc/predictive-services/outlooks) | Geographic Area Predictive Services/NICC | US areas in fire season with staff on duty | Daily, 7 [V] day horizon | Images, national viewer, product guide | Official-source attribution; note conditional coverage | yes as an outbound link; later map integration. Not all-year coverage everywhere. |
| [Significant wildland fire potential, seasonal](https://www.nifc.gov/nicc/predictive-services/outlooks) | NICC and regional predictive units | USA, next 4 [V] months; North American product also linked | Monthly, first working day | Maps, text PDF, archive and podcast | Official-source attribution; categories/methods change over time | yes, later S3; cannot backtest against changing categories without care. |
| [Pan-European wildfire-risk product](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/wildfire-risk-assessment) | JRC danger/vulnerability/exposure integration | Pan-European prototype, not precise local risk | Release-based; live cadence not stated | Risk viewer, methods publication | EU reuse with product caveats | maybe, planning context later. Its rank is not a calibrated probability. |
| [Human Settlement Layer, population and WUI proxies](https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/) | EFFIS/JRC integrated context; exact input edition not established | Risk/viewer coverage | Static or release-based | Viewer and selected EFFIS data services | Underlying dataset terms/edition must be checked | maybe, later exposure context. Point-level affected-population counts require additional analysis. |
| [CORINE Land Cover and aggregated classes](https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/) | Copernicus/EEA, served by EFFIS | European land-cover coverage | Versioned land-cover releases | Viewer, service/download catalogue | Copernicus/EEA attribution; verify edition/service rights | yes, later C8 overlay; land cover alone cannot prove a hotspot's cause. |
| [CCI Landcover](https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/) | ESA CCI label, served by EFFIS; edition unspecified | Global land-cover background | Release-based | Viewer background | Verify exact CCI product licence and attribution | maybe, later background or stratification. Do not silently change the conversion's training groups. |
| [Protected areas, Natura protected land and irreplaceability](https://forest-fire.emergency.copernicus.eu/apps/fire.risk.viewer/) | EFFIS/JRC with protected-area authorities; exact source varies by layer | European risk/impact coverage | Boundary/release updates, not live | Viewer and data-service catalogue | Layer-specific rights and attribution; third-party exceptions possible | maybe, later Impact context. No “hectares damaged” calculation from hotspot dots. |
| [European Fuel Map](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fuels) | JRC/EFFIS | European fuel classes; named 2017 [V] product | Static edition | Download via EFFIS catalogue | EFFIS explicitly supplies a recommended citation; generic EU terms plus notices | yes, later context. Turning fuel into spread prediction is separate work. |
| [CAMS GFAS fire emissions](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-emissions) | ECMWF/CAMS, assimilating MODIS and later VIIRS FRP | Global emissions; EU briefing aggregates | Daily | EFFIS plots; CAMS product access subject to service terms | CAMS/Copernicus terms; credit version and sensors | maybe, later. The page names GFAS v1.2 and a change to v1.4.2 from December 2025 [V]. Not independent hotspot truth for M6. |
| [GOES imagery and NOAA fire product](https://research.google/blog/real-time-tracking-of-wildfire-boundaries-using-satellite-imagery/) | NOAA, used by Google boundary models | Americas; geostationary view | Frequent scans; research article describes 10 [V] minute imagery | NOAA source services; algorithm-document link failed here | NOAA source terms; Google's derived output has separate terms | maybe, independent-sensor M6 work later; coarse pixels and geometry need explicit matching. |
| [Himawari imagery](https://sites.research.google/gr/wildfires/boundary-tracking/) | JMA, named by Google | Asia-Pacific/Australia model coverage | Frequent geostationary scans; product-specific | Provider imagery/data services, not downloaded here | JMA/distributor terms must be checked | maybe, later sensor extension outside the demo countries. |
| [GK2A imagery](https://sites.research.google/gr/wildfires/boundary-tracking/) | Korea Meteorological Administration, named by Google | Asia-Pacific/Australia model coverage | Geostationary scans; exact feed rate not established here | Provider services, not downloaded here | KMA/distributor terms must be checked | maybe, later; new processing/calibration required. |
| [Google estimated boundaries](https://sites.research.google/gr/wildfires/boundary-tracking/) | Google model using multiple satellites | Supported countries; not universal | Provider says 10 [V] to 15 [V] minutes | Maps/Search; no public boundary API/export found | Google product terms; no open-feed licence found | no as an ingestible weekend feed. Useful product/validation-method reference. |
| [Local-authority fire scars used in Google's evaluation](https://research.google/blog/real-time-tracking-of-wildfire-boundaries-using-satellite-imagery/) | Local authorities, used as external labels by Google | Evaluated fires; dataset identifiers not supplied as a downloadable release | Post-fire | Method description; no complete evaluation-data download found | Authority-specific, unresolved | maybe, M6 model for a future independent check. Do not claim access to Google's test set. |
| [NOAA/CIMSS Next Generation Fire System](https://www.watchduty.org/blog/watch-duty-strengthens-early-wildfire-detection-with-enhanced-satellite-feeds) | NOAA and University of Wisconsin CIMSS; Watch Duty | Contiguous US in provider article | 5 [V] (provider claim) minute imagery | Watch Duty layer; raw NGFS API/terms not verified here | NOAA/product-specific status and terms to confirm | maybe, future M6 sensor comparison; event timing still needs independently reviewed truth. |
| [Watch Duty verified incident stream](https://www.watchduty.org/how-it-works/overview) | Staff/volunteers synthesising dispatch, radio, official reports, cameras and satellites | Service's supported US regions/incidents | Human-reviewed event updates | Public app; enterprise integrations advertised | Watch Duty terms; no unrestricted public redistribution licence found | no as a freely reusable feed now; link incident context instead. |
| [Evacuation, shelters, river gauges, Red Flag and outage context](https://www.watchduty.org/) | Watch Duty/official partner inputs; each upstream feed not enumerated | Covered US incidents/regions | Event/feed-dependent | Product layers; direct raw feeds not established | Official/partner terms vary | no for operational use in Emerge. Links to authorities are appropriate. |
| [Planet weekly imagery mosaics](https://www.watchduty.org/solutions/overview) | Planet, integrated into Watch Duty enterprise | Contracted imagery coverage | Weekly [V] (provider description) | Licensed enterprise layer | Commercial partner terms, not open because visible in a product | no before freeze; useful future asset context if licensed. |
| [Overstory vegetation risk](https://www.watchduty.org/solutions/overview) | Overstory, integrated into Watch Duty enterprise | Customer vegetation/utility coverage | Not stated | Enterprise integration | Commercial terms | no before freeze; not part of the NASA harmonization task. |
| [Wet Dog Weather radar and weather](https://www.watchduty.org/solutions/overview) | Wet Dog Weather; Watch Duty | Provider coverage, not fully specified | Live product; exact cadence not stated | Partner product integration | Partner terms not established | maybe later, but direct official weather feeds may be simpler. |
| [ALERTCalifornia and ALERTWest cameras](https://fire.ai/) | Named camera networks; fire.ai guide | California and parts of western US | Live imagery/streams | Camera links; broad ingest API not verified | Camera/network terms; viewing is not republication permission | no for core history; official outbound links only. |
| [Airport observations and ECMWF weather fallback](https://fire.ai/) | Nearest-airport reports, provider not named; ECMWF fallback | Location-dependent | Current observation/model, guide does not specify issuance cadence | fire.ai popup; direct feed not exposed | Guide claims ECMWF CC BY 4.0 [V] (provider statement); airport-source terms unknown | maybe later C8, after choosing a documented feed and time/unit handling. |
| [Open-Meteo global CAMS air quality](https://fire.ai/) | Open-Meteo serving CAMS model output; fire.ai AQI card | Global model, with regional display scales | Model cycle not documented by fire.ai; card refreshes when map moves | Underlying API service; not tested here | Open-Meteo/CAMS current service terms must be checked | maybe later. This is modelled AQI, not EPA station measurements at each click. |
| [AirNow air-quality information](https://fire.ai/) | US EPA/partners, linked as a resource | US-oriented air quality/smoke information | Product-dependent, not verified here | Resource link; API not tested | EPA/partner source terms | yes as a link; do not call it fire.ai's actual AQI-card source. |
| [Community cameras and smoke-sensor beta](https://fire.ai/) | fire.ai community/partners, sensor providers unspecified | Beta network coverage not specified | Not established | Beta/gated controls | No open dataset terms found | no; too little provenance for research claims. |
| [OroraTech proprietary thermal observations](https://ororatech.com/company/technology) | OroraTech-owned thermal satellites/cameras, plus public satellites | Global commercial service claim; actual coverage/revisit contractual | Multiple observations with orbit/downlink constraints; no verified universal guarantee | Commercial platform/API | Proprietary, negotiated access and redistribution | no before freeze. Potential later data partnership; requires independent calibration. |
| [OroraTech clusters, spread, risk, burned area and damage analytics](https://ororatech.com/all-products/wildfire-solution) | OroraTech algorithms; weather/fuels/terrain providers not enumerated | Customer areas/global offering | Product/event-dependent | Commercial API, dashboards and public snapshots | Commercial terms; public snapshot is not an open dataset | no now. These derived products answer different questions from harmonized hotspot history. |
| [Basemap datasets and tile services](https://fire.ai/) | OSM, OpenFreeMap, OpenMapTiles and Esri named by fire.ai; NASA Blue Marble in FIRMS | Global/background coverage varies | Release/service-dependent | Map tiles | OSM data, style, tile-service and Esri terms differ; retain each attribution | yes, existing basemap registry. Do not treat all map tiles as one open licence. |
| [News/context links](https://fire.ai/) | Google News search and linked publishers; fire.ai incident popups | Matching named incidents | Publisher/search-dependent | Outbound links, not a documented news-data API | Publisher copyright | yes as optional links later; no scraping or AI operational brief needed. |

For M28, the strongest immediate sources are the national-service chapter in the annual EFFIS report and NIFC's annual table. For M6, those are external contextual evidence, not a literal truth count for satellite pixels. EFFIS mapped scars, NOAA-hosted NIFC tables, Google's MODIS/VIIRS-trained model and FIRMS-derived commercial maps must not be counted as independent confirmations of the same input [U].

## Shortlist before the Sunday 08:00 freeze

Freeze: Sunday 15 [V] November 2026 [V], 08:00 [V] Sofia, as specified in the brief. This is a ranked menu, not an instruction to build every item. The existing build plan still wins: real-data end-to-end checkpoint at 00:30 [V], world/proof/Must gates at 04:00 [V], data refresh and English text freeze at 06:00 [V], then Bulgarian review and smoke test. Complete missing Must behaviour before adding the optional chart.

The listed work totals roughly 11 [U] to 20 [U] agent-hours if all items are taken. The team needs separate existing owners or must stop down the list. No source access, schema change or validation result should be assumed complete because this report recommends it.

| Rank | Addition and judging criterion | Effort | Files it would touch | Concrete scope and done condition |
|---|---|---|---|---|
| 1 [U] | Fill M28 with genuinely national reported figures. **Relevance, Validity, Impact** | M | `pipeline/export_reported.py` (new source exporter); generated `web/public/data/reported/BGR.json`, `USA.json`; `components/report/ReportedCard.tsx`; `web/messages/report.en.json`, `report.bg.json`; independent expected-data fixture under `tests/expected/` | Transcribe the Bulgarian national-service table and NIFC annual table, retain source URL/date/scope, convert US area units with a checked conversion and preserve nulls. Keep Bulgarian forest fires distinct from all vegetation fires. Existing annual schema is enough. An independent reviewer checks source rows before exporter assertions. Do not add an extra series to the frozen contract without its owner. |
| 2 [U] | Put data cutoff and source provenance beside the result. **Validity, Presentation** | S | `components/app/report-view.tsx`, `components/report/ReportedCard.tsx`, `web/messages/app.en.json`, `app.bg.json`, `report.en.json`, `report.bg.json` | Reuse `meta.last_data_day`, report `source.url/fetched/note` and existing live-layer dates. The first result must say what period it covers; historical data and current map must not look synchronized. Check unavailable dates and old data in both languages. |
| 3 [U] | Print the actual comparison years and sample size. **Validity, Presentation** | S | `components/app/report-view.tsx`, `components/report/UnusualCard.tsx`, `components/report/lib/sentences.ts`, `lib/stats/unusual.ts` if a shared helper is needed; `web/messages/report.*.json` | Derive the label from the same eligible, non-null earlier months used by the calculation. Preserve gaps and the current selection's date range. For month-to-date, use the eligible daily comparison years. Check an early year, missing year and changed date filter. No fixed copied baseline. |
| 4 [U] | Add a short verdict above the existing proof tables. **Validity, Presentation** | S | `app/proof/proof-view.tsx`, `app/proof/tables.tsx`, `web/messages/proof.en.json`, `proof.bg.json` | Summarise what was tested, the spatial scale, the failed original world-gate check, and what remains unmeasured. Read existing validation fields. Keep full tables visible. State that method evidence from Bulgaria/USA is not a validation of every country's world-fit output. No invented score or automatic pass label. |
| 5 [U] | Make the recent-window comparison's units and date explicit, and expose available FRP. **Relevance, Validity** | S | `components/report/WindowCard.tsx`, `components/report/lib/sentences.ts`, `web/messages/report.en.json`, `report.bg.json` | The component already receives `frp` and an end date. Show heat only with units and available data; clearly label raw sensor counts across sensor eras, not harmonized daily history. Show the real archived end date. Check null heat and mixed sensor periods. This does not connect the historical window to today's live detections. |
| 6 [U] | Clarify historical chance versus forecast, with a proof link. **Validity, Impact** | S | `components/report/ChanceCard.tsx`, `web/messages/report.en.json`, `report.bg.json` | Explain that the number is historical occurrence frequency, not a weather forecast or evacuation recommendation. Preserve uncertainty and the existing large-area typical-fire-days view. Say calibration is not yet measured where the proof file remains null. |
| 7 [U] | Add a cumulative completed-month season chart. **Presentation, Impact** | M | `components/report/CumulativeChart.tsx` (new), `components/app/report-view.tsx`, `components/report/lib/aggregate.ts`, `web/messages/report.*.json`; reuse existing chart styles/export helper | Reuse loaded monthly Series; compare the selected year and historical median over matching completed months. Keep nulls as gaps. Do not manufacture day-level history from monthly files. Give judges an immediately readable season comparison. Cut this item first if Must checks or translation are late. |

Paths above are under `web/src/` unless they begin with `web/messages/`, `web/public/`, `pipeline/` or `tests/`. Generated data would be produced by a source exporter, not hand-edited. Future implementation owners must run the repo's relevant gates; UI changes require the existing phone/desktop overflow and UI-lint checks. This research run makes none of those application changes.

## Later, after the hackathon

- **Reported context by month and geography:** NOAA's monthly series, additional national tables, a deliberately versioned reported-data contract and explicit forest/all-land/contiguous-US scope. Supports M28 and C3.
- **Independent validation case studies:** Landsat, Sentinel or agency perimeters with matched dates, cloud/coverage caveats and expectations written before implementation. Supports M6; do not score a sensor against a derivative of itself.
- **Context overlays:** fuels, land cover, protected areas, population, wind and AQI, each with its own terms, timestamp and missing-data state. Supports C8/C10. Keep the harmonized record separate.
- **Seasonal views:** official NIFC outlook, season start/end, cumulative curves and time-lapse. Reuse existing data only where its temporal detail supports the question.
- **Research sharing:** local saved places, immutable report artifacts, documented APIs and exact-shape raw export with bounded requests. Existing share links and monthly export already cover the basic demo.
- **Commercial or operational partnerships:** assess OroraTech observations and Watch Duty information only with documented access rights, independent validation and a clear user need. A commercial feed is not automatically a scientific ground truth.

## Not worth taking

| Idea | Reason |
|---|---|
| Emergency dispatch, evacuation orders or aircraft coordination | Not our job: Emerge is a research tool, not an emergency service. |
| Rebuilding FIRMS alerts | The team explicitly cut W6; FIRMS already supplies a mature service to link. |
| Accounts, subscription billing, app-store apps and installable-app work | W1/W3/W8 are out. They do not improve the scientific answer before the freeze. |
| Fire-spread simulation or a new weather-based prediction model (**note:** plan 2, approved later on 14 Nov, does build a weather-based next-day model, with a pre-registered test and a daily scorecard; spread simulation stays out) | Missing fuel/weather/terrain calibration and independent validation; C2 is not a weekend shortcut. |
| Generating burned-area outlines from hotspot dots | Violates the measurement meaning and the W5 scope. A detection footprint is not a burned perimeter. |
| Purchasing private satellite data this weekend | Procurement, licence and inter-sensor calibration are larger than the likely demo benefit. |
| AI-written safety briefs or automatic crew pre-positioning orders (**note:** plan 2's S14 is a rule-based "consider" suggestion, never an order) | An explanatory history tool should not invent operational advice from incomplete observations. |
| Copying every EFFIS index and overlay | More controls would hide Emerge's distinctive harmonized history and uncertainty. |
| Extending the pre-MODIS record by splicing unrelated sensors | No validated conversion or comparable coverage; this research supplies no such method. |
| Calling every external fire map an independent validator | Many reuse FIRMS, and some train on the same MODIS/VIIRS labels. |

## Research method and reference handoff

Public pages were inspected in a headless browser. The site inventory was extended with menus, method pages, service pages and publisher contents. No accounts, forms, subscriptions, installations, code uploads or visible browser windows were used. Cookie controls were left untouched or set to essential-only where available. PDF reads used bounded HTTP ranges and selected-page rendering; the complete report PDF was not downloaded. The focal-loss abstract and failed linked NOAA/MODIS documents were also checked with the web reader.

The URL citations in every site section, the feature matrix and dataset table form the external-resource list for the References field. They distinguish sources inspected from linked sources not fully verified. The existing local research was used for context, not silently promoted into fresh verification. Evidence captures were kept locally during the run and are not part of this repo.

AI usage note for the team's SI disclosure: an AI assistant read repository documentation/code, navigated public websites headlessly, extracted public interface/data documentation, inspected selected official-report pages, compared existing implementations and proposed effort/priority estimates. It wrote this report. No application implementation, model training, scientific backtest, deployment or independent human review was performed. This report is not its own validation oracle.

## BRIEF CORRECTIONS

| Claim or assumption | What was observed | Implication |
|---|---|---|
| Historical record reaches today | `meta.json` ends on 31 [V] December 2025 [V], while recent detections are a separate live route. | Correct the demo wording. Completing current-year history remains existing Must work, not a small borrowed feature. |
| Existing competitor notes say map/selection are unmerged | `map-view.tsx`, `selection-tools.tsx`, shell and URL-state modules are on this checkout. | Do not cost them as new work. This run verifies code presence, not fresh end-to-end behaviour. |
| Existing notes call the proof file empty | `validation.json` is real and populated. It discloses limited test geography and a failed original world-gate check. | Improve presentation of existing evidence rather than invent a new proof page. |
| Detected versus reported is complete | BGR/USA reported files have only 1 [V] populated year each, null source URL/date and `example=true`; USA burned area is missing. | M28 is partial in data even though its card is implemented. |
| EFFIS estimates are national-service reported fires | The public API returns Bulgaria 2024 [V] as 133 [V] mapped fires and 44,745 [V] ha; national-service report page 19 [V] gives 595 [V] forest fires and 17,116.4 [V] ha in prose. | Use separate source names, scopes and units. National forestry reports are not all vegetation burns. |
| All EFFIS numbers describe the same filter | Annual EFFIS chapter page 203 [V] gives 256 [V] fires and 45,435 [V] ha; its yearly figure separately labels fires at least 30 [V] ha. The live API gives the different values above. | Store exact product/filter/retrieval date. Do not assume a data error or silently merge annual and live series. The precise reconciliation was not established here. |
| “This fire vs past fires” is a live harmonized event comparison | `lib/data/daily.ts` uses `meta.last_data_day`; validation limits describe daily counts as raw across sensor eras. `WindowCard.tsx` renders hotspots but not its available FRP. | Show the actual endpoint and raw-sensor caveat. Today's map dots do not update the historical window. |
| Chance of fire is a scored forecast | `validation.json` has null Brier and reliability results. `ChanceCard.tsx` also substitutes typical fire days for large areas. | Call it historical frequency and disclose the missing calibration. Do not claim superiority to a weather forecast. |
| Hotspots are always the default unit | `components/report/lib/constants.ts` defaults to `cd`, because the hotspot conversion did not pass its accuracy criterion. | Explain fire cell-days; keep the hotspot switch visible. |
| Downloads always match the exact shape and arbitrary dates | Raw export uses bounded annual requests and a bounding box for polygon/country. It has radius/row caps and a dateline-side caveat. Per-satellite history is country-only. | Keep current download caveats prominent; monthly analytical export is a different product. |
| Official outbound links need adding | `OutsideLinks.tsx` already provides FIRMS/GWIS/EFFIS links with scope labels. | Do not repeat the earlier research recommendation as new work. |
| “EFFIS CSV viewer” is a CSV-file viewer | Page title and controls identify a Current Situation Viewer. | Keep the requested heading, but describe the map application correctly. |
| NOAA wildfire dashboard is an independent sensor record | It says its statistics come from NIFC and cover the contiguous US. | Not an independent M6 check, nor a direct all-USA replacement. |
| fire.ai offers a comparable global historical record | Its guide distinguishes US incident history from 2004 [V] and global confirmed clusters from 2026 [V]. Future mode is advertised as coming. | Do not treat a broad historical headline as global harmonization or a shipped predictor. |
| fire.ai AQI comes from its AirNow link | The actual guide names Open-Meteo's global CAMS model for the AQI card. | Resource links and actual data inputs are different. |
| FIRMS country API is available | Current API menu marks `country` and `countries` unavailable. NOAA-21 start date also differs between active-data and archive pages. | Use the existing area route and confirm `data_availability` for the intended product. Do not rely on a stale endpoint/date assumption. |
| OroraTech is a FIRMS-only map | Its technology page describes its own thermal payloads, onboard processing and downlink. Its product combines proprietary/public data and paid analytics. | Separate the company, raw observations and software product; no open feed was verified. |
| Public product marketing gives a consistent performance specification | fire.ai's refresh descriptions conflict; OroraTech's satellite-count, minimum-fire-size and resolution claims vary within its page. | Record provider claims as claims. Do not translate smallest detectable fire into pixel resolution or guaranteed detection latency. |
| JRC's above/below prose can be copied | The inspected briefing calls 2,335 [V] below 2,193 [V]. | Generate comparison wording from validated arithmetic. |
