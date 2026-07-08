# Engineering Rules

Engineering norms a coding agent must obey on this repo. Human-authored, read whole, injected with the charter into every ticket. (Migrated from the former root `AGENTS.md` rules page; `AGENTS.md` is now a thin router.)

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.** State assumptions explicitly; if uncertain, ask. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop, name it, ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.** No features beyond what was asked; no abstractions for single-use code; no configurability that wasn't requested; no error handling for impossible scenarios. If 200 lines could be 50, rewrite it. "Would a senior engineer say this is overcomplicated?" → if yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.** Don't improve adjacent code/comments/formatting; don't refactor what isn't broken; match existing style. Remove imports/vars/functions your change orphaned; don't delete pre-existing dead code unless asked (mention it). Every changed line traces to the request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.** Turn tasks into verifiable goals ("fix the bug" → "write a test that reproduces it, then make it pass"). For multi-step work, state a brief plan with a verify check per step. Verify by actually running (browser / commands), not by imagining from code.

## 5. SSOT and One Way Only

**One source of truth, one canonical path per operation, no fallback for impossible states.** Keep exactly one SSOT per contract/schema/decision; no parallel definitions, duplicate configs, or shadow workflows. If a source of truth is missing/violated, fail fast and surface it — never add a fallback that hides an impossible state.

## Project specifics (proven on this repo)

- **Secrets**: `.env` is git-ignored and holds DB/API secrets — never stage, commit, or echo it; verify it is not staged before every commit.
- **DB access is server-only**: all reads/writes go through `app/src/lib/db.ts` `sql()` (the browser never holds the connection string). The DB is the shared Azure easy-app Postgres, schema `stemrobin-schema`.
- **Answer-key secrecy**: quiz question fetchers (`getLessonQuestions`/`getStoryQuestions`) must never send `correct_index` / `answer` / `accept` to the client; correctness is judged server-side in the `record*` server fns.
- **Content is DB-driven, skill-generated**: never hand-write `sr_*` rows; math lessons/decks and biographies are produced by `sr-math-lesson` / `sr-story` and persisted only via their `save-*.mjs` scripts (which read repo-root `.env` and resolve `node_modules` from repo root). Schema changes go through `ssot-schemas/db-schemas/stemrobin.sql` (applied via psql), never ad hoc.
- **Deploy invariant**: Dockerfile + build context stay at repo root; the Container App runs at `--min-replicas 1` (no scale-to-zero).
