# Runbook — running this project locally

Concrete, directly executable commands, repo-root-relative. No machine-specific absolute paths.
Environment-specific values are placeholders plus how to obtain them.
Section shape is fixed — see `format.md`.

This is the file acceptance verification uses to start the product, so an out-of-date command here
silently blocks every ticket. **Read it at the moment you need it and run it as written** — never
from memory, never restated into a plan or a ticket artifact. Keep it true.

> Migrated 2026-08-05 from `.prodfarm/charter/runbook.md`. Its Deploy and container-log sections moved
> to `devops.md`.

## Contract

**One long-running service**: the tanstack-start web app in `app/`, SSR — it serves both pages and
server functions, there is no separate API process. "Start the product" means the vite dev server on
this project's fixed port **3200**. The DB it talks to is remote (Azure easy-app shared PostgreSQL),
not something started locally.

Content generation (`sr-math-lesson`, `sr-story`, `sr-lesson`) runs as one-off node scripts, not as a
service.

## Tools

**Install**

```bash
cd app && npm install
```

The content skills install separately, once:

```bash
cd .agents/skills && npm install
```

**Run the dev server**

The fixed main port **3200** is set in `app/vite.config.ts`, which is the single source of truth —
**do not pass `--port`** in the main checkout:

```bash
cd app && npm run dev     # http://localhost:3200
```

For a ticket worktree, resolve the port with:

```bash
python3 <intentfold-skill>/scripts/ports.py .intentfold/project.json ticket <ticket-id>
```

and pass it to vite explicitly (this is the one case where `--port` is correct, because the worktree
must not collide with the main checkout's 3200):

```bash
cd app && npm run dev -- --port <resolved-web-port>
```

**Build**

```bash
cd app && npm run build          # output app/.output/
cd app && npm run start          # serve the built output (app/.output/server/index.mjs)
```

**Run tests**

```bash
cd app && npm run test           # vitest run
cd app && npm run e2e            # Playwright (config app/playwright.config.ts)
```

**Environment**

- One env file: the repo-root `.env`, git-ignored. Required keys: **`LEMMADECK_DATABASE_URL`** — the
  live content DB (shared Supabase project, schema `lemmadeck-schema`) — plus the `AZURE_TTS_*` keys
  for 短文学英语 朗读. `EASYAPP_DATABASE_URL` still sits in `.env` but points at the **Azure** easy-app
  Postgres, whose schema is confusingly *also* called `lemmadeck-schema`; nothing may be written
  through it (`arch.md` redline 5). Never commit this file.
- The app's SSR runtime auto-loads `.env` from its own project dir, so a git-ignored symlink
  `app/.env → ../.env` shares the single root `.env`. Recreate it after a fresh clone:

```bash
ln -sf ../.env app/.env
```

  The deployed container gets its env from Azure, not from this file.

- The content skills' `scripts/*.mjs` run directly with node and read the repo-root `.env`, resolving
  `postgres` from `.agents/skills/node_modules`.

**Database** — the live content schema, read-only inspection:

```bash
psql "$LEMMADECK_DATABASE_URL" -c 'set search_path to "lemmadeck-schema"; \dt'
```

There is no local database: this connects to the same shared Supabase project production uses.

## Guidance

**Troubleshooting**

- A missing `app/.env` symlink shows up as the app starting but every DB-backed page failing. Recreate
  it with the `ln -sf` above rather than copying `.env`.
- A startup failure is a **stop and a report**, never an acceptance result. Do not run Playwright into
  `ERR_CONNECTION_REFUSED` and record what comes back.

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Running a destructive statement against `$LEMMADECK_DATABASE_URL`** — `DROP`, `TRUNCATE`, or an
   unfiltered `DELETE`/`UPDATE` on any `sr_*` table — not without the human's explicit approval. The
   local runbook and production point at the **same Supabase project and the same schema**; there is
   no separate local DB to be safe in.
