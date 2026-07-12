# IntentMill Plan

## Source Contract

`im-spec.md` is the complete delivery contract. `im-draft.md` and
`im-grill.md` are background evidence only; their material requirements are
promoted here and into the final spec.

## Implementation Approach

1. Update both math exercise skill contracts and authoring guidance to make
   choice the sole math exercise mode, retain existing cognitive
   type/layer/review composition, require lesson-grounded distractors, and
   remove typed-recall/open-response quotas.
2. Update the math deck validator and saver to reject non-choice items, require
   valid options and one correct index, and render option labels for every
   supported option count.
3. Add a migration-only backfill command within `sr-math-lesson`. It will read
   saved math decks, snapshot immutable prompt/order/metadata, build choice
   options for each non-choice item, validate every completed deck, clear the
   approved math attempts/events, and persist complete decks through the math
   saver.
4. Keep normal saver outline/ledger validation for new content. Give only the
   backfill command a constrained existing-deck route that verifies the saved
   lesson and immutable snapshot, allowing the known Stage 2 ledger mismatch
   without authoring or changing curriculum content.
5. Reuse the current choice-only rendering and server-side choice grading in the
   app. Remove only math-specific stale score presentation if the all-choice
   dataset would otherwise expose it; leave shared story work-mode behavior
   intact.

## Implementation Drift Controls

- Do not update `sr_questions` directly from an ad hoc script. The backfill
  must use the project math saver for deck persistence and its practice/PDF
  projection.
- Do not alter a migrated question's prompt, ordinal position, type, layer,
  review target, or hidden explanation.
- Do not add a generic outline-validation bypass. The exception is restricted to
  currently saved decks whose immutable snapshot exactly matches the submitted
  migration deck.
- Do not expose hidden answer data in lesson HTML or initial question fetches.
- Do not change story generation, story saver validation, or story quiz
  branches while removing math-mode assumptions.
- If a non-choice item cannot be converted into one unambiguous correct choice
  and distinct distractors, fail the backfill before data cleanup rather than
  silently storing an invalid question.

## Phases

1. **Contracts and validation**
   - Update `sr-math-lesson` and legacy `sr-lesson` math exercise guidance.
   - Restrict math deck shape validation to choice items, remove input/work
     composition requirements, and retain current item-count/layer/review
     checks.
   - Verify with focused sample decks: valid 3-option and 5-option choice
     decks pass; input/work, duplicate options, and invalid indexes fail.

2. **Persistence and projection**
   - Update the math saver to enforce the choice-only contract and label every
     supported practice option.
   - Implement the narrowly scoped existing-deck backfill route and verify
     normal new-content outline/ledger validation remains unchanged.
   - Verify a 5-option practice projection contains no hidden answer material.

3. **Migration**
   - Implement and run the deterministic migration command for all saved math
     lessons.
   - Capture/validate the immutable question snapshot before writes; clear
     approved math attempts/events only after every conversion validates.
   - Verify all 233 saved math questions are choice items with valid options,
     exactly one key, unchanged prompt/order, and no retained math history.

4. **Runtime and browser verification**
   - Confirm new math attempt scoring has no ungraded-work remainder, while the
     story quiz retains its current work behavior.
   - Run focused Vitest checks, build, content validation, and Playwright
     desktop/mobile checks for embedded practice, PDF availability, card
     selection, answer-key secrecy, and an option count above four.

## Unit Test Plan

- Add ticket-scoped Node checks for math deck validation and migration conversion:
  choice-only acceptance, rejection of input/work, option uniqueness, one valid
  key, and prompt/order preservation.
- Extend or add an app-level contract test proving lesson-question payloads omit
  hidden keys and that score summaries classify every migrated math question as
  gradable.
- Extend Playwright coverage for a five-or-more-option practice item on desktop
  and mobile and for a choice-answer flow; retain a story work-mode regression
  check.
- Run existing `app` unit tests and production build. Run the relevant
  Playwright suite against the migrated local database.

## Handoff Expectations

Cap6 must record the converted lesson count, mode counts, history cleanup
result, prompt/order snapshot result, commands and browser evidence, and any
deviation from this plan in `im-handoff.md`. It must record residual issues only
when they do not weaken the spec.
