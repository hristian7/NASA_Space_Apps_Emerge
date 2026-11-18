# Business decision log

Decisions, corrections and dead ends from the business research, newest first. **Read this before reusing a number from an older draft.**

## 18 Nov 2026

### Decisions

- **Free tier for firefighters; paid by those carrying financial risk.** Reason: the firefighter said fire services don't pay, because EFFIS is free. Paying segments in order: utilities, then governments, then insurers (second wave), with forest-carbon projects as quick small deals ([customer segments](customer-segments/README.md)).
- **Tagline:** "Fire data in one place, plus tomorrow's fire risk" (owner's choice). It covers both data in one place and prediction.
- **Wording:** say "NASA's fire-weather index", never "NASA's prediction model". Say "tackles", not "solves".
- **Removed from the final answers by the owner:** the 1–3 year plan, grants, "publish accuracy" as a differentiator, and "nobody tells them how accurate any forecast is".
- **Team details stay out of the public repo.**

### Corrections (what we said before and what is true now)

| Earlier claim | Now | Why |
|---|---|---|
| Market "400 largest utilities and insurers × €250k = €100M" | Reachable market about €54M a year from buyer counts × price `[U]` | The old figure had no basis |
| "None of the big insurance models covers Europe" | The big model firms show US wildfire models only, but specialist European scores exist (Skyblu via Addresscloud, Guy Carpenter) `[D]` | Found in research, 18 Nov |
| "We cover Europe", as a difference from Technosylva | Dropped. Technosylva was founded in Spain (León) and serves Castilla-La Mancha and Andalusia `[D]` | |
| "One utility paid Technosylva $5.57M for one year" | Removed | The source PDF on the Utah regulator's site returns 404; not verifiable |
| "California utilities spent $40B on wildfire costs" | "...on wildfire **mitigation**, investor-owned utilities, 2019–24" `[V]` | The source covers mitigation only |
| "LA fires up to $164B" (UCLA, Feb 2025) | Use Munich Re: $53B total, about $40B insured `[V]` | UCLA revised its range to $76–131B in Mar 2025 |
| "Spain 2025 under €1bn insured" (Marsh) | About €23M insured, about 900 claims `[V]` (Howden Re) | More precise; consistent with "under €1bn" |
| "22 data sources, 11 from NASA" (15 Nov) | About 29 in use, 14 NASA (sources.ts, 18 Nov) `[V]`; say "more than 25" | Teammates added sources. The video and slides keep 22 as historical artifacts |
| "Fires are growing worldwide" | Extreme fires are growing; total burned area worldwide fell `[D]` | |
| "The USA's worst year on record" | 5th worst since 1983 (9.48M acres by 13 Nov; record 10.13M in 2015) `[V]` | |
| Model accuracy from v2 (2025 test: 20.4% vs 11.2%) | v3 (2026 test: 21.4% vs 11.5%) is now served and quoted `[V]` | Model v3 went live on 16 Nov |
| "Kettle raised $25M" (undated) | $25M Series A, Nov 2021 `[V]` | Old round; don't present it as recent |

### Dead ends and gaps

- **PR-AUC not computed:** the 2026 evaluation data (`data/derived/risk/v3/`) isn't on every computer. The script is ready ([key-metrics](key-metrics/README.md)).
- **No like-for-like competitor accuracy exists:** companies publish none, and research uses different measures ([competition](competition/README.md)).
- **Couldn't verify:**
  - Technosylva prices;
  - Pano's per-camera price (an AP estimate, no contract seen);
  - the Open-Meteo commercial price;
  - Greece's €346M prevention share and France 2026's €10–15bn (press only);
  - the roadmap's "OroraTech/LMU PR-AUC 7.8–25% across four regions". FireSight, the closest paper found, reports three regions with other values; noted in the [roadmap](../docs/plans/2026-11-15-post-event-roadmap.md).
- **Willingness to pay:** untested in every segment. No buyer has been interviewed yet.
