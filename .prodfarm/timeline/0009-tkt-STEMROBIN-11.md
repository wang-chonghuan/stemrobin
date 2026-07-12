---
id: 0009
type: tkt
author: machine
date: 2026-07-12
---

# STEMROBIN-11 done — 卡片答题计分与答题记录

Single-ticket story (no batch): cap5 → cap9 (develop + verify in worktree) → cap6.
Merged to main (f326d98), deployed to production (revision ca-stemrobin--0000021 on
f326d98, 100% traffic), verified live.

## Delivered
- New `sr_quiz_attempts` table + `sr_answer_events.attempt_id` (additive schema, applied to
  the shared Postgres).
- `quiz.ts`: `startAttempt` / `endAttempt` / `getLatestScore` / `getOpenAttempt`;
  `recordAnswer` now tags each event with `attempt_id`. Scoring counts only gradable
  (choice+input) items; 说理/work excluded and reported separately; unanswered stay in the
  denominator.
- `quiz-drawer.tsx`: start screen (last score + 继续上一次 / 重新开始), 结束本课答题 button,
  result scorecard (correct, ratio, percentage, wrong 题号). The attempt API is an optional
  prop, so the 名人传记 (story) quiz is unchanged.

## Acceptance (verified live-equivalent, empirically in the worktree; prod bundle confirmed)
- End a quiz → scorecard shows 答对 X / N, ratio + percentage, wrong 题号 (verified 3/20, 15%,
  第4/第5题).
- End again → the latest attempt's score shows, not an earlier one (1/20, 5%).
- An unfinished attempt offers 继续上一次 (resumes with prior verdicts, from first unanswered)
  and 重新开始; the last ended score persists until the next 结束 refreshes it.
- Denominator = gradable count (20); unanswered lower the %, 说理 excluded (0/3 shown apart).
- Story quiz regression-checked: no start screen / scorecard / end button — legacy path intact.

## Proxy decisions (machine, conservative-delegation)
- Kept full attempt history in the DB (weakness-analysis value) but the scorecard reads the
  latest ended attempt, so "只保留最近一次" holds for display while data is preserved.
- 重新开始 deletes the open (unfinished) attempt and its events via FK cascade; the last ended
  scorecard is a separate slot, refreshed only on 结束.
- Verification used a dedicated login-disabled test user (`edwinbiz+clerk_test@…`, id 2) driven
  by a minted session — no password handled; test data cleaned up after.
