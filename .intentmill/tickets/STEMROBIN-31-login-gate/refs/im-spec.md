# im-spec — STEMROBIN-31 · login-gate

Final spec derived from `im-draft.md` + self-adjudicated `im-grill.md`.

## Goal

Require login for every app page. Any unauthenticated request to any content page
(home/catalog, lesson, story, practice/progress) is redirected to the login page and
content is not rendered. After logging in with an existing account, all pages work as
before. No registration entry anywhere.

## Behavior spec

1. **Gate (SSOT).** A single server-side auth gate lives in `beforeLoad` on the pathless
   parent route `_app.tsx`, which wraps every learner surface (`/`, `/lesson/$id`,
   `/story/$id`, `/login`).
2. **Logged-out → redirect.** If there is no valid session and the requested pathname is not
   `/login`, the gate throws `redirect({ to: '/login' })`. Because `beforeLoad` runs before
   the `_app` loader, no protected catalog/lesson/story data is fetched or rendered for a
   logged-out user.
3. **Login stays reachable.** When the pathname is `/login`, the gate returns without a check,
   so the login form renders while logged out.
4. **Logged-in → unchanged.** With a valid `sr_session` cookie whose user still exists in
   `sr_users`, the gate passes and all pages behave exactly as today (catalog, lessons,
   stories, quiz, locale — all untouched).
5. **Session reuse.** The gate's "is logged in" decision is the existing `getCurrentUser`
   server fn (HMAC signature verification + `sr_users` row presence). No new session logic,
   no new cookie, no change to `session.server.ts`.
6. **No registration.** No signup/register/create-account UI is added; none exists today.

## Acceptance criteria (black-box)

- AC1: Logged-out, visiting any content page (`/`, a `/lesson/$id`, `/story/$id`) redirects
  to `/login`; the protected content is not visible.
- AC2: With a valid existing-account session, all pages are accessible normally.
- AC3: There is no "register / create account" entry in the UI.

## Constraints / invariants

- Only `app/` changes. Reuse the existing HMAC session; never write `sr_users` (read-only).
- Single gate, no scattered per-route checks (SSOT). Login route exempt.
- No new dependency, no new env var, no DB/schema/Dockerfile/deploy change.
- Logged-in experience unchanged; answer-key secrecy and all other module contracts intact.

## Verification

- Empirical browser (standalone Playwright, `app/node_modules/playwright`):
  - (a) No cookie → GET a protected page (`/`, `/lesson/<id>`) lands on `/login`, form shown,
    protected content absent. Screenshot.
  - (b) Minted test-learner `sr_session` cookie (user 2, per memory `sr-test-account`; no
    password typed) → `/` and a `/lesson/<id>` render normally. Screenshot.
- `cd app && npm run test` (vitest) clean; `cd app && npm run build` clean.
- Confirm no register UI (grep + browser).
