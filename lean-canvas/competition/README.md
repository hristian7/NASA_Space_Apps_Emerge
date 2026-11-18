# Competition

Updated 18 Nov 2026. This page covers commercial and prediction competitors. Fire-calendar and harmonization tools (FIRMS, GWIS, Greenpeace calendar) are in [`../../docs/research/competitors.md`](../../docs/research/competitors.md). Sources: [`../evidence.csv`](../evidence.csv).

## Who does what

| Company | What it sells | Size | How we differ |
|---|---|---|---|
| **Technosylva** (closest) | Fire-spread simulation and day-ahead fire risk for utilities and agencies | Founded 1997; offices in La Jolla and León (Spain); TA Associates growth investment (2023); bought KatRisk (2024) `[V]`. Customers include PG&E, SCE, SDG&E, PacifiCorp and CAL FIRE `[V]`, plus Castilla-La Mancha and Andalusia `[D]`. No prices public | Far cheaper and lighter, global from day one, with a 25-year history. Aimed at smaller buyers they don't serve |
| **OroraTech** | Fire *detection* from its own 20 satellites; spread, burnt area; short-term hazard forecast still a pilot `[V]` | €37M Series B (2025) `[V]`; Greece €20M satellite deal `[D]`; revenue over $3M (2023) `[D]` | We predict before ignition, using free NASA and ESA data. A possible partner or data source |
| **Pano AI** | Cameras on towers that spot smoke after a fire starts | $89M raised as of Jun 2025 `[D]`; about $50k per camera a year (AP estimate) `[D]` | We act a day earlier. A different business (detection) |
| **Moody's RMS, Verisk, KatRisk** | Long-term catastrophe models for insurers (annual loss, not daily) | Wildfire models for the US (Moody's also Canada and Australia) `[V/D]` | We have a 25-year history covering Europe too |
| **Skyblu (via Addresscloud), Guy Carpenter** | European wildfire hazard scores for insurers | Skyblu is pan-European, 20 m, launched May 2026 `[D]` | Direct competitors in European insurance. Their accuracy (AUC 0.9) is the vendor's own claim |
| **Overstory, ZestyAI, Vibrant Planet** | Vegetation and risk for utilities, property risk, forest planning | Overstory $43M Series B (Nov 2025) `[V]` | Shows that investors fund this space |
| **EFFIS / GWIS** (EU, free) | Fire-danger maps from weather; statistics | Free, data CC BY 4.0, reusable commercially `[V]` | We also use where fires actually start; 1.9× better than the weather index `[V]` |

## Owning satellites

**Satellites help *spot* fires faster.** Predicting tomorrow's fires runs on public data (weather, vegetation, fire history), so no satellite is needed. OroraTech's edge is detection, not prediction `[U]`.

## Can a competitor copy us?

**Yes.** The data is free, and Technosylva could rebuild the method. The data is not a moat; a16z argues "data moats" rarely hold `[D]`. Our edge, which is still unproven:
1. **Cost and speed:** a small AI-native team on free data can price at a fraction.
2. **Buyers incumbents skip:** rural co-ops, small municipal utilities, small regions and carbon projects. Small US utilities say full fire modelling is too costly for them `[D]`; no proof yet outside the US.
3. **Advantages to build:**
   - customers' own fire and outage records feeding back into the model;
   - alerts built into their daily tools;
   - a long public track record of daily scored forecasts.

## Accuracy against competitors (final conclusion)

**No competitor publishes a comparable number,** so "better than the competition" can't be claimed. The only fair common yardstick is the **gain over the fire-weather index**:

| System | Gain over the fire-weather index | Comparable? |
|---|---|---|
| **Emerge v3** | **1.9× world, 1.3× Europe** (share of new fires in the top 5 per region, 2026) `[V]` | — |
| FireSight (OroraTech and LMU research, 2023; 0.1°, 3–7 days ahead) | PR-AUC: Australia 0.39%→3.6%, Brazil 6.24%→11.75%, Greece 0.51%→19.93% (1.9× to 39×) `[V]` | Partly: other grid, lead time and measure |
| ECMWF Probability of Fire (open source, up to 10 days, 9 km) | "Up to 30% skill gain" in press materials; no single headline score in the paper `[D]` | Partly |
| OroraTech (EGU 2026 abstract) | "Up to 30× more ignitions than FWI" `[D]` | No: method unclear |
| WISP (arXiv 2605.10298) | 54.1% of next-day clusters within 5 km; average precision 38.2% `[V]` | No: 375 m point sets |
| Mesogeos (Mediterranean) | F1 about 0.79 `[D]` | No: probably balanced samples |
| Technosylva, Pano AI, ZestyAI | Nothing published | No |

**What to say:** "On data it never saw, our model catches nearly twice as many new fires as NASA's fire-weather index. Few companies publish any accuracy figures; we do."

**To make it a head-to-head:**
1. Compute our PR-AUC ([`../key-metrics/README.md`](../key-metrics/README.md)).
2. Run ECMWF's free fire model on our 2026 test days and score it with our test. The repo already plans this as roadmap item 4.4 ([`../../docs/plans/2026-11-15-post-event-roadmap.md`](../../docs/plans/2026-11-15-post-event-roadmap.md)).
