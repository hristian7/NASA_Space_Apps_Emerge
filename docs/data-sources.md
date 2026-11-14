# NASA Space Apps Challenge 2026: data sources in plain language

Every data source named in the 14 challenge texts, with what it is and what it gives you. Written on 12 November 2026 from the challenge pages, before the official Resources tabs opened. The official per-challenge resource lists (published 13 November) are in [challenges-full.md](challenges-full.md) under each challenge; they include more links than this list. Descriptions are from general knowledge and the numbers are approximate. Overview of the challenges: [challenges-overview.md](challenges-overview.md).

## Access and licences

- **All of it is public.** You do not need to be registered for the hackathon to use any of these sources.
- **No account:** JPL Horizons, NASA POWER, the FIRMS 24-hour and 7-day files, LOLA and LRO, Quickmap, Moon Trek, Mars Trek, USGS geologic maps, rover raw images, SPHEREx and WISE at IRSA, Aladin, earth.gov visualisations, OSDR. Landsat and SRTM are also on AWS Open Data without a login.
- **Free NASA Earthdata Login** (https://urs.earthdata.nasa.gov/, instant): MODIS and VIIRS archives, SMAP, GPM, GRACE, ECOSTRESS, GEDI, OMI, AIRS, MERRA-2, GLDAS, Giovanni, NISAR (through the Alaska Satellite Facility).
- **Free keys:** a FIRMS map key for its API and full history; an api.nasa.gov key for DONKI and other NASA APIs (about 1,000 calls an hour). The PSI combustion repository has asked for a free registration in the past.
- **Checked live on 12 November 2026:** Horizons, POWER, the FIRMS 24-hour file, IRSA's SPHEREx page, the LOLA archive, the Curiosity raw-image feed, the Earthdata login page and earth.gov all answered. DONKI's api.nasa.gov address returned "Not Found" and its own server timed out that day.
- **Licences:** NASA data is generally free to use, commercial use included, with a credit to NASA and without implying NASA endorsement. Partner-agency data (ESA, JAXA, CONAE and others) varies: check each source's terms. ESA's Gaia data needs prior permission for commercial use. Non-US websites have their own data use terms, as the official resource lists point out.

## Earth: satellites watching the planet

| Name | What it is | What it gives you | Challenges |
|---|---|---|---|
| MODIS | Camera with 36 colour bands on the Terra (1999) and Aqua (2002) satellites. Sees the whole Earth every 1 to 2 days at 250 m to 1 km. Near end of life. | Fire hotspots, vegetation greenness (NDVI), land and sea temperature, snow, clouds, smoke and dust. 25 years of history. | Fire calendar, Field Shift, Trend Detective |
| VIIRS | MODIS's successor on Suomi NPP (2011), NOAA-20 and NOAA-21. Sharper (375 m for fire). | Same kinds of products, finer detail; night lights ("Black Marble"). | Fire calendar |
| FIRMS | NASA's fire service built on MODIS and VIIRS. | Every detected hotspot as a point: location, time, brightness, confidence. CSV download and an API with a free key. Near real time plus full archive. | Fire calendar |
| NISAR | NASA and India's radar satellite (launched 2025). Radar sees through cloud and at night. | Images every 12 days showing surface change: floods, deforestation, ground sinking, earthquakes, ice movement, down to centimetres. | Dancing with the SARs |
| Landsat | The longest Earth image record (since 1972), 30 m. | True-colour and infrared images; land use change over 50 years. | Field Shift |
| SMAP | Soil moisture satellite. | How wet the top soil is, every 2 to 3 days, about 9 km. | Field Shift |
| ECOSTRESS | Heat camera on the Space Station, about 70 m. | Plant stress and water use (evapotranspiration), surface temperature by time of day. | Field Shift |
| GPM / IMERG | Global rain measurement. | Rain and snow every 30 minutes, about 10 km, since 2000. | Field Shift, Trend Detective |
| GRACE / GRACE-FO | Twin satellites that measure gravity changes. | Monthly change in water stored underground and in ice, coarse (about 300 km). Shows aquifers draining. | Field Shift |
| SRTM | Shuttle radar mission (2000). | Elevation of most of Earth at 30 m. | Field Shift, Earth analogs |
| GEDI | Laser on the Space Station. | Forest height and biomass. | Field Shift |
| OMI | Instrument on the Aura satellite. | Ozone and air pollution (NO2) since 2004. | Trend Detective |
| AIRS | Instrument on Aqua. | Air temperature and humidity at different heights, since 2002. | Trend Detective |
| NASA POWER | Ready-made weather and sunlight data for farming and energy. | Daily temperature, rain, sun, wind for any point since 1981. Simple API. | Field Shift |
| MERRA-2 | NASA's model of the whole atmosphere since 1980, filled in with observations. | Hundreds of variables, hourly, about 50 km grid. Ideal for long trends. | Trend Detective |
| GLDAS | NASA's land model. | Soil moisture, runoff, evaporation, snow, since 1948/2000. | Trend Detective |
| Giovanni (likely) | NASA's web tool for time series and maps from these datasets. The page says "data sites offer tools that generate time series". | Quick charts and downloads without processing raw files. | Trend Detective |
| CUAHSI / HydroShare | University water-science consortium. | Tools and datasets for plotting hydrology. | Trend Detective |
| Earth Information Center (EIC) | NASA's public Earth exhibit and site (earth.gov), made with the Scientific Visualization Studio. | Finished visualisations and animations: temperature, sea level, ice, ocean currents, fires. | Earth Jukebox |

## Moon

| Name | What it is | What it gives you | Challenges |
|---|---|---|---|
| LOLA | Laser altimeter on the Lunar Reconnaissance Orbiter (since 2009). | Elevation maps of the Moon, very detailed at the poles (down to a few metres). This is what you'd build 3D terrain from. | Lunar Landing Site Navigator, Moon analogs |
| LROC / Quickmap | LRO's camera and its web map. | Images down to 0.5 m: you can see Apollo landers and rover tracks. Layers for slope, lighting, temperature. | Lunar Navigator, Abandoned equipment |
| Moon Trek | JPL's 3D web viewer for the Moon. | Layered maps you can explore and export. | Lunar Navigator |
| JPL Horizons | JPL's position calculator for every body in the solar system. | Where the Sun and Earth are in the sky from any spot on the Moon at any time. Has an API. | Lunar Navigator |
| CLPS | NASA's commercial Moon lander programme. | List of past and planned landing sites (south pole targets). | Lunar Navigator |

## Mars

| Name | What it is | What it gives you | Challenges |
|---|---|---|---|
| Mars Trek | JPL's 3D web viewer for Mars. | Global layered maps: images, elevation, minerals, temperature. | Martian Map, Mars analogs |
| USGS-NASA geologic maps | Official geologic maps of Mars and the Moon. | Rock units, ages, features as GIS layers. | Martian Map, analogs |
| Rover images (likely) | Curiosity and Perseverance raw images, published daily. | Ground-level photos of the terrain, for point-of-view views. | Martian Map, Abandoned equipment |
| Orbiter data (likely) | HiRISE (25 cm images), CTX, MOLA (elevation), CRISM (minerals), THEMIS (heat). | Detailed terrain, rock types, slopes for route planning. | Martian Map, analogs |
| Radiation / weather (likely) | Curiosity's RAD radiation and REMS/MEDA weather sensors. | Surface radiation dose and weather. | Martian Map, Junior Astronaut |

## Space weather, astronauts, experiments

| Name | What it is | What it gives you | Challenges |
|---|---|---|---|
| DONKI | NASA's space weather database. | Solar flares, solar storms (CMEs), radiation events, geomagnetic storms, with dates and strength. Free API at api.nasa.gov. | Junior Astronaut, Martian Map |
| OSDR | NASA Open Science Data Repository. | Results of biology and astronaut-health experiments in space (radiation, bone loss, plants grown in space). | Junior Astronaut, Health Monitoring |
| Human Research Program | NASA's programme on astronaut health risks. | The five hazards of spaceflight and evidence reports on each health risk. | Health Monitoring |
| PSI database | NASA Physical Sciences Informatics. | Data files from Space Station experiments, including the combustion ones (BASS, SAFFIRE, FLEX, ACME, SAME). | Flame in Freefall |

## Sky and astronomy

| Name | What it is | What it gives you | Challenges |
|---|---|---|---|
| SPHEREx | NASA telescope (2025) mapping the whole sky every 6 months in 102 infrared colours. Data at IRSA (Caltech). | Images of over a billion objects, each patch photographed several times. Spectra per pixel. | Planet X |
| WISE / NEOWISE | NASA's earlier infrared all-sky survey. | Older infrared images to compare against. | Planet X |
| Gaia | ESA's star-mapping mission. | Precise positions and motions of almost 2 billion stars. Licence caution for commercial use. | Planet X |
| Aladin | Sky atlas viewer from the Strasbourg data centre (CDS). | Embeddable zoomable sky with overlays from many surveys. | Planet X |
| Astropy | Python astronomy library (the page misspells it "Astrophy"). | Coordinates, FITS image files, units. | Planet X |
| Backyard Worlds | Citizen-science project. | Model for "flip between images to spot moving objects". | Planet X |

## Not named, but likely in the resources

- Abandoned equipment: NASA's mission archive (NSSDCA) and LRO photos of landing sites.
- Moon base analogs: data from partner agencies (ESA, JAXA, ISRO, CONAE and others).
- Health Monitoring: data from other space agencies on spaceflight health.
- Space Mission Design Game: no data required; real launcher, orbit and instrument specs would add credibility.
- Junior Astronaut: Artemis and Mars surface environment data.
