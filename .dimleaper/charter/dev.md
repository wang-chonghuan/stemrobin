# Development Rules

Human-authored. Binding on every coding agent working in this repo.
Section shape is fixed — see `format.md`.

> The generic sections below are the n-dimleaper template's, kept as-is. The project-specific
> Guidance and Redlines were migrated 2026-08-05 from `.prodfarm/charter/engineering-rules.md`
> ("Project specifics"); that file's five generic rules (Think Before Coding / Simplicity First /
> Surgical Changes / Goal-Driven Execution / SSOT) were **not** copied — they say the same things as
> the Guidance below.

## Contract

The repo has **no root `package.json`**; `app/` is a standalone project and every app command runs
from there. The structural facts live in `arch.md`.

## Tools

**The mechanical defence** — the one command that makes this project's checkable rules fail rather
than be remembered. Run it once before the handoff; it is not a review pass, it is a command:

```bash
cd app && npm run test && npm run build
```

<!-- inferred 2026-08-05 from app/package.json scripts — no separate lint or typecheck script exists
     today; `vite build` is what would fail on a type error. If a lint/typecheck is added, put it in
     this command rather than writing a rule about it. -->

**Content generation** — never hand-write `sr_*` rows. Lessons/decks and biographies are produced by
the `sr-math-lesson` / `sr-story` skills and persisted only via their `save-*.mjs` scripts, which read
the repo-root `.env` and resolve `node_modules` from `.agents/skills/`.

**DB schema** — `ssot-schemas/db-schemas/stemrobin.sql` is the SSOT by charter but is currently
**stale and not to be applied**; see `arch.md`'s Key decisions. Inspect the live schema with the
command in `runbook.md` instead.

## Guidance

Binding. Followed while writing, judged by the author — nothing reviews a diff against this section.

**No gratuitous dependencies.** If the existing architecture and stack can implement the requirement,
**do not add, remove, or change any library**. Solve it with what is here. A dependency change is
admissible only when the existing stack genuinely cannot meet the requirement **and** the ticket
carries that decision — which means the human made it, at the grill or earlier. Finding the stack
insufficient with no such decision is a stop, never a silent install.

**Reuse before inventing.** Existing helpers, config paths, schemas, components and SSOT files come
first. A second way to do something that already has a way is a defect, even when it works.

**No dirty code.** No TEMP markers, no degradation branches, no mock standing in for a failed external
dependency. A failing external premise is a stop and a report, not something to route around. These
patterns get learned and copied — one of them breeds more.

**Surgical changes.** Touch what the ticket needs and nothing else. Do not "improve" adjacent code,
reformat unrelated files, or fix things you noticed in passing — report them instead so they can
become their own ticket.

**Uncertainty surfaces.** Prefer stopping and asking over inventing a fallback or a hidden
compatibility layer.

**DB access is server-only.** All reads and writes go through `app/src/lib/db.ts`'s `sql()`; the
browser never holds the connection string.

**Content is DB-driven and skill-generated.** Never hand-write `sr_*` rows and never apply a schema
change ad hoc — both have exactly one path, named in `## Tools` and in `runbook.md`.

**Secrets.** `.env` holds DB and API secrets and is git-ignored. Never stage it, commit it, or echo
its contents; verify it is not staged before every commit.

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Committing credentials, tokens, connection strings, or hidden account data** — forbidden
   outright, in source, mocks, ticket artifacts and commits alike. Concretely: `.env` and `app/.env`
   never appear in `git status`'s staged set.
2. **Discarding a change already present in a dirty worktree** — forbidden outright. It is the
   human's work until they say otherwise.
3. **Sending an answer key to the client** — forbidden outright. The quiz question fetchers
   (`getLessonQuestions` / `getStoryQuestions` in `app/src/lib/quiz.ts`) must never include
   `correct_index`, `answer` or `accept` in what they return; correctness is judged server-side in
   the `record*` server functions.
