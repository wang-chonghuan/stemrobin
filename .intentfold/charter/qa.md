# QA — how this project is tested

Verification here is **acceptance-criteria only**: a ticket proves its own criteria against the
running product and stops. No regression suite in the loop, by choice.
Section shape is fixed — see `format.md`.

This file is the **method**. A ticket's assertions live in its `ac.md`. The generic method below is
the intentfold template's; the project-specific parts were filled in 2026-08-05, when `.autoqa/` was
retired.

## Contract

**What counts as evidence.** A **ticket-scoped script run from the command line** — it encodes
assertions someone can re-run. `playwright-cli open <url>` is fine for poking at a page while
debugging; it is never the evidence that a criterion passed.

Scripts and screenshots live in `.intentfold/tickets/<ticket-id>/tmp/`, uncommitted. One script
covering all of a ticket's criteria is the normal case, with a screenshot per criterion.

**What a criterion check asserts.** The page or flow is reachable · the fixed controls are present ·
the expected region renders · the action is accepted · the result appears in the right place ·
loading resolves · no error state · the value has the right shape.

**A chore's proof is whatever settles its criterion** — usually the observation command the ticket
names, and then it needs no port and no browser. But a criterion that is only visible in the running
product is checked in the running product, chore or not. On this project that case is the normal
one: content chores write rows the app renders, and a query proves the row landed while proving
nothing about whether the product shows it — STEMROBIN-123 saved seven lessons that were invisible
in the product, and only opening the page said so.

**`app/tests/` is not this flow's business.** It holds the project's own long-lived Playwright specs
(`cd app && npm run e2e`). A ticket's AC check is a throwaway script under the ticket's `tmp/`, not a
new spec added there.

## Tools

**Playwright** — use the copy already installed in the app project (`app/node_modules/playwright`);
do not install a second one at the repo root. After a fresh clone or an upgrade:

```bash
cd app && npx playwright install chromium
```

**The AC check** — a standalone `.mjs` driving `chromium.launch()`, run from `app/` so it resolves
playwright from the app's `node_modules`:

```bash
cd app && node ../.intentfold/tickets/<ticket-id>/tmp/ac-check.mjs
```

**Ports and base URL.** Ticket ports come from `project.json`:

```bash
python3 <intentfold-skill>/scripts/ports.py .intentfold/project.json ticket <ticket-id>
```

Express work uses the explicit `main` port from the same file (web = 3200). Start the product with
the commands in `runbook.md`; the base URL is `http://localhost:<port>`.

**Viewports** — a UI criterion is checked at **desktop 1440×960** and **mobile 390×844**. The layout
breakpoint that matters is **860px**: the 236px catalog pane hides below it and the detail pane goes
full-width (`resources/reference/DESIGN.md`).

**Test accounts and data**

- The **test learner** is `edwinbiz+clerk_test@hotmail.com` — `sr_users.user_id = 2` in
  `lemmadeck-schema`, created for exactly this purpose. Every logged-in check uses it.
- `edwinbiz@hotmail.com` — `sr_users.user_id = 1` — is the **real learner**. It is not a test
  account; see the redlines.
- **Getting a logged-in session without a password.** The session is an HMAC-signed cookie
  `sr_session = "<userId>.<hmac_sha256(SESSION_SECRET, userId)>"` (`app/src/lib/session.server.ts`).
  `SESSION_SECRET` is not set in the repo `.env`, so the local app uses the in-code default. Mint the
  cookie and inject it with Playwright's `context.addCookies` (httpOnly), rather than driving the
  login form:

```bash
node -e "const c=require('crypto');console.log('2.'+c.createHmac('sha256', process.env.SESSION_SECRET || 'stemrobin-dev-session-secret').update('2').digest('hex'))"
```

- **Password login is not available to the agent.** No `TEST_USER_*` keys exist in `.env`, and typing
  a password into a field is outside what this flow does. A criterion that genuinely requires the
  login form is a stop and a hand-off to the human.
- Any rows a check creates (`sr_answer_events` and the like) are cleaned up afterwards, in the same
  script that made them.

**Non-UI observation** — the DB is remote and shared; read it with psql, scoped to the live schema:

```bash
psql "$LEMMADECK_DATABASE_URL" -c 'select * from "lemmadeck-schema".sr_answer_events where user_id = 2 order by created_at desc limit 10;'
```

