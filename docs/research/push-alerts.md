# Push alerts on Vercel (feature S11): "Alert me here"

Written 2026-11-14 under a hard time box. Tags: `[V]` verified at the primary source with a real request · `[D]` directional (known from docs, not re-opened today) · `[U]` our inference. **Most Vercel, Web Push and storage facts below are `[D]`: see "Not verified".**

## Summary

- **Flow:** the user taps "Alert me here" on a point → the app asks for notification permission → the browser gives a *push subscription* (an address the browser vendor's push service delivers to) → we store it with the point → a scheduled job checks risk at each point → if high, it sends a push → the service worker (background script of the PWA) shows the notification.
- **Risk source (verified today):** the GWIS point query `ecmwf.query` returns the official FWI for any point and day `[V]`. Alert when FWI ≥ 21.3 (EFFIS "high" class) today or tomorrow. Optional second trigger: new FIRMS detections within ~10 km in the last 24 h.
- **Stack `[U]`:** `web-push` npm library + VAPID keys (a key pair that proves the pushes come from us) in Vercel environment variables · one Vercel function `/api/check-alerts` · a scheduler (Vercel cron, or a GitHub Actions schedule if Vercel's free plan is too infrequent) · Upstash Redis (Vercel Marketplace) for subscriptions.
- **Effort `[U]`:** about 6–10 h for one developer. **Fallback:** an in-app banner when the app is opened ("Risk near your saved place is high today").

## 1. How it works

| Step | Where | What |
|---|---|---|
| 1 | Browser, after a **user tap** | `Notification.requestPermission()`, then `registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: <VAPID public key>})` |
| 2 | Vercel function `POST /api/subscribe` | Save `{subscription, lat, lon, lang, lastSentDay}` in Redis. Round lat/lon to 0.1° (~10 km) so we never hold an exact home location `[U]` |
| 3 | Scheduler, once or twice a day | Calls `GET /api/check-alerts` with a secret header (`Authorization: Bearer $CRON_SECRET`); the function rejects calls without it |
| 4 | `/api/check-alerts` | Groups subscriptions by 0.1° cell, makes **one GWIS query per cell**, compares FWI with 21.3, sends at most **one push per point per day** |
| 5 | Service worker `push` event | `self.registration.showNotification(title, {body, data: {url}})`; a tap opens the app at that point |
| 6 | Clean-up | If the push service answers 404/410 (subscription gone), delete it |

**Platforms `[D]`:** Android Chrome and desktop Chrome, Edge and Firefox support Web Push. On **iPhone/iPad, iOS/iPadOS 16.4+, only when the app was added to the Home Screen**, and the permission prompt must follow a user tap ([WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). The app should show an "Add to Home Screen first" hint on iOS Safari.

## 2. The risk check (only sources we already display)

**(a) Official fire weather, GWIS `[V]`** (tested 14 Nov, CORS open, no key):

```
https://maps.effis.emergency.copernicus.eu/gwis?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo
 &LAYERS=ecmwf.query&QUERY_LAYERS=ecmwf.query&STYLES=&CRS=EPSG:4326
 &BBOX={lat-0.1},{lon-0.1},{lat+0.1},{lon+0.1}&WIDTH=101&HEIGHT=101&I=50&J=50
 &INFO_FORMAT=text/html&FEATURE_COUNT=1&TIME={YYYY-MM-DD}
```

- Returns HTML with "Fire Weather Index (FWI) <number>" (plus ISI, BUI, FFMC, DMC, DC, anomaly, ranking) `[V]`. Parse the number after "Fire Weather Index (FWI)".
- `text/plain` and GML formats come back **empty**; use `text/html` `[V]`. The display layer `ecmwf.fwi` itself is not queryable `[V]`.
- Forecast days available: today to today+9 `[V]`. Check today and tomorrow `[U]`.
- **High = FWI ≥ 21.3** (EFFIS "high" class, see [`forecast-options.md`](forecast-options.md)). Say the class name in the notification, but label it unofficial.

**(b) New fires nearby, FIRMS (optional) `[D]`:** NASA FIRMS publishes no-key 24-hour global CSVs under `https://firms.modaps.eosdis.nasa.gov/data/active_fire/` (one per sensor: MODIS, VIIRS NOAA-20, VIIRS NOAA-21). **The exact current file names were not tested today**; check them with `curl -I` before building. Alert if any detection lies within ~10 km of the point. The keyed FIRMS area API (MAP_KEY in a git-ignored `.env` / Vercel env var) is the alternative.

## 3. Hosting choices

| Need | Pick | Why | Free-tier limits |
|---|---|---|---|
| Scheduler | **Vercel cron** first; **GitHub Actions `schedule`** if Hobby is too rare | Vercel cron is one line in `vercel.json` and sends `CRON_SECRET` automatically `[D]`. Hobby has historically allowed only about once a day `[D]`; GitHub Actions cron runs every ≥5 min, free on public repos, but can be delayed `[D]` | Not verified today |
| Subscription store | **Upstash Redis** (Vercel Marketplace) | Key-value fits "list of subscriptions"; HTTP client works in serverless functions; one-click install in Vercel `[D]` | Not verified today |
| Not chosen | Neon Postgres (overkill for a list), Edge Config (made for read-mostly config, slow writes `[D]`), Vercel Blob (files, no easy per-item update `[U]`) | | |
| Sender | `web-push` npm library | Standard Node library for VAPID + payload encryption `[D]`; licence believed MIT `[D]` | |

**Secrets:** VAPID private key, `CRON_SECRET`, Redis token live only in Vercel environment variables. Never in the repo.

## 4. Notification wording

Rules: never use official warning words ("Warning", "Alert level", "Red Flag", "Code Red"); always say **unofficial**; always link the official service.

| | English | Bulgarian |
|---|---|---|
| Title | Emerge: high fire weather near your place (unofficial) | Emerge: висока пожароопасност близо до вашето място (неофициално) |
| Body | Copernicus fire weather index is in the "high" range today. Not an official warning. Check official sources and follow local authorities (112). | Индексът на пожароопасност на Copernicus днес е в диапазона „висок“. Това не е официално предупреждение. Проверете официалните източници и следвайте местните власти (112). |
| Tap opens | The app at the saved point, with links to EFFIS/GWIS and, in Bulgaria, NIMH ([meteo.bg/bg/forecasts/fireindex](https://meteo.bg/bg/forecasts/fireindex)) | Same |

USA: replace 112 with 911 and link NIFC.

## 5. Effort and fallback `[U]`

| Part | Hours |
|---|---|
| Service worker push handler + subscribe button + iOS "add to Home Screen" hint | 2–3 |
| `/api/subscribe`, `/api/unsubscribe`, Redis | 1–2 |
| `/api/check-alerts` (GWIS parse, threshold, de-duplicate, send, clean-up) | 2–3 |
| Scheduler + secrets + test on Android and one iPhone | 1–2 |
| **Total** | **6–10** |

**Fallback if push isn't finished:** keep the saved point in the browser (localStorage) and, when the app opens, call the same GWIS query and show a banner with the same wording. No server, no permission prompt, works on every phone. Demo the push on one Android phone if only part works.

## Not verified (check before building)

- ~~Vercel cron frequency~~ **Checked 14 Nov `[V]`:** Hobby (free) runs cron jobs at most **once per day**, with ±59 min precision; Pro once per minute ([usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)). So use the GitHub Actions schedule. The `CRON_SECRET` mechanism is still to check.
- ~~GitHub Actions minimum interval~~ **Checked 14 Nov `[V]`:** "once every 5 minutes" at the shortest ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)). Runs can be delayed at busy times `[D]`.
- Upstash Redis free-tier limits on the Vercel Marketplace: [vercel.com/marketplace/upstash](https://vercel.com/marketplace/upstash) `[D]`.
- ~~`web-push` licence~~ **Checked 14 Nov `[V]`:** version 4.0.0, licence **MPL-2.0** (open source, OSI-approved; fine as a dependency of an Apache-2.0 project) ([npm registry](https://registry.npmjs.org/web-push/latest)).
- Web Push support table and iOS rules: [WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) `[D]`.
- ~~No-key FIRMS 24 h URLs~~ **Checked 14 Nov `[V]`** (HTTP 200, updated the same day): `https://firms.modaps.eosdis.nasa.gov/data/active_fire/` + `modis-c6.1/csv/MODIS_C6_1_Global_24h.csv` (0.9 MB), `noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv` (4.5 MB), `noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv` (4.9 MB).
- GWIS terms of use for automated point queries (rate limits, fair use) and the EU Data Licence named in its capabilities `[U]`.
