# IntentMill Grill

> Self-adjudicated under full delegation (prodfarm cap13, no human in the loop).
> Every blocking `final_decision` is resolved from the charter, the seed grill
> decisions carried in intent.md, and the recommendation evidence in im-draft.md.

## Blocking Decisions

1.
- id: when-to-record-score
- question: At which moment is a practice attempt's score persisted to the progress model, and on how many of a lesson's attempts?
- recommendation: Record server-side inside `endAttempt` on **every** `结束本课答题` submission (intent's "提交一次答题"), using the percent the drawer's `ScoreCard` already shows. `getProgress` uses only the latest attempt as the live practice signal and STEMROBIN-29 already prunes storage to the latest two, so a later low attempt regresses the point with no extra logic. Client never sends the score (server-authoritative, answer-key-secret).
- final_decision: Record in `endAttempt` on every attempt end, server-side, using `gradableTotal>0 ? round(correct/gradableTotal×100) : 0`. Do not record on `startAttempt`, per-question `recordAnswer`, or from the client.

2.
- id: reuse-without-duplication
- question: How does `quiz.ts` persist the score without duplicating STEMROBIN-29's insert+prune SQL (SSOT, engineering-rules §5)?
- recommendation: Extract the existing insert+prune body of `recordPracticeAttempt` into one plain exported server-side helper in `progress.ts` (e.g. `storePracticeAttempt(uid, lessonId, score)`); have both the `recordPracticeAttempt` server fn and `endAttempt` call it. One definition of the storage rule; no copied SQL in `quiz.ts`.
- final_decision: Add `storePracticeAttempt(uid, lessonId, score)` to `progress.ts`; `recordPracticeAttempt` delegates to it (no behavior change); `endAttempt` calls it. No prune/insert SQL is duplicated in `quiz.ts`.

3.
- id: all-work-deck-zero
- question: For a lesson whose deck is entirely `work`/说理 items (`gradableTotal = 0`), what score is recorded?
- recommendation: Record the same value the learner sees — `0` — with no special case. Such a deck cannot be practice-complete because there is nothing to grade; showing 0 and storing 0 are consistent, and adding a "skip" branch would create a second, hidden definition of "no score". No such practice deck is known to exist today.
- final_decision: Record the displayed percent unchanged (0 when `gradableTotal = 0`). No special-case branch.

4.
- id: homepage-refresh-timing
- question: Must the homepage bar update live the instant a drawer attempt ends, or is updating on the next navigation/SSR load sufficient?
- recommendation: The bar is driven by the route loader (`getProgress()` on SSR/navigation). A learner ends an attempt inside a lesson page's drawer, then returns to the overview, which re-runs the loader and shows the fresh bar — this satisfies the acceptance ("moves when the user … scores a practice attempt"). A live drawer→home push adds cross-route state for no acceptance gain (simplicity §2).
- final_decision: Drive the bar from the overview loader only. No live drawer→home refresh channel. Acceptance is checked by navigating to the overview after an attempt.

5.
- id: progress-card-content
- question: What does the repurposed progress card show, and what happens to the three mock stat tiles and the `/ 96 课` unit?
- recommendation: Headline number = `completedPoints`, unit = `/ {totalPoints}` (real, from `getProgress`); bar width = `completedPoints/totalPoints`. Replace the three fake tiles: keep two backed by real data — 课文 points completed (reading-complete lessons) and 练习 points completed (practice-complete lessons) — and **drop the streak tile**, which has no data source (showing a fabricated streak violates the no-mock intent). Reuse existing `.sr-progress*` classes; the grid adapts to two tiles.
- final_decision: Bar + headline = real `completedPoints / totalPoints`. Two real tiles (课文完成 / 练习完成 counts from `getProgress().lessons`); remove the streak tile. Update `ov.progress.unit` and the two tile labels in zh + en; remove the `ov.stat.streak` usage. Keep all `.sr-progress*` classes/tokens (no new hue, no CSS restructure beyond the tile count).

## Recommended Defaults

- Percent definition is single-sourced: `endAttempt`'s recorded score equals the `ScoreCard` formula; if that formula ever changes, both move together (they read the same `ScoreSummary`).
- `totalPoints` is always `2 × lessonCount` from `getProgress()`; never hardcode 32/96.
- Reading-signal write path is untouched (`recordReadCheck` already emits `read_check` events that `getProgress` reads).
- Story quizzes (drawer opened without the attempt API) are unaffected — they never call `endAttempt`, so they never record a practice score. Correct: stories carry no lesson practice point.

## Future Or Conditional Decisions

- A real streak / mastery / weak-concept panel once a data source exists (currently none) — could re-add a third tile.
- Per-lesson progress badges in the catalog (reading/practice dots) — out of this ticket; would consume the same `getProgress().lessons` projection.
- Locale-specific practice regression analytics — not needed; the model is already locale-agnostic on `lesson_id`.

## Out-of-Scope Guardrails

- No schema change: both attempt tables and the content-event table already exist (STEMROBIN-11 + STEMROBIN-29). Backed by inspected `stemrobin.sql`.
- No change to the quiz-drawer's per-question answering UX, the choice-only + server-judged contract, or answer-key secrecy — the only new server behavior is one score write at attempt end.
- No new dependency; only `app/` files change.
- No new `getProgress` caller beyond the overview route in this ticket (catalog/lesson-page progress surfacing is deferred above).
- Disposable verification rows (`sr_quiz_attempts` / `sr_answer_events` / `sr_practice_attempts` / `sr_content_answer_events` for the test learner) are cleaned up in cap6; `sr_users` and content rows are never modified.
