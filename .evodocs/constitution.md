# Project Constitution

## Technology Stack

- Primary stack: TypeScript + React 19 on TanStack Start (file-based routing via `@tanstack/react-router`, server functions via `createServerFn`), built with Vite and the Nitro plugin, running on Node 24.
- Main frameworks/libraries: `@tanstack/react-start` full-stack framework; `postgres` (postgres.js) server-only client to a shared Azure PostgreSQL, all tables in the per-project schema `stemrobin-schema` (`src/lib/db.ts`); Tailwind CSS v4 via `@tailwindcss/vite`.
- Auth: no external auth provider — scrypt password hashing plus an HMAC-signed httpOnly session cookie implemented with Node `crypto` (`src/lib/session.server.ts`).
- Secondary/supporting libraries: `zustand` (layout state), `marked` (server-side Markdown-to-HTML for story chapters), `lucide-react` icons, Geist variable font; KaTeX is loaded from a CDN in the root document, not from npm.
- Tooling and configuration: TypeScript (`tsconfig.json`); Vitest with a separate `vitest.config.ts` because the TanStack Start plugin is incompatible with the vitest runner (only the `~` alias is mirrored); shadcn config in `components.json`; multi-stage `node:24-alpine` Dockerfile.
- Evidence: `package.json`, `vite.config.ts`, `vitest.config.ts`, `Dockerfile`, `components.json`, `src/lib/db.ts`, `src/lib/session.server.ts`.

## Operations Runbook

- Install: `npm install` (Docker build uses `npm ci`).
- Local development: `npm run dev` — Vite dev server on port 3000.
- Verification: `npm run test` (vitest, runs `src/**/*.test.ts`); `npm run build` (production build); `npm run start` (serve built output via `node .output/server/index.mjs`).
- Database: apply schema and seeds with `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`; the connection string comes from `.env` (`EASYAPP_DATABASE_URL` locally, `DATABASE_URL` injected in the deployed Container App); never commit `.env`.
- Deployment: Azure Container Apps app `ca-stemrobin` via the n-easyapp redeploy capability (builds `acreasyapp.azurecr.io/stemrobin:latest` with `az acr build` from the repo-root Dockerfile); container logs via `az containerapp logs show -n ca-stemrobin -g rg-easyapp-shared --tail 50`.
- Evidence: `package.json`, `Dockerfile`, `ssot-schemas/db-schemas/stemrobin.sql`, `src/lib/db.ts`, `.prodfarm/runbook.md`.

## Development Rules

TBD.

## Verification Rules

TBD.

## Notes For Future Agents

TBD.
