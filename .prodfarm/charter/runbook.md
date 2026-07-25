# Runbook

The web app is a **standalone project in `app/`** (its own `package.json` +
`package-lock.json` + `node_modules`). There is **no repo-root `package.json`**.
Run app commands from `app/` (or with `npm --prefix app`).

## Develop
- `cd app && npm install` — install app deps (into `app/node_modules`)
- `cd app && npm run dev` — vite dev server on this project's fixed port **3200** (http://localhost:3200; set in `app/vite.config.ts`, which is the single source of truth — do not pass `--port`)
- Local-dev env: the app's SSR runtime auto-loads `.env` from its own project dir, so a
  gitignored symlink `app/.env → ../.env` shares the single root `.env`. Recreate it after a
  fresh clone: `ln -sf ../.env app/.env`. (The container gets env from Azure, not this file.)

## Test / Build
> Regression: `.autoqa/` initialized (n-autoqa TS-stack support, 2026-07-07). RG cases accumulate per ticket via n-autoqa; `cd app && npm run test` (vitest) remains the unit floor. Run RG suite: n-autoqa cap3.

- `cd app && npm run test` — vitest run
- `cd app && npm run build` — production build (output `app/.output/`)
- `cd app && npm run start` — serve the built output (`app/.output/server/index.mjs`)
- `cd app && npm run e2e` — Playwright E2E (config `app/playwright.config.ts`)
- Content skills (`sr-math-lesson`, `sr-story`, `sr-lesson`) run their `scripts/*.mjs` directly
  with node and resolve `postgres` from **`.agents/skills/node_modules`** (their own manifest
  `.agents/skills/package.json`) — independent of the app's install. Set up once with
  `cd .agents/skills && npm install`.

## Database
- PostgreSQL; connection via `.env` (`EASYAPP_DATABASE_URL` / `DATABASE_URL`; obtain from n-easyapp shared PostgreSQL contract). Never commit `.env`.
- Apply the schema from the repo root: `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`.

## Deploy
- Azure Container Apps app `ca-stemrobin` (n-easyapp substrate, shared env `cae-easyapp-shared`).
- Redeploy: n-easyapp redeploy cap for project `stemrobin` (builds `acreasyapp.azurecr.io/stemrobin:latest` via `az acr build`, updates the container app).
- **Build invariant**: n-easyapp hard-codes Dockerfile + build context at the **repo root**. The
  root `Dockerfile` builds the standalone app: `npm ci` from `app/`'s manifest, `npm run build`,
  then ships only `app/.output`. Do not move the Dockerfile; keep it building `app/`.
- **Live URL: https://lemmadeck.com** (`www` 301s to the apex). Origin still answers at
  https://ca-stemrobin.kindsmoke-4d84c417.northeurope.azurecontainerapps.io.
- Domain layout (n-golive cap2, STEMROBIN-111): Cloudflare zone `lemmadeck.com` —
  `A @ → 20.54.18.105` **DNS only (grey; the Azure managed cert needs to reach the origin)**,
  `TXT asuid` = the container app's customDomainVerificationId, `CNAME www → lemmadeck.com`
  **proxied (orange)** plus a redirect rule. Cert `mc-cae-easyapp-sh-lemmadeck-com-3571`
  (DigiCert, auto-renewing) is bound `SniEnabled` on the shared env.
- Retired 2026-07-25: `mynatree.com` and `stemrobin.com` serve nothing — no DNS records, no
  hostname binding. Their Cloudflare zones are still in the account (re-pointable).

## Troubleshoot
- Container logs: `az containerapp logs show -n ca-stemrobin -g rg-easyapp-shared --tail 50`
