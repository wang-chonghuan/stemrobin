# im-plan — STEMROBIN-36 · login-logout

## Step 1 — Move login to a bare top-level route
- Create `app/src/routes/login.tsx` (top-level, child of `__root`):
  - `createFileRoute('/login')` with `beforeLoad`: if `getCurrentUser()` returns a user,
    `throw redirect({ to: '/' })` (don't show bare login to an authed user).
  - `loader`: `{ locale: await getLocale() }`.
  - Component: centered `.sr-auth` wrapper → `.sr-auth-card` with brand mark + title + the
    existing login form (email/password state, busy guard, `login()`, on success
    `router.navigate({ to: '/' })`, error slot). No sidebar, no links other than the form.
- Delete `app/src/routes/_app/login.tsx`.
- Verify: `login` redirect target still resolves to the new `/login`.

## Step 2 — Simplify the `_app` gate + load the user
- `app/src/routes/_app.tsx`:
  - `beforeLoad`: remove the `if (location.pathname === '/login') return` line; keep
    `const user = await getCurrentUser(); if (!user) throw redirect({ to: '/login' })`. Return
    `{ user }` from beforeLoad OR fetch in loader.
  - `loader`: add `user: await getCurrentUser()` alongside `lessonIds`, `locale`.
  - Pass `user` into `<CatalogSidebar ... user={user} />`.

## Step 3 — Logout control in the sidebar footer
- `app/src/components/catalog.tsx`:
  - Extend props with `user: CurrentUser | null`.
  - Import `logout` from `~/lib/session`, `useRouter` (already imported).
  - After `.sr-cat-scroll`, add `<div class="sr-cat-foot">`: signed-in email + a
    `<button class="sr-logout">` whose handler `await logout(); router.navigate({ to: '/login' })`.
  - No signup/register link.

## Step 4 — CSS
- `app/src/styles/app.css`: add
  - `.sr-auth` (full-viewport centered flex, `--sr-white` bg) + `.sr-auth-card` (bordered card,
    max-width ~360px, brand header) reusing existing `.sr-login*` for the form.
  - `.sr-cat-foot` (top border, padding, email text) + `.sr-logout` (button on `--sr-*` tokens).
- No new hues; reuse `--sr-*` tokens.

## Step 5 — i18n
- `app/src/lib/i18n.ts`: add `login.logout` (zh: 登出 / en: Sign out). Optional
  `login.signedInAs` if used for the email row label.

## Step 6 — Verify (gate6)
- `cd app && npm run dev` (note the port).
- Standalone Playwright script `app/node_modules/playwright`:
  - (a) no cookie → `/login`: form present, `.sr-catalog` absent, no lesson titles; no
    register/create-account text. Screenshot.
  - (b) mint user-2 `sr_session` (secret default) → `/`: app shell + `.sr-logout` visible.
    Screenshot.
  - (c) click logout → lands on `/login` (bare); reuse context → `/` redirects to `/login`.
    Screenshot.
- `cd app && npm run test` (vitest) clean; `cd app && npm run build` clean.
- Write `im-handoff.md`. STOP (no merge/push/PR/deploy).

## Files touched
- add: `app/src/routes/login.tsx`
- del: `app/src/routes/_app/login.tsx`
- edit: `app/src/routes/_app.tsx`, `app/src/components/catalog.tsx`,
  `app/src/styles/app.css`, `app/src/lib/i18n.ts`
- regenerated (not hand-edited): `app/src/routeTree.gen.ts`
