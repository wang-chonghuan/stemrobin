# im-plan — STEMROBIN-42 · card-section-num

## Step 1 — component: number + name
`app/src/components/card-reader.tsx`, in the `.sr-card-titles` block, change the section render
from `{card.name}` to `<span class="sr-card-section-num">{card.num}</span> {card.name}`, keeping
the `card.name &&` guard.
Verify: text content of `.sr-card-section` starts with the number then the name.

## Step 2 — css: prominent accent
`app/src/styles/app.css`, `.sr-card-section` rule: change `color: var(--sr-blue-deep)` →
`var(--sr-blue)`, size 13px → 15px, weight 600 → 700; add `.sr-card-section-num` (mono, 700).
Verify: computed color ≈ rgb(14,124,155), not near-black.

## Step 3 — gate6 empirical browser verify
Standalone Playwright (`app/node_modules/playwright`): mint test-learner `sr_session` cookie
(HMAC secret `process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'`, user 2), start
`cd app && npm run dev`, open math-s3-07, assert `.sr-card-section` text starts with the number
and computed color is non-black; screenshot the card head.

## Step 4 — unit + build floor
`cd app && npm run test` clean; `cd app && npm run build` clean.

## Rollback
Revert the two edits; no schema/data/deps touched.