**Observe the database the app actually reads.** `EASYAPP_DATABASE_URL` / `stemrobin-schema` still
connects and still holds a stale copy of some content — a check pointed there can pass on data the
product cannot see (this is exactly how STEMROBIN-123's seven lessons looked saved and were invisible).

## Guidance

Binding. Followed while writing the check, judged by the author.

**Start the product first.** Confirm the service is actually responding at its URL before invoking
Playwright. Knowingly running into `ERR_CONNECTION_REFUSED` produces a failure that says nothing — fix
the startup, or stop and report it. That is a stop condition, not a test result.

**Headed, not headless,** for formal UI verification — headless hides real rendering failures. Fall
back to headless only on a non-GUI environment, and say so in the handoff rather than claiming headed
verification passed.

**Drive a real browser from a script, not an embedded browser panel.** An in-app preview pane has
rendering quirks — hidden panels, IntersectionObserver not firing — that produce false negatives on
lazy-loading and viewport logic. Use it to show a page to the human, never as the basis of a verdict.

**Locators.** Prefer user-visible ones — role, label, placeholder, visible text. For regions whose
content varies, use a stable `data-testid` or `data-*` container attribute. Never locate by CSS class
chains or DOM structure the user cannot perceive; they break on refactors that changed nothing a user
would notice. **Locate the stable container first, then assert about what is inside it** — never find
a dynamic response by matching its generated text.

**Dynamic and AI-generated content.** Generated text is not fixed UI copy; assert the product's
contract, not the model's wording. Lesson html, exercise decks and story chapters are all
skill-generated — assert structure, not sentences.

- *Assert*: the response appears in the right place, is non-empty once loading finishes, loading
  states resolve, error-only states do not appear, and values have the right shape or format
  (currency, date, count, row structure).
- *Do not assert*: exact full text of generated paragraphs; exact ranked titles or wording; exact
  numbers, dates or percentages unless the dataset is pinned.
- *Streaming*: do not pass on the first non-empty token. Wait for a completion signal —
  `aria-busy="false"`, `data-streaming="false"`, a loading indicator disappearing, the send control
  returning to ready. With no such signal, wait until the text stops changing for ~2s. Set the test
  timeout above the longest expected backend wait.
- *Stale content must not satisfy the assertion.* Assert after the action that triggers the content,
  against a region you know was empty or different before — otherwise a broken feature passes on
  leftovers from a previous run.

Use web-first assertions or `expect.poll` for anything asynchronous. Never sleep a fixed duration and
hope.

**When it fails.** Decide first whether it is an **implementation defect** or a **test problem**
(locator too broad, wait too short, wrong fixture). Fix whichever it is, then re-run **the same
command** — do not switch commands, and do not create extra diagnostic scripts or scratch files to
work around it.

## Redlines

**A closed list, looked up — never judged.** Do not ask "is this a big deal?"; check whether the
action is on the list. If it is: **route around it, or stop and hand it to the human.** Never
proceed, never approximate, never decide on the human's behalf.

Every entry says which of the two it is — **forbidden outright**, or **not without the human's
explicit approval**. An entry that needs a read-through to apply is not a redline; write it as
Guidance instead (`format.md`, test 2).

1. **Recording a criterion as passed when its check did not run** — forbidden outright. An
   environment or external limit that stopped the run goes into `handoff.md` exactly as it happened.
2. **Writing to the real learner's data from a test** — forbidden outright. That is
   `sr_users.id = 1` / `edwinbiz@hotmail.com`; tests use `id = 2` and nothing else.
3. **Driving https://lemmadeck.com** — forbidden outright. That means signing in, clicking, sub­mitting,
   or anything that writes. Acceptance always runs against localhost.
   **A read-only GET is not driving** and is not on this list: `devops.md`'s post-deploy check
   requires looking at the live site, and fetching a page or an asset to confirm a deploy took is
   exactly that. (Narrowed 2026-08-06: the entry used to forbid "running a check against" production
   outright, which contradicted the post-deploy check the same charter mandates. Two rules that
   cannot both be obeyed get one of them ignored, and nobody decides which.)
4. **Writing a real password, session secret, or DB connection string into a check script, a ticket
   artifact, or this file** — forbidden outright. The cookie-minting command above is the supported
   way in.
