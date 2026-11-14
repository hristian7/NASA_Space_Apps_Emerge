# References: every outside resource we use

For the "References" field of the NASA submission. **Add a row the first time a resource is used**, in the same commit. Research sources behind the conversion method are listed in [`conversion-plan.md`](conversion-plan.md), section 10.

## Data

| Resource | Used for | Link | Licence or terms |
|---|---|---|---|
| NASA FIRMS yearly country files: MODIS Collection 6.1 (Terra, Aqua), VIIRS 375 m (S-NPP, NOAA-20) | All fire detections, 2000 to 2025 | https://firms.modaps.eosdis.nasa.gov/data/country/ | NASA open data |
| Natural Earth admin-0 country borders | Country outlines in the preview | https://www.naturalearthdata.com/ | Public domain |
| NASA challenge page | Challenge text | https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/ | Public |

## Software

| Resource | Used for | Link | Licence |
|---|---|---|---|
| DuckDB | Pipeline: cleaning and counting | https://duckdb.org | MIT |
| Python with pandas, NumPy, PyArrow, scikit-learn, LightGBM, SciPy, pytest | Pipeline: models, scoring, tests | https://www.python.org | BSD / MIT / Apache-2.0 / PSF |
| MapLibre GL JS | Map and globe in the preview | https://maplibre.org | BSD-3-Clause |

## Licence text

| Resource | Used for | Link |
|---|---|---|
| Apache License 2.0 | This repo's `LICENSE` | https://www.apache.org/licenses/LICENSE-2.0 |
