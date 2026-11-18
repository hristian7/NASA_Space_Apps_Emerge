# Emerge as a startup: Lean Canvas and business research

Started 18 Nov 2026, after Emerge took **2nd place at the Sofia local round** of NASA Space Apps 2026 `[V]`. Source: the organiser's email (week of 16 Nov), which also invited the team to the local Startup award.

This folder holds **only business research**: who pays, why, how much, against whom. The product and model live in [`../specs/`](../specs/), [`../docs/`](../docs/) and [`../pipeline/`](../pipeline/).

**This repo is public.** Team members' personal details and the organiser's name are kept out on purpose; a private copy of the full application lives outside the repo, in the owner's workspace folder `startup/`, which is not in git.

Tags: `[V]` verified at a primary source · `[D]` directional (secondary source or press) · `[U]` our estimate or inference. Raw numbers with links are in [`evidence.csv`](evidence.csv).

## The canvas on one page (state on 18 Nov 2026)

| Block | In one line | Detail |
|---|---|---|
| **Problem** | Fire crews can't see where fire will start tomorrow; the satellite fire record is split; data sits on about 10 websites | [problem](problem/README.md) |
| **Customer segments** | Electric utilities, insurers, governments and fire services, forest-carbon projects. Fire services get a free tier | [customer-segments](customer-segments/README.md) |
| **Unique value proposition** | "Fire data in one place, plus tomorrow's fire risk" | [unique-value-proposition](unique-value-proposition/README.md) |
| **Solution** | One fair 25-year fire record plus our own next-day fire model. It catches 21.4% of new fires in its top 5 spots per region, against 11.5% for NASA's fire-weather index `[V]` | [solution](solution/README.md) |
| **Channels** | Not tested yet: direct sales to utility wildfire teams, insurer data marketplaces, government tenders | [channels](channels/README.md) |
| **Revenue streams** | Annual licences, €5k to €250k by segment `[U]`. Reachable market about €54M a year `[U]` | [revenue-streams](revenue-streams/README.md) |
| **Cost structure** | Near zero today; data free for commercial use except one weather licence | [cost-structure](cost-structure/README.md) |
| **Key metrics** | Forecast skill against fair baselines, then paid pilots and revenue | [key-metrics](key-metrics/README.md) |
| **Unfair advantage** | None proven yet. The data is public and copyable; our edge is cost, speed and the buyers incumbents skip | [unfair-advantage](unfair-advantage/README.md) |
| **Competition** | Technosylva is closest. No competitor publishes comparable accuracy | [competition](competition/README.md) |
| **Team** | Roles and gaps only (privacy) | [team](team/README.md) |

## Other files

- **[`applications/2026-11-18-sofia-startup-award.md`](applications/2026-11-18-sofia-startup-award.md):** the five YC-style questions and our final answers.
- **[`decision-log.md`](decision-log.md):** business decisions, corrections and dead ends. Read it before reusing any number from older drafts.
- **[`evidence.csv`](evidence.csv):** every number used here, with its source and tag.

## Open questions, in order

1. **Will customers pay?** Not tested yet. Next step: 20 interviews with utilities, insurers and fire services in Spain, Portugal, Greece and Australia, aiming for 3 paid pilots `[U]`.
2. **Are we better than competitors?** Unknown, because they publish no accuracy. Run the European weather centre's (ECMWF) free fire model on our 2026 test days ([competition](competition/README.md)).
3. **Our exact precision score (PR-AUC):** not computed. The script is ready, but the data is on the machine that ran model v3 ([key-metrics](key-metrics/README.md)).
4. **Licences:** three data sources must change before we sell ([cost-structure](cost-structure/README.md)).
