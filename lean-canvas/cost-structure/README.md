# Cost structure

Updated 18 Nov 2026.

## Today

**Near zero.** We run on subscriptions the founders already have for other work: two AI coding assistant plans at $200 a month each, and a Vercel Pro account, as reported by the owner `[U]`. The data is free. The model is LightGBM, which trains on ordinary computers; no GPUs are needed today `[V]` (no GPU code in `pipeline/risk/`).

**At market rates,** two founders at about €5k a month each plus tools come to about €10.5k a month `[U]`.

## Later

- **People:** salaries, including Earth-observation and machine-learning hires.
- **Compute:** AI tools, cloud computing, and GPUs if we move to finer grids or deep-learning models.
- **Licences:** one paid weather licence (below).

## Data licences for commercial use (checked 18 Nov 2026)

| Source | Commercial use | Conditions | Tag |
|---|---|---|---|
| NASA (FIRMS, GIBS, POWER, SEDAC GPW, GFWED) | Yes | Free and open; cite and acknowledge NASA; don't imply endorsement | `[V]` |
| NOAA GFS | Yes | US government data; cite NOAA/NCEP | `[D]` |
| EFFIS / GWIS (Copernicus) | Yes | CC BY 4.0; credit © European Union | `[V]` |
| JRC GHSL, ESA WorldCover | Yes | CC BY 4.0, with credit | `[D]` / `[V]` |
| GRIP4 roads | Yes | CC0 | `[V]` |
| Natural Earth | Yes | Public domain | `[D]` |
| OpenStreetMap (OpenFreeMap tiles) | Yes | ODbL: credit OSM. Share-alike applies to derived databases, not to a base map | `[V]` |
| **Open-Meteo** | **No, on the free tier** | The free API is non-commercial only; paid plans (Standard, Professional, Enterprise) give a commercial licence. Price not read: the page loads it by script | `[V]` |
| **MCD12Q1 mosaic on Zenodo** (record 8367523) | Yes, but share-alike | CC BY-SA 4.0 | `[V]` |
| **Public Photon geocoder** | Not safely | "Be fair" use, throttling and no guarantee; self-host instead | `[V]` |

**Three changes before we sell:**
1. **Open-Meteo:** buy a commercial plan, or switch to NOAA GFS directly.
2. **Land cover:** replace the Zenodo copy with NASA's original MCD12Q1 from LP DAAC.
3. **Place search:** self-host Photon or use a paid geocoder.
