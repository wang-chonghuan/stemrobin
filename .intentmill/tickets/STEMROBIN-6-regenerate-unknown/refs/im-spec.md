# IntentMill Spec

## Intent

Replace the poor, drifted math 3.1 lesson with a fresh `未知数是什么` lesson and repair the generation/persistence/navigation path that allowed the drift and formatting defect.

## Scope

- Stage-3 lesson 1 ledger and app outline title alignment.
- New `math-s3-01` HTML lesson and exercise deck.
- `sr-math-lesson` validation and generated practice formatting.
- App catalog/overview/lesson navigation automatic availability.
- Persistence of the regenerated lesson/deck to the database.

## Non-Scope

- Regenerating any lesson other than `math-s3-01`.
- Changing the quiz drawer, grading semantics, DB schema, or deployment.
- Publishing status changes unrelated to the existing draft workflow.

## Requirements

1. `math-s3-01` is titled `未知数是什么` in the human-facing catalog, lesson heading, label, and PDF download name.
2. The new lesson is authored from scratch and does not reuse text, examples, prompts, answers, or structure from the current stored 3.1 lesson.
3. The lesson teaches the distinction between a still-unknown quantity, the symbol used to stand for it, and a possible value of that quantity.
4. The lesson includes concrete motivation, positive/non-positive examples, boundary cases, worked parsing examples, connections, and oral questions matching the concept-lesson contract.
5. The deck contains 16-24 items, passes `check-exercises.mjs`, covers 指认/操作/辨错/说理, and uses the repaired practice section style on screen and print.
6. `save-lesson.mjs` rejects saves that do not provide a ledger, do not match the ledger entry, or do not pass deck validation before database mutation.
7. After a valid lesson exists in the database, the corresponding outline item becomes clickable automatically and participates in previous/next navigation in curriculum order.
8. Existing answer-key secrecy remains intact: `answer`, `correct_index`, and `accept` are not embedded into lesson HTML or sent before answering.

## Critical Existing Contracts

- The human course guide owns high-level lesson titles; `resources/content/math-ledger/stage-*.json` is the machine-expanded lesson SSOT after alignment.
- Content persists only through `.agents/skills/sr-math-lesson/scripts/save-lesson.mjs`.
- Server database access stays behind existing `createServerFn` functions and `app/src/lib/db.ts`.
- `CURRICULUM` remains the ordered outline; database ids determine availability.
- Lesson HTML follows `assets/lesson-template.html` and `resources/reference/DESIGN.md` tokens.

## Confirmed Decisions

- The old 3.1 content is discarded as a source.
- 3.1 title is `未知数是什么`.
- 2.7's exercise presentation is the visual baseline.

## Compatibility And Regression Constraints

- Existing available lessons stay reachable.
- Unknown unavailable lesson ids still do not receive prev/next links.
- No new colors, UI system, dependencies, schema, or runtime service.

## Open Questions

None.
