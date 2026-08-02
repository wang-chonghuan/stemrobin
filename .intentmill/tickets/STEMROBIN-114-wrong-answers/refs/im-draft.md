# IntentMill Draft

## Source

- Ticket key: `STEMROBIN-114-wrong-answers`; ticket id: `STEMROBIN-114`.
- Read `.intentmill/tickets/STEMROBIN-114-wrong-answers/meta.json` and the raw original user intent in `.intentmill/tickets/STEMROBIN-114-wrong-answers/intent.md`.
- Read `AGENTS.md`, all five `.prodfarm/charter/` files, `.evodocs/modules/module-index.json`, `.evodocs/modules/mod--app.md`, `.evodocs/modules/mod--app--domain-services.md`, `.evodocs/modules/mod--app--learner-experience.md`, and `.evodocs/modules/mod--database-schema.md`.
- Read `resources/reference/DESIGN.guide.md` before `resources/reference/DESIGN.md`. Inspected `README.md`, `app/src/lib/db.ts`, `app/src/lib/textbook-answer.ts`, `app/src/lib/textbooks.ts`, `app/src/components/catalog.tsx`, `app/src/routes/_app.tsx`, `app/src/routes/_app/card.$id.tsx`, existing `.sr-tabs` and `.sr-empty` CSS patterns in `app/src/styles/app.css`, and `ssot-schemas/db-schemas/stemrobin.sql`.
- This repository has no `nf-db` skill. An earlier cap3 attempt incorrectly used the repository's Node `postgres` client for a live read-only probe; those counts are discarded and are not used as planning evidence. This rerun uses only static SSOT/code evidence. Database application and empirical DB verification remain an execution gate and must use the repository-authorized server-only Node `postgres` path recorded in `README.md`; no `psql` or browser DB client is permitted.
- No new library, SDK, cloud service, or unfamiliar external interface is required. PostgreSQL through `app/src/lib/db.ts` is established. Framework documentation was not needed for the draft because the route, server-function, and link patterns already exist in this codebase.
- UI research: IXL's Questions Log and Trouble Spots patterns expose exact missed questions for targeted review; Quizlet's Write mode focuses subsequent study on missed items; learner requests around Khan Academy repeatedly emphasize direct navigation back to a missed question without revealing the answer first. This supports a compact chronological record with one direct redo action, not an analytics dashboard or pre-revealed solution.

## Draft Spec

- Draft: authenticated learners have a protected `/mistakes` surface reachable from the existing profile dropdown.
- Draft: every automatically graded textbook exercise submission that is wrong creates a durable database record containing learner id, textbook book id, lesson/card id, printed exercise number, and server-generated UTC timestamp.
- Draft: durable mistake history is independent of the disposable `sr_content_answer_events` analytics/progress event lifecycle. A later correct answer does not update or delete prior mistake records.
- Confirmed: the durable store is a dedicated `sr_textbook_mistakes` table. It keeps a user foreign key with account-deletion cascade, but its stored lesson/card id has no lesson cascade.
- Confirmed: the additive table is applied to the active `LEMMADECK_DATABASE_URL` / `lemmadeck-schema`; the schema SSOT header and apply instructions are corrected to match current runtime truth, while frozen charter drift is left for boundary settlement.
- Draft: the initial view groups records by UTC calendar date in reverse chronological order and displays book id, exercise number, and UTC occurrence time.
- Draft: a visible single-option `按日期 / By date` tab uses the existing `.sr-tabs` pattern so the current view is explicit and future view types have a stable entry structure without implementing them now.
- Draft: each row offers a redo action that opens the original card's exercise tab, identifies the exact printed exercise, scrolls it into view, and leaves its answer control usable for another server-judged submission.
- Draft: only textbook exercise answers participate. Read checks, legacy relational quizzes, and English recitation remain outside this feature.
- Draft: initial question payloads remain answer-key-free and all grading remains server-side.
- Draft: the page follows the existing `_app` shell and the established authenticated-child pattern used by `/learn`, because the parent shell itself is public. It uses the profile menu, `.sr-tabs`, `.sr-empty`, `--sr-blue`/`--sr-green`/white palette, `--sr-font`, compact 20px detail padding, Lucide icons, responsive detail-pane layout, and teal focus rules from `resources/reference/DESIGN.md` and `app/src/styles/app.css`.

## Draft Plan

