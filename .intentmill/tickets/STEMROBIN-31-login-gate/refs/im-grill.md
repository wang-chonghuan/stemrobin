# im-grill — STEMROBIN-31 · login-gate

Blocking product/architecture decisions from `im-draft.md`, each with a recommended
default. **Adjudication mode: cap13 self-adjudication from the live charter — full
delegation, no human in the loop** (seed STEMROBIN-26). Every decision is resolved below
from `charter/` (goal, engineering-rules, redlines) + the ticket AC.

---

## G1 (blocking, UX boundary) — Does the login page hide the catalog sidebar?

After the gate, the only page a logged-out user reaches is `/login`, which renders inside
the `_app` shell, so the **catalog sidebar (lesson/story titles only)** is visible there.
Lesson bodies, story prose, practice, and PDFs are never rendered to a logged-out user.

- **Option A (recommended default): keep login inside the `_app` shell.** Content =
  lesson/story bodies + practice, all gated. The catalog is navigation chrome that already
  exists; every link it exposes bounces back through the gate. No restructuring.
- Option B: make `/login` a bare page outside the shell (hide the catalog). Stricter reading
  of "content not visible", but requires moving `login` out of the pathless `_app` parent or
  threading route-awareness into `AppShell` — a non-surgical structural change.

**Adjudication → Option A.** Charter `engineering-rules` §2 Simplicity First and §3 Surgical
Changes: minimum change that solves the problem, touch only what you must. The AC "看不到内容
(content not visible)" is satisfied because all actual learning content is gated by the single
`beforeLoad`; the catalog is a title-level navigator, not content, and is the app's existing
shell. Option B adds structural change for a chrome-level concern with no charter mandate.
Recorded as a deliberate product decision; noted in handoff as a residual consideration.

## G2 (blocking, architecture) — Where does the single gate live?

- **Recommended default / adjudication → `beforeLoad` on the pathless parent `_app.tsx`,
  exempting `location.pathname === '/login'`, reusing `getCurrentUser`.** Charter
  `engineering-rules` §5 SSOT and One Way Only: exactly one gate on the one parent that wraps
  every content route; no per-route or scattered checks. Reuses the existing HMAC session SSOT
  (`getCurrentUser` = signature + `sr_users` row presence) — no parallel auth path, no new
  session logic. Aligns with ticket Constraints ("沿用现有 HMAC session；不动 sr_users").

## G3 (blocking, scope) — Registration / logout UI?

- **Adjudication → add nothing; remove nothing needed.** No register/signup UI exists today
  (verified by grep). The `logout` server fn exists but is unwired — out of scope, leave as is.
  Charter §3 Surgical Changes + ticket AC "页面上没有注册/创建账号入口" (already true).

## G4 (recommended default) — Auth check: reuse `getCurrentUser` (DB round-trip) vs. a
cookie-signature-only helper?

- **Adjudication → reuse `getCurrentUser`.** It is the existing "who is the current user"
  contract and additionally rejects a cookie for a deleted user (row-presence check per the
  domain-services module). One extra lightweight `sr_users` read per protected navigation is
  acceptable (loaders already issue multiple DB reads). Avoids a second, parallel auth code
  path (§5 SSOT). Read-only on `sr_users` — never writes (redlines §2).

---

## Out-of-scope guardrails (do NOT do)

- Do not add signup/registration, password reset, roles, or session revocation.
- Do not modify `sr_users` schema or rows; do not touch `session.server.ts` crypto/cookie logic.
- Do not add a logout button, a "logged-in as" header, or any new UI beyond the redirect gate.
- Do not add a new dependency or a new env var. Do not change the DB, Dockerfile, or deploy path.
- Do not restructure the route tree or move the login route out of `_app`.

## Future / conditional (not this ticket)

- If a stricter "bare login page" is later mandated, revisit G1 Option B.
- A logout affordance and a "signed in as X" indicator are natural follow-ups (separate ticket).

## Resolution status

All blocking decisions (G1–G4) self-adjudicated from the charter. **No human input required;
proceed to cap5.**
