# Runbook

All commands run from the repo root.

## Develop
- `npm install` — install deps
- `npm run dev` — vite dev server (default http://localhost:3000; check terminal output for the actual port)

## Test / Build
> Regression: `.autoqa/` initialized (n-autoqa TS-stack support, 2026-07-07). RG cases accumulate per ticket via n-autoqa; `npm run test` (vitest) remains the unit floor. Run RG suite: n-autoqa cap3.

- `npm run test` — vitest run
- `npm run build` — production build
- `npm run start` — serve the built output (`.output/server/index.mjs`)

## Database
- PostgreSQL; connection via `.env` (`DATABASE_URL`; obtain from n-easyapp shared PostgreSQL contract). Never commit `.env`.

## Deploy
- Azure Container Apps app `ca-stemrobin` (n-easyapp substrate, shared env `cae-easyapp-shared`).
- Redeploy: n-easyapp redeploy cap for project `stemrobin` (builds `acreasyapp.azurecr.io/stemrobin:latest` via `az acr build`, updates the container app).
- Live URL: https://ca-stemrobin.kindsmoke-4d84c417.northeurope.azurecontainerapps.io

## Troubleshoot
- Container logs: `az containerapp logs show -n ca-stemrobin -g rg-easyapp-shared --tail 50`
