// sr-math-lesson — question-mode POLICY (STEMROBIN-25).
//
// Temporary, REVERSIBLE choice-only policy. Both learner surfaces — each card's
// read-check and the end-of-lesson exercises deck — are restricted to `choice`
// questions. This is a generation/validation POLICY, not a capability removal:
//   - the schema keeps `input` as a valid answer_mode (ssot-schemas/db-schemas/stemrobin.sql),
//   - the app keeps rendering + server-judging `input` (app/src/lib/reading.ts),
//   - the renderer keeps its neutral projection (scripts/render-lesson.mjs),
//   - validateItemKey (scripts/check-content.mjs) keeps its `input`/`work` branches.
// To re-enable fill-in-the-blank (and open `work`) later, flip CHOICE_ONLY to
// false — no other code change. The validators call the helpers below, so the
// single source of truth for the allowed modes lives here.
export const CHOICE_ONLY = true

// Allowed modes for a card read-check item.
export function readCheckModes() {
  return CHOICE_ONLY ? ['choice'] : ['choice', 'input']
}

// Allowed modes for an exercise-deck item.
export function exerciseModes() {
  return CHOICE_ONLY ? ['choice'] : ['choice', 'input', 'work']
}
