# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract. `im-draft.md` and `im-grill.md` are background evidence whose material decisions and constraints have been promoted here.

## Implementation Approach

Keep the feature inside existing boundaries: schema SSOT for the durable row, the textbook answer server function for atomic writes, one server-only mistake query helper, an authenticated child route inside the public `_app` shell, and typed card-route search for redo. Reuse shelf lookup, profile menu, localization, tabs, empty state, design tokens, and current answer controls. Do not create a second event interpretation or browser-side persistence path.

The new SQL block is fully qualified to `"lemmadeck-schema"` and bounded by explicit markers. A ticket-scoped Node executor reads only that block and runs it through the existing `postgres` package and `LEMMADECK_DATABASE_URL`; it never executes the legacy Azure section.

## Implementation Drift Controls

- Do not query `sr_content_answer_events` as the notebook source or change its disposable contract.
- Do not write a mistake from the browser or outside the server grading transaction.
- If book lookup fails for a textbook answer request, fail explicitly rather than parsing the card id or storing an incomplete row.
- Do not add a lesson foreign-key cascade to the durable history table.
- Do not make correct answers delete, resolve, deduplicate, or mutate prior mistakes.
- Follow the existing `/learn` child-route authentication pattern; do not expose learner history through the public `_app` shell.
- Do not invent new colors, cards, view types, filters, or controls; use the existing profile row, tabs, empty state, and app tokens.
- Do not weaken exact redo to “open the lesson”; the target exercise must be selected, visible, and resubmittable.
- Do not execute the whole legacy schema file against `lemmadeck-schema`.
- If the active schema block cannot be applied or verified, fail before starting application deployment.
- Record the charter/runbook/evodocs active-database drift in handoff/timeline; do not edit frozen charter files.

## Phases

1. **Durable schema contract**
   - Append the fully qualified, additive, idempotent mistake table and index block to `ssot-schemas/db-schemas/stemrobin.sql`.
   - Add a ticket-scoped executor that extracts only that marker-bounded block and applies it through the established Node `postgres` client.
   - Verify the table columns, user foreign key, absence of a lesson foreign key, and user/time index in `lemmadeck-schema`; rerun the apply to prove idempotency.
   - Run a rollback probe in one transaction: insert a valid temporary answer event, force the mistake insert to violate the non-empty identity check, and prove neither row remains.
   - Regression check: existing table row counts are unchanged by schema application.

2. **Atomic server persistence**
   - Update textbook grading to resolve `book_id` from the shelf authority.
   - Wrap the existing content-event write and wrong-only mistake insert in one transaction.
   - Update the notebook query to read only the dedicated table for the current user.
   - Add focused tests for book lookup and preserve all existing textbook answer behavior.
   - Regression check: correct and ungraded paths create no mistake; existing answer events still write as before.

3. **Notebook and redo UI**
   - Add the localized profile dropdown entry and protected child route.
   - Render one selected date-view tab, UTC date groups, durable row fields, established empty state, and compact responsive rows.
   - Add typed card search, exact target styling, and post-layout scrolling while preserving ordinary card defaults.
   - Regenerate the route tree through the app build tooling.
   - Regression check: logout/locale menu behavior, normal card navigation, and page-top scroll restoration remain intact.

4. **Empirical acceptance verification**
   - Strengthen the ticket Playwright script to query exact pre-state, submit a real wrong answer, select the new durable row by id, and validate its book/exercise/UTC group.
   - Read the correct fixture value only in the test's server-side Node process from the stored hidden answer key; enter it through the visible control without adding it to any application payload or DOM attribute.
   - Use that row's redo action, submit the test-only correct value, observe a correct server verdict, and prove the original mistake row still exists and no extra mistake was added.
   - Capture desktop notebook, exact redo target, and mobile notebook screenshots.
   - Delete only exact answer-event and mistake ids created by the test in `finally`.
   - Run the full unit suite, production build, existing scroll-restoration test, and the ticket browser test.

## Unit Test Plan

- Ticket-scoped tests live under `.intentmill/tickets/STEMROBIN-114-wrong-answers/tests/`.
- Schema executor assertions:
  - only the marker-bounded LemmaDeck block is executed;
  - apply succeeds twice;
  - exact columns/index/user FK exist;
  - no lesson FK exists;
  - empty book/lesson/exercise identities are rejected;
  - a forced second-write failure rolls back the preceding temporary answer event;
  - existing row counts remain unchanged.
- Browser acceptance assertions:
  - baseline mistake id/count is captured before submission;
  - the browser's wrong submission produces one new durable row with `book_id=5m`, the exact card/exercise, and a server UTC timestamp;
  - the displayed row is the new row, not `.first()` among pre-existing history;
  - UTC group date equals the timestamp's UTC date;
  - redo opens the exercise tab, highlights and scrolls exercise 9 into view;
  - entering the correct answer and submitting yields a visible correct verdict;
  - the original mistake row remains and correct submission creates no new mistake;
  - exact test-created rows are cleaned up.
- Run `cd app && npm run test`, `cd app && npm run build`, the existing scroll-restoration browser check, and the ticket browser script.
- Static key-secrecy check: no hidden `answerKey.parts.expected` or equivalent is added to initial route data or rendered attributes.

## Handoff Expectations

After implementation, write `im-handoff.md` with the actual schema, server, UI, test, and deployment changes; state any deviation from this spec/plan; identify missed grill points; record the missing `nf-db` capability and active-database charter drift as residual governance issues; and list only genuine future improvements such as additional notebook views.
