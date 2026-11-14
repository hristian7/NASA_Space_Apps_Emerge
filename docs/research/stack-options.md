# Tech stack options for Emerge (research task 3)

Researched 2026-11-14 under a 15-minute time box. Tags: `[V]` read on the primary page or tested live on 14 Nov · `[D]` directional (secondary or not opened in full) · `[U]` our inference. Scores (1–5) are our judgement `[U]`.

**Constraints used (decided 14 Nov):** Vercel only, so no always-on VM. Data is pre-computed into small static files. The app is a 3D globe with a 2D fallback, English and Bulgarian, phones, and an installable PWA (an app people can add to the home screen). Push alerts are a Should. It must be built by AI agents in about 20 hours. No keys or tokens may be committed, and everything we submit becomes Apache-2.0.

## Summary

- **Recommended stack:**
  - **Next.js** (React framework with built-in server routes) as the app;
  - **MapLibre GL JS globe** as the map;
  - **deck.gl** layers inside it for the fire points and cells;
  - **NASA GIBS** tiles for the satellite and night looks;
  - the **GWIS WMS** for fire danger;
  - **Vercel Functions + Cron** for push alerts.
  
  None of these needs an API key `[V]`, and all are open source (BSD-3 or MIT) `[V]`.
- **The two critical facts are verified:**
  - MapLibre added the globe in **v5.0.0** (31 Dec 2024) `[V]`.
  - deck.gl **v9.1** "works seamlessly with the MapLibre v5 globe view" in all three integration modes `[V]`.
  - The deck.gl repo has a ready example: MapLibre globe plus deck.gl, interleaved `[V]`.
