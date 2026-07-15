# IntentMill Plan — STEMROBIN-30

## Step 1 — `app/src/lib/progress.ts`: extract shared store helper
- Add an exported server-side async helper `storePracticeAttempt(uid: number, lessonId: string, score: number): Promise<void>` holding the existing `insert into sr_practice_attempts …` + `delete … keep latest 2` body.
- Refactor `recordPracticeAttempt`'s handler to: verify session/uid, validate score range, then `await storePracticeAttempt(uid, data.lessonId, data.score)`. No behavior change to the server fn.
- Verify: `progress.test.ts` still green; new behavior covered in Step 4.

## Step 2 — `app/src/lib/quiz.ts`: record score at attempt end
- Import `storePracticeAttempt` from `~/lib/progress`.
- In `endAttempt`, after `summarizeAttempt` yields the `ScoreSummary` (already has `correct`, `gradableTotal`), compute `pct = summary.gradableTotal > 0 ? Math.round((summary.correct / summary.gradableTotal) * 100) : 0` and `await storePracticeAttempt(uid, data.lessonId, pct)` before returning the summary. `uid` is the already-verified logged-in id. Do not change the return shape.
- Guard: only record on a real end (the existing `uid == null` early-return already gates logged-out).

## Step 3 — `app/src/routes/_app/index.tsx`: real progress bar
- Loader: add `progress: await getProgress()` (import from `~/lib/progress`).
- In `Overview`, derive `readingDone = progress.lessons.filter(l => l.readingComplete).length`, `practiceDone = progress.lessons.filter(l => l.practiceComplete).length`, `pctWidth = progress.totalPoints > 0 ? (progress.completedPoints / progress.totalPoints) * 100 : 0`.
- Replace headline `8` → `{progress.completedPoints}`; unit → `/ {progress.totalPoints} {t(locale,'ov.progress.unit')}`; bar `style={{ width: `${pctWidth}%` }}`.
- Replace the three tiles with two: `{readingDone}`/课文完成 and `{practiceDone}`/练习完成. Remove the streak tile block and the `{/* mockup … */}` comment.

## Step 4 — `app/src/lib/i18n.ts`: labels (zh + en)
- `ov.progress.unit`: zh `点` / en `pts` (bare unit; drop "/ 96 课" / "/ 96 lessons").
- Repurpose two stat labels: `ov.stat.learned` → 课文完成 / "Reading done"; `ov.stat.practiced` → 练习完成 / "Practice done". Leave `ov.stat.streak` key in place but unused (removing the key is optional cleanup; not referenced after Step 3). Keep it minimal — do not delete other keys.
  - (If lint/unused-key checks flag it, remove `ov.stat.streak` from both locales.)

## Step 5 — Tests (`im tests path` + colocated `progress.test.ts`)
- Extend `app/src/lib/progress.test.ts` (pure) with a case asserting the attempt-percent mapping used at end-of-attempt: e.g. `computeProgress` with `latestScoreByLesson` at 80 → practiceComplete true, at 79 → false (regression), locking the ≥80 boundary the wiring depends on. (The DB write path itself is proven in the browser run.)
- Record ticket test notes under `.intentmill/tickets/STEMROBIN-30-practice-progress/tests/`.

## Step 6 — Empirical browser verification (cap6, playwright)
- Standalone Playwright from `app/node_modules/playwright` (MCP harness version conflict). Start `cd app && npm run dev`.
- Mint test-learner `sr_session` cookie (secret `process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'`, uid 2, HMAC per `session.server.ts`; no password typed).
- Flow: open a lesson with a gradable deck → open practice → answer to score ≥ 80 → 结束本课答题 → see score → go to overview → bar/`练习完成` reflects it. Then redo the attempt scoring < 80 → 结束 → overview → practice point regresses (bar drops). Screenshot each state.
- Also confirm reading a lesson's cards raises 课文完成 (AC3) if not already complete for the test learner.
- Clean up: delete the disposable `sr_practice_attempts` / `sr_quiz_attempts` / related event rows created for uid 2 during the run; leave `sr_users` + content untouched.
- `cd app && npm run test` green; `cd app && npm run build` clean; `.env` present and unstaged.

## Verification matrix
- AC1 ← Steps 1+2 + browser flow (score shown, ≥80 completes, <80 regresses).
- AC2 ← Step 3 + browser flow (real numbers, moves on reading + practice).
- AC3 ← existing `recordReadCheck` write + Step 3 surfacing + browser check.
- SSOT ← Step 1 single helper; percent shared with scorecard.

## Rollback / risk
- All changes additive/surgical; revert is per-file. No migration to undo.
- Blocked-premise (DB unreachable, session mint fails) → `im-handoff.md` `## Blocker` + STOP, no mock-around.
