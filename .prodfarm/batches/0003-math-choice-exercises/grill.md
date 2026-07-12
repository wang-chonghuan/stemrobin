# Batch 0003-math-choice-exercises — seed grill and release record

## Seed

- Parent seed: STEMROBIN-12 — 评估数学课选择题改造
- Source: human intent
- Release: explicitly approved by the human on 2026-07-12

## Investigation and self-grill

- Feasibility: the current math question contract already supports choice options and
  server-side correctness checking. There are 11 math lessons and 233 questions:
  59 choice, 143 input, and 31 work. The same saved deck drives the lesson
  practice section, printable PDF, and card quiz. No dependency or external service
  is required.
- Consistency: this is a new learner-visible behavior and is not a duplicate of
  STEMROBIN-5, which only standardized existing practice styling and catalog
  activation. The scope is restricted to math lessons; story chapter questions remain
  unchanged.
- Completeness: one story covers future math exercise generation, all current math
  lesson decks, the lesson/PDF/card-quiz projections, prompts and ordering, and
  pre-answer secrecy. A five-or-more-option item is included as empirical evidence
  that the former four-option convention is not a cap.
- Constraint challenge: retaining historic attempt data would make the replacement
  unsafe because deck replacement removes the old question identities and cascades
  their answer events. The human explicitly ruled that all prior math answer records
  and attempts may be removed without migration.
- Batch risk: one vertical story, no dependencies, no split required.

## Release ruling

The human approved the complete delivery set:

1. Convert every existing and future math-lesson exercise to a choice question,
   preserving existing prompt text and order, allowing more than four options, and
   keeping the lesson, print, and card-quiz views aligned.
2. Limit the change to math lessons; do not modify biography chapter questions.
3. Clear prior math answer records and attempts without data migration.

## Settlement

Nothing to settle. No vetoes, deferred items, or charter changes.
