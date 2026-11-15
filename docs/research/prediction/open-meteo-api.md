# Open-Meteo ECMWF API — detailed research notes

Source: https://open-meteo.com/en/docs/ecmwf-api
Researched 2026-11-15. Tags: `[V]` confirmed at source · `[D]` directional · `[U]` our inference.

## What it is

Open-Meteo is a free (non-commercial), open-source weather API that exposes ECMWF IFS (Integrated Forecast System) forecasts via a simple REST endpoint with no authentication. The ECMWF model runs at ~9 km resolution (0.1°) globally.

This source **directly closes the "optional raw weather" gap** in our spec section 5.2, which currently reads:
> "Optionally (if spike (a) finds a compatible free source): raw temperature and wind speed in real units"

Open-Meteo is that source. It also provides `lightning_density` which is not in any other free daily source we identified.

## API endpoint

```
GET https://api.open-meteo.com/v1/ecmwf
  ?latitude=42.15
  &longitude=23.45
  &hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,lightning_density
  &forecast_days=3
  &past_days=7
  &format=json
```

No API key required `[V]`. The response is a JSON object with `hourly` time series arrays.

## Variables confirmed available for our pipeline

| Variable name | Units | What it gives us | Maps to spec input |
|---|---|---|---|
| `temperature_2m_max` | °C | Daily max air temp (compute from hourly) | `t_max_c` |
| `relative_humidity_2m_min` | % | Daily min RH (compute from hourly) | `rh_min` |
| `wind_speed_10m_max` | km/h | Daily max wind speed | `wind_max_kmh` |
| `wind_direction_10m_dominant` | degrees | Wind direction at peak speed | `wind_dir_deg` |
| `lightning_density` | flashes/km²/day | Daily lightning activity | NEW input |
| `soil_moisture_0_to_7cm` | m³/m³ | Top-layer soil moisture | supplements DC |
| `precipitation` | mm | Daily rainfall | part of FWI computation |

All of the above are confirmed accessible via the endpoint on 2026-11-15 `[V]`.

## Historical data

Open-Meteo provides historical ECMWF data via a separate endpoint:

```
GET https://archive-api.open-meteo.com/v1/archive
  ?latitude=42.15
  &longitude=23.45
  &start_date=2021-01-01
  &end_date=2025-12-31
  &daily=temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,...
```

This uses ERA5-Land reanalysis (not forecast) data. Coverage: 1940–present at 0.1° `[V]`. This means we can fetch the training-year inputs (2021–2023) and test-year inputs (2025) from the same source, consistently.

**Important:** The historical endpoint uses ERA5-Land (observed reanalysis) while the forecast endpoint uses ECMWF IFS (model output). For the live daily prediction run, we use the forecast endpoint; for training, we use the historical endpoint. These are slightly different products — this should be noted in `PROTOCOL.md` as an acknowledged inconsistency.

## How to use in build_inputs.py

For the daily live run (predict day D):

```python
import requests, datetime

def fetch_open_meteo(lat: float, lon: float, target_date: str) -> dict:
    """Fetch Open-Meteo variables for a single lat/lon and date."""
    # target_date: YYYY-MM-DD, the day we are predicting (D)
    # We want D-1 actuals and D forecast
    url = "https://api.open-meteo.com/v1/ecmwf"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "temperature_2m", "relative_humidity_2m",
            "wind_speed_10m", "wind_direction_10m",
            "lightning_density", "soil_moisture_0_to_7cm",
        ]),
        "forecast_days": 2,  # includes D-1 observed + D forecast
        "format": "json",
    }
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json()
```

**Practical note for batch use:** Open-Meteo allows up to 10,000 requests per day on the free tier `[V]`. At 0.25° grid there are ~60,000 land cells — too many to query individually. The approach is:
1. Download on a 0.25° or 0.5° grid using the `/v1/ecmwf` `&models=ecmwf_ifs025` endpoint
2. Or accept that Open-Meteo is used only for Bulgaria + a few demo regions, and use GFWED for the rest

For the demo (Bulgaria only), individual spot queries will work within the free-tier limit.

## Lightning density: the new input

The `lightning_density` variable (flashes per km² per day) is unique — no other free daily source provides this at 0.25° globally. Its use in our pipeline:

1. **Stage 1 filter (condition F6):** If `lightning_density > 0.01 flashes/km²/day` for a spot on day D-1, flag the spot as a candidate regardless of FWI threshold.
2. **Stage 2 model input:** Include raw `lightning_density` as a continuous feature. The model learns whether lightning risk is higher when FWI is also elevated (interaction).
3. **`why` phrase:** If `lightning_density` is in the top contributing inputs for a spot, add `"lightning_risk"` to the `why` array.

The 0.01 threshold `[U]` should be pre-registered in `PROTOCOL.md` before any test run.

## Licence

Open-Meteo is open source (AGPLv3 `[V]`). Free for non-commercial use. The underlying ECMWF data is released under CC-BY-4.0 `[V]` (ECMWF Open Data licence), so our derivative model outputs can be included in the Apache-2.0 repo without licence conflict.

## Limitations

- **Rate limits:** 10,000 requests/day on free tier. Batch queries for 60,000 world cells are impractical without the commercial plan. **Mitigation:** use GFWED for FWI components (already planned); only add temperature/humidity/wind/lightning from Open-Meteo for the initial demo regions (Bulgaria, USA).
- **Forecast vs reanalysis inconsistency:** Live runs use ECMWF IFS forecast; training uses ERA5-Land reanalysis. Wind speed and temperature are comparable, but lightning density may have systematic differences. Document in `PROTOCOL.md`.
- **Resolution:** 0.1°/0.25° — coarser than our eventual 0.1° spot grid. For now, the nearest 0.25° Open-Meteo cell is assigned to all 0.1° spots within it.
- **Historical lightning:** ERA5-Land does not include lightning. For training data, the `lightning_density` feature will be null for 2021–2023 training years and only available for live runs. **Consequence:** the logistic model is trained without lightning density and must treat it as a test-time-only enhancement via the Stage 1 filter (F6).

## Related source: ECMWF Open Data (#11)

ECMWF also publishes raw GRIB files at 0.25° for the last 2–3 days free via Python client (`ecmwf-opendata` package). This is more work to process than Open-Meteo's JSON API but gives more variables. For our overnight build, Open-Meteo is the faster path.
