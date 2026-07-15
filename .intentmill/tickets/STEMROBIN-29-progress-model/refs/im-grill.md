# IntentMill Grill

> Adjudication mode: **full delegation (cap13, no human)**. Blocking decisions carry the seed STEMROBIN-26 grill rulings the human made in-session (batch 0005 `grill.md`); remaining decisions are self-adjudicated from the live charter + repository evidence. No `final_decision` is left `TBD`.

## Blocking Decisions

1.
- id: BD-1-practice-complete-rule
- question: What defines "练习完成" (practice-complete) for a lesson, and how much history is stored?
- recommendation: Practice-complete = the LATEST attempt's score ≥ 80% (can regress); store only the latest two attempts per (user, lesson); one submission scores.
- final_decision: Practice-complete = latest attempt score ≥ 80% (regresses below 80). Store latest TWO attempts per (user, lesson) in `sr_practice_attempts`; a 3rd insert prunes the oldest. (human ruling, seed grill "G-练习完成".)

2.
- id: BD-2-reading-complete-rule
- question: What defines "课文完成" (reading-complete) for a lesson, and where is it derived from?
- recommendation: Reading-complete = walked all cards = every read-check of the lesson has a correct answer; derive from `sr_content_answer_events` (kind='read_check', is_correct=true); no new reading table.
- final_decision: Reading-complete = a correct read-check event exists for EVERY read-check of the lesson, derived from `sr_content_answer_events` kind='read_check' is_correct=true; no new reading-completion table (soft gate, re-reading allowed). (human ruling, seed grill "G-课文完成".)

3.
- id: BD-3-locale-agnostic-totals
- question: How is progress aggregated across locales, and what is the total point count?
- recommendation: Per-lesson, locale-agnostic (zh/en of one lesson = one point set); total points = 2 × number of existing lessons.
- final_decision: Progress is per-lesson and locale-agnostic (same lesson id in any locale counts once). Total points = 2 × count of lessons in `sr_lessons` (= 32 for 16 lessons); completed = Σ(reading-complete + practice-complete). (human ruling, seed grill "G-进度跨语言合一".)

4.
- id: BD-4-reading-complete-when-no-readchecks
- question: A migrated lesson can have JSONB content but zero read-checks (confirmed live: `math-s2-08`). Is such a lesson reading-complete vacuously (true for every learner) or never via this signal?
- recommendation: Require read-check count > 0 for reading-complete, so a lesson with no read-check gate is never auto-marked complete for untouched learners.
- final_decision: A lesson is reading-complete only when it defines ≥ 1 read-check AND every read-check has a correct event. A lesson with zero read-checks is never reading-complete via this signal (conservative — never inflates progress). Self-adjudicated from charter goal (progress must reflect the learner actually walking the cards, not a vacuous truth); flagged to the human as a residual in `im-handoff.md` for later override if a no-read-check lesson should count.

## Recommended Defaults

- New table `sr_practice_attempts` is purpose-built for JSONB-world practice scores; do NOT overload the legacy `sr_quiz_attempts` (relational `sr_questions` deck, different world). Seed feasibility probe confirmed new storage is needed.
- `score` is a percentage in [0,100] stored as `NUMERIC(5,2)` with `CHECK (score >= 0 AND score <= 100)`; threshold is `score >= 80`. Matches acceptance examples ("85%", "50%") and tolerates fractional scores.
- Server functions live in a new `app/src/lib/progress.ts`, reusing `sql()` (`db.ts`) and `currentUserId()` (`session.server.ts`). No second DB client, no new dependency.
- All business logic is factored into a pure `computeProgress(...)` (DB-free) so it is unit-testable; DB-bound recording/pruning + reading/practice derivation are verified empirically via psql (the ticket's gate6 contract).
- Pruning to latest 2 is enforced in the recording path (delete rows outside the newest 2 by `submitted_at desc, id desc`), NOT a trigger (human ruling).
- `getProgress()` when logged out returns all-incomplete (`completedPoints = 0`) but still reports `totalPoints = 2 × lessons` — graceful; the site-wide login gate is STEMROBIN-31.
- Unit test co-located at `app/src/lib/progress.test.ts` (repo convention; run by `vitest run`), with a results note under the ticket `tests/`.

## Future Or Conditional Decisions

- Practice UI, per-attempt scoring wiring, and the homepage real progress bar are STEMROBIN-30 (this ticket only exposes storage + `getProgress`/`recordPracticeAttempt` for it to call).
- If a future lesson legitimately has no read-check gate but should still be reading-completable, revisit BD-4 (e.g. a "cards viewed" signal). Not needed now.
- Site-wide login gating is STEMROBIN-31; `getProgress`/`recordPracticeAttempt` only need `currentUserId()` today.

## Out-of-Scope Guardrails

- No practice-answering UI, no homepage progress bar, no route/component changes (STEMROBIN-30).
- No changes to `sr_users`, the 16 lessons, any lesson content/exercises, or legacy `sr_quiz_attempts`/`quiz.ts` behavior.
- Schema changes only in `ssot-schemas/db-schemas/stemrobin.sql`, additive + idempotent, applied via the server-only `psql` path.
- No new dependency, no new recurring cost, no second DB client, no new answer-key exposure.
