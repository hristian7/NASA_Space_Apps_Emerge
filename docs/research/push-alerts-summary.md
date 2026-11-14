# Push alerts: short version

Summary of [`push-alerts.md`](push-alerts.md) (14 Nov 2026), feature S11. Tags: `[V]` checked at the source · `[D]` directional · `[U]` our guess.

## The question

How do we send a phone notification when fire risk near a saved place becomes high, on **Vercel only**?

## How it works, in six steps

1. The user taps **"Alert me here"** on the globe, and the phone asks for permission.
2. The app saves the sign-up with the place rounded to about 10 km, so no exact home address is kept.
3. A timer starts a check once or twice a day.
4. The check reads the official fire-danger number for each saved place.
5. If it's "high" or worse, the phone gets one notification a day at most.
6. Tapping it opens Emerge at that place, with links to official services.

## Options for each part

| Part | Options | Pick | Why |
|---|---|---|---|
| **What counts as "high risk"** | (a) Copernicus fire weather index ≥ 21.3 ("high" class); (b) new NASA fire detections within about 10 km in 24 h | **(a)**, with (b) as an extra | (a) is official and works for any point today `[V]`; (b) uses NASA's free 24 h files `[V]` |
| **Timer** | Vercel's built-in timer; GitHub's free timer | **GitHub timer** | Vercel's free plan runs only once a day `[V]`; GitHub can run every 5 minutes at most `[V]` |
| **Where sign-ups are stored** | Upstash Redis; Neon Postgres; Vercel Edge Config; Vercel Blob | **Upstash Redis** | A simple list fits; Postgres is overkill, Edge Config is slow to write, Blob has strict free limits |
| **Sending** | `web-push` library | **web-push** | Standard and open source (MPL-2.0) `[V]` |

## Which phones

- **Android, and desktop Chrome, Edge and Firefox:** yes.
- **iPhone and iPad:** only iOS 16.4 or newer, only after "Add to Home Screen", and only after a tap `[V]`. The app shows an "Add to Home Screen first" hint.

## Wording rules

- Never use official words like "Warning" or "Red Flag".
- Always say **"unofficial"**, link the official service, and mention 112 (911 in the US).
- The example text in English and Bulgarian is in the full file.

## Recommendation

**Build it after the Musts work**, using the Copernicus fire-danger number and a GitHub timer. **Effort is about 6–10 hours** `[U]`.

**Fallback if it isn't finished:** when the app is opened, show a banner ("Fire risk near your saved place is high today, unofficial"). This needs no server and no permission, and works on every phone. For the demo, show a real push on one Android phone.

**Why:** it reuses data we already show, costs nothing, keeps no exact locations, and has a safe fallback.

## Still to check

- The licence for automated use of the Copernicus service: its metadata names the EU Data Licence, not CC BY 4.0.
- Upstash's free-plan limits.
