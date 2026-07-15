# test-results — STEMROBIN-31 · login-gate

## Unit + build (floor)
- `cd app && npm run test` → **47 passed (5 files)**. No regressions.
- `cd app && npm run build` → **built OK** (Start/Nitro output generated), exercises the new `beforeLoad`.

## Empirical browser (standalone Playwright, `app/node_modules/playwright` 1.61.1)
Dev server: `npm run dev` @ http://localhost:3000. Test learner = user 2
(`edwinbiz+clerk_test@hotmail.com`); session minted as `sr_session = "2." + HMAC_SHA256(dev-secret, "2")`
and injected via `context.addCookies` — **no password typed**. Probe lesson id: `math-s2-02`.
Script: `scratchpad/verify-gate.mjs`.

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Logged-out `/` → redirected to `/login`, password form shown | PASS | url=`/login`, pwFields=1 · `logged-out-home.png` |
| 2 | Logged-out `/lesson/math-s2-02` → `/login`, no lesson iframe (content absent) | PASS | url=`/login`, iframes=0 · `logged-out-lesson.png` |
| 3 | Logged-in `/` renders (no redirect) | PASS | url=`/`, no pw field · `logged-in-home.png` |
| 4 | Logged-in `/lesson/math-s2-02` renders lesson (iframe present) | PASS | url=`/lesson/math-s2-02`, iframes=1 · `logged-in-lesson.png` |
| 5 | No registration entry on `/login` (register/注册/创建账号/sign up/create account) | PASS | matched=false |

**5/5 PASS.** Screenshots saved beside this file.

## Notes
- G1 (adjudicated Option A): the login page renders inside the `_app` shell, so the catalog
  sidebar (lesson **titles** only) is visible to a logged-out user on `/login`; lesson/story
  bodies and practice are never rendered (see `logged-out-lesson.png` — detail pane shows the
  login form, not the lesson).
- `sr_users` read-only (login/getCurrentUser); never written. No schema/session/dep change.
