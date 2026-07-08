# AutoQA

`.autoqa/` contains AI-assisted Playwright tests and shared test infrastructure for this repo. It is separate from product code and from `.t2p/` ticket evidence.

## Layout

- `fixtures/`: shared Playwright fixtures. Use these instead of repeating setup steps in specs.
- `libs/`: shared AutoQA helpers that are not fixtures.
- `shared-df/`: reusable DB/data fixtures for data-backed RG cases.
- `rg-cases/`: formal durable regression cases.
- `rg-candidates/`: draft regression case candidates.
- `tickets/<TICKET-ID>/ac-cases/`: formal ticket acceptance cases.
- `tickets/<TICKET-ID>/ac-candidates/`: draft ticket acceptance cases.
- `ssot-config.json`: repo-local AutoQA runtime configuration.

## Current Fixture

Use `azureLoggedInPage` from `fixtures/auth.ts` when a case needs an authenticated app page.

```ts
import { expect, test } from '../fixtures/auth'

test('example', async ({ azureLoggedInPage }) => {
  await expect(azureLoggedInPage).toHaveURL(/\/coach$/)
})
```

This fixture performs the real Azure / CIAM UI login. Do not replace it with direct token injection for cases that depend on login coverage.

## Run

Prerequisite for frontend cases: the local backend and frontend are running.
Start them with the project's documented dev commands; `ssot-config.json`
environments name the expected local `baseURL`/`backendURL`. Record the
exact startup commands for this repo here after initialization.

Run frontend-only legacy regression cases directly with Playwright:

```bash
npx playwright test .autoqa/rg-cases --project=chrome
```

For mixed RG cases created by capability 11/12, use n-autoqa capability 3 so the run honors `meta.json`, backend commands, and the data-fixture lifecycle (session reconcile/snapshot/clean, per-case verify/snapshot/prep/restore) executed by `libs/df_runner.py`.

## Requirements

- Browser project must use system Chrome: `channel: 'chrome'`.
- Data fixtures are declarative: a case's `df/` holds `manifest.json` (+ optional seed `data.json`) only, executed by `libs/df_runner.py` through the per-repo `libs/db_adapter.py`; both follow `ssot-config.json.db`, which is extracted from `.evodocs/constitution.md` during capability 1 initialization. Cases never carry setup/reset code.
- Semantic-gate assertions call `libs/llm_check.py`, configured by `ssot-config.json.semanticCheck`; an unavailable judge is an infrastructure failure, never a silent skip.
- Do not run automated regression and manual testing on the shared test account at the same time; scheduled jobs that write the test account's scope must be excluded or scheduled apart. Record the repo-specific conventions here.
- Do not move AutoQA specs into app directories.
- Do not duplicate login steps inside specs; use `azureLoggedInPage`.
- Generated tests must follow the case layout in the n-autoqa layout contract.
- PTA Planner / Generator / Healer work must run through OpenCode or Claude Code.
- Codex must not be used as a PTA host; rerun PTA-required steps in OpenCode or Claude Code.

## Skills

- `n-autoqa`: repo initialization, AutoQA structure, Playwright/PTA prerequisites.
- `n-toaskill`: used when changing the n-autoqa skill design itself.
- `n-git`: required for branch sync, commit, and push workflow.