- Draft direction: append one additive, idempotent, fully schema-qualified block for a dedicated durable textbook-mistake table in `"lemmadeck-schema"`, with a user/time lookup index. Do not change or execute the legacy Azure `SET search_path` section. Store book and exercise identifiers at occurrence time so later shelf-label changes do not rewrite history.
- Draft direction: in the existing textbook answer server function, keep the current content-answer event write and add the durable mistake insert only for a wrong automatically graded result, inside one database transaction.
- Draft direction: read the dedicated mistake table through a server-only domain helper; render an authenticated child route under the public `_app` shell following `/learn`; add the profile-dropdown entry, one-option date-view tab, established empty state, and localized copy using existing patterns.
- Draft direction: use typed route search (`tab=ex&exercise=<number>`) to open and position the exact exercise. Preserve ordinary card navigation's existing default-to-text behavior.
- Draft direction: replace the express-era acceptance script with a database-backed browser check that records the pre-submit state, proves a new row and timestamp were created by the actual wrong submission, submits a correct redo answer, and proves the original wrong record remains.
- Draft direction: run focused tests, the full app unit suite, production build, desktop/mobile browser verification, additive schema apply, deployment, and live verification.

## Code And Evodocs Findings

- `ssot-schemas/db-schemas/stemrobin.sql` explicitly marks `sr_content_answer_events` as disposable. Using it as the sole user-visible wrong-answer history would silently change its lifecycle contract and caused the required `express -> standard` reroute.
- `app/src/lib/textbook-answer.ts` already owns server-side grading and authenticated content-event persistence. It is the one correct write boundary; browser code must not create mistake records.
- `app/src/lib/textbooks.ts` is the shelf authority that maps a card id to its book id. The book id should be resolved at write time and persisted with the mistake.
- `README.md` and `app/src/lib/db.ts` are current code facts: the app reads Supabase through `LEMMADECK_DATABASE_URL` and quoted `lemmadeck-schema`; the charter, evodocs, runbook, and schema header still describe the retired Azure `stemrobin-schema`. The ticket cannot rewrite frozen charter intent or safely retarget the entire legacy SQL file. Its additive DDL is therefore fully qualified to the active schema and executed in isolation; the broader documentation/SSOT migration drift is recorded for boundary follow-up.
- Existing UI surfaces affected: profile dropdown (`catalog.tsx`), protected route tree, mistakes detail page at desktop and mobile widths, existing tab and empty-state patterns, card exercise tab/search handling, exact exercise highlight/scroll, localized Chinese/English strings, and global app CSS. The overview, knowledge galaxy, read-check UI, English recitation, legacy quiz drawer, and generated lesson content are not affected.
- The IXL exact-question log pattern supports showing concrete question identity and chronology; Quizlet's missed-item loop supports a direct retry command. The current ticket already settles placement, displayed fields, date grouping, and redo behavior, so no additional dashboard, filters, mastery state, or deletion controls are justified.
- The dedicated table has no need to reference disposable event ids. `user_id` should retain the existing account-lifetime cascade. `lesson_id` should remain a stored stable identifier without a content-row cascade so mistake history is not erased by content replacement; redo can only function while that lesson remains available.
- The current express-era Playwright check is insufficient: it can pass using pre-existing exercise-9 rows, it does not prove a newly inserted record, and its redo check stops before submitting another answer.

## Assumptions

- Each wrong submission is a distinct historical occurrence, so repeated wrong attempts may create repeated rows.
- The stable card id and printed exercise number are sufficient to reconstruct the redo URL; the current textbook shelf provides the book id at write time.
- A correct redo proves the exercise remains usable but does not mark the historical row resolved; resolution/mastery status is outside the ticket.

## Risks

- DB/schema: applying the stale schema file wholesale to the active database is forbidden. Execution must extract and run only the new fully qualified LemmaDeck block and verify that exact table/index in `lemmadeck-schema`.
- Data integrity: a wrong content event without a matching durable mistake row, or vice versa, would produce divergent histories. Both writes must share one transaction.
- Lifecycle: a foreign-key cascade from lessons would make user-visible history disappear during content replacement; avoid that coupling.
- Security: moving answer keys or expected values into the browser test path would violate answer-key secrecy. The production UI must remain key-free; ticket testing may inspect the DB only from Node and must not expose those values to page payloads.
- R-TEST: the acceptance flow uses the real shared app database and authenticated server path. The script uses the established test user/session, captures exact pre-state, selects newly created row ids, and deletes only those test-created rows in `finally`; it must not infer success from existing records or delete accumulated learner data.
- R-TEST: exact exercise scrolling is asynchronous because route restoration and MathLive rendering can move layout; browser verification must wait for the target to be inside the viewport and then submit.
- Deployment: the additive table must exist before application code that writes it goes live. Deploy order is schema first, then app.

## Grill Required

completed
