# Architecture

- Single tanstack-start app; SSR routes under `src/routes/_app/` (index = catalog, `lesson.$id`, `story.$id`, `login`).
- Domain libs in `src/lib/`: `curriculum.ts` (course structure), `lessons.ts`, `stories.ts`, `quiz.ts` + `answer-normalize.ts` (practice), `session*.ts` (auth), `db.ts` (postgres access).
- Lesson content generated per `docs/course-gen-guide-*.md` skills; math ledger under `docs/math-ledger/`.
- `ssot-schemas/` holds shared data contracts.

## Project rules

- (awaiting human: architectural rules accumulate here via boundary settlement / ADR-bearing timeline entries)
