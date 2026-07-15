# IntentMill Spec

## Intent

Temporarily make ALL math questions choice-only on both learner surfaces — each card's read-check and the end-of-lesson exercises deck — in a fully reversible way, and re-author every existing fill-in-the-blank (`input`) question in the 16 shared-DB math lessons into a proper diagnostic multiple-choice question that preserves the concept it tested.

## Scope

- `.agents/skills/sr-math-lesson/` generator: enforce choice-only for read-check and exercises through a single reversible policy, keeping the `input` code path intact.
- The 16 math lessons' data in the shared Azure Postgres (`stemrobin-schema`): re-author every existing `input`-mode read-check into a `choice` item, via the generator's deterministic save + translate path, keeping `en` overlay coverage == `zh`.

## Non-Scope

- No `app/` runtime code change (the app already renders and server-judges both `choice` and `input`).
- No schema change; `input` remains a valid `answer_mode`/`mode` value (reversibility).
- No exercise-deck data change: all 331 exercise items across the 16 lessons are already `choice` (verified). Only read-check `input` items are re-authored.
- No change to `sr_users`. `sr_content_answer_events` history for changed read-checks is disposable (charter-authorized) and need not be preserved.
- No removal of the orphaned relational-model scripts (`scripts/choice-deck.mjs`, `scripts/backfill-choice-decks.mjs`) or the legacy `sr_questions` table (pre-0004 dead code; separate cleanup).
- No mechanical "which is X?" conversions.

## Requirements

1. After delivery, generating a new math lesson yields read-checks AND exercises that are `choice`-only: the deterministic validators (`check-content.mjs`, `check-exercises.mjs`) REJECT any `input` (and, for exercises, any `work`) item under the active policy.
2. Choice-only is enforced through ONE reversible policy source in `.agents/skills/sr-math-lesson/scripts/` exposing a boolean `CHOICE_ONLY` (currently `true`) and per-surface allowed-mode helpers. Both validators consume it. Setting `CHOICE_ONLY = false` restores the prior allowed modes (`read-check: choice|input`; `exercises: choice|input|work`) with no other code change.
3. The generator's `input` (and `work`) capability is preserved: `validateItemKey`'s `input`/`work` validation branches, the schema's `input` mode, the renderer's neutral projection, and the app's `input` rendering/judging all remain functionally intact and reachable when `CHOICE_ONLY = false`.
4. Every existing `input`-mode read-check in the 16 lessons (40 items across 15 lessons) becomes a `choice` item: `mode:'choice'`, an `options[]` of exactly 4 node-id refs, and `key.correct_index` in the neutral `content` base. The prompt (and the concept it tests) is preserved. No read-check is dropped; per-lesson read-check counts do not decrease.
5. Each re-authored read-check has exactly 4 options (one correct, three distractors); every distractor is the same kind/surface form as the correct answer and wrong for a nameable, common misconception. No filler options ("无法确定 / 以上都不对") and no meta-sentence 误区标签 options.
6. Answer-key secrecy (charter G5) holds: `key.correct_index` lives ONLY in the neutral `sr_lessons.content` base; it never appears in any `sr_lesson_i18n` overlay (zh or en) nor in the rendered learner-visible HTML nor in the app's initial read-check payload.
7. After the data change, for every affected lesson the `en` overlay node-id set equals the `zh` overlay node-id set exactly (the `check-i18n` coverage gate passes): each new option node has both a zh and an en prose entry `{ t, src_rev }`.
8. Across all 16 lessons after delivery, the count of `input`-mode items in read-check + exercises is 0, and total read-check + exercise question counts do not collapse (coverage preserved).

## Critical Existing Contracts

- **JSONB content SSOT** (`ssot-schemas/db-schemas/stemrobin.sql`): `sr_lessons.content.cards[].read_check[]` items are `{ id, mode, key, rev }` (+ `options[]` for choice); `sr_lessons.exercises.items[]` are `{ id, ord, type, mode, layer, review_of, key, rev }`. KEY is neutral-base-only. The generator/validators are the enforcement point for JSONB internals; Postgres does not constrain them.
- **Answer-key secrecy (G5):** overlays (`sr_lesson_i18n`) are prose-only and never carry `correct_index`/`accept`/`answer`; `check-content.mjs` and `check-i18n.mjs` both fail on any KEY field in an overlay; `render-lesson.mjs` never reads `item.key`; `app/src/lib/reading.ts` projects read-checks KEY-free and judges server-side.
- **Deterministic persistence:** `sr_*` content rows are written ONLY by `save-lesson.mjs` (content/exercises/zh + rendered html/pdf, ledger read from `sr_content_ledger`) and `translate-lesson.mjs` (en overlay, gated by `check-i18n.mjs`). No hand-written rows.
- **i18n translation contract (`check-i18n.mjs`):** en overlay must exactly cover zh; per-node math spans, inline SVG, and HTML markup are byte-identical to zh; en entries are `{ t, src_rev }`; no CJK residue on translated surface.
- **Deck composition (`check-exercises.mjs`):** item count 16–24, layer shares, ≥2 辨错, ≥2 说理, review tail + `review_of` closure — must still pass for exercises after the mode restriction (exercises are already all `choice`, so the restriction is satisfied without touching exercise data).
- **`validateItemKey`** is shared by both validators and must keep validating `choice` (options[]≥2 node ids, `key.correct_index` in range, key is exactly `{correct_index}`) and, for reversibility, the `input`/`work` branches.

## Confirmed Decisions

- Reversibility via a single `CHOICE_ONLY` policy source; input capability retained everywhere (schema/app/generator/renderer).
- Prompts of the 40 read-checks unchanged; only options + `key` added and `mode` flipped; new option prose added to zh and en overlays.
- Persist only through `save-lesson.mjs` + `translate-lesson.mjs`; snapshot before mutation; emit a conversion summary.
- No `app/`, schema, exercise-data, or `sr_users` change; no removal of orphaned relational scripts.

## Compatibility And Regression Constraints

- `check-content.mjs`/`check-exercises.mjs` are shared by the generator save path and any future authoring; the mode restriction must not break the still-valid `choice` items (90 existing choice read-checks + 331 choice exercises must continue to validate) or the exercise composition rules.
- `validateItemKey` is called by both validators; changing only the `allowedModes` argument passed to it (not its body) preserves its other consumers' behavior. No consumer relies on `input`/`work` being accepted for read-check/exercises under the active policy.
- Re-saving a lesson re-renders html/pdf from JSONB; the rendered read-check must show clickable options (existing `.sr-p-opts` markup) and leak no KEY.
- `en` overlay exact-coverage gate must pass for every changed lesson (no missing/extra node).

## Open Questions

None.
