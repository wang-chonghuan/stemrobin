# QA — how this project is tested

Verification here is **acceptance-criteria only**: a ticket proves its own criteria against the
running product and stops. No regression suite in the loop, by choice.
Section shape is fixed — see `format.md`.

This file is the **method**. A ticket's assertions live in its `ac.md`. Angle-bracketed parts are this
project's to fill; the rest holds regardless of project.

## Contract

**What counts as evidence.** A **ticket-scoped script run from the command line** — it encodes
assertions someone can re-run. `playwright-cli open <url>` is fine for poking at a page while
debugging; it is never the evidence that a criterion passed.

Scripts and screenshots live in `.dimleaper/tickets/<ticket-id>/tmp/`, uncommitted. One script
covering all of a ticket's criteria is the normal case, with a screenshot per criterion.

**What a criterion check asserts.** The page or flow is reachable · the fixed controls are present ·
the expected region renders · the action is accepted · the result appears in the right place ·
loading resolves · no error state · the value has the right shape.

**A chore has no port and no playwright check** — its proof is the observation command the ticket
names.

## Tools

**Playwright** — after first adding it, or after upgrading: `npx playwright install chromium`.

<The project's actual run command — a `.spec.ts` via `npx playwright test <path>`, or a standalone
`.mjs` driving `chromium.launch()`. Pick one and write it here so every ticket runs the same way.>

**Ports and base URL.** Ticket ports come from `project.json`:

```bash
python3 <n-dimleaper-skill>/scripts/ports.py .dimleaper/project.json ticket <ticket-id>
```

Express work uses each service's explicit `main` port from the same file.

<Startup command, and how to build the base URL from a port.>

**Viewports** — <which viewports a UI criterion must be checked at, e.g. desktop 1440×960 and mobile
390×844.>

**Test accounts and data** — <where credentials come from, never the values themselves. Seeded data,
and how to reset state between runs.>

**Non-UI observation** — <the query or command shape used to see data changes and background jobs a
browser cannot.>

## Guidance

Binding. Followed while writing the check, judged by the author.

**Start the product first.** Confirm the service is actually responding at its URL before invoking
Playwright. Knowingly running into `ERR_CONNECTION_REFUSED` produces a failure that says nothing — fix
the startup, or stop and report it. That is a stop condition, not a test result.

**Headed, not headless,** for formal UI verification — headless hides real rendering failures. Fall
back to headless only on a non-GUI environment, and say so in the handoff rather than claiming headed
verification passed.

<If this project runs system Chrome via `channel: 'chrome'`, note the `--project=chrome` requirement
here.>

**Locators.** Prefer user-visible ones — role, label, placeholder, visible text. For regions whose
content varies, use a stable `data-testid` or `data-*` container attribute. Never locate by CSS class
chains or DOM structure the user cannot perceive; they break on refactors that changed nothing a user
would notice. **Locate the stable container first, then assert about what is inside it** — never find
a dynamic response by matching its generated text.

**Dynamic and AI-generated content.** Generated text is not fixed UI copy; assert the product's
contract, not the model's wording.

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
2. **Mutating external or production data from a test** — forbidden outright.
3. **<Any account or dataset tests must never touch>** — forbidden outright.
