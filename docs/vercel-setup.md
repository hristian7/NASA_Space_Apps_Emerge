# Vercel setup and auto-deploy test

The app lives in [`web/`](../web/). It is a Next.js app (App Router, TypeScript). The framework is declared in [`../web/vercel.json`](../web/vercel.json) as `{"framework": "nextjs"}`, so Vercel builds it with the Next.js preset and no preset has to be picked by hand ([`../specs/specification.md`](../specs/specification.md)). The design preview stays reachable at `/preview`.

## Quick steps for the Vercel project owner

**Status (14 Nov, 16:45): done.** Root Directory `web`, framework Other, pause removed, redeployed; the auto-deploy test (build 1 → 2) passed.


1. **Vercel → emerge → Settings → Build and Deployment**
   - **Root Directory:** `web`
   - **Framework Preset:** Next.js (`web/vercel.json` sets this too)
   - **Build Command** and **Output Directory:** leave empty (overrides off)
2. **Settings → Git**
   - Check that the repo is connected and **Production Branch** is `main`.
   - **Remove the pause:** clear the "Ignored Build Step" command (`exit 0`), or set it back to Automatic.
3. **Redeploy once** (Deployments → latest → Redeploy). The live URL should show the Emerge home page, and `/preview` should show the design preview.

**If a push doesn't deploy:** check that the Vercel GitHub app has access to this repo (GitHub → Settings → Applications → Vercel → Configure → Repository access).

## Settings at a glance

| Setting | Value | Why |
|---|---|---|
| **Git → Connected repository** | `hristian7/NASA_Space_Apps_Emerge` | Deploys on every push. The repo is public on a personal GitHub account, so teammates' pushes deploy too without joining the Vercel team `[V]` ([Vercel docs](https://vercel.com/docs/git)) |
| **Build and Deployment → Root Directory** | `web` | Only the app is published, never `docs/`, `specs/`, `pipeline/` or data |
| **Framework Preset** | Next.js | Declared in `web/vercel.json` |
| **Build Command / Output Directory** | empty | The Next.js preset supplies both |
| **Ignored Build Step** | removed (Automatic) | The `exit 0` pause was only needed until `web/` existed |
| **Environments → Production branch** | `main` | A push to `main` becomes the live site; other branches get preview links |

## Good to know

- **Pull requests from forks** wait for one click of approval from a Vercel team member before they deploy `[V]` (same Vercel page). Pushing branches to this repo directly avoids that.
- **No keys in git:** `.vercel` and `.env*` are already ignored. Keys (the FIRMS MAP_KEY) go in **Settings → Environment Variables**.
- **Free plan limits that shape the design** are in [`research/storage-options.md`](research/storage-options.md): 100 MB of static files per deployment, scheduled jobs at most once a day.
- **Data size heads-up:** the full world table at 0.25° monthly, with every satellite's series, measured about **1.1 GB as JSON (about 150 MB gzipped)** on 14 Nov, above the 100 MB limit and well above the 60 to 80 MB estimate in the specification. Plan for Blob storage, a compact binary format, or fewer columns in the tiles.
