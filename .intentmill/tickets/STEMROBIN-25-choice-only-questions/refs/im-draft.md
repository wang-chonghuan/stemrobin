# IntentMill Draft

## Source

- `.intentmill/tickets/STEMROBIN-25-choice-only-questions/intent.md` (read — ticket full text + live charter + evodocs injected by prodfarm cap9).
- `.intentmill/tickets/STEMROBIN-25-choice-only-questions/meta.json` (read — ticket-key `STEMROBIN-25-choice-only-questions`, branch, worktree path confirmed).
- `AGENTS.md` router + `.prodfarm/charter/` (goal, redlines, engineering-rules, architecture, runbook — read via injected intent). Obeyed: SSOT/one-way (rule 5), surgical changes (rule 3), simplicity (rule 2), content is DB-driven skill-generated (never hand-write `sr_*` rows), answer-key secrecy, never touch `sr_users`.
- evodocs (substantive, used to guide code reading): `mod--content-generation--math-courseware`, `mod--database-schema`, `mod--app--domain-services`. Recorded disagreement below (evodocs describe the pre-0004 relational `sr_questions` deck; code is now JSONB-first — code is authoritative).
- No external library/API/SDK/cloud usage is introduced by this ticket, so no `find-docs`/Context7 evidence is required.
- `nf-db` usage: direct `psql` read-only inspection of the shared Azure Postgres (`stemrobin-schema`) was performed to ground the ticket premise (see Findings). All writes go through the generator's deterministic savers, not hand SQL.

## Draft Spec

(draft material — the settled contract lives in im-spec.md)

Make ALL math questions **choice-only** for both surfaces — per-card **read-check** and end-of-lesson **exercises** — reversibly, in the generator, and zero out existing `input` items in the 16 lessons' data.

1. Generator produces only `choice` for read-check and exercises going forward.
2. The 16 lessons' existing `input` items become proper diagnostic multiple-choice, same concept preserved, plausible named distractors, no dropped questions, no lost coverage.
3. "Temporary" ⇒ reversible: the schema's `input` mode, the app's `input` rendering/judging, and the generator's `input` code path stay intact. Choice-only is a minimal generation **policy switch** plus zeroing the current data — not removal of the capability.
4. Answer-key secrecy preserved (KEY only in neutral base `content`/`exercises` JSONB, never in a locale overlay or the browser payload).
5. `en` overlay coverage stays == `zh` after the data change (re-translate changed/new nodes).

## Draft Plan

(rough — the constrained route lives in im-plan.md)

- Add a single reversible policy source (`scripts/question-policy.mjs`) exporting a `CHOICE_ONLY` flag + `readCheckModes()`/`exerciseModes()` helpers. `check-content.mjs` and `check-exercises.mjs` consume the helpers instead of hard-coded mode arrays; the `validateItemKey` input/work code path stays intact.
- Update authoring references (`references/capability-2-lesson-html/lesson.md` read-check section, `references/capability-3-exercises/exercises.md` mode note) and `SKILL.md` design commitment #4 to state read-check + exercises are choice-only under the current policy, capability preserved.
- Data: snapshot the 16 lessons' `content`/`exercises`/overlays; re-author each of the 40 `input` read-checks into a 4-option diagnostic choice (prompt unchanged, add option nodes + `key.correct_index` + `mode:'choice'`, zh + en overlay prose for new options); re-save each affected lesson through `save-lesson.mjs` (content SSOT + zh + rendered html/pdf) and `translate-lesson.mjs` (en overlay, check-i18n gate).
- Verify empirically with psql (input count == 0, coverage preserved, en==zh), a rendered lesson (choice rendering, no KEY leak), and a freshly generated sample lesson (choice-only).

## Code And Evodocs Findings

- **Empirical DB ground truth (psql, `stemrobin-schema`)** — refines the ticket premise:
  - 16 math lessons, all with `content` + `exercises` JSONB.
  - **exercises: 331 items, ALL `choice` already** (0 `input`, 0 `work`). STEMROBIN-13 + the 0004 JSONB migration already made exercises choice-only. So the exercises surface already satisfies the acceptance; no exercise data change is required.
  - **read-check: 90 `choice` + 40 `input`.** The 40 `input` read-checks (across 15 lessons; `math-s2-08` 练习课 has none) are the ONLY data to re-author.
