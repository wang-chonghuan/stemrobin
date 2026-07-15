# IntentMill Grill

> Adjudication authority: prodfarm cap13, full delegation (seed STEMROBIN-18), NO human. Each blocking
> decision below is resolved from the live charter + the seed binding decisions (`.tmp/seed-drafts.md`
> §架构定调 G5/G8, 草案5) + `.tmp/plan-card-reading.md` D7/D13/D15. No decision required a human; none is a grill-leak.

## Blocking Decisions

1.
- id: D-FORMULA-FIDELITY
- question: Formulas are stored inline as `$...$` inside prose overlay strings (there are no separate `formula`-kind nodes). Acceptance says "formulas equal the zh source — verify formulas live in the neutral base, not the overlay." How is that satisfied and verified given formulas ride inside translatable prose?
- recommendation: Treat the SVG markup as the neutral-base-not-overlay witness (`migrate-lib.mjs htmlToCards` puts `<svg>` in `sr_lessons.content`, only its caption in the overlay), and prove formula non-alteration by byte-equality of the ordered `$...$`-span list (and the HTML tag multiset) between each `zh` and `en` overlay entry. The deterministic gate `check-i18n.mjs` fails the save on any `$...$`/tag mismatch. This matches G8 (公式/SVG 继承源、逐字节一致) and D15 (gate 校验公式/SVG 与源卡逐字节相同).
- final_decision: Adopt the recommendation. Formula fidelity = per-node `$...$`-span + HTML-tag byte-equality zh↔en, enforced by `check-i18n.mjs`; SVG is the demonstrated neutral-base-only artifact. Grounded in seed G8 + plan D15.

2.
- id: D-EN-SRC-REV
- question: What `src_rev` does each `en` overlay entry record?
- recommendation: The `zh` source entry's `src_rev` (the neutral-base revision translated from) — `1` for all migrated nodes today. Keeps the schema staleness contract (`overlay.src_rev < base node rev ⇒ stale`) uniform across locales.
- final_decision: Adopt. `en` entry `src_rev` = the corresponding `zh` entry's `src_rev`. Grounded in schema lines 259-272 + binding decision "src_rev records the source revision translated from".

3.
- id: D-COVERAGE-SET
- question: Which nodes must the `en` overlay cover — a subset or the full `zh` translatable node set?
- recommendation: Exactly the full `zh` node_id set (card prose `-b*`, captions `-cap*`, read-check prompts/options `-rc*`/`-o*`, exercise prompts/options `-ex*`/`-o*`). The gate fails on any missing or extra node_id.
- final_decision: Adopt. `en` node_id set must equal the `zh` node_id set exactly. Grounded in acceptance criterion 1 (cards + read-checks + exercises all covered) + plan D13 (练习 deck included).

## Recommended Defaults

- Saver mirrors `migrate-lesson.mjs`: two modes (`--emit` worksheet, default save), idempotent `insert ... on conflict (lesson_id,'en') do update`, server-only `db.mjs`; writes ONLY `sr_lesson_i18n(locale='en')`.
- Gate `check-i18n.mjs` reuses `check-content.mjs` `KEY_FIELDS` for the KEY-secrecy assertion (overlay values are prose-only strings; no `correct_index`/`accept`/`answer`).
- Residual-CJK check: a translated `en` string containing Han characters outside a `$...$` span fails the gate (untranslated leftover) — a cheap, strong fidelity signal for math prose.
- Authoring at scale via parallel per-lesson subagents producing `refs/translation/en/<id>.json`, then an independent prose-fidelity review pass before the deterministic gated save (produce → independent-review → deterministic-save discipline).
- `translate-all.mjs` thin driver to gate+save all 16 (mirrors `migrate-all.mjs`).

## Future Or Conditional Decisions

- App locale switch / English reader rendering — STEMROBIN-22 / STEMROBIN-24, out of this ticket.
- Staleness re-translation workflow (detect `src_rev < base rev` and re-emit) — needed once base content is revised; not exercised now (all `rev=1`).
- Additional locales beyond `en` (target 7–8) — reuse this same flow later; no schema change needed.

## Out-of-Scope Guardrails

- No `app/` code, no `app/src/routes` / `lib` changes, no Dockerfile change — this ticket is `.agents/skills/` + `sr_lesson_i18n('en')` rows only.
- No third-party translation API / new npm dependency / new recurring cost (redline #3; binding decision).
- Do NOT modify the `zh` overlays, the neutral base (`sr_lessons.content`/`exercises`), `sr_questions`, `sr_content_ledger`, or `sr_users` — additive `en` rows only (redline #2; only add).
- Read-check / exercise answer KEY stays in the neutral base; never copied into the `en` overlay (charter answer-key secrecy).
