# IntentMill Handoff

## Delivered

- Added the durable `"lemmadeck-schema".sr_textbook_mistakes` table, its non-empty identity constraint, user cascade, and deterministic user/time index to the schema SSOT.
- Updated textbook grading so authenticated submissions write the existing answer event and a wrong-only durable mistake occurrence in one PostgreSQL transaction.
- Added shelf-authoritative book lookup without parsing card ids.
- Added the authenticated `/mistakes` route, localized profile-menu entry, UTC date grouping, empty state, responsive layout, and exact redo links.
- Added typed redo search state to the card route, exercise-tab selection, exact target highlighting, and post-restoration/post-MathLive scrolling.
- Added focused shelf lookup tests plus ticket-scoped schema and browser acceptance scripts.

## Spec And Plan Alignment

- All twelve spec requirements are implemented through the planned schema, server boundary, authenticated child route, existing profile menu, and existing card route.
- The notebook reads only the dedicated durable mistake table and remains scoped to the current authenticated user.
- Correct and ungraded submissions create no mistake row; later correct submissions do not update or delete history.
- Initial browser data remains answer-key-free and all grading remains server-side.
- Existing design tokens, tabs, empty-state, shell, localization, Lucide icons, and answer controls were reused without adding dependencies.
- The schema executor applies only the marker-bounded LemmaDeck block and does not execute or retarget the legacy Azure section.
- The implementation follows the plan. No product-scope deviation was introduced.

## Verification

- Schema apply succeeded twice and preserved existing user, lesson, and answer-event row counts.
- Database metadata checks confirmed the expected columns, user foreign key, absence of a lesson foreign key, non-empty identity check, and user/time index.
- A forced invalid mistake insert rolled back the preceding answer-event insert in the same transaction.
- Vitest passed 72 of 72 tests, including the product persistence helper's
  single-transaction and correct-answer branches.
- The production build passed.
- The ticket browser flow created one real durable wrong-answer row, displayed it under the correct UTC date, reopened the exact exercise, accepted a correct retry, preserved the original mistake, and created no second mistake.
- The ticket script passed in headed Chromium at desktop and mobile viewports;
  screenshots were captured and visually reviewed.
- The existing desktop and mobile page-scroll restoration Playwright cases passed.

## Missed User-Review Points

None.

## Residual Issues

- The n-im workflow references an `nf-db` capability that is not installed in this environment. The repository's explicit current database path, Node `postgres` with `LEMMADECK_DATABASE_URL`, was used instead. This is governance/tooling drift, not a product runtime fallback.
- Existing charter/schema prose still contains retired `stemrobin-schema` references while the running product uses `lemmadeck-schema`. This ticket intentionally changed only the fully qualified additive block needed by its scope; the wider documentation reconciliation remains a boundary decision.

## Future Improvements

- Additional notebook views, filters, mastery state, bulk redo, and unavailable-content handling remain outside this ticket.

## Charter Drift

None caused by this ticket. No dependency, stack, build, run, test, or deployment procedure changed.
