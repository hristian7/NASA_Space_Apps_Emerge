# Customer segments

Updated 18 Nov 2026. Every price and count is `[U]` unless tagged. Sources: [`../evidence.csv`](../evidence.csv).

**The rule that shaped this:** fire services feel the most pain but rarely pay; the firefighter interview and EFFIS being free both show it. The money is with those who carry the financial risk.

## The four segments we pitch

### 1. Electric utilities (€50–250k a year `[U]`)

**What they do with it:**
- **Daily:** choose which power lines get fast-trip settings. The line switches off instantly if a branch touches it, which prevents sparks but causes more outages.
- **Daily:** choose where to cut power before the most dangerous days (Public Safety Power Shutoffs).
- **Daily:** choose where to send patrols and crews.
- **Yearly:** use the fire history to choose where to cut trees and inspect lines first.

**Evidence they buy this:**
- PG&E switches on fast-trip settings using its Fire Potential Index, and sends daily data to Technosylva `[V]`.
- In Victoria (Australia), Powercor sets its line protection to the most sensitive mode on Total Fire Ban days `[V]`.
- Technosylva serves 25+ utilities and agencies `[D]`.

**Honest catch:** utilities work at much finer scale than our 28 km squares, so we would be an extra layer, not their main tool.

### 2. Insurers, reinsurers, specialist insurers (from €100k a year `[U]`)

**What they do with it:** price policies and limit how much risk they hold in one area, using our 25-year history.

**Europe:**
- **The big model firms** (Moody's RMS, Verisk, KatRisk) show wildfire models for the US. We found none from them for Europe `[V/D]`.
- **Specialist European scores exist:** Skyblu, via Addresscloud (pan-European, 20 m, May 2026), and a Guy Carpenter score `[D]`. So the market is open, but not empty.

**Will European insurers pay, given few insured losses so far?**
- **For:**
  - France 2026 may cost €10–15bn, much of it insured, because France's state disaster scheme excludes wildfire `[D]`.
  - Reinsurers are keeping more of each loss, so insurers absorb small wildfire losses themselves `[V]`.
  - EIOPA (the EU insurance regulator) flags the wildfire protection gap; Greece is "high" `[V]`.
- **Against:**
  - Spain 2025: about 400,000 ha burned, but only about 900 claims and about €23M insured `[V]` (Howden Re).
  - Fire is bundled into ordinary property cover.
  - Spain's public insurer (Consorcio) does not cover wildfire `[D]`.
- **Likely first payers:** specialist insurers (MGAs), parametric providers, reinsurers and brokers. Mainstream home insurers come later `[D]`.

**Recommendation:** insurers are a second-wave segment.

### 3. Governments and fire services (€20–100k per region a year `[U]`)

- **Free for firefighters:** it carries our impact and the storytelling.
- **Governments pay** for regional dashboards: where to place crews tomorrow, and which seasons are unusual.
- **Evidence governments pay for fire tech, despite free EFFIS:**
  - Greece's AIGIS programme: €2,077,494,365 `[V]`, about €346M of it for warning and prevention `[D]`;
  - Greece's €20M OroraTech satellite deal `[D]`;
  - Canary Islands: €22M fire geo-information contract `[D]`;
  - Murcia: an €80M five-year tender `[D]`;
  - CAL FIRE uses Technosylva `[D]`.
- **Most of this money goes to aircraft, sensors and satellites,** not to risk maps alone `[D]`.

### 4. Forest-carbon projects (€5–20k per forest a year `[U]`)

- **What a "project" is:** one forest registered to sell carbon credits.
- **The fire link:** the registry (Verra) scores its fire risk with the AFOLU Non-Permanence Risk Tool, and the score sets how many credits go into a reserve, the buffer pool `[V]`.
- **Why it matters:** fires used up about a fifth of California's offset buffer pool in under 10 years `[V]` (Badgley et al. 2022).
- **What we sell:** fire history and a risk score per forest.
- **No price evidence found.** Planet sells forest data at $0.10–0.25 per hectare `[D]`.

## All 20 segments considered (ranked by pain × ability to pay × market size, `[U]`)

1–5. Utilities; property insurers; reinsurers and catastrophe modellers; parametric insurers (Kettle raised $25M in 2021 `[V]`); forest-carbon developers.
6–10. Timber and forestry; US state and federal fire agencies; rail and pipelines; telecom towers; solar and wind owners.
11–20. Real estate; agribusiness; mining; municipalities (they buy cameras, not forecasts); Earth-observation resellers (a channel, not a buyer); weather and media apps; tourism and parks; defence; EU civil protection; national fire services (high pain, don't pay).

## Not yet validated

- **Willingness to pay** in any segment: no buyer has been interviewed.
- **Whether utilities accept 28 km next-day forecasts** alongside their own finer models.
- **Prices:** all are our estimates, anchored only on Pano AI (about $50k per camera a year, an AP estimate `[D]`).
