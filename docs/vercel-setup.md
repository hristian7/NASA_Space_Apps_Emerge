# Vercel setup and auto-deploy test

The app lives in [`web/`](../web/). For now it is a single static "hello world" page with no build step, so we can prove that a push to `main` deploys by itself before the real app (stack still being decided) replaces it.

## Project settings (Vercel dashboard → the project → Settings)

| Setting | Value | Why |
|---|---|---|
| **Git → Connected repository** | `hristian7/NASA_Space_Apps_Emerge` | Deploys on every push. The repo is public on a personal GitHub account, so teammates' pushes deploy too without joining the Vercel team `[V]` ([Vercel docs](https://vercel.com/docs/git)) |
| **Build and Deployment → Root Directory** | `web` | Only the app is published, never `docs/`, `specs/`, `pipeline/` or data |
| **Framework Preset** | Other | Plain HTML for now. Switch to Next.js (or whatever we pick) when the real app lands in `web/` |
| **Build Command** | empty (override off) | Nothing to build yet |
| **Output Directory** | empty (default) | Vercel serves `web/` as is |
| **Environments → Production branch** | `main` | A push to `main` becomes the live site; other branches get preview links |

## Test that auto-deploy works

1. After the settings above, open the production address: the page says **"Deploy test 1"**.
2. Change `1` to `2` in [`web/index.html`](../web/index.html) (the `<code id="build">` line), commit and push to `main`.
3. Within about a minute, the Vercel dashboard shows a new deployment with that commit message, and the page says **"Deploy test 2"**.

If step 3 does not happen: check **Settings → Git** (repository connected, production branch `main`) and that the Vercel GitHub app has access to this repository (GitHub → Settings → Applications → Vercel).

## Notes

- **Pull requests from forks** wait for one click of approval from a Vercel team member before they deploy `[V]` (same Vercel page). Pushing branches to this repo directly avoids that.
- **No keys in git:** `.vercel` and `.env*` are already ignored. Keys (FIRMS MAP_KEY, push-alert VAPID keys) go in **Settings → Environment Variables**.
- **Free plan limits that shape the design** are in [`research/storage-options.md`](research/storage-options.md): 100 MB of static files per deployment, scheduled jobs at most once a day.
