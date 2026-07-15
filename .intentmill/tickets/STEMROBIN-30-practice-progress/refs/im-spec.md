# IntentMill Spec — STEMROBIN-30 练习按次计分与首页真进度条

## Summary

Connect two already-built but unwired mechanisms and surface the result:
1. The practice deck's attempt lifecycle (STEMROBIN-11: `sr_quiz_attempts`, `endAttempt`, scorecard) is joined to the dormant progress model (STEMROBIN-29: `sr_practice_attempts`, `recordPracticeAttempt`/`getProgress`) so a finished attempt's score drives the lesson's practice-progress point.
2. The homepage overview replaces its mock progress card with a real bar driven by `getProgress()`.

App-only. No schema change, no new dependency.

## Behavior contract

### Part 1 — attempt score → practice progress
- **Trigger**: server-side in `endAttempt` (`app/src/lib/quiz.ts`), on every `结束本课答题` submission by a logged-in learner. Not on start, per-question answer, or from the client.
- **Score**: the percent already displayed by the drawer's `ScoreCard` = `gradableTotal > 0 ? Math.round(correct / gradableTotal × 100) : 0`, computed from the attempt's own `ScoreSummary` (gradable = choice+input; work/说理 excluded). One definition, shared with the scorecard via the same `summarizeAttempt` result.
- **Persistence**: through a single shared helper `storePracticeAttempt(uid, lessonId, score)` in `app/src/lib/progress.ts` (extracted from the current `recordPracticeAttempt` body: insert into `sr_practice_attempts` + prune to latest 2 per (user, lesson)). `recordPracticeAttempt` delegates to it; no insert/prune SQL is duplicated in `quiz.ts`.
- **Effect**: `getProgress().lessons[*].practiceComplete` = latest attempt score ≥ 80. A later attempt < 80 regresses it (latest wins; storage keeps 2, `getProgress` reads only the newest).
- **Unchanged**: choice-only + server-judged answering, answer-key secrecy, story quizzes (no attempt API → never record a practice score), the drawer UI and per-question feedback.

### Part 2 — homepage real progress bar
- `app/src/routes/_app/index.tsx` loader adds `getProgress()` → `{lessons, lessonCount, totalPoints, completedPoints}`.
- Headline number = `completedPoints`; unit = `/ {totalPoints}` (real; `totalPoints = 2 × lessonCount`, never hardcoded).
- Bar fill width = `totalPoints > 0 ? (completedPoints / totalPoints) × 100 : 0` percent.
- Two real stat tiles derived from `getProgress().lessons`: 课文完成 count (`readingComplete === true`) and 练习完成 count (`practiceComplete === true`). The mock streak tile is removed (no data source).
- Remove the `{/* … mockup … later */}` comment. Reuse existing `.sr-progress*` CSS classes/tokens (three-color palette preserved; grid renders two tiles).
- i18n (`app/src/lib/i18n.ts`, zh + en): `ov.progress.unit` becomes a bare "points" unit (no "/ 96 课"); the two tile labels describe 课文/练习 completion; `ov.stat.streak` is no longer referenced.

## Acceptance criteria (black-box, verified empirically in cap6)
- AC1: Completing (ending) one practice attempt shows the learner their score; a score ≥ 80% makes that lesson's 练习进度 complete, and a later attempt < 80% regresses it to incomplete.
- AC2: The homepage progress bar shows real `completedPoints / totalPoints (2 × lessons)` — not a fixed mock — and moves when the user completes reading a lesson's cards or scores a practice attempt.
- AC3: Reading a lesson's cards completes its 课文 point on the bar.

## Constraints honored
- SSOT / one-way-only: single percent definition, single storage helper.
- Surgical: only `quiz.ts` (add call), `progress.ts` (extract helper), `index.tsx` (real data), `i18n.ts` (labels). No unrelated edits.
- DB server-only via `sql()`; no schema change; `.env` never staged.
- Answer-key secrecy intact; only `app/` changes; no new dependency.

## Out of scope
Catalog/lesson per-lesson progress badges; streak/mastery panels; any second `getProgress` caller; schema changes; quiz-drawer UX changes.