- **Both outside map layers work with no key, from any website:**
  - **GWIS** returned an `ecmwf.fwi` tile in EPSG:3857 (Web Mercator, the projection web maps use).
  - **GIBS** returned Blue Marble and VIIRS Black Marble tiles with no key.
  - Both send `Access-Control-Allow-Origin: *` (CORS, the header that lets a browser use another site's images in WebGL) `[V]`, tested 14 Nov.
- **Ruled out or ranked low:**
  - **Streamlit, Panel and Dash** need a long-running Python server. They also give little control over the PWA and mobile layout.
  - **A PostGIS VM** breaks the Vercel-only rule.
  - **Mapbox, Google 3D Tiles and ArcGIS** need accounts or keys, and their licences are not open source `[V]`.
- **The PWA estimate holds for "installable" (+5–10%). Push is plausible but at the low end (+25–35%)** `[U]`.
  - Push has about 7 moving parts.
  - On Vercel's free Hobby plan, a cron job can run **only once a day (±59 min)** `[V]`. So alerts become a daily check unless the team upgrades or triggers the check from elsewhere.

## Ranked table (best → worst)

Columns: **Wow** = polish and wow · **Globe** = 3D globe · **Data** = large point data · **AI** = speed of building with AI agents · **Mobile** = mobile and PWA · **Vercel** = Vercel hosting fit · **Lic** = licence and cost. Total out of 35.

**Tie-break:** Vercel + licence first (the hard constraints), then AI speed. For back ends, Wow and Globe are a neutral **3**, because they don't apply.

| Rank | Option | Layer | Wow | Globe | Data | AI | Mobile | Vercel | Lic | Total | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **deck.gl** (layers on the MapLibre globe; GlobeView alone) | Data layers | 5 | 4 | 5 | 4 | 4 | 5 | 5 | **32** | GPU drawing for hundreds of thousands of points. Works on the MapLibre globe since v9.1 `[V]`. Use it for fires and cells |
| 2 | **MapLibre GL JS** globe projection | Globe/map | 4 | 4 | 3 | 5 | 5 | 5 | 5 | **31** | Free, no token, one library for both globe and 2D, loads WMS/WMTS tiles. The base map |
| 3 | **Next.js** | Framework | 4 | 4 | 4 | 4 | 5 | 5 | 5 | **31** | Vercel's own framework. Official PWA and Web Push guide `[V]`. The map must be a client-only component |
| 4 | **Vite + React** | Framework | 4 | 4 | 4 | 5 | 5 | 4 | 5 | **31** | Simplest for a WebGL single-page app, and vite-plugin-pwa does the PWA `[V]`. Vercel advises adding Nitro for server functions `[V]`, which costs a little extra for push |
| 5 | **Vercel serverless functions** | Back end | 3 | 3 | 3 | 5 | 5 | 5 | 5 | **29** | Needed only for push (subscribe and send). Hobby cron runs once a day `[V]` |
| 6 | **Globe.gl** (three.js) | Globe/map | 5 | 4 | 3 | 4 | 3 | 5 | 5 | **29** | Beautiful and quick. But there is no WMS/tile basemap out of the box `[U]`, and no 2D fallback |
| 7 | **SvelteKit** | Framework | 4 | 4 | 4 | 3 | 4 | 5 | 5 | **29** | Fine technically. Fewer map wrappers and less agent fluency than React `[U]` |
| 8 | **Mapbox GL JS** globe | Globe/map | 5 | 5 | 3 | 5 | 5 | 5 | 1 | **29** | The best-looking globe, but v2+ is not open source and needs a Mapbox account `[V]` and a token |
| 9 | **CesiumJS / Resium** | Globe/map | 5 | 5 | 4 | 3 | 3 | 5 | 3 | **28** | A true 3D Earth. Heavy on phones, and its default imagery needs a Cesium ion token (free plan is "personal and non-commercial") `[V]` |
| 10 | **Kepler.gl** | Globe/map | 4 | 2 | 5 | 3 | 2 | 5 | 5 | **26** | Great for exploring data, poor as a custom app shell. Globe support not verified |
| 11 | **FastAPI** (as a Vercel Function) | Back end | 3 | 3 | 4 | 4 | 3 | 4 | 5 | **26** | Runs on Vercel as one function `[V]`. Only needed if we query data live; static files are enough |
| 12 | **ArcGIS Maps SDK for JS** | Globe/map | 4 | 5 | 4 | 3 | 3 | 5 | 2 | **26** | Strong 3D SceneView, but proprietary terms and an account or API key for basemaps `[V]` |
| 13 | **Leaflet** | Globe/map | 2 | 1 | 2 | 5 | 5 | 5 | 5 | **25** | The easiest 2D map, but no globe and slow with many points `[U]`. Not needed: MapLibre does 2D too |
| 14 | **DuckDB-WASM** | Back end (in browser) | 3 | 3 | 4 | 3 | 2 | 5 | 5 | **25** | SQL in the browser over Parquet. A large download on phones `[U]`. Overkill when files are pre-cut |
| 15 | **OpenLayers** | Globe/map | 2 | 1 | 3 | 4 | 4 | 5 | 5 | **24** | The best WMS handling, but no globe without Cesium (ol-cesium) |
| 16 | **Dash** (Plotly) | Framework | 3 | 3 | 3 | 3 | 2 | 3 | 5 | **22** | Python, but needs a server process. It might run as a Vercel Python function (not verified) |
| 17 | **Google Photorealistic 3D Tiles** | Globe/map (content) | 5 | 4 | 2 | 3 | 2 | 5 | 1 | **22** | Stunning cities, but needs an API key and billing `[V]`. Wildfires are mostly away from cities |
| 18 | **VM with PostGIS + tile server** | Back end | 3 | 3 | 5 | 2 | 3 | 1 | 4 | **21** | The most flexible, but breaks the Vercel-only rule and adds operations work |
| 19 | **Panel** (HoloViz) | Framework | 2 | 3 | 4 | 2 | 1 | 2 | 5 | **19** | Needs a Bokeh server or a slow in-browser Python export `[U]`. Weak on mobile |
| 20 | **Streamlit** | Framework | 2 | 3 | 3 | 4 | 1 | 1 | 4 | **18** | Quick for Python, but needs an always-on server with a live connection. Vercel connections close after 300 s on Hobby `[V]`. No PWA control |

## Recommended stack (one line per layer)

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js** (App Router), globe page rendered in the browser only | Built-in manifest file, official Web Push guide and zero-config deploys on Vercel `[V]`. Push needs server routes, which Next.js has natively. **Fallback:** Vite + React if push (S11) is cut |
| Globe and 2D map | **MapLibre GL JS v6** (latest 6.18.0, BSD-3) `[V]`, globe projection, wrapped with react-map-gl (MIT) `[V]` | One library for both globe and flat map. No token |
| Fire points and cells | **deck.gl 9.4** via `@deck.gl/maplibre`, interleaved (deck.gl draws inside the MapLibre scene) `[V]` | Fast GPU drawing, glow and size effects (S9), click-to-pick for fact cards |
| Map looks | **NASA GIBS** WMTS (pre-cut tiles): `BlueMarble_ShadedRelief_Bathymetry` (satellite) and `VIIRS_Black_Marble` (night) `[V]`. "Plain" = a dark background plus our own country outlines `[U]` | No key and CORS-enabled `[V]`. GIBS asks for an acknowledgement line `[V]` |
| Fire danger | **GWIS WMS** layer `ecmwf.fwi` as a MapLibre raster source in EPSG:3857 `[V]` | Official source. No key, "Fees none", CORS `*` `[V]` |
| Data | Pre-computed static files from the Python + DuckDB pipeline, served from Vercel's CDN. Format is task 2's call | No live processing. Fast first load |
| Back end | **Vercel Functions** (subscribe, unsubscribe, send) + **Vercel Cron** + `web-push` (MPL-2.0) `[V]` + a small store for subscriptions `[U]` | The only server work. Keys go in Vercel environment variables, never in git |
| PWA | Next.js `app/manifest.ts` plus a hand-written service worker. Serwist (MIT) only if offline caching is wanted `[V]` | Small and documented |
| Other pieces `[U]` | Bilingual text: react-i18next or next-intl · bottom sheet: a small sheet component · fire calendar: a CSS grid or nivo HeatMap (MIT `[V]`) | All need no keys. Licences of the i18n and sheet libraries not checked |

**Navigation pattern in this stack `[U]`:**
- a full-screen MapLibre globe on a dark background;
- a React side panel (a bottom sheet under about 768 px wide) with switches that toggle the deck.gl and raster layers;
- the map-look switcher swaps the GIBS raster source;
- tapping a mark uses deck.gl picking (finding the object under the finger) to open the fact card.

## Keys, tokens and licences

| Option | Key or token needed? | Licence |
|---|---|---|
| MapLibre GL JS | No | BSD-3-Clause `[V]` |
| deck.gl / react-map-gl / Globe.gl / Kepler.gl | No (Kepler's default basemap not checked) | MIT `[V]` |
| CesiumJS | The library, no. Default ion imagery and terrain, yes (an ion access token) `[V]`. Can be avoided with GIBS imagery `[U]` | Apache-2.0 `[V]`. Ion Community plan: "personal and non-commercial", 15 GB streaming a month `[V]` |
| Mapbox GL JS v2+ | Yes: a Mapbox account (and a token) | Mapbox Terms of Service, "for use only with the relevant Mapbox product(s)". v1.13 and older are BSD-3 `[V]` |
| Google Photorealistic 3D Tiles | Yes: an API key and a billing account | Google Maps Platform terms. The renderer must show attribution `[V]` |
| ArcGIS Maps SDK for JS | Yes, for location services such as basemaps (account or API key) | Product-specific terms of use. Location Platform is pay-as-you-go `[V]` |
| OpenLayers / Leaflet | No | BSD-2-Clause `[V]` |
| NASA GIBS tiles | No (none mentioned in the docs, and our requests worked without one) | NASA open data. An acknowledgement is requested `[V]` |
| GWIS WMS | No | The GetCapabilities file (the service's self-description) says "Fees none, AccessConstraints None" `[V]`. The full Copernicus licence text was not opened |

## Starter repos

Last activity and licence come from the GitHub API on 14 Nov `[V]`.

| Repo / example | What it gives us | Licence | Last push |
|---|---|---|---|
| [visgl/deck.gl `examples/website/maplibre`](https://github.com/visgl/deck.gl/tree/master/examples/website/maplibre) | **The exact pattern:** MapLibre `projection="globe"` plus `MapLibreOverlay` with `interleaved` (in `app.tsx`) `[V]` | MIT | 2026-11-14 |
| [maplibre/maplibre-gl-js `test/examples`](https://github.com/maplibre/maplibre-gl-js/tree/main/test/examples) | Globe examples: `display-a-globe-with-an-atmosphere.html`, `add-a-custom-layer-with-tiles-to-a-globe.html`, `create-a-heatmap-layer-on-a-globe-with-terrain-elevation.html` `[V]` | BSD-3-Clause | 2026-11-13 |
| A small FIRMS + fire-weather app (found on GitHub; link left out because the repo name is a personal username) | **Next.js + maplibre-gl** `[V]`. Reference only, not a base | MIT | 2026-09-26 |
| A small "every fire on a dark globe" app (found on GitHub; link left out for the same reason) | three.js, set up for Vercel `[V]`. Visual reference only | MIT | 2026-08-02 |
| [nasa-gibs/gibs-web-examples](https://github.com/nasa-gibs/gibs-web-examples) | GIBS client examples (which libraries are covered was not checked) | Not stated by the API: check before copying | 2026-11-09 |
| [plouc/nivo](https://github.com/plouc/nivo) (HeatMap) · [wa0x6e/cal-heatmap](https://github.com/wa0x6e/cal-heatmap) | Fire calendar. nivo HeatMap suits a years × months grid. cal-heatmap is day-based | MIT · MIT | 2026-07-21 · 2026-11-11 |

## PWA estimate check

**Installable (+5–10%): supported.** The verified requirements are small:
- a manifest with name, icons (192 px and 512 px) and `display: standalone`;
- a service worker (a background script for caching and push);
- HTTPS.

Both vite-plugin-pwa and Next.js's built-in `app/manifest.ts` cover this `[V]` ([vite-pwa](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html), [Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)). The estimate itself stays `[U]`.

**Risk:** cache only the app shell, not the data files, or users may see stale data `[U]`.

**With push (+25–35%): plausible but on the low side `[U]`.** No source measures it. The verified moving parts are:
1. **VAPID keys:** a key pair that identifies our server to push services. They go in environment variables `[V]`.
2. **A push handler** in the service worker `[V]`.
3. **A subscribe button.** iOS asks permission only "in response to direct user interaction" `[V]`.
4. **An "Add to Home Screen" hint for iPhones.** Push works only for home-screen web apps on iOS/iPadOS 16.4+, and the manifest must set `display` to standalone or fullscreen `[V]`.
5. **A database for subscriptions.** The Next.js guide says production needs one `[V]`.
6. **A sender function** using `web-push` `[V]`.
7. **A scheduled check.** On Hobby, Vercel Cron runs at most once a day, ±59 min `[V]`.

Add the alert rule (risk near the saved place) and testing on a real iPhone. **Suggestion `[U]`:** plan about 4–5 hours, and ship push as a "daily risk digest".

## Verified facts (with links)

1. **MapLibre globe:** release v5.0.0 lists "Support globe mode", "New GlobeControl" and an atmosphere option `[V]`. [GitHub release v5.0.0](https://github.com/maplibre/maplibre-gl-js/releases/tag/v5.0.0)
   - Published 2024-12-31. The latest is 6.18.0 (2026-11-11), BSD-3-Clause `[V]`. [npm registry](https://registry.npmjs.org/maplibre-gl)
2. **deck.gl on the MapLibre globe:**
   - v9.1 (published 2025-01-21 `[V]`, npm) says it "works seamlessly with the MapLibre v5 globe view" "for all three Basemap Integration Modes", and "MapboxOverlay works with maplibre-gl globe map without additional configuration" `[V]`.
   - v9.4's `@deck.gl/maplibre` supports "overlaid and interleaved rendering with MapLibre GL JS v4, v5, and the recently released v6" `[V]`.
   - The changelog calls GlobeView "experimental" up to v9.1. Its status in v9.4 is unclear.
   - Source: [deck.gl What's New](https://deck.gl/docs/whats-new). Example: [app.tsx](https://github.com/visgl/deck.gl/blob/master/examples/website/maplibre/app.tsx)
3. **Mapbox GL JS v2+:** licensed under the Mapbox Terms of Service, "for use only with the relevant Mapbox product(s)". The licence ends without a Mapbox account in good standing. v1.13 and earlier are BSD-3 `[V]`. [LICENSE.txt](https://github.com/mapbox/mapbox-gl-js/blob/main/LICENSE.txt)
4. **Cesium:**
   - The quickstart has you insert a Cesium ion access token `[V]`. [Quickstart](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/)
   - The ion Community plan is for "personal and non-commercial use": 15 GB streaming a month, 1,000 Google 3D Tiles root tiles `[V]`. [Pricing](https://cesium.com/platform/cesium-ion/pricing/)
   - CesiumJS is Apache-2.0 `[V]` (npm and GitHub API).
5. **Google Photorealistic 3D Tiles:** an API key and a billing account are needed, and the renderer must display copyright attribution `[V]`. [Docs](https://developers.google.com/maps/documentation/tile/3d-tiles)
6. **ArcGIS Maps SDK for JS:** governed by product-specific terms of use. An ArcGIS Location Platform or ArcGIS Online account is required for location services (including basemap styles). Location Platform is pay-as-you-go `[V]`. [Licensing](https://developers.arcgis.com/javascript/latest/licensing/)
7. **NASA GIBS:**
   - The docs list public EPSG:3857 WMTS at `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` and mention no key `[V]`. [Access basics](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
   - They ask users to acknowledge GIBS, with suggested wording `[V]`. [GIBS docs](https://nasa-gibs.github.io/gibs-api-docs/)
   - **Live test on 14 Nov:** with no key, `BlueMarble_ShadedRelief_Bathymetry` (JPEG) and `VIIRS_Black_Marble` (PNG, date 2016-01-01) returned HTTP 200 with `access-control-allow-origin: *` `[V]`.
8. **GWIS WMS** ([GetCapabilities](https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&request=GetCapabilities&version=1.3.0)):
   - The root layer lists EPSG:3857, which child layers inherit.
   - "Fees none, AccessConstraints None".
   - **Live test:** `GetMap` for `ecmwf.fwi` in `CRS=EPSG:3857` over Bulgaria returned a 256×256 PNG with `access-control-allow-origin: *` and a 1-hour cache `[V]`.
   - So MapLibre can use it as a raster source, using the `{bbox-epsg-3857}` URL placeholder `[D]`.
9. **vite-plugin-pwa minimum requirements:** manifest with name, description and theme colour; 192 px and 512 px icons; HTTPS; the manifest served as `application/manifest+json` `[V]`. [Guide](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html)
10. **Next.js PWA guide** `[V]`. [Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
    - **Install:** a manifest plus HTTPS.
    - **Push:** VAPID keys, `web-push`, a service worker, and a database for subscriptions in production.
    - Lists iOS 16.4+ for home-screen apps.
    - Suggests Serwist for offline.
11. **WebKit (16 Feb 2023):** Web Push works for Home Screen web apps on iOS/iPadOS 16.4 `[V]`. [WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
    - The manifest must set `display` to standalone or fullscreen.
    - The permission request must follow a user tap.
    - No Apple Developer Program membership is needed.
12. **Vercel Cron:** Hobby is limited to once per day, with timing ±59 min. Pro and Enterprise allow once per minute `[V]`. [Cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing)
13. **Vercel WebSockets:** in public beta. Connections close at the function's maximum duration, which is 300 s on Hobby `[V]`. [Guide](https://vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections)
14. **FastAPI on Vercel:** runs as a single Vercel Function, with a 500 MB bundle limit `[V]`. [Docs](https://vercel.com/docs/frameworks/backend/fastapi)
15. **Vite on Vercel:** for server functions, Vercel recommends the framework's own method or adding Nitro `[V]`. [Docs](https://vercel.com/docs/frameworks/frontend/vite)
16. **web-push licence:** MPL-2.0 (file-level copyleft). It's fine as an unmodified dependency of an Apache-2.0 project `[U]`. [npm](https://registry.npmjs.org/web-push)

## Not verified

- Whether a plain Vite project can still use a bare `api/` folder for Vercel Functions without Nitro.
- Kepler.gl globe support, and its default basemap token.
- Globe.gl support for tile or WMS layers.
- Free-tier sizes for Mapbox and ArcGIS.
- Whether Dash runs cleanly as a Vercel Python function.
- Panel's PWA options.
- Licences of Streamlit (Apache-2.0 `[D]`), Dash (MIT `[D]`), Panel (BSD-3 `[D]`), SvelteKit (MIT `[D]`), FastAPI (MIT `[D]`), react-i18next and next-intl.
- **GWIS:**
  - the full Copernicus licence text;
  - whether `GetFeatureInfo` (reading the value at a point) works for `ecmwf.fwi`, which the push alert rule would need.
  - **Note for the forecast task:** the layer's abstract says "from ECMWF reanalysis data", but its default date was 2026-11-22, 8 days ahead. Check which product it really is.
- GIBS rate limits, and the deepest zoom levels for Blue Marble and Black Marble in EPSG:3857.
- Performance numbers: how many points MapLibre alone or deck.gl can draw smoothly on a mid-range phone `[U]`.
- Vercel Hobby limits on static files and bandwidth for our data files.
- A key-free vector basemap with place names (for example OpenFreeMap).
- The PWA effort percentages: still `[U]`.
