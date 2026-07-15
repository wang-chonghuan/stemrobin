# im-handoff — STEMROBIN-31 · login-gate

## What changed

One surgical change, `app/` only.

- `app/src/routes/_app.tsx` — added a single `beforeLoad` auth gate to the pathless parent
  route `_app` (which wraps every learner surface: `/`, `/lesson/$id`, `/story/$id`, `/login`):

  ```ts
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') return
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
  },
  ```

  Added imports: `redirect` (from `@tanstack/react-router`) and `getCurrentUser`
  (from `~/lib/session`). Loader and `AppShell` component unchanged.

No other files changed. `package-lock.json` was momentarily mutated by a local `npm install`
(it pruned platform-specific esbuild optional-dep entries) and was **restored** — the
committed lockfile is untouched.

## How the gate works (mechanism / SSOT)

- `_app` is the one pathless parent of every content route, so a single `beforeLoad` there is
  the whole-app gate (SSOT) — no scattered per-route checks.
- `beforeLoad` runs **before** the `_app` loader, so a logged-out user never triggers the
  protected catalog/lesson/story DB reads; the redirect happens server-side on SSR and as a
  client nav on in-app navigation (`getCurrentUser` is an isomorphic GET server fn).
- "Is logged in" = the existing `getCurrentUser` (HMAC signature verify + `sr_users` row
  presence). Reuses the existing HMAC session; **no** new session logic, cookie, dependency,
  or env var.
- **Login stays open**: the `location.pathname === '/login'` exemption lets the login form
  render while logged out (also prevents a redirect loop).

## No registration

No signup/register/create-account UI exists in the codebase (grep + browser both confirm) and
none was added. The unwired `logout` server fn was left as-is (out of scope).

## Acceptance vs. evidence

- AC1 (logged-out → login, content hidden): **met** — Playwright checks 1–2; `logged-out-*.png`.
- AC2 (logged-in → all pages work): **met** — checks 3–4; `logged-in-*.png`.
- AC3 (no register entry): **met** — check 5 + grep.

Browser evidence, unit (47 passed) and build (OK) results: `tests/test-results.md` +
`tests/*.png`. `sr_users` read-only throughout; no schema/session/deploy change.

## Spec/plan alignment

Implemented exactly as `im-spec.md` / `im-plan.md`. All grill decisions (G1–G4) were
self-adjudicated from the charter (cap13, full delegation, no human) — see `im-grill.md`.

## Missed user-review points / residual

- **G1 (adjudicated Option A, residual):** the login page renders inside the `_app` shell, so a
  logged-out user on `/login` sees the **catalog sidebar (lesson/story titles only)** — a
  title-level navigator, not content. All lesson/story bodies, practice, and PDFs remain gated
  (verified: `logged-out-lesson.png` shows the login form in the detail pane, no lesson iframe).
  If a stricter "bare login page" is later required, revisit G1 Option B (move `login` out of
  `_app` or hide the sidebar on that route) — a larger structural change deliberately avoided
  here under charter §2/§3 (Simplicity / Surgical Changes).
- Follow-ups (separate tickets, out of scope): a logout affordance and a "signed in as X"
  indicator; wiring the existing `logout` server fn to UI.

## Grill leaks

None. Every UI/interface/dev-test decision the draft raised was captured in `im-grill.md` and
adjudicated from the charter before implementation.

## Status

- cap3→cap6 complete; gate6 obligations (spec/plan alignment, tests, build, empirical browser
  verify, handoff) satisfied. **STOP at a verified worktree.**
- **Commit status: uncommitted** (cap6 does not commit; cap8 owns commit/PR). Working tree:
  `M app/src/routes/_app.tsx` + new `.intentmill/tickets/STEMROBIN-31-login-gate/{refs,tests}/`.
- No merge, no deploy, no cap8, no push (per executor scope).
