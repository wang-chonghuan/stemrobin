# im-spec — STEMROBIN-33 · unlock-practice

## Goal
The 课后题 (practice) entry on a lesson page is always openable/answerable,
independent of card-reading progress. Reverse STEMROBIN-22's "read all cards to
unlock" gate on the practice button only.

## Behavior (black-box)
1. Open any lesson (with a card tree). WITHOUT walking all cards, the practice
   button is enabled (no lock icon) and opens the practice drawer.
2. Answering a practice question judges normally (choice, server-graded).
3. Doing only the practice (not 精读-ing the cards) does NOT complete that lesson's
   课文 (reading) progress point. The 练习 point still = latest attempt ≥ 80%.
4. Lessons without a card tree behave as before (practice was already open).

## In scope
- `app/src/routes/_app/lesson.$id.tsx`: practice button always enabled; drop
  `allRead` state, `Lock` import, `onAllRead` wiring.
- `app/src/components/card-reader.tsx`: drop the `onAllRead` prop + the effect that
  fires it; keep the local `allRead` used by `showDone` + `onOpenPractice`.
- `app/src/lib/i18n.ts`: remove the now-dead `lesson.practice.locked` key (zh+en).

## Out of scope / invariants
- No change to practice judging, question modes, or answer-key secrecy.
- No change to `progress.ts` — reading-complete and practice-complete stay
  independent and derived from their own event sources.
- `sr_users` untouched. No new dependency. `app/` only.

## Acceptance
- Browser: practice opens + judges without finishing cards; opening/answering
  practice leaves 课文进度 uncompleted for that lesson.
- `npm run test` and `npm run build` clean.
