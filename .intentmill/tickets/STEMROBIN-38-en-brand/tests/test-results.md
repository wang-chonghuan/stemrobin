# Test Results — STEMROBIN-38 en-brand

## Environment

- App: standalone project under `app/` (Node 24, Vite 8, TanStack Start).
- `app/node_modules` installed via `cd app && npm install` (was missing in the fresh worktree).
- Playwright: `app/node_modules/playwright`; Chromium binary already present at the ms-playwright cache (no `npx playwright install` needed this run).
- Env: root `.env` present, `app/.env → ../.env` symlink present. `SESSION_SECRET` not set in `.env`, so the app + verification script both use the dev default `stemrobin-dev-session-secret`.
- Dev server: `cd app && npm run dev -- --host 127.0.0.1`, actual port **3000** (`http://127.0.0.1:3000`).

## Development Test Log

1. Edited `app/src/components/catalog.tsx` (locale-aware wordmark + conditional slogan + locale-aware logo alt).
2. Started dev server on port 3000.
3. Ran ticket browser check → adjusted script module resolution (createRequire anchored at `app/`), reran → 9/9 PASS.
4. `cd app && npm run test` → 68/68 pass (8 files).
5. `cd app && npm run build` → clean, `.output` generated.

## Browser Verification (playwright-browser-verification.md)

- Script: `.intentmill/tickets/STEMROBIN-38-en-brand/tests/browser-brand-check.mjs`
- Command: `node .intentmill/tickets/STEMROBIN-38-en-brand/tests/browser-brand-check.mjs http://127.0.0.1:3000`
- Mode: headed Chromium (`chromium.launch({ headless: false })`).
- Auth: minted `sr_session` cookie for test-learner user 2 via HMAC-SHA256 of the user id with the dev `SESSION_SECRET` (no password typed).
- Viewport: default desktop (1280×720) — the catalog header rail (236px) is the sole affected surface; it renders identically at desktop and inside the mobile drawer, so a second viewport adds no new contract.
- Result: **9/9 checks passed**
  - zh wordmark reads `知更`
  - zh slogan present (`随时随地学理工`)
  - zh logo image present
  - en wordmark reads `stemrobin`
  - en slogan hidden (`.sr-tagline` count = 0)
  - en logo image still present
  - en wordmark on a single line (height 22px)
  - zh restored after switching back: wordmark `知更`
  - zh restored: slogan present again
- Screenshots:
  - `.intentmill/tickets/STEMROBIN-38-en-brand/tests/screenshots/header-zh.png` (知更 + slogan + green 更 accent)
  - `.intentmill/tickets/STEMROBIN-38-en-brand/tests/screenshots/header-en.png` (stemrobin, single line, no slogan)
- Failures/fixes: initial run failed with `ERR_MODULE_NOT_FOUND: playwright` because the script lives outside `app/`; fixed by resolving Playwright through `createRequire` anchored at `app/package.json`. Reran → all pass. No product-code defect surfaced.

## Coverage Map

| Plan Unit Test Plan item | Covered by | Result |
|---|---|---|
| R1 en wordmark = `stemrobin` | browser check "en wordmark reads stemrobin" | PASS |
| R2 zh wordmark = `知更` unchanged | browser checks "zh wordmark reads 知更" + "zh restored" | PASS |
| R3 en slogan hidden | browser check "en slogan hidden (not rendered)" | PASS |
| R4 zh slogan present | browser checks "zh slogan present" + "zh restored: slogan present again" | PASS |
| R5 logo present both locales + alt | browser checks "zh/en logo image present" (alt asserted in code via locale branch; visually confirmed) | PASS |
| R6 no overflow / no CSS change | browser check "en wordmark on a single line" (22px, one line) — no `app.css` change needed | PASS |
| Regression floor: vitest suite green | `cd app && npm run test` | 68/68 PASS |
| Production build clean | `cd app && npm run build` | PASS |

## Commands

- `cd app && npm install`
- `cd app && npm run dev -- --host 127.0.0.1` (port 3000)
- `node .intentmill/tickets/STEMROBIN-38-en-brand/tests/browser-brand-check.mjs http://127.0.0.1:3000`
- `cd app && npm run test`
- `cd app && npm run build`
