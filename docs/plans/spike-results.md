# Risk spikes: results

Short risk tests run before building on a technique (spec section 8, shortcut 3). Each was done by a separate agent in a scratch folder; no spike code is in the repo. Tags: `[V]` measured in the test · `[D]` directional · `[U]` our inference.

| Spike | Question | Answer |
|---|---|---|
| (a) Query function | Can a serverless function query the raw hotspots by area and date? | **Yes, with a different engine** (below) |
| (b) Drawing on the globe | Can a user draw an area on the 3D globe? | **Yes** (below) |
| (c) Layers on the globe | Do NASA, OpenStreetMap and fire-danger layers show on the globe? | **Yes, all four** (below) |
| (d) Charts as PNG | Can the calendar and charts be saved as images in the browser? | **Yes, with rules** (below) |
| (e) Land-type map | Is there a land-type and region map that needs no login? | **Yes, both exist; one licence point to decide** (below) |

## (d) Calendar and charts as PNG: works, if the code follows six rules

Tested on a 26 x 12 calendar drawn as SVG, in two headless browser engines (the Chrome engine and the Safari engine). The PNG came out at twice the SVG size (1040 x 1280 from 520 x 640 `[V]`), with correct colours and a Bulgarian title.

**A plain "copy the SVG into an image" fails:** every cell came out black `[V]`, because the copied SVG loses the page's styles.

Rules for the app code:
1. Before copying, write every colour onto the element itself as plain `rgb(...)`. Modern colour formats (`oklch`, `color-mix`) and CSS variables do not survive the copy; convert them by painting one pixel on a canvas and reading it back.
2. Remove `class` and `style` from the copy. Outside stylesheets never reach it.
3. Embed any web font inside the SVG as base64, and set the font family, size and weight as attributes. Otherwise labels fall back to a system font `[V]`.
4. Give the root SVG an explicit `xmlns`, `width` and `height`.
5. Paint a background first, or the PNG is transparent.
6. Wait for the image to decode before drawing it, then release the temporary address.

**Not tested:** a real iPhone (only the desktop build of the Safari engine), very large images (phones cap canvas size), dashed lines, fonts loaded from another site.

## (e) Land-type and region maps: both download with no login

Both files were downloaded and joined into one table on the 0.25 degree grid: 1,036,800 rows, one per cell `[V]`. The files are kept in the git-ignored `data/raw/landcover/`.

| Map | Source | Size | Licence |
|---|---|---|---|
| 14 world fire regions | GFED4.1s yearly file, layer `ancill/basis_regions`, already on the 0.25 degree grid. https://www.geo.vu.nl/~gwerf/GFED/GFED4/ | 70 MB `[V]` | No licence text found on the page `[V]`. Credit: van der Werf et al. 2017, ESSD 9, 697 |
| Land type (17 IGBP classes, year 2021) | MODIS MCD12Q1 v061 mosaic at 500 m, Zenodo record 8367523 | 133 MB `[V]` | **CC BY-SA 4.0** `[V]`: credit the source, and share anything derived from it under the same licence |

Test points `[V]`: Sofia is region 6 (Europe), class 13 (urban). Northern California (40 N, 122 W) is region 2 (temperate North America), class 10 (grassland).

**Not usable:** the reference method's own code repository lists the two masks but does not ship them `[V]`; the newer GFED5 grids and NASA's 0.05 degree land-cover file need a login `[V]`.

**Open points**
- **Licence (team decision).** The land-type file is share-alike, and the region file states no licence. If the bake-off shows that plain latitude bands are good enough, we use neither and the question disappears. If land type is needed, the derived class table stays out of the repo and both sources are credited.
- The reference method uses 16 fire land types (for example peat and deforestation). The 17 IGBP classes need a mapping to those; peat and deforestation would need their own masks.

## (b) Drawing an area on the globe: works

