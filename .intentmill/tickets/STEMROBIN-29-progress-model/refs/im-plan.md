# IntentMill Plan

## Source Contract

`im-spec.md` is the source contract for this plan. Every step below traces to a spec requirement (R1–R10), a confirmed decision (BD-1..BD-4), or a critical existing contract in `im-spec.md`. This plan adds no requirement beyond `im-spec.md`.

## Implementation Approach

Two artifacts:

1. **Schema** — append one additive + idempotent block to `ssot-schemas/db-schemas/stemrobin.sql` creating `sr_practice_attempts` (R1) and its index. No `ALTER` of existing tables. Apply with `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`.

2. **New module `app/src/lib/progress.ts`** with three parts:
   - A pure, DB-free core (R10):
     - `computeProgress(lessons, correctReadCheckIdsByLesson, latestScoreByLesson)` → `{ lessons: LessonProgress[], lessonCount, totalPoints, completedPoints }`, where each `LessonProgress = { lessonId, readingComplete, practiceComplete }`.
       - `readingComplete = readCheckIds.length > 0 && readCheckIds.every(id => correctSet.has(id))` (R5, BD-4).
       - `practiceComplete = latestScore != null && latestScore >= 80` (R6).
       - `totalPoints = 2 * lessons.length` (R7). `completedPoints = Σ(readingComplete + practiceComplete)`.
     - A pure helper `keepLatestTwoIds(rows)` (or inline SQL equivalent) is not required if pruning is done in SQL; the latest-2 selection ordering (`submitted_at desc, id desc`) is the contract (R2).
   - `recordPracticeAttempt = createServerFn({ method: 'POST' })` (R3):
     - Read `currentUserId()`; if null return `{ error: '请先登录' }` and write nothing.
     - Insert `(user_id, lesson_id, score)` into `sr_practice_attempts`.
     - Prune: `delete from sr_practice_attempts where user_id=$uid and lesson_id=$lessonId and id not in (select id from sr_practice_attempts where user_id=$uid and lesson_id=$lessonId order by submitted_at desc, id desc limit 2)`.
     - Return `{ ok: true }`.
   - `getProgress = createServerFn({ method: 'GET' })` (R4, R8, R9):
     - Query lesson ids + read-check ids from `sr_lessons.content` (all lessons, including those with zero read-checks) using `jsonb_array_elements` over `content->'cards'` and `coalesce(c->'read_check','[]')`, mirroring the extraction pattern already in `app/src/lib/lessons.ts` / `reading.ts`.
     - `uid = currentUserId()`. If null: build empty `correctReadCheckIdsByLesson` and `latestScoreByLesson`, so all lessons compute incomplete while `lessonCount`/`totalPoints` stay correct (R9).
     - If non-null: query correctly-answered read-check node ids: `select distinct lesson_id, node_id from sr_content_answer_events where user_id=$uid and kind='read_check' and is_correct=true`. Query latest score per lesson: `select distinct on (lesson_id) lesson_id, score from sr_practice_attempts where user_id=$uid order by lesson_id, submitted_at desc, id desc`.
     - Assemble the pure inputs (keyed on `lesson_id` only — locale-agnostic, R8) and return `computeProgress(...)`.

Reuse `sql()` (`app/src/lib/db.ts`) and `currentUserId()` (`app/src/lib/session.server.ts`). No new dependency, no second client.

## Implementation Drift Controls

- Do NOT create or read `sr_quiz_attempts`; the new table is separate (spec Non-Scope, Critical Contracts).
- Do NOT select or expose any `key`/`correct_index`/`accept`/`answer` material; this ticket reads only read-check `id`s from content and `is_correct` from events (answer-key secrecy).
- Aggregation MUST key on `lesson_id` only, never on `locale` (R8). Do not add a `locale` filter to any progress query.
- Reading-complete MUST require `readCheckIds.length > 0` (BD-4); do not let a zero-read-check lesson be vacuously complete.
- Practice-complete MUST use the single latest attempt (`submitted_at desc, id desc` first row), not a max or an average (R6) — so a regressed latest score flips it false.
- Pruning MUST be in the recording path (delete outside newest 2), not a DB trigger (BD, Non-Scope).
- Schema block MUST be `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` only; no `ALTER` of existing tables (Critical Contracts).
- Leave `sr_users`, the 16 lessons, content/exercises, i18n overlay, and all existing modules/routes untouched (Non-Scope, Regression Constraints).

## Phases

1. **Schema.** Append the `sr_practice_attempts` block to `stemrobin.sql`. Apply it via `psql`. Verify the table + FKs + CHECK + index exist. (R1)
2. **Pure core.** Implement `computeProgress(...)` and the type exports in `progress.ts`. (R5–R8, R10)
3. **Unit tests.** Add `app/src/lib/progress.test.ts` covering the Unit Test Plan below; run `vitest run`. (R10)
4. **Server functions.** Implement `recordPracticeAttempt` and `getProgress` in `progress.ts` on top of the pure core. (R3, R4, R9)
5. **Empirical proof (gate6 contract).** With disposable rows for `user_id = 2`, psql-prove: latest-2 pruning (a 3rd insert leaves exactly the two newest); a lesson with all read-checks correct → readingComplete; latest attempt 85 → practiceComplete; a later attempt 50 → practiceComplete false (regression). Clean up all seeded rows afterward. (R2, R5, R6)
6. **Type/build check.** Run the repo TypeScript/vitest to confirm no breakage. Write `test-results.md` and `im-handoff.md`.

## Unit Test Plan

Ticket-scoped unit tests for the pure `computeProgress(...)` (high-risk logic, DB-free):

- **Reading-complete all correct**: a lesson whose every read-check id is in the correct set → `readingComplete = true`.
- **Reading-incomplete missing one**: a lesson missing one correct read-check → `readingComplete = false`.
- **Reading zero read-checks (BD-4)**: a lesson with an empty read-check id list → `readingComplete = false` even if the correct set is non-empty. (High-risk edge; guards against vacuous truth.)
- **Practice-complete threshold**: latest score 80 → true; 79.99 → false; 85 → true.
- **Practice regression (R6)**: `latestScoreByLesson` reflecting a later 50 → `practiceComplete = false`. (The pure fn takes the already-resolved latest score; the "latest wins / regression" ordering itself is verified empirically in Phase 5 because it is DB-ordering behavior.)
- **Practice absent**: no attempt → `practiceComplete = false`.
- **Totals (R7)**: `totalPoints = 2 × lessons.length`; `completedPoints` sums reading + practice across lessons.
- **Locale-agnostic single-count (R8)**: inputs keyed only by `lesson_id` yield one point-pair per lesson id (the pure fn has no locale axis — asserts a lesson id appears once and contributes ≤ 2).

DB-ordering and persistence behavior that cannot be unit-tested purely (R2 pruning, R6 latest-wins ordering, R5 event derivation) are covered by the Phase 5 empirical psql proof with disposable data, recorded in `test-results.md`.

## Handoff Expectations

`im-handoff.md` must record:
- Actual table shape + latest-2 enforcement location (recording path).
- The two server functions (signatures, file) and how reading/practice/totals are computed locale-agnostically.
- The psql empirical proof (2-cap + regression + reading derivation) and the co-located unit-test run.
- Confirmation that content and `sr_users` were untouched and no UI was wired.
- `## Spec And Plan Alignment` mapping spec obligations, plan obligations, critical contracts, non-scope/rejected options, and test obligations.
- `## Blocker` only if an external premise failed.
- Residual: BD-4 (zero-read-check lesson never reading-complete) flagged for possible human override; any grill-leaks.
