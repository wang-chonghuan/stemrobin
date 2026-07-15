# im-handoff — STEMROBIN-36 · login-logout

## What was built
A clean **bare login page** and a **visible logout control**, reusing the existing HMAC
session. No registration anywhere. `app/`-only, no new dependency, `sr_users` untouched.

### 1. Bare login page (fix the STEMROBIN-31 leak at its source)
- **Moved** the login route out of the auth-gated `_app` layout to a **top-level** route:
  - added `app/src/routes/login.tsx` (`/login`, child of `__root`, sibling of `_app`)
  - deleted `app/src/routes/_app/login.tsx`
- Because it is no longer a child of `_app`, the login page renders with **no catalog
  sidebar** — a self-contained centered card (`.sr-auth` / `.sr-auth-card`): brand, title,
  email + password, error slot, primary submit. Same form logic as before (calls the
  unchanged `login` server fn; on success `router.navigate({ to: '/' })`).
- `login.tsx` `beforeLoad` redirects an already-authenticated visitor to `/` (so the bare
  page is never shown to a logged-in user).

### 2. Login gate simplified (STEMROBIN-31 effect preserved)
- `app/src/routes/_app.tsx`: removed the now-unnecessary `if (pathname === '/login') return`
  exception from the `beforeLoad` gate. Every `_app` surface now uniformly requires a user;
  a logged-out visitor to any protected page is still redirected to `/login`.
- The `_app` loader also fetches `getCurrentUser()` and passes the user to the sidebar.

### 3. Logout control
- `app/src/components/catalog.tsx`: added a persistent sidebar **footer** (`.sr-cat-foot`)
  showing the signed-in email (`.sr-cat-user`) + a **登出 / Sign out** button (`.sr-logout`,
  lucide `LogOut` icon). Handler calls the existing `logout` server fn then
  `router.navigate({ to: '/login' })`.
- **How logout clears the session:** `logout` (`app/src/lib/session.ts`) →
  `clearSessionCookie()` (`session.server.ts`) re-sets the `sr_session` httpOnly cookie with
  `maxAge: 0`, expiring it. The next request has no valid cookie, so the `_app` gate redirects
  to `/login`. No new session code was written — the existing fn was reused.

### 4. i18n / CSS
- `app/src/lib/i18n.ts`: added `login.logout` (zh 登出 / en Sign out) to both locales
  (i18n key-parity test still green).
- `app/src/styles/app.css`: added `.sr-auth` / `.sr-auth-card` / `.sr-auth-brand` /
  `.sr-auth-title` (bare login), `.sr-login-submit`, and `.sr-cat-foot` / `.sr-cat-user` /
  `.sr-logout` — all on existing `--sr-*` tokens (no new hues, DESIGN.md palette).

## Spec/plan alignment
Implemented exactly as im-spec.md / im-plan.md. All 6 plan steps done. No deviations.
The one improvement beyond the old code: the login submit button now uses the `primary`
variant (the old bare `.sr-btn` had no background) — needed for "a clean login screen" (G-4).

## Browser verification (gate6) — standalone Playwright, real dev server
Script: `.intentmill/tickets/STEMROBIN-36-login-logout/tests/` (run via scratchpad
`verify-36.mjs`), against `npm run dev` (port 3001). **13/13 checks passed.** Logged-in checks
mint the user-2 `sr_session` HMAC cookie (secret default `stemrobin-dev-session-secret`) and
inject it via `context.addCookies` — **no password typed**.
- (a) logged-out `/login`: login card renders, form present, **no `.sr-catalog`**, **no lesson
  titles**, **no register/create-account entry**. → `tests/shots/a-loggedout-login.png`
- (b) logged-in `/`: stays on app (not redirected), catalog present, **visible logout button**,
  signed-in email shown (`edwinbiz+clerk_test@hotmail.com`). → `tests/shots/b-loggedin-app.png`
- (c) click logout → lands on bare `/login`, `sr_session` cookie cleared, then GET `/`
  **re-gated back to `/login`**. → `tests/shots/c-after-logout.png`

## Tests / build
- `cd app && npm run test` → 68/68 pass (8 files).
- `cd app && npm run build` → clean (Nitro output generated).

## Safety
- `sr_users` NOT touched (grep-confirmed in the diff). `.env` not staged. No new dependency.
  `package-lock.json` restored (npm-install pruned extraneous esbuild platform binaries; not
  part of this feature). `routeTree.gen.ts` is plugin-regenerated, not hand-edited.

## Files
- add: `app/src/routes/login.tsx`
- del: `app/src/routes/_app/login.tsx`
- edit: `app/src/routes/_app.tsx`, `app/src/components/catalog.tsx`,
  `app/src/lib/i18n.ts`, `app/src/styles/app.css`
- regenerated: `app/src/routeTree.gen.ts`

## Commit status
Uncommitted in the ticket worktree (cap6 stop point). No merge / push / PR / deploy performed,
per instructions. Ready for cap8.

## Residual / grill-leaks
- Mobile "visible" logout lives in the catalog drawer footer (behind the hamburger on
  <1200px), consistent with the app's single-nav-surface design (grill D2). Desktop shows it
  always. No separate mobile logout affordance was added (out of scope).
- Registration / password reset / role model remain intentionally absent (charter known-limit;
  grill "future/conditional").
- The `login` server fn itself is unchanged; actual credential submission was verified
  structurally (form wired to the pre-existing, already-working fn), not by typing a password,
  per the safety rule + test-account state.
