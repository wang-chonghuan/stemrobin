# im-handoff — STEMROBIN-33 · unlock-practice

## What changed
Reversed STEMROBIN-22's "read all cards to unlock" gate on the 课后题 (practice)
button. The practice entry is now always openable/answerable; the practice deck
itself (choice-only, server-judged) is unchanged.

### app/src/routes/_app/lesson.$id.tsx
- Removed `Lock` from the `lucide-react` import.
- Deleted the `const [allRead, setAllRead] = useState(!reading)` gate state (+ its
  comment); replaced with a note explaining practice is ungated and reading-complete
  stays 精读-only.
- Practice button (top bar): removed `disabled={!allRead}`; `title` is now always
  `lesson.practice.open`; icon is always `<Layers/>` (no lock branch).
- Removed `onAllRead={() => setAllRead(true)}` from `<CardReader/>`; kept
  `onOpenPractice`.

### app/src/components/card-reader.tsx
- Removed the `onAllRead` prop (type + destructuring) and the effect
  `useEffect(() => { if (allRead) onAllRead() }, …)` that fired it.
- Kept the LOCAL `const allRead = cards.every(...)` and `showDone = allRead && isLast`
  — they still drive the in-reader completion panel + its "进入练习题" shortcut.

### app/src/lib/i18n.ts
- Removed the now-dead `lesson.practice.locked` key from both zh and en maps.

## How reading/practice progress stay independent (unchanged by construction)
`app/src/lib/progress.ts` derives the two points from separate event sources, and
NEITHER depends on the removed UI gate:
- 课文 (reading) point = every read-check id of a lesson answered correct, sourced
  from `sr_content_answer_events (kind='read_check')` written by `recordReadCheck`
  while 精读-ing cards. The `allRead` UI flag never wrote progress.
- 练习 (practice) point = latest `sr_practice_attempts` score ≥ 80.
Opening the drawer records nothing; answering writes only practice-side events.
So opening/answering practice cannot complete a lesson's 课文进度.

## Browser evidence (gate6)
Standalone Playwright (`app/node_modules/playwright`), minted test-learner
`sr_session` cookie (user 2, secret `SESSION_SECRET || 'stemrobin-dev-session-secret'`,
no password typed), dev server on :3001, lesson `math-s2-01`:
- STEP1: practice button `disabled = false`, lock-icon count `= 0` (unlocked while
  on card 1/5, cards NOT walked).
- STEP2: practice drawer opened; after the STEMROBIN-30 start gate (重新开始) the
  first question rendered 4 choice options.
- STEP3: answering the first option produced a server verdict (correct-marked `= 1`)
  — judging works.
- Reading-not-granted: after opening + answering practice, `sr_content_answer_events
  (read_check)` for user 2 × math-s2-01 stayed `0` → 课文进度 NOT completed by
  practice. (getProgress reading-complete requires those events, which remained absent.)
- Screenshot: `scratchpad/sr33-practice-unlocked.png` (card 1/5 behind an open,
  answered practice drawer; top-bar 练习题 shows Layers, no lock).
- Cleanup: deleted the disposable quiz_attempt (id 33) + its 1 answer_event; user 2 ×
  math-s2-01 back to baseline (0/0/0 across content_answer_events / practice_attempts /
  quiz_attempts). No `sr_users` writes.

## Tests + build
- `cd app && npm run test` → 68 passed (8 files), incl. i18n key-parity test.
- `cd app && npm run build` → clean (TS + Nitro bundle).

## Invariants honored
- Practice judging/question modes untouched; answer-key secrecy unchanged.
- `sr_users` untouched. No new dependency. `app/` only.

## Missed user-review points / residual
- None. Only blocking decision G-1 (unlock the entry) was resolved by the seed;
  D-1 (keep in-reader shortcut) and D-2 (remove dead i18n key) self-adjudicated.
- The `npm install` needed to run tests/build pruned some extraneous esbuild
  platform entries from `app/package-lock.json`; that churn was reverted so the
  diff is source-only.

## Grill leaks
None.

## Charter drift
None (no stack/ops change).

## Commit status
Uncommitted (cap6 scope). Working tree: `app/src/routes/_app/lesson.$id.tsx`,
`app/src/components/card-reader.tsx`, `app/src/lib/i18n.ts` modified + ticket
`refs/` artifacts untracked. No commit/push/PR/merge/deploy performed (cap8 excluded).
