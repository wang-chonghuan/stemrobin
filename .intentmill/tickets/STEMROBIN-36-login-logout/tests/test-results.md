# test-results — STEMROBIN-36 · login-logout

## Unit (vitest) — `cd app && npm run test`
8 files, **68/68 pass** (incl. i18n key-parity `i18n.test.ts` after adding `login.logout`).

## Build — `cd app && npm run build`
Clean. Nitro `.output` generated.

## Browser (gate6) — standalone Playwright (`app/node_modules/playwright`)
`node .intentmill/tickets/STEMROBIN-36-login-logout/tests/verify-36.mjs` against `npm run dev`
(`BASE=http://localhost:3001`). Logged-in checks mint the user-2 `sr_session` HMAC cookie
(secret default) and inject it — no password typed. **13/13 checks passed.**

| # | check | result |
|---|-------|--------|
| a1 | login card renders | PASS |
| a2 | login form present | PASS |
| a3 | NO catalog sidebar (`.sr-catalog`=0) | PASS |
| a4 | NO lesson titles leaked | PASS |
| a5 | NO register/create-account entry | PASS |
| b1 | logged-in stays on `/` (not redirected) | PASS |
| b2 | app shell + catalog present | PASS |
| b3 | visible logout control | PASS |
| b4 | signed-in email shown | PASS |
| c1 | logout lands on `/login` | PASS |
| c2 | post-logout page bare (login card, no catalog) | PASS |
| c3 | `sr_session` cookie cleared | PASS |
| c4 | protected `/` re-gated to `/login` | PASS |

Screenshots: `shots/a-loggedout-login.png`, `shots/b-loggedin-app.png`,
`shots/c-after-logout.png`.
