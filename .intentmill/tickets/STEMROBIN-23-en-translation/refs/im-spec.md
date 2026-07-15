# IntentMill Spec

## Intent

Deliver an English (`en`) translation overlay for the 16 migrated math lessons and the repeatable translation flow that produces it. Math content is authored in Chinese (`zh`) as the source language; `en` is the product's first real second locale. Only learner-facing prose is translated; math formulas, SVG, numeric literals, and answer keys are language-neutral and inherited from the neutral base. This ticket delivers the data (16 `en` overlays) and the tooling (`.agents/skills/` translation flow), not any app rendering.

## Scope

- A translation flow under `.agents/skills/sr-math-lesson/scripts/`:
  - a deterministic gate that validates a candidate `en` overlay against its `zh` source before persistence;
  - a saver that emits a per-lesson translation worksheet, runs the gate, and idempotently persists an `en` overlay to `sr_lesson_i18n(locale='en')`;
  - a thin driver to gate-and-save all 16 lessons.
- `en` locale overlays for all 16 migrated lessons (`math-s2-01..08`, `math-s3-01..08`) in `sr_lesson_i18n`, covering card prose, SVG captions, read-check prompts + options, and exercise prompts + options.
- Empirical verification (psql + gate output) captured in `im-handoff.md`.

## Non-Scope

- No `app/` code, `app/src/routes`, `app/src/lib`, or Dockerfile changes. The locale switch and English reader are STEMROBIN-22 / STEMROBIN-24.
- No third-party translation API, no new npm dependency, no new recurring cost (redline #3; binding decision — translation is authored by the agent / subagents).
- No modification of the `zh` overlays, the neutral base (`sr_lessons.content` / `exercises`), `sr_questions`, `sr_content_ledger`, or `sr_users`. Additive `en` rows only.
- No staleness re-translation workflow, no additional locales beyond `en` (both future work — the flow supports them without schema change).
- No schema (`ssot-schemas/db-schemas/stemrobin.sql`) change — `sr_lesson_i18n` already exists.

## Requirements

- R1. After delivery each of the 16 migrated lessons has exactly one `sr_lesson_i18n` row with `locale='en'`, queryable via the runbook psql path.
- R2. Each `en` overlay's node_id set equals its `zh` overlay's node_id set exactly — no missing and no extra node — covering card prose (`-b*`), SVG captions (`-cap*`), read-check prompts + options (`-rc*`, `-rc*-o*`), and exercise prompts + options (`-ex*`, `-ex*-o*`). (Grill D-COVERAGE-SET.)
- R3. Each `en` overlay entry has the prose-only shape `{ "t": "<english string>", "src_rev": <int> }`, where `src_rev` equals the corresponding `zh` entry's `src_rev` (the neutral-base revision translated from). (Grill D-EN-SRC-REV.)
- R4. No `en` overlay entry contains an answer KEY field (`correct_index`, `accept`, or `answer`). KEY lives only in the neutral base; it is never copied into any overlay.
- R5. Within each node, the ordered list of `$...$` KaTeX spans and the multiset of HTML tags in the `en` string are byte-identical to the `zh` string — formulas, markup, SVG, and numeric literals are inherited unaltered. (Grill D-FORMULA-FIDELITY.)
- R6. A translated `en` string contains no residual CJK (Han) characters outside `$...$` spans — every Chinese prose fragment is actually rendered into English.
- R7. The gate is a hard precondition of persistence: any candidate `en` overlay failing R2–R6 must be refused (no partial or bypassed write).
- R8. The saver writes only `sr_lesson_i18n(locale='en')` rows, via the server-only `db.mjs` path, using an idempotent `insert ... on conflict (lesson_id, 'en') do update` so re-runs overwrite rather than duplicate.
- R9. The flow introduces no new dependency and calls no third-party translation service.

## Critical Existing Contracts

- **Overlay prose-only + KEY-secrecy** (`ssot-schemas/db-schemas/stemrobin.sql` lines 259-272; `check-content.mjs` `KEY_FIELDS`): `sr_lesson_i18n.overlay` maps `node_id -> { t, src_rev }` and must never contain `correct_index`/`accept`/`answer`. The `en` overlay reuses this exact shape. Answer-key secrecy (charter engineering-rules) is preserved because KEY stays in `sr_lessons.content`/`exercises`.
- **Neutral-base vs overlay split** (`migrate-lib.mjs htmlToCards`/`deckToExercises`): structure/order/编号/anchors/formulas/SVG/KEY are neutral; only prose text is in the overlay. SVG markup lives in `sr_lessons.content` as a `{kind:'svg', svg}` node; only its `<figcaption>` is overlay prose via `caption_id`. This is the witness that a graphic lives in the neutral base and not the overlay.
- **Inline formula reality**: there are no `formula`-kind nodes; all math is inline `$...$` inside prose HTML strings (verified live on `math-s2-01`). Fidelity is therefore per-node `$...$`-span + tag byte-equality, not formula absence.
- **`src_rev` staleness contract** (schema lines 259-272): staleness ⇔ overlay `src_rev` < base node `rev`, or node absent. All migrated base nodes are `rev=1`; every `zh` entry is `src_rev=1`; `en` entries mirror the `zh` `src_rev`.
- **Server-only DB access** (charter engineering-rules; `db.mjs`): all writes go through the skill's server-only `postgres` client bound to `search_path="stemrobin-schema"`, reading root `.env`. Never a second client, never hand-written `sr_*` rows, `.env` never staged.
- **Idempotent gated save discipline** (`migrate-lesson.mjs`, evodocs `mod--content-generation--math-courseware`): produce → independent review → deterministic saver; the saver validates before mutating and upserts idempotently.

## Confirmed Decisions

- D-FORMULA-FIDELITY: formula fidelity = per-node `$...$`-span + HTML-tag byte-equality zh↔en, enforced by the gate; SVG is the demonstrated neutral-base-only artifact (present in `sr_lessons.content`, absent from every overlay).
- D-EN-SRC-REV: each `en` entry `src_rev` = the corresponding `zh` entry's `src_rev` (= 1 today).
- D-COVERAGE-SET: `en` node_id set must equal the `zh` node_id set exactly.
- Recommended defaults adopted: saver mirrors `migrate-lesson.mjs` (two modes, idempotent upsert, server-only `db.mjs`); gate reuses `check-content.mjs` `KEY_FIELDS`; residual-CJK check; parallel per-lesson authoring + independent fidelity review before gated save; a `translate-all.mjs` driver.
- Future/conditional (not built now): app locale switch/reader (STEMROBIN-22/24); staleness re-translation; locales beyond `en`.

## Compatibility And Regression Constraints

- The 16 existing `zh` `sr_lesson_i18n` rows, `sr_lessons.content`/`exercises`, `sr_questions`, `sr_content_ledger`, and `sr_users` must be byte-for-byte unchanged after the flow runs — verified by comparing `zh` overlay and neutral-base state before/after (only `en` rows added).
- No consumer currently reads `locale='en'` (the reader is a later ticket), so adding `en` rows cannot regress runtime behavior; this must be confirmed (grep `app/` for `'en'` locale reads → none) rather than assumed.
- The gate and saver are new scripts; they must not modify or import-mutate existing `check-content.mjs` / `migrate-*.mjs` behavior (reuse by import only).

## Open Questions

None.
