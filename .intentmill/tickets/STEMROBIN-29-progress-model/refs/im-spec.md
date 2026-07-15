# IntentMill Spec

## Intent

Establish practice-attempt storage and progress computation for StemRobin's JSONB-world learning experience, as an enabler with NO user-facing UI. Deliver the server-side data model + functions that STEMROBIN-30 (practice scoring + real homepage progress bar) will call.

## Scope

- A new durable table `sr_practice_attempts` storing per-learner, per-lesson practice scores, keeping only the latest TWO attempts per (user_id, lesson_id).
- A server function `recordPracticeAttempt(lessonId, score)` that records one attempt for the logged-in learner and prunes that (user, lesson) group to the latest two.
- A server function `getProgress()` that returns, for the current learner, per-lesson reading-complete and practice-complete plus total/completed points.
- A pure, DB-free progress-computation function that both server functions and unit tests use.
- Additive + idempotent schema change in `ssot-schemas/db-schemas/stemrobin.sql`.

## Non-Scope

- No practice-answering UI, no homepage progress bar, no route/page/component changes (these are STEMROBIN-30).
- No changes to `sr_users`, the 16 lesson rows, any lesson content/exercises JSONB, or the per-locale i18n overlay.
- No changes to legacy `sr_quiz_attempts` or `app/src/lib/quiz.ts` behavior; the new table is separate and does not replace or read them.
- No site-wide login gating (STEMROBIN-31).
- No new dependency, no new recurring cost, no second DB client, no trigger-based enforcement.

## Requirements

- R1. `sr_practice_attempts` exists with columns: `id` (identity PK), `user_id` (FK → `sr_users(user_id)` ON DELETE CASCADE), `lesson_id` (FK → `sr_lessons(id)` ON DELETE CASCADE), `score` NUMERIC(5,2) with `CHECK (score >= 0 AND score <= 100)`, `submitted_at` TIMESTAMPTZ NOT NULL DEFAULT now(). Created additively and idempotently (`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` on `(user_id, lesson_id, submitted_at)`), applied via `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql`.
- R2. Only the latest TWO attempts per (user_id, lesson_id) are retained. Recording a 3rd attempt leaves exactly two rows — the two newest by `submitted_at` (tie-broken by `id`). Enforcement is in the recording path (delete rows outside the newest two), not a trigger.
- R3. `recordPracticeAttempt(lessonId, score)` inserts one attempt for the current logged-in learner (`currentUserId()`), then prunes to latest two. When no learner is logged in, it records nothing and returns an error result. `score` is a percentage in [0,100].
- R4. `getProgress()` returns, for the current learner: a per-lesson list where each entry has `lessonId`, `readingComplete`, `practiceComplete`; plus `lessonCount`, `totalPoints`, `completedPoints`.
- R5. `readingComplete` for a lesson is true iff the lesson defines at least one read-check AND every read-check id in `sr_lessons.content` (`cards[].read_check[].id`) has a correct event in `sr_content_answer_events` (kind='read_check', is_correct=true) for that learner and lesson. A lesson with zero read-checks is never reading-complete (BD-4). No new reading-completion table is created; the signal is derived from existing events.
- R6. `practiceComplete` for a lesson is true iff the learner's LATEST attempt for that lesson (by `submitted_at`, tie-broken by `id`) has `score >= 80`. It regresses: a later attempt with `score < 80` makes it false again.
- R7. `totalPoints = 2 × (count of rows in sr_lessons)`. `completedPoints = Σ over lessons of (readingComplete?1:0 + practiceComplete?1:0)`.
- R8. Progress is per-lesson and locale-agnostic: aggregation keys on `lesson_id` only, never on locale, so the same lesson in any locale contributes at most 2 points and is never double-counted.
- R9. When no learner is logged in, `getProgress()` returns all lessons incomplete with `completedPoints = 0`, while still reporting the correct `lessonCount` and `totalPoints`.
- R10. All progress business logic is contained in a pure, DB-free `computeProgress(...)` function so it can be unit-tested without a database or request context.

## Critical Existing Contracts

- **Single server-side SQL client**: all DB access goes through `sql()` from `app/src/lib/db.ts`, which sets the quoted `"stemrobin-schema"` search path and holds the server-only connection string. No second client, no browser DB access.
- **Session identity**: the logged-in learner is obtained only via `currentUserId()` from `app/src/lib/session.server.ts` (HMAC-signed cookie → numeric user id, or null). Recording requires it; it must never be trusted from client input.
- **Read-check event shape (batch 0004)**: `sr_content_answer_events (user_id, lesson_id, kind, node_id, is_correct, chosen, answer_text, locale)`, written by `recordReadCheck` in `app/src/lib/reading.ts` with `kind='read_check'` and `node_id` = the JSONB read-check id. `lesson_id` is the locale-agnostic lesson identity; `locale` is disposable analytics.
- **Content JSONB shape**: `sr_lessons.content = { cards: [ { read_check: [ { id, ... } ] } ] }`. Read-check ids are the join key between content and events. Answer-key material (`key`) in content must never be selected into any browser payload — this ticket does not read `key` at all.
- **Answer-key secrecy**: unchanged; `getProgress`/`recordPracticeAttempt` never expose correct answers.
- **Schema is create-only (no migration runner)**: the new table must be a fully additive `CREATE TABLE IF NOT EXISTS` block; it must not `ALTER` existing tables.
- **Lesson identity**: 16 rows in `sr_lessons` (all subject=math today), one row per lesson regardless of locale; locales live in the i18n overlay, not extra lesson rows.

## Confirmed Decisions

- BD-1: practice-complete = latest attempt score ≥ 80% (regresses); store latest two attempts per (user, lesson); one submission scores. (human)
- BD-2: reading-complete = every read-check correct, derived from `sr_content_answer_events`; no new reading table; soft gate. (human)
- BD-3: per-lesson, locale-agnostic; total = 2 × existing lessons. (human)
- BD-4: a lesson with zero read-checks is never reading-complete (require read-check count > 0). (self-adjudicated from charter; residual flagged for human override.)
- `score` stored NUMERIC(5,2) in [0,100], threshold ≥ 80.
- New purpose-built table `sr_practice_attempts`; legacy `sr_quiz_attempts` untouched and not reused.
- Pruning in the recording path, not a trigger.
- Server functions in new `app/src/lib/progress.ts`; pure `computeProgress(...)` unit-tested; DB-bound behavior verified empirically via psql.

## Compatibility And Regression Constraints

- Additive schema only: applying the updated `stemrobin.sql` to the live shared DB must create `sr_practice_attempts` and its index without touching any existing table, row, or index. Re-applying is idempotent.
- No behavioral change to any existing server function, route, content saver, or the legacy attempt model. `progress.ts` is a new module with no existing consumers; `getProgress`/`recordPracticeAttempt` are new exports.
- `sr_content_answer_events` and `sr_lessons.content` are read-only for this ticket (never written or altered).
- Empirical verification uses only disposable rows for test `user_id = 2` (practice attempts + content-answer events) and cleans them up; it never touches `sr_users`, lessons, or content.

## Open Questions

None.
