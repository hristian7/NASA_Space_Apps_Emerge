# Emerge: feature list, suggestion 2 (M / S / C / O)

IDs reuse [`features-moscow.md`](features-moscow.md)'s numbering where a feature already exists there. Features new to this suggestion get a new number, continuing that file's sequence (M16+, since it ends at M15).

## Core

| # | Name | Description |
|---|---|---|
| M16 | Multiple base maps | 2D or 3D base map — must support different base maps (NASA, OpenStreetMap, etc.) |
| M25 | Extensible base maps | Written so that, in the future, it can support additional base maps without reworking the architecture |
| M17 | Multiple data layers | Must support multiple different types of data to be seen, used, or visualised — MODIS, VIIRS, temperature, wind, etc. |
| M26 | Extensible data layers | Written so that, in the future, it can support different data layers beyond MODIS or VIIRS without reworking the architecture |
| M18 | Point + radius / polygon data model | Two selection shapes only: point + radius (a geodesic distance filter — not a buffered circle polygon, to avoid faceting error) and polygon (an enclosed area, drawn or predefined). No separate plain-point mode: a point is point + radius with radius → 0 |
| M19 | No-data vs. zero | Difference between "nothing measured" and "no measurement made" |
| M20 | Data types on point or polygon | Each data type (fire, temperature, wind, humidity, etc.) is applied to either a point (a raw source measurement) or a polygon (an aggregated or area measurement, e.g. a grid cell or region). A single point or polygon can carry more than one data type at once (e.g. fire and temperature on the same point) |
| M8 | English and Bulgarian interface | — |
| M9 | Works on phones | — |
| M10 | Public web address | — |
| M14 | Worldwide coverage | — |
| M2 | Data pipeline: whole world | Download and process NASA fire data for the whole world before the demo, so the app shows data at once |
| M15 | Installable app (PWA) | — |
| C3 | Second source of truth | — |
| C4 | Older or more satellites | Data before 2000 or from more satellites |
| C7 | Support for different base maps | Actually offer more base maps than NASA/OpenStreetMap, not just leave room for them |
| C8 | Support for different data layers | Actually add data layers beyond MODIS or VIIRS, not just leave room for them |
| M21 | Fetch simple data | In raw or table format, or visualised on a map, from the current moment back to however many years MODIS and VIIRS go (by point or area + timeframe + visualisation) |
| M22 | Fetch complex data | In raw or table format, or visualised (same as simple data, combined) |

## Using fetched data for all of the following

| # | Name | Description |
|---|---|---|
| M11 | Export to file | Export fetched data into a file |
| M3 | Pick a country or a point | Using point + radius, or a polygon (a drawn area, or a predefined one like a country boundary) |
| M7 | Plain-language explanations | — |
| M12 | Tests on the main paths | — |
| S1 | 3D globe view | A spinning Earth with fires and risk zones on it; the 2D map stays as the fast fallback |
| S3 | Fire-risk outlook | Official forecasts |
| S5 | Recent fires | Last 24h / 7 days of NASA detections |
| S6 | Hazard-style navigation | A compact layer menu over a full-screen globe |
| S8 | Advice for crews and volunteers | — |
| S9 | Fire-intensity visuals | — |
| S10 | Shareable links | — |
| S11 | Push alerts | For people in danger areas (was Could have; moved up by the team on 14 Nov) |
| C2 | Our own forecast model | — |
| C5 | Time-lapse animation | — |
| C6 | Bulgarian regions view | Statistics per Bulgarian province (oblast), for local crews |
| M23 | Statistics and visualisation | Group heading |
| M1 | ↳ Harmonized fire history | — |
| M4 | ↳ Fire calendar | For a point or area — raw or visualised; how much burned, statistics, graphics, etc. |
| M5 | ↳ "Is this unusual?" indicator | — |
| M13 | ↳ "Chance of fire this month" | From history |
| M24 | Verification | Group heading |
| M6 | ↳ "How we know it's right" page | — |

## Won't have

| # | Name | Description |
|---|---|---|
| W1 | User accounts and login | The team decided: out for now |
| W2 | Official warning service | We are not an emergency agency; we point to official services and say so clearly |
| W3 | Native app-store apps | The PWA covers phones without the app stores |
| W4 | Making blurry images sharp | Not needed: we convert fire counts statistically, not pictures (see interview answer E3) |
| W5 | Burned-area mapping from imagery | A different, much bigger problem |
