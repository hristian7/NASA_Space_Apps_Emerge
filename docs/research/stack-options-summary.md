# Tech stack options: short version

Summary of [`stack-options.md`](stack-options.md) (14 Nov 2026). Tags: `[V]` checked at the source · `[D]` directional · `[U]` our guess.

## The question

Which tools do we build the app with: a 3D globe, a 2D map, fire data, English and Bulgarian, phones, installable, push alerts, all on **Vercel only**, built by AI agents in about 20 hours?

## All 20 options, best to worst

Each scored 1–5 on seven things (looks, 3D globe, many points, quick to build, phones and installable app, fits Vercel, free and open), so the maximum is 35.

| # | Option | What it is | Score | Verdict |
|---|---|---|---|---|
| 1 | **deck.gl** | Draws many points fast | 32 | **Use** for fires and cells |
| 2 | **MapLibre** | Free globe and 2D map | 31 | **Use** as the map |
| 3 | **Next.js** | Website framework made by Vercel | 31 | **Use** for the app |
| 4 | Vite + React | Lighter website setup | 31 | Backup if push alerts are dropped |
| 5 | **Vercel functions** | Small pieces of server code | 29 | **Use** for push alerts only |
| 6 | Globe.gl | Pretty 3D globe | 29 | No 2D map, no map tiles |
| 7 | SvelteKit | Website framework | 29 | Fine, but AI agents know React better |
| 8 | Mapbox | Polished globe | 29 | Not open source; needs an account `[V]` |
| 9 | CesiumJS | Full 3D Earth | 28 | Heavy on phones; needs a key `[V]` |
| 10 | Kepler.gl | Data-exploring tool | 26 | Poor as a custom app |
| 11 | FastAPI | Python server | 26 | Not needed with ready-made files |
| 12 | ArcGIS | Esri's map tools | 26 | Paid terms, needs a key `[V]` |
| 13 | Leaflet | Simple 2D map | 25 | No globe |
| 14 | DuckDB in the browser | Database inside the phone | 25 | Too heavy for phones |
| 15 | OpenLayers | 2D map | 24 | No globe |
| 16 | Dash | Python dashboards | 22 | Needs a server |
| 17 | Google 3D Tiles | Photo-real cities | 22 | Needs a key and billing `[V]` |
| 18 | Server with PostGIS | Own map server | 21 | Breaks the Vercel-only rule |
| 19 | Panel | Python dashboards | 19 | Weak on phones |
| 20 | Streamlit | Python dashboards | 18 | Needs an always-on server |

## Recommendation

| Part | Pick | Why |
|---|---|---|
| Website | **Next.js** on Vercel | Vercel's own framework, with an official guide for installable apps and push alerts `[V]` |
| Globe and 2D map | **MapLibre** | One free library for both, no key; globe added in v5 `[V]` |
| Fire layers | **deck.gl** | Works on the MapLibre globe `[V]`; fast with many points |
| Background images | **NASA GIBS** (Blue Marble, Black Marble at night) | Free, no key `[V]`; using NASA imagery helps the "Relevance" score |
| Fire-danger layer | **Copernicus GWIS** map tiles | Free, no key, works in our map `[V]` |
| Push alerts | Vercel functions + `web-push` (open source, MPL-2.0 `[V]`) | Standard way to send phone notifications |

**Why this wins:** everything is free and open source, needs no paid keys, runs on Vercel, works on phones, and AI coding agents know these tools well. It also gives both the "wow" 3D globe and a simple 2D fallback from the same code.

## Watch out

- **Vercel's free plan runs scheduled jobs once a day** `[V]`, so push alerts need a free GitHub timer (see the push-alert summary).
- **Installable app:** about +5–10% front-end time; push alerts closer to 4–5 extra hours `[U]`.
