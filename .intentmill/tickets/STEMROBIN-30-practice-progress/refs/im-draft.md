# IntentMill Draft

## Source

- `intent.md` — read and obeyed (STEMROBIN-30 「练习按次计分与首页真进度条」, story, batch 0005-progress-and-access, seed STEMROBIN-26, full delegation).
- `meta.json` — read (ticket_key STEMROBIN-30-practice-progress, branch STEMROBIN-30-practice-progress).
- `AGENTS.md` router + `.prodfarm/charter/` (goal / redlines / engineering-rules / architecture / runbook, embedded verbatim in intent.md) — read and obeyed. Salient rules honored below: SSOT & one-way-only (§5), surgical changes (§3), simplicity (§2), answer-key secrecy, DB access is server-only via `sql()`, only `app/` changes, no new dependency, `.env` never staged.
- Evodocs read: `.evodocs/modules/mod--app--learner-experience.md` and `mod--app--domain-services.md` (both embedded in intent.md). Both are substantive and were used to locate the right code. **Both carry a stale `known-limits` note** that the overview progress is "static placeholder" and that the domain module "does not calculate learner progress at runtime" — code is authoritative: STEMROBIN-29 already added `app/src/lib/progress.ts` (`computeProgress`/`getProgress`/`recordPracticeAttempt`). The evodocs predate that ticket; this is recorded as an evodocs↔code disagreement resolved in favor of code.
- No external library / API / SDK / cloud interface is introduced, so no `find-docs` / Context7 lookup was needed — the ticket reuses in-repo TanStack Start server functions and the existing Postgres `sql()` client only.
- `nf-db`: no schema change and no ad-hoc DB migration is proposed. Both attempt tables already exist (`sr_quiz_attempts`, `sr_practice_attempts`, `sr_content_answer_events` — STEMROBIN-11 + STEMROBIN-29). Empirical DB behavior is verified in cap6 through the running app (a real practice attempt writing a row), not by hand-editing rows.
- Frontend `DESIGN.md`: `resources/reference/DESIGN.md` has no `progress`-specific rule; the progress card's visual contract lives in `app/src/styles/app.css` (`.sr-progress*` tokens/classes). The three-color palette (teal-blue / green / white) is preserved by reusing those existing classes — no new hue.

## Draft Spec

*(draft — finalized in im-spec.md after grill)*

STEMROBIN-30 is a **wiring ticket**, not a from-scratch build. Targeted inspection shows the two halves the ticket names already exist as separate, unconnected mechanisms; the delta is to connect them and to surface the result on the homepage.

Two parts, both `app/`-only:

**Part 1 — practice attempt score feeds progress.**
- The practice deck (quiz-drawer) already has a full attempt lifecycle (STEMROBIN-11): `startAttempt` → per-question server-judged answering → `endAttempt`, which stamps `sr_quiz_attempts.ended_at` and returns a `ScoreSummary`; the drawer already shows the learner their score (`ScoreCard`, percent = `round(correct / gradableTotal × 100)`). So "one attempt = one pass" and "learner sees their score" are **already met**.
- The gap: nothing writes the attempt's score into `sr_practice_attempts`, which is the table `getProgress` reads for the practice signal. `recordPracticeAttempt`/`getProgress` (STEMROBIN-29) have **zero callers in the app** — the progress model is dormant.
- Delta: when an attempt is **ended** (server-side, in `endAttempt`), compute the same percent the scorecard shows and persist it through STEMROBIN-29's storage so `getProgress`'s `practiceComplete` (latest score ≥ 80, regressing) reflects it. Recording server-side (not from the client) keeps the score server-authoritative and answer-key-secret — the client never supplies a score.

**Part 2 — homepage real progress bar.**
- `app/src/routes/_app/index.tsx` currently renders a MOCK progress card: hardcoded headline `8`, bar `width: '8.3%'`, and three fake stat tiles (`8` / `104` / `5` = learned / practiced / streak), with a stale `/ 96 课` unit and a `{/* mockup — wire … later */}` comment.
- Delta: drive the card from `getProgress()` in the route loader. Headline/unit and bar width become the real `completedPoints / totalPoints` (totalPoints = 2 × lessonCount = 32 today). The bar moves when a lesson's cards are all read (reading point) or a practice attempt scores ≥ 80 (practice point), and regresses when a later attempt < 80. The `streak` tile has no data source and must not display a fabricated number.

Acceptance (black-box) is unchanged from intent.md and is verified empirically in cap6.

## Draft Plan

*(draft — rough; finalized in im-plan.md after grill)*

1. **Extract a shared store helper in `progress.ts`** so the insert+prune logic is defined once (SSOT, engineering-rules §5): a plain server-side async helper (e.g. `storePracticeAttempt(uid, lessonId, score)`) holding the current `insert … / delete … keep-latest-2` body. Refactor the existing `recordPracticeAttempt` server fn to call it (no behavior change). This avoids duplicating STEMROBIN-29's prune SQL in `quiz.ts`.
2. **Wire `endAttempt` (`app/src/lib/quiz.ts`)** to compute the attempt percent from the already-computed `ScoreSummary` (`gradableTotal > 0 ? round(correct/gradableTotal×100) : 0`) and call the helper for the logged-in `uid`. Only on a real end (guarded by the existing session check). No client-facing signature change; the drawer keeps working unchanged.
3. **Homepage (`app/src/routes/_app/index.tsx`)**: add `getProgress()` to the loader; replace the mock headline, unit, bar width, and stat tiles with real values from `Progress` (`completedPoints`, `totalPoints`, and real per-signal counts). Remove the `mockup` comment. Reuse existing `.sr-progress*` classes.
4. **i18n (`app/src/lib/i18n.ts`)**: update `ov.progress.unit` and the stat-tile labels (zh + en) so they describe real point-based progress rather than "/ 96 课" and a streak. Exact label wording is a grill item.
5. **Tests** under `im tests path` + colocated where the repo already colocates (`progress.test.ts` exists): a pure unit test that the attempt-percent→score mapping and the store/prune reuse behave (extend existing `progress.test.ts` patterns), plus browser verification in cap6.
6. **Empirical browser verify (cap6)**: logged-in test learner → do a practice attempt → see score → homepage bar reflects it → a low-scoring attempt → bar regresses; screenshots; `npm run test` + `npm run build` clean; clean up disposable attempt/event rows.

