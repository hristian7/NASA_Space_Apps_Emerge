# Vercel setup and auto-deploy test

The app lives in [`web/`](../web/). For now it is a single static "hello world" page with no build step, so we can prove that a push to `main` deploys by itself before the real Next.js app replaces it ([`../specs/specification.md`](../specs/specification.md)).

## Quick steps for the Vercel project owner (Hristian)

1. **Vercel → emerge → Settings → Build and Deployment**
   - **Root Directory:** `web`
   - **Framework Preset:** Other
   - **Build Command** and **Output Directory:** leave empty (overrides off)
2. **Settings → Git**
   - Check that the repo is connected and **Production Branch** is `main`.
   - **Remove the pause:** clear the "Ignored Build Step" command (`exit 0`), or set it back to Automatic.
3. **Redeploy once** (Deployments → latest → Redeploy). The live URL should show "Emerge · hello world" and "Deploy test 1".
4. **Test auto-deploy:** in [`web/index.html`](../web/index.html), change `1` to `2` in the line `<code id="build">1</code>`, then commit and push to `main`. Within about a minute a new deployment appears and the page says "Deploy test 2".

**If step 4 doesn't deploy:** check that the Vercel GitHub app has access to this repo (GitHub → Settings → Applications → Vercel → Configure → Repository access).

**When we scaffold Next.js in `web/`:** change Framework Preset to Next.js. Root Directory stays `web`.

## Settings at a glance

| Setting | Value | Why |
|---|---|---|
| **Git → Connected repository** | `hristian7/NASA_Space_Apps_Emerge` | Deploys on every push. The repo is public on a personal GitHub account, so teammates' pushes deploy too without joining the Vercel team `[V]` ([Vercel docs](https://vercel.com/docs/git)) |
| **Build and Deployment → Root Directory** | `web` | Only the app is published, never `docs/`, `specs/`, `pipeline/` or data |
| **Framework Preset** | Other (Next.js once it lands) | Plain HTML for now |
| **Build Command / Output Directory** | empty | Nothing to build yet |
| **Ignored Build Step** | removed (Automatic) | The `exit 0` pause was only needed until `web/` existed |
| **Environments → Production branch** | `main` | A push to `main` becomes the live site; other branches get preview links |

## Good to know

- **Pull requests from forks** wait for one click of approval from a Vercel team member before they deploy `[V]` (same Vercel page). Pushing branches to this repo directly avoids that.
- **No keys in git:** `.vercel` and `.env*` are already ignored. Keys (FIRMS MAP_KEY, push-alert VAPID keys) go in **Settings → Environment Variables**.
- **Free plan limits that shape the design** are in [`research/storage-options.md`](research/storage-options.md): 100 MB of static files per deployment, scheduled jobs at most once a day.
- **Data size heads-up:** the full world table at 0.25° monthly, with every satellite's series, measured about **1.1 GB as JSON (about 150 MB gzipped)** on 14 Nov, above the 100 MB limit and well above the 60 to 80 MB estimate in the specification. Plan for Blob storage, a compact binary format, or fewer columns in the tiles.
