# IntentMill Grill

## Blocking Decisions

1.
   - id: storage-lifecycle
   - question: Should the user-visible wrong-answer notebook promote `sr_content_answer_events` from disposable analytics to durable history, or use a dedicated durable table?
   - recommendation: Use a dedicated durable table. The schema explicitly authorizes disposal of content answer events, while the ticket requires persistent history that survives later correct answers. Separate storage keeps analytics/progress lifecycle independent from the learner's notebook.
   - final_decision: Use a dedicated durable `sr_textbook_mistakes` table; keep `sr_content_answer_events` disposable and unchanged. Basis: ticket Constraints require database persistence and preservation after later correct answers; `ssot-schemas/db-schemas/stemrobin.sql` explicitly defines content answer events as disposable; `.prodfarm/charter/engineering-rules.md` requires one SSOT and forbids a shadow lifecycle.

2.
   - id: active-schema-apply
   - question: Which database/schema must receive the additive mistake table, given that current code and README use `lemmadeck-schema` while the frozen charter and schema header still name retired `stemrobin-schema`?
   - recommendation: Add a fully schema-qualified LemmaDeck block to the existing schema SSOT and execute only that block through the repository's established server-only Node `postgres` client. Do not retarget or execute the legacy Azure section.
   - final_decision: Add and apply only a fully qualified `"lemmadeck-schema".sr_textbook_mistakes` block through `LEMMADECK_DATABASE_URL`; leave the legacy Azure header/section untouched and record the broader charter/runbook/schema drift for boundary settlement. Basis: ticket Scope requires the running app to persist mistakes; `app/src/lib/db.ts` and `README.md` establish the active runtime target, while `.prodfarm/charter/engineering-rules.md` requires schema changes to remain in the schema SSOT. Additive DDL follows `.prodfarm/timeline/0014-tkt-STEMROBIN-19.md` and deletes or rewrites no accumulated row.

3.
   - id: durable-row-lifetime
   - question: Should a mistake row be deleted automatically if its lesson/card row is later removed or replaced?
   - recommendation: Keep the stable lesson id as data without an `ON DELETE CASCADE` lesson foreign key. User-visible history should not disappear because generated content is republished; redo may be unavailable only if the referenced lesson no longer exists.
   - final_decision: Preserve the stored lesson/card id without a lesson foreign-key cascade; keep the existing user foreign key with account-deletion cascade. Basis: ticket Constraints define the rows as persistent learner history, while generated lesson rows are replaceable content; the recommended default is the only option that prevents content lifecycle from silently erasing that history.

## Recommended Defaults

- Resolve and store the book id at wrong-answer write time using the textbook shelf authority; do not parse it from the card id or recompute it on every read.
- Record one row per wrong submission and preserve every row after later correct submissions.
- Keep date grouping and timestamps strictly UTC as the ticket specifies; newest dates and events appear first.
- Reuse the existing profile dropdown, protected `_app` shell, route search, app CSS tokens, and Lucide icon patterns.
- Reuse the existing `.sr-tabs` pattern for the single current date view and `.sr-empty` for no records, preserving a clear future-view entry without implementing future views.
- Verify with one real browser flow plus server-side test-only DB queries: capture pre-state, create a wrong row, redo correctly, prove the original row remains, then delete only the exact rows created by the test.
- Apply additive schema before deploying application code; fail deployment verification if the table is absent.

## Future Or Conditional Decisions

- Additional notebook views, filtering, deduplication, resolved/mastered state, deletion, and bulk redo can be designed in later tickets.
- If a lesson is permanently removed, a later product decision may define how an unavailable historical row is displayed; this ticket does not add that state.

## Out-of-Scope Guardrails

- Do not include read checks, legacy relational quiz questions, English recitation, or generated content changes.
- Do not expose answer keys or accepted forms in initial browser payloads.
- Do not add a new dependency, database client, service, dashboard, analytics aggregation, or mistake-resolution state.
- Do not edit frozen charter files during this ticket; record the active-database documentation drift for boundary settlement.