Tested with real mouse clicks in a headless browser on the globe view (MapLibre GL JS 6.18, Terra Draw 1.39 with its MapLibre adapter 1.5) `[V]`.
- Four clicks and a closing click gave back a finished polygon as GeoJSON `[V]`.
- Large areas draw correctly: boxes 45 and 160 degrees wide followed the sphere with no tearing `[V]`.
- No fallback to the flat map is needed.

Traps for the app code:
- MapLibre 6 has no default export: use `import * as maplibregl`.
- The map's worker file must be bundled separately and set with `setWorkerUrl`, or the map fails with "Worker failed to load".
- MapLibre rejects modern colour formats (`oklch`, `color-mix`) in map styles: use hex or `rgb`.

## (c) Layers on the globe: all four work

Every layer returned images, allowed use from another site (CORS), and showed on the globe with no errors `[V]`.

| Layer | Address that worked | Notes |
|---|---|---|
| NASA Blue Marble | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg` | 256 px tiles, zoom 0 to 8 |
| NASA Black Marble (night) | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png` | 256 px tiles, zoom 0 to 8 |
| Streets (OpenStreetMap data) | Style `https://tiles.openfreemap.org/styles/liberty` | Set the globe view after the style loads. Credit: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors (ODbL) |
| Fire danger (Copernicus GWIS) | `https://maps.effis.emergency.copernicus.eu/gwis?service=WMS&version=1.1.1&request=GetMap&layers=ecmwf.fwi&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&time=YYYY-MM-DD&bbox={bbox-epsg-3857}` | Dates from 2018 on; today's date returned data `[V]`. The older address on `ies-ows.jrc.ec.europa.eu` is broken `[V]` |
| Points on top (deck.gl 9.4) | `MapboxOverlay`, not interleaved | Four test points landed in the right places `[V]` |

**Not checked:** the exact credit wording NASA GIBS asks for; the GWIS reuse terms (its service description says no fees and no access limits `[V]`, the data policy was not read, so D-4 stays open); points on the far side of the globe; speed on a real phone.

## (a) Query function for raw hotspots: works, but not with the planned engine

Tested locally on "Bulgaria, August 2024" against the public firms-catalog files. Not deployed, so the points under "Not checked" stay open.

| | Planned: DuckDB in the function | Tested alternative: a TypeScript route with a small Parquet reader (hyparquet) |
|---|---|---|
| Time | 35 s on many cores; over 270 s on one core, stopped `[V]` | 12.7 s `[V]` |
| Data downloaded | 579 MB `[V]` | 9 MB `[V]` |
| Memory | 660 MB `[V]` | 460 MB `[V]` |
| Rows returned | 5,510 `[V]` | 5,510, identical `[V]` |
| Size of the code package | about 200 MB `[V]` | under 1 MB `[V]` |

**Why:** each year is one 1.2 GB file `[V]`. The file records which part of the world each block covers, and only 4 of its 690 blocks touch Bulgaria `[V]`. The small reader uses that and skips the rest; DuckDB does not, and downloads almost half the file. The free hosting plan gives one processor core, where DuckDB took over 4.5 minutes.

**Decision for the build:** the hotspots download is a TypeScript route in `web/src/app/api/`, not a Python function. This also settles conflict 17 in the build plan.

Rules for the route:
- Read the file's block list first, keep only blocks whose area overlaps the selection, then read those blocks.
- Dates do not narrow the search (every block spans the whole year `[V]`); filter rows by date after reading.
- One file per year: name each year's address directly.
- Send the CSV as a stream. A plain response is capped at 4.5 MB on the hosting plan and a 100,000 row CSV is about 8 MB `[D]`.
- Latitude and longitude come from the geometry column; the file has no separate columns for them `[V]`.

**Licences `[V]`:** the data is CC0-1.0 (NASA's data), the catalogue's code is Apache-2.0. This closes conflict 8 in the build plan.

**Not checked (needs a deployment):** speed on the hosting plan's single core; the worst case (one year, 200 km, up to 100,000 rows); a stream larger than 4.5 MB; caching. **Fallback** if it fails there: a small static points file for Bulgaria and the USA, as the spec says.
