# IntentMill Draft

## Source

- ticket key: STEMROBIN-29-progress-model
- ticket id: STEMROBIN-29
- `meta.json` read (`.intentmill/tickets/STEMROBIN-29-progress-model/meta.json`).
- `intent.md` read as the raw original user input (batch 0005 ticket full text + live charter + seed STEMROBIN-26 grill rulings).
- `AGENTS.md` read (repo router; charter = intent, evodocs = understanding).
- `.prodfarm/charter/` (goal/redlines) and seed grill read at `.prodfarm/batches/0005-progress-and-access/{story-list.md,grill.md}`.
- `.evodocs/modules/module-index.json` chain: read `mod--database-schema.md` and `mod--app--domain-services.md` (both directly relevant).
- code areas inspected: `ssot-schemas/db-schemas/stemrobin.sql`, `app/src/lib/db.ts`, `app/src/lib/reading.ts` (read-check recording + JSONB content shape), `app/src/lib/quiz.ts` (legacy `sr_quiz_attempts` model + `getLatestScore`/`recordAnswer`), `app/src/lib/session.server.ts` (`currentUserId`), `app/src/lib/lessons.ts` (`listLessonIds`, JSONB node extraction SQL), `app/src/lib/locale.server.ts`.
- external docs: none needed — no new/unfamiliar external interface; all storage is the existing project Postgres via `postgres` (already a dependency).
- `nf-db`: not used; DB inspection done via `psql "$EASYAPP_DATABASE_URL"` against the live shared schema (read-only counts + disposable seeded rows for user_id 2, cleaned up), which is the project's server-only path per the schema header.
- frontend `DESIGN.md`: not read — this ticket has NO user-facing UI (explicitly deferred to STEMROBIN-30). No UI surface changes.

## Draft Spec

After delivery:

- A durable structure stores practice-attempt scores per learner per lesson: `sr_practice_attempts` = (user_id, lesson_id, score, submitted_at). Only the latest TWO attempts per (user_id, lesson_id) are retained; recording a 3rd prunes the oldest.
- A server function `recordPracticeAttempt(lessonId, score)` inserts one attempt for the logged-in learner and prunes that (user, lesson) group to the latest 2. Rejects when logged out (no row written).
- A server function `getProgress()` returns, for the current learner, per-lesson `readingComplete` and `practiceComplete`, plus totals: `totalPoints = 2 × (count of lessons in sr_lessons)` and `completedPoints = Σ (readingComplete?1:0 + practiceComplete?1:0)`.
- `readingComplete` for a lesson = a correct read-check event exists for EVERY read-check the lesson defines, derived from `sr_content_answer_events` (kind='read_check', is_correct=true) against the read-check ids in `sr_lessons.content` JSONB. No new reading-completion table.
- `practiceComplete` for a lesson = the LATEST attempt's score ≥ 80 (percent). Regresses: a later attempt below 80 flips it back to incomplete.
- Progress is per-lesson and locale-agnostic: the same lesson in zh/en is one lesson id = at most 2 points (1 reading + 1 practice); it is never double-counted per locale.
- The pure progress computation is isolated and unit-tested independently of the DB.

## Draft Plan

