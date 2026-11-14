# Emerge plan 2: next-day fire risk, in one page

Short version (14 Nov 2026). Build details: [`specification.md`](specification.md). Feature list: [`../features-moscow.md`](../features-moscow.md), section "Plan 2". Sources: the [firefighter interview](../../docs/research/firefighter-interview.md) and the [competitor research](../../docs/research/feature-map.md).

## The problem

Fire services decide **one day ahead** where to send teams, because weather forecasts are most accurate then. Today they open about 10 websites and still can't see where a fire is most likely tomorrow, or how accurate the forecasts are. A Bulgarian firefighter told us **prediction is the top problem**.

## Our answer

For **every region in the world**, the spots most likely to catch fire today and tomorrow, ranked, each with a plain reason, plus a public score of how often we were right. Same logic everywhere; Bulgaria is the demo. Until the engine passes its test, the app shows a clear placeholder.

## Must-haves

| Feature | What it means |
|---|---|
| **Top risk spots per region** | Any fire service opens its area and sees the places most likely to catch fire, ranked |
| **Next-day risk engine** | Scores every small square of land for tomorrow, learned from each place's seasons and past fires |
| **All the data that drives fire** | Temperature, wind, humidity, rain, plant dryness, forest or grass, 25 years of fires |
| **Scorecard** | Each day, yesterday's predictions are checked against NASA's detections and the fire-weather index |
| **"Why this spot"** | A plain reason: "very hot, strong wind, dry forest, burned in 6 of 25 Julys" |
| **One screen instead of 10 websites** | Tomorrow's danger, fires now, history and official links on one page |
| **Real official fire numbers** | Each country's own reported fires, kept apart from satellite estimates |
| **Date and source on every number** | Every result says which period it covers and where it comes from |
| **Name the comparison years** | "Is this unusual?" lists the exact past years it compared against |
| **Plain verdict on the proof page** | Two lines on top: what we tested, what passed, what failed |

## Should-haves

| Feature | What it means |
|---|---|
| **Week outlook** | The following days, marked less certain |
| **Wind on the map** | Arrows for wind strength and direction |
| **Crew suggestion** | "Consider a standby team near spot 1" |
| **Fire type label** | Forest, farmland or grass |
| **Fire heat** | How hot today's fires burn, next to past years |
| **Season-so-far chart** | This year's fires adding up against a normal year |

## How we prove it

Tested on fire seasons the engine never saw. We say "more accurate" only where we beat the fire-weather index or fire history alone, each said separately. NASA's detections are the judge, never the AI.

## How we build it fast

Develop on a coarse grid, then ship on the fine one. Score the simple baselines first, then the model. One satellite (NOAA-20) throughout. Reuse plan 1's data and screens. Build every screen on example files first.

A research prototype, not an official warning service.

## Later (recorded)

Could: a model that improves each season, sharper spots, a printable daily brief, a method sheet for fire chiefs, and the competitor research's "later" ideas. Won't for now: fire-station locations, firebreaks, web cameras, live response coordination.