## Code And Evodocs Findings

- **`app/src/lib/quiz.ts`** — owns the relational practice deck + attempt lifecycle over `sr_questions` / `sr_answer_events` / `sr_quiz_attempts`. `summarizeAttempt(lessonId, attemptId, endedAt)` already computes `correct` and `gradableTotal` (choice+input gradable; work excluded). `endAttempt` stamps `ended_at` and returns the `ScoreSummary`. This is the single server-side moment an attempt is finalized — the correct injection point for recording the practice score. Percent formula must match `ScoreCard` in the drawer: `round(correct/gradableTotal×100)`.
- **`app/src/lib/progress.ts`** (STEMROBIN-29) — `recordPracticeAttempt({lessonId, score})` inserts into `sr_practice_attempts` and prunes to the latest 2 per (user, lesson); `getProgress()` reads read-check correctness (`sr_content_answer_events` kind=`read_check`) for the reading signal and the latest `sr_practice_attempts.score` for the practice signal, and `computeProgress` yields `{lessons, lessonCount, totalPoints=2×lessonCount, completedPoints}`. **REUSED, not reinvented.** Grep confirms neither `recordPracticeAttempt` nor `getProgress` has any app caller yet.
- **`app/src/components/quiz-drawer.tsx`** — already renders `start`/`quiz`/`result` phases, the `结束本课答题` (endAttempt) control, and `ScoreCard` (percent + ratio + wrong ords). No change is required for the learner to *see* their score; the score→progress link is server-side. (If the drawer needs to trigger a homepage refresh, that is a UI decision — see Grill.)
- **`app/src/routes/_app/index.tsx`** — the mock progress card, with an explicit `{/* Progress (mockup — wire to sr_answer_events / sr_progress later) */}` comment. Loader currently returns `{lessonIds, locale}`.
- **`app/src/lib/reading.ts` + `card-reader.tsx`** — the reading side is already fully wired: `recordReadCheck` writes `sr_content_answer_events` kind=`read_check`, which `getProgress` reads. So acceptance #3 (reading a lesson's cards completes its 课文 point) needs only Part 2's surfacing, no new write path.
- **Schema** (`ssot-schemas/db-schemas/stemrobin.sql`) — `sr_practice_attempts` (score NUMERIC(5,2) 0–100, keep latest 2) and `sr_quiz_attempts` are documented as *deliberately distinct* tables for the same learner-facing deck (relational per-question events vs a single stored percent). Bridging them (record the percent at end-of-attempt) is coherent with that design and needs **no schema change**.
- **Two-deck nuance**: `getProgress`'s reading query walks `sr_lessons.content->'cards'->'read_check'` (JSONB) keyed on `lesson_id`; the practice score is keyed on the same `lesson_id`. `endAttempt` receives `lessonId`, so the key aligns 1:1 — no locale/id mismatch.

## Assumptions

- The percent recorded for the practice signal is exactly the percent the drawer's `ScoreCard` already shows (`gradableTotal>0 ? round(correct/gradableTotal×100) : 0`) — one definition of "本次分数", no second formula (SSOT).
- Recording happens on **每次 endAttempt** (每一次「结束本课答题」提交), matching intent's "提交一次答题"; `getProgress` already keeps only the latest attempt as the live signal and STEMROBIN-29 prunes storage to 2, so re-ending/redoing naturally regresses.
- `totalPoints = 2 × lessonCount` comes straight from `getProgress()`; "32" in intent is today's value (16 lessons), not a constant to hardcode.
- Only `app/` changes; no new dependency; no schema change; disposable attempt/event rows may be created and cleaned up during cap6 verification, but `sr_users` and content rows are never touched.

## Risks

- **Calling STEMROBIN-29 logic from `quiz.ts` without duplication.** Mitigation: extract one shared plain helper in `progress.ts` and call it from both the existing server fn and `endAttempt`; do not copy the insert/prune SQL into `quiz.ts` (would violate SSOT §5).
- **All-`work` deck edge case** (`gradableTotal = 0`): the scorecard shows 0%, so recording 0 keeps practice incomplete forever for such a lesson. Likely no such practice deck exists, but the behavior must be a deliberate choice — Grill item.
- **Homepage freshness after an attempt**: the loader runs on navigation; a learner ending an attempt in the drawer then returning home should see the updated bar. Whether an in-place live refresh is required (vs on next navigation/SSR load) is a UI decision — Grill item.
- **i18n label churn**: repurposing the three stat tiles + unit touches learner-visible copy in two locales; wording is a small product/UI choice — Grill item. Keeping the existing `.sr-progress*` classes avoids any visual/design regression.
- **Empirical verify needs a logged-in session** (login gate STEMROBIN-31): cap6 mints the test-learner `sr_session` cookie (uid 2, no password typed) per the run rules; standalone Playwright from `app/node_modules/playwright` (MCP harness version conflict).

## Grill Required

completed