- New file `app/src/lib/progress.ts` (assumption: name from intent's "e.g. progress.ts"). Holds: a pure `computeProgress(...)` function (DB-free, unit-testable) plus two `createServerFn` wrappers `recordPracticeAttempt` and `getProgress` that gather DB rows and call the pure core.
- Schema: append an additive + idempotent block to `ssot-schemas/db-schemas/stemrobin.sql` creating `sr_practice_attempts` (+ an index on `(user_id, lesson_id, submitted_at)`), applied with `psql "$EASYAPP_DATABASE_URL" -f ...`.
- Reuse existing helpers: `sql()` from `app/src/lib/db.ts` (the single server client), `currentUserId()` from `session.server.ts`. Reuse the JSONB read-check-id extraction pattern already in `lessons.ts`/`reading.ts`.
- Pruning enforced in the recording path (delete rows outside the latest 2 by `submitted_at desc, id desc`), per the human ruling — not a trigger.
- Unit test `app/src/lib/progress.test.ts` (repo convention: co-located `*.test.ts`, run by `vitest run`) covering the pure `computeProgress`: reading-complete requires all read-checks correct; practice-complete uses latest score ≥ 80 and regresses; totals = 2 × lessons; locale-agnostic single-count.
- Leave untouched: `sr_users`, the 16 lessons, all content, legacy `sr_quiz_attempts`/`quiz.ts`, all UI/routes.

## Code And Evodocs Findings

- **New table is required, distinct from legacy `sr_quiz_attempts`.** `quiz.ts` already has a `sr_quiz_attempts` model (open/ended passes over the *relational* `sr_questions` deck, with `getLatestScore` computing a `ScoreSummary` on the fly). That is the pre-JSONB deck world. The current learner experience (batch 0004) is JSONB card-reading + JSONB exercises recorded in `sr_content_answer_events` (kind ∈ read_check|exercise) — there is NO stored practice *score* there. The seed feasibility probe confirms: "练习最近两次 attempt/分数 需新存储（新表，每用户每课留 2 条）". So `sr_practice_attempts` is a new, purpose-built store; do not overload `sr_quiz_attempts`.
- **Reading-complete signal source.** `sr_lessons.content` JSONB = `{cards:[{read_check:[{id,...}]}]}`. Read-check answers are recorded by `recordReadCheck` in `reading.ts` into `sr_content_answer_events (user_id, lesson_id, kind='read_check', node_id=<read_check id>, is_correct, locale)`. So reading-complete = for every `read_check.id` in the lesson content, ∃ an event with is_correct=true. Confirmed live: 16 lessons, all subject=math; read-check counts per lesson range 8–10, EXCEPT `math-s2-08` which has content (1 card) but **0 read-checks**.
- **Locale-agnostic is structural.** `sr_content_answer_events.lesson_id` and `sr_practice_attempts.lesson_id` are the locale-agnostic lesson identity; `locale` is disposable analytics only. Grouping by `lesson_id` (never by locale) yields per-lesson single-counting for free. zh/en of one lesson share one lesson id.
- **`getProgress` must count lessons from `sr_lessons`.** `totalPoints = 2 × (select count(*) from sr_lessons)` = 2 × 16 = 32. Locale-agnostic (there is one row per lesson regardless of locale — locales live in the i18n overlay, not extra lesson rows).
- **R-UI:** none. No user-visible surface changes; UI is STEMROBIN-30. No peer-app research needed.
- **R-EXT:** none. No new/unfamiliar external interface; only the existing server-only Postgres client.
- **R-TEST:** the two server fns depend on `createServerFn` request context (`currentUserId`/`getCookie`) and a live DB, which is awkward to unit-test in isolation. Mitigation: factor all business logic into a **pure** `computeProgress(...)` and pruning-selection logic that is unit-tested without DB/request context; verify the DB-bound recording/pruning + reading/practice derivation **empirically via psql** with disposable seeded rows for user_id 2 (per the ticket's empirical gate), then clean up. This mirrors the repo's existing split (`reading.ts` unit-tests `projectCards`/`judgeReadCheck`; `quiz.ts` logic is exercised via DB).

## Assumptions

- File name `app/src/lib/progress.ts` (intent says "e.g. `progress.ts`"). Low risk — cosmetic.
- `score` is a percentage in [0,100]; threshold is `score >= 80`. Stored as `NUMERIC(5,2)` to tolerate fractional scores (e.g. 5/6 = 83.33). Acceptance examples ("85%", "50%") fit. Low risk.
- Unit test co-located as `app/src/lib/progress.test.ts` (repo convention; picked up by `vitest run`), with a mirror results note under `im tests path`. Low risk.
- `getProgress()` when logged out returns all-incomplete with `completedPoints=0` but still `totalPoints=2×lessons` (graceful; full login gate is STEMROBIN-31). Low risk.

## Risks

- **DB/schema:** `stemrobin.sql` is a create-only script (no migration runner). `sr_practice_attempts` is a brand-new table, so `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` is fully additive and idempotent — safe to apply to the live shared DB. Must NOT alter existing tables.
- **Reading-complete vacuous-truth edge (`math-s2-08`, 0 read-checks):** "for EVERY read-check ∃ correct event" is vacuously true when a lesson has no read-checks, which would mark that lesson reading-complete for *every* learner including brand-new ones (inflating progress). Draft decision: require `readCheckCount > 0` so a lesson with no read-check gate is never auto-complete (conservative — never over-counts). This is a genuine grill decision → surfaced in cap4.
- **Score scale ambiguity:** if STEMROBIN-30 passes a 0–1 fraction instead of 0–100, the ≥80 threshold breaks. Mitigated by making the score contract explicit in the spec (percent, 0–100) and a CHECK constraint; STEMROBIN-30 must honor it.
- **Data authorization:** empirical proof seeds disposable events/attempts for user_id 2 and content-answer events; must delete exactly what was seeded and never touch `sr_users` or lesson/content rows.
- **R-TEST:** server fns are not directly unit-testable without request context + DB; addressed by the pure-core split + empirical psql proof (above).

## Grill Required

completed

Grill decisions (`im-grill.md`) resolved: practice-complete = latest score ≥ 80% with latest-2 storage (BD-1); reading-complete = all read-checks correct, derived from `sr_content_answer_events`, no new table (BD-2); per-lesson locale-agnostic totals = 2 × lessons (BD-3); a lesson with zero read-checks is never reading-complete (BD-4, self-adjudicated, residual flagged for human).
