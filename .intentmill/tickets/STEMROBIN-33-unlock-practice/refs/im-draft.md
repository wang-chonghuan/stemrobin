# im-draft — STEMROBIN-33 · unlock-practice

## Problem (grounded)
STEMROBIN-22 gated the 课后题 (practice deck) button behind "read all cards". The
gate lives entirely in `app/src/routes/_app/lesson.$id.tsx`:

- `const [allRead, setAllRead] = useState(!reading)` (starts `false` whenever the
  lesson has a card tree).
- The practice button is `disabled={!allRead}`, shows a `<Lock/>` icon and the
  `lesson.practice.locked` title until unlocked.
- `<CardReader … onAllRead={() => setAllRead(true)} />` flips it once every card
  is 精读-passed. `CardReader` fires `onAllRead` from an effect (`if (allRead)
  onAllRead()`) computed from local read-check results.

Human intent (seed STEMROBIN-32 / grill G-1): the 课后题 must be openable and
answerable at any time, NOT locked by unfinished reading.

## Fix (rough spec)
Remove the "locked until all cards read" gate on the practice entry so the drawer
opens regardless of reading progress. The practice deck itself is unchanged
(choice-only, server-judged via `QuizDrawer`).

Concretely:
- Practice button always enabled, always `Layers` icon, always the "open" title.
- Drop the `allRead` state + the `Lock` import in the lesson route.
- Drop the now-unused `onAllRead` plumbing: the prop on `CardReader` and the
  effect that fires it. Keep `CardReader`'s LOCAL `allRead` computation — it still
  drives the in-reader `showDone` completion panel + its "进入练习题" convenience
  button (`onOpenPractice`), which stays.

## Progress independence (must hold, and does by construction)
`src/lib/progress.ts` derives the two points independently and NEITHER depends on
the button gate:
- reading-complete = every read-check id of the lesson answered correct — sourced
  from `recordReadCheck` answer events written while walking cards. UI `allRead`
  never writes progress.
- practice-complete = latest `sr_practice_attempts` score ≥ 80.
Opening the drawer records nothing until a question is answered; answering writes
a practice attempt only. So opening/answering practice cannot complete 课文进度.

## UI / external-interface / dev-time-test investigation
- UI change: one button's disabled/icon/title; removal of a lock affordance. No
  new screens, no new copy needed (reuse `lesson.practice.open`). Dead i18n key
  `lesson.practice.locked` (zh+en) becomes unreferenced — safe to leave or remove;
  removing is cleaner. No new dependency.
- External interface: none. No server-fn signature change. `QuizDrawer`,
  `recordAnswer`, `startAttempt`, `endAttempt`, `getLatestScore` unchanged.
- Dev-time test: browser gate (gate6) — mint test-learner `sr_session` cookie
  (secret `process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'`, user 2),
  open a lesson, WITHOUT walking all cards open the practice drawer + answer a
  choice question (opens + judges). Confirm reading point not granted by opening
  practice. `npm run test` + `npm run build` clean. Clean up disposable answer
  events.

## Assumptions
- A1: `onAllRead` has no consumer other than the parent's lock flip (verified: sole
  caller is the effect at card-reader.tsx L192-195; sole parent use is `setAllRead`).
- A2: Lessons without a card tree already left practice open (`useState(!reading)`
  → `true`); behavior there is unchanged.

## Risks
- R1: Removing `onAllRead` from `CardReader` props must also remove its type entry
  + effect, or TS build fails. Mitigated by editing both together.
- R2: `CardReader.showDone` relies on the LOCAL `allRead` — must NOT be removed.

## Grill required
Only decision is G-1 (unlock the practice entry), already resolved by the seed.
No further blocking product/architecture decisions.
