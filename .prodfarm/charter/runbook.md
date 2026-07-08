# Runbook

The repo is an **npm workspace**: the web app lives in `app/`, and the root
`package.json` proxies the common scripts (`dev`/`build`/`test`/`start`) into it.
Run everything below **from the repo root** unless noted.

## Develop
- `npm install` — install deps (workspace install; app deps hoist to root `node_modules`)
- `npm run dev` — vite dev server for `app/` (default http://localhost:3000; check terminal output for the actual port)
- Local-dev env: the app's SSR runtime auto-loads `.env` from its own project dir, so a
  gitignored symlink `app/.env → ../.env` shares the single root `.env`. Recreate it after a
  fresh clone: `ln -sf ../.env app/.env`. (The container gets env from Azure, not this file.)

## Test / Build
> Regression: `.autoqa/` initialized (n-autoqa TS-stack support, 2026-07-07). RG cases accumulate per ticket via n-autoqa; `npm run test` (vitest) remains the unit floor. Run RG suite: n-autoqa cap3.

- `npm run test` — vitest run (in `app/`)
- `npm run build` — production build (in `app/`; output `app/.output/`)
- `npm run start` — serve the built output (`app/.output/server/index.mjs`)
- Content skills (`sr-math-lesson`, `sr-story`) run their `scripts/*.mjs` directly with node
  and resolve deps (`postgres`, `marked`) from root `node_modules` via workspace hoisting.

## Database
- PostgreSQL; connection via `.env` (`EASYAPP_DATABASE_URL` / `DATABASE_URL`; obtain from n-easyapp shared PostgreSQL contract). Never commit `.env`.

## Deploy
- Azure Container Apps app `ca-stemrobin` (n-easyapp substrate, shared env `cae-easyapp-shared`).
- Redeploy: n-easyapp redeploy cap for project `stemrobin` (builds `acreasyapp.azurecr.io/stemrobin:latest` via `az acr build`, updates the container app).
- **Build invariant**: n-easyapp hard-codes Dockerfile + build context at the **repo root**. The
  root `Dockerfile` is multi-stage: `npm ci` at root (workspace), `npm run build --workspace app`,
  then ships only `app/.output`. Do not move the Dockerfile or assume the app is at root.
- Live URL: https://ca-stemrobin.kindsmoke-4d84c417.northeurope.azurecontainerapps.io

## Troubleshoot
- Container logs: `az containerapp logs show -n ca-stemrobin -g rg-easyapp-shared --tail 50`
