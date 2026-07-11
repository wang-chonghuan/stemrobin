# Gate 3 — Exercise deck (fast)

Run after cap3, before cap4 persists. This is a deterministic write-safety gate, not an independent pedagogical review.

## Purpose

The deck must be structurally valid enough for the saver and quiz to represent it faithfully. The lesson text is the deep-reviewed teaching artifact; do not add a second expensive semantic review here by default.

## Pass Conditions

- `check-exercises.mjs` passes for this lesson id and ledger.
- The author reports the item count, layer/mode split, boundary-case coverage, review targets, and that every input/choice key was self-checked.
- The JSON has no parse error and the saver accepts its required item shape.

## Escalation

Run the former full semantic deck audit only when the user explicitly asks for it, a previous deck produced an answer-key incident, or the generation contains an unusual answer format that the deterministic contract cannot validate. Otherwise proceed directly to cap4.
