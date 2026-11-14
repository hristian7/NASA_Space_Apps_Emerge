# Emerge: feature list, suggestion 2 (M / S / C / O)

IDs reuse [`features-moscow.md`](features-moscow.md)'s numbering where a feature already exists there. Features new to this suggestion get a new number, continuing that file's sequence (M16+, since it ends at M15).

## Core

| # | Name | Description |
|---|---|---|
| M16 | Multiple base maps | 2D or 3D base map — must support different base maps (NASA, OpenStreetMap, etc.) |
| M17 | Multiple data layers | Must support multiple different types of data to be seen, used, or visualised — MODIS, VIIRS, temperature, wind, etc. |
| M18 | Point / radius / polygon data model | Data must be organised by point — single point, point + radius, or polygon (area enclosed by points). To be considered: should it be point + polygon, or point + polygon + point + radius? Also consider accuracy of measurement and accuracy of position |
| M19 | No-data vs. zero | Difference between "nothing measured" and "no measurement made" |
| M20 | Simple vs. complex data | Separation of simple data (temperature, fire occurrence, wind speed and direction, humidity) and complex data (a combination of a few simple data points for a point or area, and a timeframe) |
| M8 | English and Bulgarian interface | — |
| M9 | Works on phones | — |
| M10 | Public web address | — |
| M14 | Worldwide coverage | — |
| C3 | Second source of truth | — |
| C4 | Older or more satellites | Data before 2000 or from more satellites |
| M21 | Fetch simple data | In raw or table format, or visualised on a map, from the current moment back to however many years MODIS and VIIRS go (by point or area + timeframe + visualisation) |
| M22 | Fetch complex data | In raw or table format, or visualised (same as simple data, combined) |

## Using fetched data for all of the following

| # | Name | Description |
|---|---|---|
| M11 | Export to file | Export fetched data into a file |
| M3 | Pick a country or a point | Using a point or a polygon |
| M7 | Plain-language explanations | — |
| M12 | Tests on the main paths | — |
| S3 | Fire-risk outlook | Official forecasts |
| S8 | Advice for crews and volunteers | — |
| S9 | Fire-intensity visuals | — |
| S10 | Shareable links | — |
| S11 | Push alerts | For people in danger areas (was Could have; moved up by the team on 14 Nov) |
| C2 | Our own forecast model | — |
| C5 | Time-lapse animation | — |
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
