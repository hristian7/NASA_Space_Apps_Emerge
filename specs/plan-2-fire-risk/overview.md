# Emerge plan 2: next-day fire risk, in one page

Short version (14 Nov 2026). Build details: [`specification.md`](specification.md). Feature list: [`../features-moscow.md`](../features-moscow.md), section "Plan 2". Where it comes from: [`../../docs/research/firefighter-interview.md`](../../docs/research/firefighter-interview.md).

## The problem

Fire services decide **one day ahead** where to send teams, because weather forecasts are most accurate then. Today they open about 10 websites and still can't see where a fire is most likely tomorrow, or how accurate the forecasts are. A Bulgarian firefighter told us **prediction is the top problem**: the closer the team, the easier the fire is to stop.

## Our answer

For **every region in the world**, the spots most likely to catch fire today and tomorrow, ranked, each with a plain reason, plus a public score of how often we were right. The logic is the same in every country; Bulgaria is the demo.

## Must-haves

| Feature | What it means |
|---|---|
| **Top risk spots per region** | Any fire service in any country opens its own area and sees the places most likely to catch fire today and tomorrow, ranked from number one down |
| **Next-day risk engine** | Gives every small square of land on Earth a fire-risk score for tomorrow, learned from that place's own seasons and past fires |
| **All the data that drives fire** | Temperature, wind, humidity, rain, how dry the plants are, forest or grass, and 25 years of past fires, for every place |
| **Scorecard** | Every day, yesterday's predictions are checked against the fires NASA satellites saw, and compared with the official fire-danger index |
| **"Why this spot"** | A short plain reason, such as "very hot, strong wind, dry forest, burned in 6 of the last 25 Julys" |
| **One screen instead of 10 websites** | Tomorrow's danger, fires now, fire history and official links on one simple page |

## Should-haves

| Feature | What it means |
|---|---|
| **Week outlook** | The next 7 days, marked as less certain than tomorrow |
| **Wind on the map** | Arrows for wind strength and direction, now and tomorrow |
| **Crew suggestion** | "Consider a standby team near spot 1": free to follow or ignore |
| **Fire type label** | Forest, farmland or grass, for every fire and risky spot |

## How it works

1. **Collect** tomorrow's fire weather, plant dryness, forest cover and fire history.
2. **Learn** from past years which conditions came before a new fire.
3. **Rank** the spots inside each region; forest counts most.
4. **Check** the next day against NASA detections.

## How we prove it

Tested on fire seasons the engine never saw. We say "more accurate" only where we beat both the official fire-danger index and fire history alone. NASA's detections are the judge, never the AI itself.

A research prototype, not an official warning service; every screen links to official services and 112.

## Later (recorded, not in this plan)

- **Could:** a model that improves each season, sharper 1–2 km spots, a printable daily brief, a method sheet for fire chiefs.
- **Won't for now:** fire-station locations, firebreak planning, web cameras, live response coordination.
