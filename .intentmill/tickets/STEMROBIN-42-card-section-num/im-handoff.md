# im-handoff — STEMROBIN-42 · card-section-num

## Status: DEV DONE + gate6 verified. No push / PR / merge / deploy (per executor scope).

## What changed
- `app/src/components/card-reader.tsx` — the `.sr-card-section` render now shows the section
  **number + name**: `<span class="sr-card-section-num">{card.num}</span> {card.name}` (was
  `{card.name}` only). `card.name &&` guard retained.
- `app/src/styles/app.css` — `.sr-card-section` color `var(--sr-blue-deep)` → `var(--sr-blue)`
  (brighter primary teal #0E7C9B), size 13px → 15px, weight 600 → 700; added `.sr-card-section-num`
  (mono, 700). No new hue, no new dependency, no i18n key. zh/en identical.

## Empirical browser verify (gate6)
- Standalone Playwright (`app/node_modules/playwright`), test-learner `sr_session` cookie minted
  for user 2 (HMAC secret `process.env.SESSION_SECRET || 'stemrobin-dev-session-secret'`, no
  password typed), dev server on :3001, opened `/lesson/math-s3-07`.
- Observed on the first card:
  - `.sr-card-section` text = **"1 为什么学这个"** (number prefix + name) — AC1 pass.
  - `.sr-card-section-num` text = "1".
  - computed color = **rgb(14, 124, 155)** (= `--sr-blue`), clearly not black — AC2 pass.
  - `.sr-card-lesson` = "3.7 去分母解方程" still shown — AC3 pass.
- Screenshot of the card head: `scratchpad/card-head.png` (shows black lesson title above the
  teal "1 为什么学这个" section title, progress "第 1 / 5 张卡片" at right).

## Unit + build floor
- `cd app && npm run test` → 8 files, 76 tests passed.
- `cd app && npm run build` → clean (`.output` generated).

## Residual / grill-leaks
- Seed premise "全黑" was not literally true in code (prior color was `--sr-blue-deep`, a dark
  desaturated teal that *reads* near-black at 13px). The fix still fully satisfies the acceptance
  ("明显的颜色、非纯黑") by moving to the brighter `--sr-blue` and enlarging the label. See im-grill G1.
- No other leaks. Read-check flow untouched.

## Commit
- Committed on branch `STEMROBIN-42-card-section-num` (app changes + .intentmill artifacts). Not pushed.
