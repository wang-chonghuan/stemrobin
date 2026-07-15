# im-draft — STEMROBIN-31 · login-gate

> Rough spec/plan findings from `intent.md`, live charter, `.evodocs`, and code inspection.
> **Grill required: yes** (one UX-boundary decision; see `im-grill.md`).

## 1. Problem / intent

Today every content page (home/catalog, lesson, story, practice) is **public**. Login
is only needed to *record* a quiz answer (the `record*` server fns verify the session;
the quiz drawer shows a "login to save" link when logged out). The ticket flips the
default: **all app pages require login**. A logged-out request to any page must be
redirected to the login page (content not visible); after logging in with an existing
account, everything works as before. **No registration** — no signup flow, no
"create account" UI anywhere.

## 2. Current-state findings (code-grounded)

- Route tree (all learner surfaces live under one pathless parent):
  - `app/src/routes/__root.tsx` — document shell only (html/head/KaTeX). No loader, no content.
  - `app/src/routes/_app.tsx` — **pathless layout parent** (`createFileRoute('/_app')`).
    Loader fetches `lessonIds`, `stories`, `locale`; renders `CatalogSidebar` + `<Outlet/>`.
    Every content page is its child.
  - `app/src/routes/_app/index.tsx` → `/` (overview/catalog)
  - `app/src/routes/_app/lesson.$id.tsx` → `/lesson/$id`
  - `app/src/routes/_app/story.$id.tsx` → `/story/$id`
  - `app/src/routes/_app/login.tsx` → `/login`
  - No other top-level routes. Gating `_app` covers the whole product.
- Session (reuse, do not touch): `app/src/lib/session.server.ts` — HMAC-signed httpOnly
  cookie `sr_session = "<userId>.<hmac_sha256(SESSION_SECRET, userId)>"`; `currentUserId()`
  reads+verifies it. `app/src/lib/session.ts` exposes `getCurrentUser` (GET server fn:
  verifies cookie **and** confirms the `sr_users` row still exists) and `login`/`logout`.
- Existing loader pattern: loaders `await` GET server fns (`getLocale`, `listAvailableLessonIds`)
  — the isomorphic server-fn-in-loader pattern is already established, so a server-side
  auth check in a route hook is idiomatic here.
- **No registration UI exists today.** `grep -rni 'register|注册|创建账号|sign up|signup|create account' src/`
  → only the generated `routeTree.gen.ts` `interface Register` (TanStack router type, unrelated).
  So the "no register entry" AC is already met; the task is to *not add one* and to verify.
- `logout` server fn exists but is **not wired to any UI** today (out of scope).

## 3. Proposed approach (SSOT single gate)

Add one server-side auth gate as `beforeLoad` on the pathless parent `_app.tsx`:

```
beforeLoad: async ({ location }) => {
  if (location.pathname === '/login') return          // login stays reachable logged-out
  const user = await getCurrentUser()                 // reuse existing HMAC session SSOT
  if (!user) throw redirect({ to: '/login' })
}
```

- `beforeLoad` runs **before** the `_app` loader, so a logged-out user never triggers the
  catalog/story DB reads for a protected page, and is redirected server-side during SSR
  (and on client navigations, since `getCurrentUser` is an isomorphic server fn).
- Single gate on the one parent = SSOT; no per-route checks scattered around.
- Login route exempted by pathname so it renders logged-out.
- Reuses `getCurrentUser` (signature + user-row presence) — the existing "who is logged in"
  contract; no new session logic, no new dependency, `sr_users` only read (never written).

## 4. Assumptions

- A1: The four routes above are the complete app surface (confirmed by `find src/routes`).
- A2: `getCurrentUser()` is callable from `beforeLoad` server-side during SSR and from the
  client during navigation (same pattern as `getLocale` in loaders). **Verify empirically.**
- A3: `redirect({ to: '/login' })` thrown from `beforeLoad` yields a real HTTP redirect on
  SSR and a client nav on the client. **Verify empirically** (no `beforeLoad`/`redirect`
  precedent in this repo yet).
- A4: Logged-in experience is otherwise unchanged (quiz gate, locale, catalog all untouched).

## 5. Risks

- R1 (verify): TanStack Start `beforeLoad` + `redirect` behavior on SSR first paint — must
  confirm the logged-out response actually lands on `/login` and does not render protected
  content (belt-and-suspenders: `beforeLoad` precedes the loader, so no protected data loads).
- R2 (UX boundary — grill): the login page still renders inside the `_app` shell, so the
  **catalog sidebar (lesson titles only)** is visible to a logged-out user on `/login`.
  Lesson/story bodies and practice are never rendered. Is title-level navigation chrome
  acceptable as "content not visible", or must the login page be bare? → grill G1.
- R3: infinite-redirect safety — the pathname exemption for `/login` prevents a loop; confirm
  `/login` is the exact resolved pathname (pathless `_app` → child `login` = `/login`).

## 6. UI / external-interface / dev-time-test investigation

- **UI change**: behavioral only (redirect gate). No new components, no visual redesign.
  The one UI *policy* question is R2/G1 (catalog visibility on the login page). No register
  entry to add or remove (none exists).
- **External interfaces**: none new. Reuses the internal `sr_session` cookie + `sr_users`
  read via existing server fns. No new dependency, no new env var.
- **Dev-time test**: unit tests can't meaningfully cover a TanStack route `beforeLoad`
  redirect (framework-integration behavior). Primary verification is **empirical browser**
  (n-im cap6 playwright): logged-out → redirected to `/login` on a protected page; minted
  test-learner `sr_session` cookie → pages load. Plus `npm run test` + `npm run build` clean.
  Test-learner + cookie-minting per memory `sr-test-account` (no password typed).
