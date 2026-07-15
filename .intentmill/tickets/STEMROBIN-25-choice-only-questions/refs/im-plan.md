# IntentMill Plan

## Source Contract

Implements `im-spec.md` in this ticket worktree. All requirement numbers (R1–R8) refer to `im-spec.md ## Requirements`.

## Implementation Approach

Two coordinated changes, both confined to `.agents/skills/sr-math-lesson/` + the 16 lessons' DB data:

1. **Reversible choice-only policy (generator).** Add `scripts/question-policy.mjs` exporting `CHOICE_ONLY = true`, `readCheckModes()` → `['choice']` (else `['choice','input']`), `exerciseModes()` → `['choice']` (else `['choice','input','work']`). Replace the hard-coded `allowedModes` arrays passed to `validateItemKey` in `check-content.mjs` (read-check) and `check-exercises.mjs` (exercises) with these helpers. Leave `validateItemKey`'s body (all three mode branches) untouched. Update `references/capability-2-lesson-html/lesson.md` (read-check authoring), `references/capability-3-exercises/exercises.md` (mode note), and `SKILL.md` design commitment #4 to state read-check + exercises are choice-only under the active policy and that `input`/`work` remain re-enablable via the flag.

2. **Data re-authoring (40 read-check `input` → `choice`).** For each of the 15 affected lessons: pull current `content` + zh + en overlays; for each `input` read-check, add 4 option node-ids `<rc.id>-o0..o3`, set `mode:'choice'` + `key:{correct_index}` (KEY in `content` only), keep `rev` and the prompt node; add zh + en overlay prose `{ t, src_rev }` for each option. Persist content/exercises/zh + rendered html/pdf with `save-lesson.mjs`, then the en overlay with `translate-lesson.mjs` (its `check-i18n` gate enforces exact coverage + KEY-free + fidelity).

The distractors are authored per item (not generated) from each prompt's tested concept, same surface form as the answer, each tied to a nameable misconception (R5). The orphaned relational scripts `choice-deck.mjs`/`backfill-choice-decks.mjs` are NOT used (mechanical distractors, wrong data model).

## Implementation Drift Controls

- Choice-only MUST be a policy the validators consume, not a deletion: `validateItemKey`'s `input`/`work` branches, the schema `input` value, and the app path stay intact (R2, R3). Verify `CHOICE_ONLY=false` restores prior modes.
- KEY (`correct_index`) goes ONLY into `content` JSONB, never an overlay (R6). `check-content.mjs` + `check-i18n.mjs` fail on any overlay KEY field — run both.
- Every new zh option node gets a matching en node (R7); the `check-i18n` gate blocks any coverage mismatch — do not bypass `translate-lesson.mjs`.
- No prompt rewrite, no dropped read-check, no exercise-data edit, no `app/`/schema/`sr_users` edit (Non-Scope). Snapshot before mutating (reversibility).
- Persist only via `save-lesson.mjs` + `translate-lesson.mjs`; no hand-written SQL rows (deterministic-persistence contract).

## Phases

1. **Policy + validators.** Add `scripts/question-policy.mjs`; wire `check-content.mjs` + `check-exercises.mjs` to the helpers. Verify: run each validator's unit tests (below) — existing `choice` fixtures pass, `input`/`work` fixtures now rejected under `CHOICE_ONLY=true` and accepted under `false`.
2. **Reference/SKILL text.** Update `lesson.md`, `exercises.md`, `SKILL.md` #4. Verify: read-back consistency (no residual "input for read-check" instruction; reversibility noted).
3. **Snapshot.** Export all 16 lessons' `content` + `exercises` + zh/en overlays to the ticket scratch snapshot; record per-lesson `input` read-check inventory (conversion summary source).
4. **Author + apply conversions.** Author the 40 items' options (zh+en, correct_index) and transform the JSONB + overlays deterministically. Verify per lesson: `check-content.mjs` (choice-only, KEY-free overlay), then `save-lesson.mjs`; build the full en map (existing en + new option en) and `translate-lesson.mjs` (check-i18n gate) to upsert en.
5. **Empirical DB verification (gate6 evidence).** psql across all 16 lessons: `input` count in read-check + exercises == 0; read-check + exercise totals preserved vs snapshot; en node-id set == zh node-id set per lesson; no KEY field in any overlay. Render/inspect one converted lesson (choice options shown, no `correct_index` in html). Generate one `--sample` lesson and show its read-checks + exercises are choice-only and that an `input` read-check fixture is rejected by `check-content.mjs`.

## Unit Test Plan

Ticket-scoped tests under `im tests path` (`.mjs`, run with `node`):

- **policy-modes.test.mjs** (R1, R2, R3): with `CHOICE_ONLY=true`, `validateContent` on a read-check `input` fixture returns a mode problem, and a `choice` fixture passes; `validateExercises` on an `input`/`work` item returns a mode problem, and an all-`choice` deck passes composition. Assert `readCheckModes()`/`exerciseModes()` return `['choice']` when true and the full arrays when false (exercise the reversible branch directly). This is the high-risk assertion (enforcement + reversibility), not happy-path only.
- **key-secrecy.test.mjs** (R6): a converted read-check item carries `key.correct_index` in `content`; the built zh/en overlay entries for its option + prompt nodes contain no `correct_index`/`accept`/`answer` (assert against `KEY_FIELDS`); `validateContent` rejects an overlay that leaks a KEY field.
- **conversion-shape.test.mjs** (R4, R5, R7): the transform applied to an `input` read-check yields `mode:'choice'`, exactly 4 distinct option node-ids, an in-range `correct_index`, an unchanged prompt id, and matching zh+en overlay entries for every new node (coverage parity via `validateI18n` on a mini overlay pair).

Reused existing checks as guardrails (record in test-results): `check-content.mjs`, `check-exercises.mjs`, `check-i18n.mjs` run against real exported lesson data during Phase 4/5 are contract-level coverage for R1/R6/R7/R8.

Not unit-testable in-repo (documented, verified empirically in Phase 5 instead): the DB-wide `input==0` + coverage-preserved + en==zh assertions (require the shared DB) and the rendered-HTML no-KEY-leak check (requires render). These are covered by the psql + render evidence captured in `im-handoff.md`.

## Handoff Expectations

`im refs path/im-handoff.md` records: files changed (policy module, two validators, three reference/SKILL docs) and how choice-only is enforced reversibly with input capability preserved; the data conversion (count per lesson, read-check vs exercises, authoring approach, snapshot + conversion-summary location); psql proof (input==0, coverage preserved, en==zh, no KEY leak); sample-lesson choice-only evidence; confirmation the schema/app/generator `input` capability and `sr_users` are untouched; `## Spec And Plan Alignment`; missed user-review points (or `None.`); residual issues (orphaned relational scripts, legacy `sr_questions`).