- **Schema (`ssot-schemas/db-schemas/stemrobin.sql`, JSONB CONTENT SSOT block):** `sr_lessons.content = { cards:[ { read_check:[ { id, mode:'choice'|'input', key:{correct_index}|{accept}, rev } ] } ] }`; `sr_lessons.exercises = { items:[ { id, ord, type, mode:'choice'|'input'|'work', layer, review_of, key, rev } ] }`. KEY (`correct_index`/`accept`/`answer`) is neutral-base-only. Prose lives in `sr_lesson_i18n(locale)` overlay `{ node_id → { t, src_rev } }`, prose-only, never a KEY. `input` mode stays a valid schema value — keeping it is what makes the change reversible.
- **Validators (enforcement point; Postgres does not constrain JSONB internals):**
  - `scripts/check-content.mjs` → `validateContent` calls `validateItemKey(..., ['choice','input'])` for read-check (line ~96). `validateItemKey` (shared, exported) fully handles `choice`/`input`/`work` shapes.
  - `scripts/check-exercises.mjs` → `validateExercises` calls `validateItemKey(..., ['choice','input','work'])` (line ~48) + composition rules (counts, layer shares, review tail).
  - Restricting allowed modes to `['choice']` via a policy flag is the minimal reversible enforcement; `validateItemKey`'s input/work branches remain, so flipping the flag re-enables them.
- **Renderer (`scripts/render-lesson.mjs`):** `renderChoiceOptions` renders A/B/C/D options for read-check and practice; `renderReadCheck` calls it. It NEVER reads `item.key` (answer-key secrecy is structural). Flipping a read-check to `choice` with `options` makes the rendered HTML show clickable options with no app change.
- **App runtime (`app/src/lib/reading.ts`):** already projects read-check KEY-free (`projectReadCheck` resolves choice options to text, omits `key`), and server-judges (`choice`: `chosen === key.correct_index`; `input`: normalized text match) in `recordReadCheckAnswer`, writing `sr_content_answer_events`. It handles both modes today — confirms NO `app/` change is needed; flipping data to `choice` yields server-judged clickable questions.
- **Translation path (`scripts/translate-lesson.mjs` + `scripts/check-i18n.mjs`):** `--emit` writes a zh worksheet; author writes en to `refs/translation/en/<id>.json`; save mode runs the `check-i18n` gate (coverage en==zh exact, `{t,src_rev}` shape, math/SVG/markup byte-identical, KEY-free, no CJK residue) and upserts `sr_lesson_i18n(en)`. This is the deterministic en-save path to reuse for new option nodes.
- **Save path (`scripts/save-lesson.mjs`):** reads ledger from `sr_content_ledger` (DB), validates content+exercises+overlay, runs human-outline fidelity check for non-sample ids, renders html/pdf from JSONB, upserts `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`. Canonical deterministic save — reuse it; do not hand-write rows.
- **Stale artifacts (evodocs/code disagreement):** `scripts/choice-deck.mjs` + `scripts/backfill-choice-decks.mjs` are STEMROBIN-13 relational-model (`sr_questions`, `answer_mode`, `--questions`/`--existing-deck`) scripts, orphaned by the 0004 JSONB migration, and their mechanical "which is X" distractors are exactly the forbidden mechanical conversion. They are not on the JSONB path and are not reused. Pre-existing dead code — left in place per engineering-rule #3 (do not delete unasked; mentioned here and in handoff).
- **DESIGN.md:** this ticket changes no app UI surface or styling (data + generator only); the rendered options reuse existing `.sr-p-opts` classes. No new DESIGN decision.

## Assumptions

- The 40 `input` read-checks' prompts remain valid as-is; re-authoring adds options + a KEY and flips mode without rewriting the prompt (the concept tested is preserved by construction). Prompt prose is unchanged, so its overlay `rev`/`src_rev` are untouched and only new option nodes are added.
- Re-saving affected lessons via `save-lesson.mjs` passes the human-outline fidelity check (these 16 lessons are already persisted, i.e. previously passed it). Verified during cap6.
- Answer-event data in `sr_content_answer_events` for the changed read-checks is disposable (charter-authorized); re-saving content does not need to preserve it.

## Risks

- **Distractor quality:** mechanical distractors would violate the ticket. Mitigation: each of the 40 items gets same-surface-form options wrong for a nameable misconception, self-reviewed against SKILL.md commitment #4's bar.
- **en coverage drift:** adding zh option nodes without matching en nodes breaks the exact-coverage `check-i18n` gate. Mitigation: author en for every new option node; gate blocks any mismatch.
- **KEY leak:** placing `correct_index` in an overlay would break G5. Mitigation: KEY stays in `content` JSONB only; `check-content` + `check-i18n` both fail on any KEY field in an overlay.
- **Outline-fidelity check failure on re-save (known-limit for stage 2 in evodocs).** Mitigation: verify a dry re-save of one lesson early in cap6; if it fails, that is a blocked premise → im-handoff `## Blocker`.

## Grill Required

no
