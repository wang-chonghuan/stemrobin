# im-plan — STEMROBIN-33 · unlock-practice

## Step 1 — lesson.$id.tsx: unlock the practice button
- Remove `Lock` from the `lucide-react` import (keep `Layers`).
- Delete `const [allRead, setAllRead] = useState(!reading)` and its comment block.
- Practice button: remove `disabled={!allRead}`; set `title` to
  `t(locale, 'lesson.practice.open')`; render `<Layers size={16} />` unconditionally.
- Remove `onAllRead={() => setAllRead(true)}` from the `<CardReader … />` usage.
  Keep `onOpenPractice={() => setQuizOpen(true)}`.

## Step 2 — card-reader.tsx: drop the onAllRead plumbing
- Remove `onAllRead` from the component props type and destructuring.
- Delete the effect `useEffect(() => { if (allRead) onAllRead() }, [allRead, onAllRead])`.
- KEEP `const allRead = cards.every(...)` and `const showDone = allRead && isLast`
  and the `onOpenPractice` button — unchanged.

## Step 3 — i18n.ts: remove dead key
- Delete `'lesson.practice.locked'` from both the zh and en maps.

## Step 4 — verify
- `cd app && npm run build` (TS + bundle) clean.
- `cd app && npm run test` clean.
- Browser gate (gate6): standalone Playwright from `app/node_modules/playwright`;
  mint test-learner `sr_session` cookie (secret `process.env.SESSION_SECRET ||
  'stemrobin-dev-session-secret'`, user 2); `npm run dev`; open a lesson; WITHOUT
  walking all cards, open the practice drawer + answer a choice question (opens +
  judges); assert reading point NOT granted (getProgress reading-complete stays
  false for that lesson). Screenshot. Clean up disposable answer/attempt events.

## Files
- app/src/routes/_app/lesson.$id.tsx
- app/src/components/card-reader.tsx
- app/src/lib/i18n.ts
