# IntentMill Handoff — STEMROBIN-29 progress-model

## Actual Changes

- **`ssot-schemas/db-schemas/stemrobin.sql`** — appended an additive + idempotent block creating `sr_practice_attempts`:
  - Columns: `id` (identity PK), `user_id` BIGINT FK→`sr_users(user_id)` ON DELETE CASCADE, `lesson_id` TEXT FK→`sr_lessons(id)` ON DELETE CASCADE, `score` NUMERIC(5,2) `CHECK (score >= 0 AND score <= 100)` (percent), `submitted_at` TIMESTAMPTZ DEFAULT now().
  - Index `sr_practice_attempts_user_lesson_idx (user_id, lesson_id, submitted_at)`.
  - No `ALTER` of any existing table. Applied via `psql "$EASYAPP_DATABASE_URL" -f ssot-schemas/db-schemas/stemrobin.sql` (verified: new table created; existing objects skipped).
- **`app/src/lib/progress.ts`** (new) — three parts:
  - Pure `computeProgress(lessons, correctReadCheckIdsByLesson, latestScoreByLesson): Progress` (+ exported types `LessonReadChecks`, `LessonProgress`, `Progress`). Reading-complete = `readCheckIds.length > 0 && every id correct`; practice-complete = `latestScore != null && latestScore >= 80`; `totalPoints = 2 × lessons.length`; `completedPoints = Σ(reading + practice)`.
  - `recordPracticeAttempt = createServerFn({method:'POST'})` — signature `{ lessonId: string; score: number }`. Requires `currentUserId()` (returns `{error:'请先登录'}` + writes nothing when logged out; rejects score outside [0,100]). Inserts one row, then prunes to the latest 2 per (user,lesson) via `delete … where id not in (select id … order by submitted_at desc, id desc limit 2)`. Returns `{ok:true}`.
  - `getProgress = createServerFn({method:'GET'})` — no args. Reads all lessons + their read-check ids from `sr_lessons.content` JSONB; for the logged-in learner, reads correct read-check node_ids from `sr_content_answer_events` (kind='read_check', is_correct=true) and the latest score per lesson (`distinct on (lesson_id) … order by lesson_id, submitted_at desc, id desc`); returns `computeProgress(...)`. Logged out ⇒ all lessons incomplete, `completedPoints=0`, correct `lessonCount`/`totalPoints`.
- **`app/src/lib/progress.test.ts`** (new) — 12 unit tests for the pure core.

Reading/practice/totals are computed **locale-agnostic**: every query keys on `lesson_id` only (no `locale` filter). `sr_lessons` has one row per lesson regardless of locale (locales live in the i18n overlay), so `totalPoints = 2 × 16 = 32` and a lesson counts at most 2 points.

Latest-2 enforcement lives in the **recording path** (`recordPracticeAttempt`), not a trigger — per the human ruling.

## Spec And Plan Alignment

- **Spec obligations (R1–R10):** all satisfied. R1 table shape ✔ (verified via `\d`); R2 latest-2 prune ✔ (psql PROOF 1); R3 record + login gate ✔; R4 getProgress shape ✔; R5 reading derivation + BD-4 guard ✔ (psql PROOF 2 + unit); R6 practice latest≥80 + regression ✔ (psql PROOF 3 + unit); R7 totals ✔ (unit + live 16→32); R8 locale-agnostic ✔ (queries key on lesson_id); R9 logged-out totals ✔; R10 pure core ✔ (unit-tested).
- **Plan obligations:** followed. Schema block additive/idempotent; new `progress.ts` reuses `sql()` + `currentUserId()`; pruning in recording path; unit tests + empirical psql proof as planned.
- **Critical existing contracts:** preserved. Single `sql()` client; identity only via `currentUserId()`; read-check event + content JSONB read read-only; answer-key material never read/exposed; schema create-only (no ALTER); legacy `sr_quiz_attempts`/`quiz.ts` untouched.
- **Non-scope / rejected options:** no UI, no homepage bar, no route/component changes; no trigger; no second DB client; no new dependency; `sr_users` and the 16 lessons/content untouched. Legacy attempt model not reused.
- **Test obligations:** every `im-plan.md` Unit Test Plan item mapped in `tests/test-results.md ## Coverage Map`.

## Deviations From Spec/Plan

None. Implementation matches `im-spec.md` and follows `im-plan.md`.

## Missed User-Review Points

None blocking. One self-adjudicated decision is surfaced for optional human review below (BD-4) — it is non-blocking (conservative default that never inflates progress).

## Residual Issues / Future Improvements

- **BD-4 (residual, non-blocking):** a lesson with JSONB content but zero read-checks (live: `math-s2-08`) is treated as never reading-complete (require ≥1 read-check). This was self-adjudicated from the charter (progress should reflect actually walking the cards, not a vacuous truth) since the human seed grill did not rule on it. If product later decides an ungated lesson should be reading-completable, this rule needs a different signal (e.g. a "cards viewed" event). Flagged for human override.
- **STEMROBIN-30 wiring:** `recordPracticeAttempt` / `getProgress` are exposed but not yet called by any UI — that is STEMROBIN-30 (practice scoring + real homepage progress bar). STEMROBIN-30 must pass `score` as a percent in [0,100].
- The two server functions' request-context path (cookie → `currentUserId`, live DB) is not covered by an automated unit harness (documented R-TEST obstacle); their exact SQL behavior is proven empirically via psql. A future integration-test harness with a seeded session cookie could automate this.

## Commit Status

Uncommitted. Per the n-im flow, cap6 stops at a verified worktree; committing/pushing/PR is cap8's responsibility (not run here).

## Charter Drift

None. No stack or ops change: no new dependency, no new service, no new recurring cost. The schema grew by one additive table applied through the existing server-only `psql` path already documented in the runbook/charter.
