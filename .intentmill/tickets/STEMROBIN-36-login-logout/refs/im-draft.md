# im-draft — STEMROBIN-36 · login-logout

## Intent (restated)
Deliver a proper **login page** + a **logout** affordance. No registration. Reuse the
existing HMAC session (`login`/`logout` server fns). Do not touch `sr_users`. The
STEMROBIN-31 login gate stays; this ticket refines the login **page** (bare, no catalog
sidebar) and adds a visible logout control. `app/` only, no new dependency.

## Current state (code-grounded)
- `app/src/routes/_app.tsx` is the pathless auth-gated layout. Its `beforeLoad` gate
  redirects unauthenticated users to `/login`, but **special-cases `/login`** so the login
  route stays reachable while logged out. `AppShell` always renders `<CatalogSidebar/>` +
  `<Outlet/>`. → **Root cause of the leak:** login lives *under* `_app`, so a logged-out
  visitor on `/login` still gets the full app shell (catalog sidebar with lesson titles).
- `app/src/routes/_app/login.tsx` renders inside `.sr-detail` (the shell's detail pane) — a
  credential form wired to the pre-existing `login` server fn, then `router.navigate({to:'/'})`.
- `app/src/lib/session.ts` already exports `login`, `logout`, `getCurrentUser` server fns.
  `logout` calls `clearSessionCookie()` (session.server.ts) → sets `sr_session` maxAge 0.
  **Logout server fn already exists — reuse, do not add.**
- `app/src/components/catalog.tsx` = the persistent `<aside class="sr-catalog">`; header
  (brand + language switch) then scrollable outline. No footer, no user identity shown.
- CSS `app/src/styles/app.css`: `.sr-login*` form styles exist; `.sr-detail`, `.sr-catalog`,
  `.sr-app` layout. `.sr-page` box-sizing helper exists but is unused.
- Root route `__root.tsx` renders `<Outlet/>` directly inside `<html><body>` — so a
  top-level route (sibling of `_app`) renders WITHOUT the `_app` shell.

## Findings / approach
**F1 — bare login (fix the leak at its source).** Move login OUT of the gated `_app` layout to
a **top-level** route `app/src/routes/login.tsx` (child of `__root`, sibling of `_app`). It
then renders with no catalog sidebar at all — a self-contained centered login card. Simplify
the `_app` gate to drop the now-unnecessary `/login` special-case (`_app` = protected surfaces
only). This is the SSOT-clean fix: login is a public route, not a gated-shell child.

**F2 — logout control.** Add a persistent, visible logout control in the catalog sidebar
footer (the sidebar is the app's single always-present nav surface; on mobile it is reachable
via the existing drawer). Show the logged-in email + a "登出/Sign out" button that calls the
existing `logout` server fn then `router.navigate({to:'/login'})`. `_app` loader must fetch the
current user (the gate already guarantees one) to pass the email down.

**F3 — no registration.** Neither the login page nor the sidebar exposes any signup / create-
account entry. (Current code already has none; keep it that way.)

## UI changes
- New bare login page (top-level route) — centered card, brand, email+password, error, submit.
- Sidebar footer: user email + logout button (new CSS `.sr-cat-foot`, `.sr-logout`).
- i18n: add `login.logout` (+ optional signed-in label) for zh/en.

## External interface
None new. Reuses existing `login`/`logout`/`getCurrentUser` server fns and HMAC cookie.
`sr_users` untouched. No new dependency.

## Dev-time test obstacles
- Browser (gate6) via **standalone Playwright** from `app/node_modules/playwright`.
- Logged-in checks: mint `sr_session` for user 2 (secret default `stemrobin-dev-session-secret`),
  inject via `context.addCookies` — **no password typed** (respects safety rule + test-account
  memory: account may be login-disabled).
- Logged-out check: no cookie → `/login` must be bare (no `.sr-catalog`, no lesson titles).

## Risks
- Moving the route regenerates `routeTree.gen.ts` (auto). Redirect target `/login` still
  resolves (route still exists, just top-level).
- Mobile "visible" logout: it sits in the drawer footer (behind hamburger). Acceptable — the
  sidebar is the app's canonical nav; desktop shows it always.

Grill required.
