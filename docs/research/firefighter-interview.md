# Interview with a Bulgarian firefighter (14 Nov 2026)

From our notes of the conversation, rewritten as full sentences and grouped by topic, then checked by the team member who held the interview. Nothing is added. All figures are his and haven't been checked `[U]`. Lines marked **(?)** were unclear in the notes. One personal name and one company name are left out for privacy.

The features built from this interview are in [`../../specs/plan-2-fire-risk/overview.md`](../../specs/plan-2-fire-risk/overview.md).

## 1. The main message
- Today firefighters have to open about 10 websites: Europe's (EFFIS), NASA's (FIRMS), Google's, and the weather forecasts.
- Take all of them, make them user-friendly, nice and polished, and put them in one place.
- Then build extra features on top. The most important is **prevention**.
- **The objective is an extremely accurate forecast of where fire will break out the next day:** one day in advance, more accurate than anything on the market. This would be the unique selling point.

## 2. Fire risk assessment
- The key question is the risk of a forest fire on a given territory.
- It depends on humidity, vegetation and wind. Which is the riskiest point: this forest, these conditions, stronger wind?
- Example: on the Strandzha territory, where is the risk biggest, and where is a fire most likely? The answer should be a specific place on the mountain where a fire may start on that day.
- Example output: "The system predicts the highest risk for tomorrow in Rila, at this specific point."
- This will help fire teams the most: the risk for the day and where it is highest.

**What drives the risk**
- The conditions matter most.
- **Temperature** comes first.
- **Wind** has a huge influence. Its direction can change, and firefighters watch in real time how it blows.
- **Vegetation** is graded from low plants, to shrubs, to lush, to dried out.
- **Season:** in June the vegetation is greener; in July the question is how dried out it is.
- There are two categories of fire: farm fires and forest fires (wildfires).

**How far ahead**
- Firefighters look at the weather forecast for the next day and for the week.
- But operational decisions are made **one day in advance**, for the next day.
- The weather forecast is most accurate one day ahead. The closer to the day, the more accurate it is (?).
- Today and tomorrow are good enough; a week ahead would help if possible. The focus is the next day.

## 3. Prevention
- Prevention and preparedness are the parts of the emergency management cycle where this tool can help: the risk of a forest fire.
- This would be very good for the fire services.
- The earlier, the better, as in medicine. The faster you reach a fire, the easier it is to put out. Knowing in advance where it will start is the biggest problem.
- A forest takes 100 years to recover. So act faster, prevent, and look at the technique so the fire doesn't spread (?).

**Firebreaks**
- Bulgaria has the largest forest fund (?). The Executive Forest Agency is responsible for forest fires.
- Prevention measures on farmland include mineralised strips (firebreaks of ploughed bare soil).
- A block of 10,000 decares is split into small blocks of a few decares, so a fire can't jump from one to the next.
- Fires are fought block by block: crews have an anchor point and divide the area into small blocks.
- No software does this at the moment.

## 4. Preparedness: where to place teams
- Many teams and fire services are involved.
- The real question is where to position the teams. The territory is very large (?). Firefighters should know where to be.
- The idea is to have one fire team on site and move it closer to where a fire is likely.
- The fire station is often far from the risky place. When the risky place is known, crews do standby shifts near it.
- A recommendation doesn't hurt, for example "guard this place on site."
- There are GPS locations of about 170 fire services (his figure).

## 5. Response
- Response means operational information and coordination.
- In France and Spain, about 400,000 people were evacuated, people died, and there was heat (his figures).

## 6. Spotting fires: web cameras
- Web cameras detect fires. A private person, a volunteer programmer, runs them.
- The cameras read the image and report it. The problem is telling fog from real smoke.
- **Prediction is the top problem** (confirmed after the interview).

## 7. Proof: how accurate is it?
- Firefighters have no idea how accurate the current forecasts are.
- They want a detailed analysis showing very high accuracy.
- Compare what was predicted as risk with where fires actually happened. After the day passes, check whether there was a fire and what really happened.
- Executive Forest Agency: "to see it, AI to read it" (?).

## 8. Adoption and money
- He would use such a tool, and it is useful.
- For official use, the managers must approve it.
- Fire services don't pay for tools; the European Commission's (EFFIS) is free. There is no money in this.
- The camera volunteer works unpaid; it serves as advertising and marketing for other things.

---

## Team decisions after the interview (14 Nov, not his words)
- **Goal:** a next-day prediction for **the whole world**, with the same logic in every country. Each fire service covers its own region and should see the **number one risk spot in that region** for today and tomorrow.
- **Different climates:** Bulgaria has four seasons; other countries have fewer.
- **The model must know** how dry the vegetation is and whether the place is forest. Forest is the biggest problem; low grass, green and moist or dry, matters much less. All the data needed for an accurate prediction is a Must.
- **The prediction model** makes a prediction, checks it against real FIRMS fire data, and measures its accuracy. It is tested on past years now and fine-tuned later with more data.
- **Not now:** fire-station GPS (maybe later), mineralised strips (firebreaks), web cameras, and a spread hint.
