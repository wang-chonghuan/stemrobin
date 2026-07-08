---
id: 0004
type: note
author: machine
date: 2026-07-08
---

# Repo restructure to unified prodfarm layout (n-prodfarm cap1)

The tanstack-start app was moved from the repo root into `app/` as an npm workspace, and
`infra/` + `jobs/` were added so the layout is the unified prodfarm shape
(`app/` · `infra/` · `jobs/` · `ssot-schemas/`). Root `package.json` is now a workspace
manifest that proxies `dev|build|test|start` into `app`.

- Root `Dockerfile` rewritten multi-stage (workspace `npm ci` → `npm run build --workspace app`
  → ship `app/.output`); build context stays the repo root to honor n-easyapp's hard-coded
  Dockerfile+context invariant.
- Content skills (`sr-math-lesson`, `sr-story`) keep resolving `postgres`/`marked` from root
  `node_modules` via workspace hoisting.
- Local dev shares the single root `.env` via a gitignored `app/.env → ../.env` symlink
  (`app/vite.config.ts` sets `envDir:'..'` for build-time env).
- Charter `runbook.md` + `architecture.md` updated to the `app/` layout and the build invariant.

Verified: `npm ci`/`build`/`test` (14/14)/`tsc` clean; a local `docker build` of the new root
Dockerfile + container smoke test served HTTP 200 and SSR-rendered `/lesson/math-s2-06`;
redeployed to Azure (revision `ca-stemrobin--0000015`, commit `77d9558`) and the live site
renders the lesson with practice section + `2.x` sidebar.

Commit: `77d9558`. Known consequence (not a live breakage): the `.intentmill/` closed-ticket
archives (SR-1/SR-2/SR-3 drafts, plans, handoffs, archived test copies) still reference the
pre-move root `src/` paths. These are historical ticket records and are **not** executed —
`npm run test` (vitest, `app/src/**/*.test.ts`, 14/14) and the live Playwright suite
(`tests/*.spec.ts`, URL-driven, no source imports) are both unaffected. Left as-is; archives
are read-only history.
