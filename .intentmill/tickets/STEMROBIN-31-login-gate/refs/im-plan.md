# im-plan — STEMROBIN-31 · login-gate

Implementation plan for `im-spec.md`. One surgical code change + empirical verification.

## Step 1 — Add the single auth gate to `_app.tsx`

File: `app/src/routes/_app.tsx`

- Import `redirect` from `@tanstack/react-router` and `getCurrentUser` from `~/lib/session`.
- Add `beforeLoad` to the route options (before/alongside `loader`):

  ```ts
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
  },
  ```

- Leave the existing `loader` and `AppShell` component unchanged.
- Verify check: gate runs before loader, so logged-out users never trigger the protected
  loader reads.

## Step 2 — Confirm no registration UI (no code change expected)

- Re-run `grep -rni 'register|注册|创建账号|sign up|signup|create account' app/src` — expect
  only `routeTree.gen.ts interface Register` (unrelated framework type). No edit needed.

## Step 3 — Unit / build floor

- `cd app && npm run test` — vitest must stay green (no unit test targets this framework
  behavior; the existing suite must not regress).
- `cd app && npm run build` — production build must succeed (exercises Start/Nitro + the new
  `beforeLoad`).

## Step 4 — Empirical browser verification (n-im cap6)

Standalone Playwright script using `app/node_modules/playwright` (MCP harness has a version
conflict — per memory `sr-test-account`). Dev server: `cd app && npm run dev`.

1. Start dev server; discover the actual port from its output.
2. Find a real lesson id for the protected-page probe: query `sr_lessons` (via a tiny node
   script using the app's `postgres` through `EASYAPP_DATABASE_URL`) or read it from the
   catalog after login.
3. Logged-out (fresh context, no cookie):
   - Navigate to `/` → assert final URL is `/login` and the login form is visible; assert no
     protected overview content. Screenshot `logged-out-home.png`.
   - Navigate to `/lesson/<id>` → assert redirect to `/login`. Screenshot
     `logged-out-lesson.png`.
4. Logged-in: mint cookie
   `sr_session = "2." + hmac_sha256('stemrobin-dev-session-secret', '2')` and
   `context.addCookies` (httpOnly, path `/`); no password typed.
   - Navigate to `/` → assert overview renders (no redirect). Screenshot `logged-in-home.png`.
   - Navigate to `/lesson/<id>` → assert lesson renders. Screenshot `logged-in-lesson.png`.
5. Save screenshots under the ticket `tests/` dir; record results in `tests/test-results.md`.

## Step 5 — Handoff

- Write `im-handoff.md`: mechanism (file + gate), login-open + no-registration, browser
  evidence (screenshots), test+build status, `sr_users` untouched, residual (G1 catalog-on-
  login), commit status. STOP (no merge/deploy/push).

## Blocked-exit note

If the DB is unreachable (no `EASYAPP_DATABASE_URL` connectivity) or the dev server won't
start, record evidence in `im-handoff.md` `## Blocker` and STOP without faking verification.
