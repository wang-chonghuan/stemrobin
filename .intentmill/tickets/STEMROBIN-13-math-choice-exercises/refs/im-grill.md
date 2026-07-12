# IntentMill Grill

## Blocking Decisions

None.

## Recommended Defaults

- Reuse the existing full-width choice-button interaction in the card drawer and
  the existing deck-derived practice/PDF projection; do not introduce a new UI
  control or visual treatment.
- Treat every math choice item as scoreable after the migration, while retaining
  the separate story-question behavior.
- Clear math answer events and attempts before deck replacement, as explicitly
  approved in the released story.

## Future Or Conditional Decisions

- Reconsider typed-recall or open-response practice only through a future
  user-approved story; this ticket must not add a second answer path.

## Out-of-Scope Guardrails

- Do not change biography chapter questions, story quiz behavior, login inputs,
  authentication, or the shared database schema's supported story modes.
