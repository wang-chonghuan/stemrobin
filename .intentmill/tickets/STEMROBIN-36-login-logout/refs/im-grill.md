# im-grill — STEMROBIN-36 · login-logout

Full delegation (n-prodfarm cap13, no human). Decisions self-adjudicated from the charter,
the seed grill (batch 0006, decision **G-4**), and the ticket acceptance criteria. Each
blocking decision below is resolved with the charter-consistent default and the reason.

## D1 — How to make the login page "bare" (no catalog sidebar)?
Options: (a) conditional branch inside `AppShell` to hide the sidebar on `/login`;
(b) move login to a top-level route outside the gated `_app` layout.
**Decision: (b) move to top-level `login.tsx`.** Charter engineering-rule 5 (SSOT / one way
only) + rule 3 (surgical, every line traces to the request). The leak exists *because* login
was placed under the gated shell; branching the shell keeps the root cause and adds a second
shell mode. Moving login makes `_app` mean exactly "authenticated surfaces" and removes the
`/login` special-case from the gate. The login gate (STEMROBIN-31) still stays — it just no
longer needs an exception.

## D2 — Where does the logout control live?
Options: sidebar footer; a header/user menu; the overview page only.
**Decision: catalog sidebar footer** (persistent, single canonical nav surface; DESIGN.md
three-color palette, no new hues). Header user-menu would add a new pattern the app doesn't
have. Overview-only would fail "the app has a visible logout control" on lesson pages.
Mobile: reachable through the existing catalog drawer — acceptable, the sidebar is the app's
one nav home.

## D3 — Add a logout server fn, or reuse?
**Decision: reuse the existing `logout` server fn** in `app/src/lib/session.ts` (constraint:
"reuse existing HMAC session login/logout server fns"; it already clears `sr_session`). No new
server fn.

## D4 — After logout, where does the user land?
**Decision: navigate to `/login`.** Acceptance: "登出后回到登录页" + "登出后访问受保护页被要求
重新登录". Navigating to `/login` shows the bare page; the `_app` gate re-protects everything else.

## D5 — Registration entry?
**Decision: none, anywhere** (G-4 + constraint "无注册入口"). No signup form / create-account
link on the login page or in the sidebar.

## D6 — Password handling in verification?
**Decision: never type a password.** Logged-in checks mint the `sr_session` HMAC cookie for
user 2 and inject it (test-account memory + safety rule). The login form is verified
structurally (renders, email+password fields, submit wired to the unchanged `login` fn).

## Recommended defaults (non-blocking)
- Reuse existing `.sr-login*` form CSS inside a new centered `.sr-auth` wrapper; add minimal
  `.sr-cat-foot` / `.sr-logout` on existing `--sr-*` tokens.
- Keep login copy in the existing i18n `login.*` namespace; add `login.logout`.

## Future / conditional (out of scope now)
- Registration / password reset / role model — explicitly deferred (charter known-limit:
  "authentication is intentionally minimal").
- A full header user-menu — not needed for this ticket.

## Out-of-scope guardrails
- Do not touch `sr_users`, the session crypto, or the answer-key boundary.
- Do not add a dependency. `app/` only. Do not hand-edit `routeTree.gen.ts`.
