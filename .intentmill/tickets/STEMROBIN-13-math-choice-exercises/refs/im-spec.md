# IntentMill Spec

## Intent

Make all math-lesson exercises selectable multiple-choice questions while
preserving the existing question wording and order. The same change must govern
future math exercise generation and the 11 saved math lessons.

## Scope

- Convert every current `sr_questions` item for the 11 saved math lessons to a
  choice question.
- Require every future math lesson deck produced by either supported math
  exercise skill to use choice questions only.
- Keep lesson practice HTML, printable PDFs, and card-quiz option presentation
  derived from the same saved deck.
- Permit a valid question to contain more than four options.
- Clear all current math answer events and quiz attempts before migration, with
  no history migration.

## Non-Scope

- Biography chapter questions and story quiz behavior.
- New lesson content, lesson prompts, lesson order, curriculum outline, ledger
  content, authentication, or database schema changes.
- Reintroducing typed or open-response math exercise paths.

## Requirements

- Every saved and newly generated math exercise has
  `answer_mode: "choice"`, at least three non-empty options, and exactly one
  valid `correct_index`.
- Existing math questions retain their original `lesson_id`, ordinal position,
  prompt text, type, layer, review target, and hidden answer explanation. The
  migration may add or replace only answer-mode-specific choice data.
- At least one migrated or newly generated math question has five or more
  options; all of its options render in the embedded practice section, PDF, and
  card drawer.
- Existing and future math exercise authoring instructions require plausible,
  lesson-grounded distractors and no longer prescribe `input` or `work`.
- Before replacing any current math deck, remove all rows in the math answer
  events and math quiz attempts. Do not preserve, translate, or display a prior
  score after the migration.
- A new math attempt after migration scores every question as a choice question
  and records selected option indexes normally.

## Critical Existing Contracts

- The saved deck is the sole source of the embedded lesson practice section and
  printable PDF. The lesson HTML must never carry answer explanations, accepted
  typed forms, or correct option indexes.
- Initial lesson-question reads must continue to omit `correct_index`, `answer`,
  and `accept`. The server must obtain the hidden key only when an authenticated
  learner submits an answer.
- The card drawer may shuffle visible option order but must submit original
  stored indexes for server-side grading.
- Existing normal lesson generation continues to validate the human outline and
  concept ledger before persistence. The migration-only persistence route may
  operate on an existing saved lesson whose prompt/order snapshot matches the
  stored deck; it must not become a route for new or changed lesson content.
- Stage 2's known outline/ledger mismatch must not be “fixed” in this ticket or
  used to bypass validation for new generation.

## Confirmed Decisions

- Scope is math lessons only; biography chapter questions are unchanged.
- The original prompt text and question order are immutable in the backfill.
- The user explicitly approved deletion of all math answer records and attempts
  without migration.
- Reuse the established compact choice-button interaction and existing
  deck-to-practice/PDF projection.

## Compatibility And Regression Constraints

- `sr_story_questions`, story card quizzes, and their `choice|work` behavior
  remain unchanged.
- Math course metadata, lesson reader content outside the generated practice
  section, navigation, and catalog availability remain unchanged.
- No dependency, secret, cloud configuration, or schema migration is added.
- Existing correct-choice feedback, option-order shuffling, and answer-key
  secrecy remain intact.

## Open Questions

None.
