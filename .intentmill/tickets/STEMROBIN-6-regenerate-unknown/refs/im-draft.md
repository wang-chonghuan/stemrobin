# IntentMill Draft

## Source

- Ticket key: STEMROBIN-6-regenerate-unknown
- Ticket id: STEMROBIN-6
- Raw intent read from `.intentmill/tickets/STEMROBIN-6-regenerate-unknown/intent.md`.
- Project router and charter read through `AGENTS.md`.
- Human math outline evidence: `resources/content/course-gen-guide-math.md` says stage 3 lesson 1 is `未知数是什么`.
- Current drift evidence: `resources/content/math-ledger/stage-3.json` and `app/src/lib/curriculum.ts` currently say `未知数与方程的解`.
- Affected code: `.agents/skills/sr-math-lesson/scripts/save-lesson.mjs`, `check-exercises.mjs`, skill references, `resources/content/math-ledger/stage-3.json`, `app/src/lib/curriculum.ts`, `app/src/lib/lessons.ts`, catalog/overview/lesson routes.
- UI system read: `resources/reference/DESIGN.guide.md` and `resources/reference/DESIGN.md`.
- Current TanStack Start docs were checked with Context7 earlier in this ticket stream: route loaders can call `createServerFn`; server-only database access must remain behind server functions.

## Draft Spec

- Replace the current math 3.1 lesson with a fully new `3.1 未知数是什么` lesson generated from the human outline and revised ledger, without reusing the current 3.1 lesson content or exercises.
- Bring stage-3 ledger and app curriculum back into alignment with the human outline for lesson 3.1.
- Repair the embedded practice rendering so 3.1 and future lessons carry the same exercise formatting as 2.7.
- Strengthen `sr-math-lesson` so lesson/deck persistence checks ledger metadata and deck composition before database mutation.
- Make valid persisted lessons automatically activate their corresponding outline item in the catalog and navigation.

## Draft Plan

- Update stage-3 ledger entry `math-s3-01` to `未知数是什么`, with concepts centered on unknown quantities rather than making `方程的解` the lesson title.
- Generate new HTML and deck under `refs/generated/`, then persist with the repaired saver.
- Make generated practice CSS self-contained and require `--ledger` in saver commands.
- Add dynamic outline availability helpers in app curriculum and load database lesson ids in app route loaders.
- Add focused tests for curriculum filtering/navigation and saver validation/style contracts.

## Code And Evodocs Findings

- Current 3.1 drift came from generated ledger/curriculum content, not the human outline. The human outline is the source for this repair.
- Current `save-lesson.mjs` injects only partial practice CSS and assumes authored HTML has base `ol.sr-practice` styles.
- Current `save-lesson.mjs` accepts metadata from command-line args without verifying it against the ledger.
- Current catalog availability is represented by manually adding `id` fields in `CURRICULUM`, so successful persistence does not automatically activate the outline item.
- Current app has `listLessonIds` as a server function, which is the natural database availability source.

## Assumptions

- For first lesson of a stage, no `复习` items are required by the existing `check-exercises.mjs` composition rule.
- Existing draft lessons should remain visible when present in the database, matching current behavior.
- `方程` may appear as a limited support context in 3.1, but the main teaching target is the unknown quantity and its symbol/value distinction.

## Risks

- Regenerating content writes production/shared DB rows. Mitigation: gate static files first, then persist only through `save-lesson.mjs`.
- Route loader data shape changes can affect overview/catalog/lesson navigation together. Mitigation: centralize helper functions and test sparse availability.
- PDF rendering may depend on local browser availability. HTML/question persistence is still required; PDF limitation should be recorded if rendering fails.

## Grill Required

no
