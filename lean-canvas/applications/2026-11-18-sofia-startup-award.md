# Sofia Startup award: questions and our answers

**Context:**
- After Emerge took 2nd place in Sofia, the local organiser offered the team the local Startup award track, by email in the week of 16 Nov 2026 `[V]`.
- **Next steps:** send short answers by Thursday, then a 15–30 minute meeting on Friday.
- **Where the questions come from:** the Y Combinator application, https://www.ycombinator.com/apply. The organiser also pointed to YC's Requests for Startups, https://www.ycombinator.com/rfs#startups-in-a-world-of-abundant-space-access.
- **How that RFS fits Emerge:** only indirectly. YC wants businesses that depend on much cheaper launches; Emerge uses existing satellite data on the ground `[D]`.
- **Tips for YC-style answers** `[D]`, from third-party guides and Paul Graham's essays:
  - use plain words;
  - be specific about who pays and how much;
  - size the market bottom-up (buyers × price);
  - be honest about gaps in expertise;
  - show proof of need with numbers.
- **Open item:** the team asked the organiser what the programme involves (time commitment, the prize, whether the goal is a YC application). No answer is recorded yet.

**The final answers** were shared as a Google Doc, which is private, outside this repo. Team names and profiles are left out here (public repo); otherwise this is the final text, 18 Nov 2026.

---

**1. Who on your team would like to continue working on this project?**
All six hackathon team members (names and LinkedIn profiles are in the private copy).

**2. Describe what your company does in 50 characters or less.**
Fire data in one place, plus tomorrow's fire risk

**3. What is your company going to make?**
Emerge puts all wildfire data in one place and predicts where new fires are likely to start tomorrow.
- **One fair fire history:**
  - NASA has watched fires from space since 2000 with two satellites whose records don't match: the newer one sees 2.7× more fire.
  - We merged them into one 25-year record for any place on Earth.
  - We added 25+ more sources: weather, soil moisture, vegetation, land type, population, roads.
- **Tomorrow's fire risk:**
  - Every day, our own machine-learning model picks the 5 places in each region most likely to have a new fire tomorrow.
  - Tested on January–October 2026, data it never saw. The share of new fires in each method's picks: Emerge 21.4% world, 57.9% Europe; past fire history 17.2% and 54.3%; NASA fire-weather index 11.5% and 43.6%; random picks 10.9% and 41.7%.
  - We catch nearly twice as many new fires as NASA's index. Europe's numbers are higher because its regions are smaller.

**4. How will you make money? How much could you make?**
1. **Electric utilities (€50–250k a year):**
   - Every day, utilities decide where to turn on extra-sensitive line settings (power switches off instantly if a branch touches a line) and where to cut power before a dangerous day. Both stop sparks starting fires.
   - Emerge tells them where fire is most likely tomorrow, so they protect the right areas and avoid needless blackouts.
   - Yearly, our fire history shows where to cut trees first.
   - Why they pay: one fire can bankrupt a utility (PG&E, 2019, about $30B in claims).
2. **Insurers (from €100k a year):**
   - Use our 25-year fire history to price policies and limit risk in one area.
   - Why now: France's 2026 fires may cost €10–15bn, much of it insured. Europe has only a few new wildfire risk scores, and the big model firms focus on the US.
3. **Governments and fire services (€20–100k per region a year):**
   - Free for firefighters.
   - Governments pay for regional dashboards: where to place crews tomorrow.
   - Greece: a €2.1bn civil-protection plan, €346M of it for warning and prevention.
4. **Forest-carbon projects (€5–20k per forest a year):**
   - Companies pay forests to stay standing by buying carbon credits. If a forest burns, that carbon is lost.
   - So each forest keeps a safety reserve of credits, sized by its fire risk. We provide that fire-risk score from 25 years of satellite data.

**How big:**
- Total spending on wildfire (TAM): billions a year. California's utilities alone spend about $9bn a year on wildfire prevention.
- The market we can reach (SAM): about €54M a year, in fire-prone regions only:
  - about 260 utilities × €100k;
  - about 180 insurers and reinsurers × €100k;
  - about 80 government regions × €60k;
  - about 500 forest projects × €10k.

**Costs:** near zero today. Data is free for commercial use (NASA, NOAA, EU Copernicus), except one weather licence. Later: salaries, AI tools, cloud computing, GPUs.

**5. Why did you pick this idea? Do you have domain expertise? How do you know people need what you're making?**
- **Why this idea:**
  - At NASA Space Apps, a Bulgarian firefighter with 20 years' experience told us crews check about ten websites. Their biggest need is knowing where fire will start tomorrow.
  - Fires are getting worse: 2025 was the EU's worst fire year on record; in July 2026 over 300,000 people fled fires in France and Spain; the US has burned nearly twice as much land this year as last.
- **Competition, and how we differ:**
  - **Technosylva** (closest; Spanish-American, since 1997): fire simulations and day-ahead risk for large US utilities and Spanish regions. We're far cheaper, global, and built for smaller buyers they don't serve.
  - **OroraTech** (€37M raised): its own 20 satellites spot fires already burning; its forecast is still a pilot. We predict before ignition, so they're a possible partner.
  - **Pano AI** ($89M raised): cameras spot smoke after a fire starts, about $50k per camera a year. We act a day earlier.
  - **Moody's, Verisk:** long-term insurance models, with wildfire for the US only. In Europe, only a few new specialist scores exist.
  - **EFFIS** (EU, free): fire-danger maps from weather only. We add where fires actually start, which makes us better.
- **How we know people need it:**
  - **Utilities** already pay for day-ahead fire-risk forecasts: Technosylva has 25+ customers.
  - **Insurers:** European wildfire losses are rising (France 2026), and reinsurers and specialist insurers are starting to buy fire data.
  - **Governments** spend heavily on prevention (Greece, above).
- **Domain expertise:** product and startup validation, design, software engineering, and students in applied physics and information systems. Details are in the private copy.
- We test every claim on unseen data and will add an Earth-observation and machine-learning expert later.

---

**Removed at the owner's request** (don't re-add without asking):
- a 1–3 year revenue plan;
- grants;
- "we publish our accuracy" as a differentiator;
- "nobody tells them how accurate any forecast is";
- the "1.9×" figure on the EFFIS line.

The evidence behind every number is in [`../evidence.csv`](../evidence.csv), and the corrections are in [`../decision-log.md`](../decision-log.md).
