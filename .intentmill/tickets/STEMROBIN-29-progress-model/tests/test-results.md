# Test Results — STEMROBIN-29 progress-model

Test commands:
- Unit: `cd app && npx vitest run src/lib/progress.test.ts` → 12 passed.
- Full regression: `cd app && npx vitest run` → 6 files, 59 passed.
- Typecheck: `cd app && npx tsc --noEmit` → exit 0.
- Empirical DB proof: `psql "$EASYAPP_DATABASE_URL" -f scratchpad/proof.sql` (transaction + ROLLBACK; disposable rows for user_id 2 only).

## Development Test Log

1. Wrote pure `computeProgress` + types in `app/src/lib/progress.ts`; wrote `app/src/lib/progress.test.ts` (12 cases) before the server functions. `npx vitest run src/lib/progress.test.ts` → 12 passed (reading all-correct / missing-one / zero-read-checks / no-events; practice threshold 80 / 79.99 / 85 / regression-50 / absent; totals; locale-agnostic single-count).
2. Added server functions `recordPracticeAttempt` + `getProgress` on the pure core. Ran full `npx vitest run` (59 passed) and `npx tsc --noEmit` (clean) to confirm no regression and that the new server-fn SQL/types compile.
3. Applied schema (`psql ... -f ssot-schemas/db-schemas/stemrobin.sql`) → `sr_practice_attempts` created with FKs (user→sr_users, lesson→sr_lessons, both ON DELETE CASCADE), `CHECK(score 0..100)`, index `(user_id,lesson_id,submitted_at)`. Existing tables reported "already exists, skipping" (additive + idempotent confirmed).
4. Ran the empirical psql proof with disposable data for user_id 2, then ROLLBACK; verified 0 residual rows in `sr_practice_attempts` and `sr_content_answer_events` for user 2.
5. Verified the exact `getProgress` lesson-extraction query returns all 16 lessons (including the zero-read-check `math-s2-08`).

## Coverage Map

Maps `im-plan.md ## Unit Test Plan` items to evidence:

| Plan test obligation | Evidence |
|---|---|
| Reading-complete all correct | unit: "reading-complete when every read-check is correct" (pass) + psql PROOF 2 (8/8 → t) |
| Reading-incomplete missing one | unit: "reading-incomplete when one read-check is missing" (pass) + psql PROOF 2 (delete one → 7/8 → f) |
| Reading zero read-checks (BD-4) | unit: "reading-incomplete for a lesson with zero read-checks" (pass); live `math-s2-08` handled |
| Practice-complete threshold (80/79.99/85) | unit: 3 threshold cases (pass) |
| Practice regression (latest wins) | unit: "practice regresses when the LATEST resolved score is below 80" (pass) + psql PROOF 3 (85→t then later 50→f) |
| Practice absent | unit: "practice-incomplete when there is no attempt" (pass) |
| Totals = 2 × lessons | unit: "total points = 2 × lesson count" + "completed points sum…" (pass); live: 16 lessons → total 32 |
| Locale-agnostic single-count | unit: "each lesson id appears once and contributes at most 2 points" (pass); queries key on lesson_id only, no locale filter |
| Latest-2 pruning (R2, DB ordering) | psql PROOF 1: 3 inserts → exactly 2 newest (60,90); oldest (40) pruned |
| Additive+idempotent schema (R1) | schema apply log: new table CREATE; existing objects "already exists, skipping" |
| Disposable data / no touch to sr_users/content (constraints) | ROLLBACK + post-rollback residue = 0; proof only seeds user_id 2 attempts/events |

Not-run / N/A: no UI in scope (no Playwright); server functions themselves are exercised via the empirical psql proof of their exact SQL rather than a request-context harness (documented R-TEST obstacle — server fns need cookie/DB context, so business logic was isolated into the pure `computeProgress` core which IS unit-tested).
