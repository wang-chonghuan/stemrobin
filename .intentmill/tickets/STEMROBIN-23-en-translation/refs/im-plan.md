# IntentMill Plan

## Source Contract

`im-spec.md` is the only requirement contract. `im-draft.md` and `im-grill.md` are background provenance; all material constraints (R1–R9, critical contracts, D-FORMULA-FIDELITY / D-EN-SRC-REV / D-COVERAGE-SET) are promoted into `im-spec.md` and this plan.

## Implementation Approach

Add three scripts under `.agents/skills/sr-math-lesson/scripts/`, reusing existing helpers by import (no edits to existing scripts):

- `check-i18n.mjs` — the deterministic gate. Exports `validateI18n({ zh, en, id })` returning `string[]` problems, plus a CLI mirroring `check-content.mjs`. Checks:
  - node coverage: `Object.keys(en)` set equals `Object.keys(zh)` set (report missing + extra) — R2.
  - entry shape: each `en[nid]` is `{ t: string, src_rev: int }` — R3.
  - KEY-secrecy: reuse `KEY_FIELDS` from `check-content.mjs`; fail if any `en` entry carries `correct_index`/`accept`/`answer` — R4.
  - formula/markup fidelity: for each node, extract the ordered `$...$` span list (a small tokenizer over the string, honoring `$...$`; `$$...$$` if present) and the sorted HTML-tag multiset from both `zh.t` and `en.t`; fail on any inequality — R5.
  - residual-CJK: after removing `$...$` spans and HTML tags from `en.t`, fail if any `一-鿿` remains — R6.
- `translate-lesson.mjs` — two modes mirroring `migrate-lesson.mjs`:
  - `--id <id> --emit`: read the `zh` overlay from `sr_lesson_i18n`; write `refs/translation/src/<id>.json` = `{ node_id: zh_string }` (source worksheet for the author) and a matching empty/echo `refs/translation/en/<id>.json` template is NOT auto-written (author/subagent creates it).
  - `--id <id>` (default, save): read the `zh` overlay + authored `refs/translation/en/<id>.json` (`{ node_id: en_string }`); build candidate `en` overlay `{ node_id: { t: en_string, src_rev: zh[node_id].src_rev } }`; run `validateI18n` and HARD-FAIL on any problem (R7); on pass, `insert into sr_lesson_i18n (lesson_id,'en',overlay) on conflict (lesson_id,locale) do update` (R8). Writes only the `en` row.
- `translate-all.mjs` — thin driver mirroring `migrate-all.mjs`: iterate the 16 ids, run the save mode for each, summarize.

Translation content is produced by parallel per-lesson authoring (the agent / subagents) writing `refs/translation/en/<id>.json`, followed by an independent prose-fidelity review, then the deterministic gated save. The gate mechanically guarantees R2–R6; the human-readable English quality is the authoring concern.

## Implementation Drift Controls

- The gate is a non-bypassable precondition: `translate-lesson.mjs` save mode must call `validateI18n` and `process.exit(1)` on any problem before any DB write (R7). No `--force`, no partial write.
- Additive-only DB contract: the saver hard-codes `locale='en'` and only touches `sr_lesson_i18n`; it must never `update`/`delete` a `zh` row or any neutral-base column. Verify `zh` + neutral base unchanged before/after (compat constraint).
- Reuse, don't fork: import `KEY_FIELDS` (and any needed helpers) from `check-content.mjs`; import `connect`/`repoRoot` from `db.mjs`; do not copy or edit those files.
- Formula fidelity cannot be weakened: the `$...$`-span and tag-multiset equality checks are mandatory; a translation that alters a formula or drops a tag must fail, not warn.
- No new dependency / no external translation call (R9): scripts use only Node stdlib + the already-present `postgres` client.
- Uncertainty is fail-fast + handoff: if any lesson's authored `en` file is missing or fails the gate, the saver fails that lesson loudly; record any residual in `im-handoff.md` rather than persisting a degraded overlay.

## Phases

1. **Gate script.** Write `check-i18n.mjs` with `validateI18n` + CLI. Unit-test it (see Unit Test Plan) against crafted zh/en fixtures covering: exact-cover pass, missing node, extra node, KEY leak, altered `$...$`, dropped tag, residual CJK, good translation. Verify all fail/pass as specified. No DB, no shared-file edits (reuse `check-content.mjs` by import only — regression check: `check-content.mjs` still runs unchanged).
2. **Saver + emit.** Write `translate-lesson.mjs` (`--emit` and save). Run `--emit` for one lesson (e.g. `math-s2-01`), confirm `refs/translation/src/math-s2-01.json` matches the live `zh` node set. Regression check: `migrate-lesson.mjs` untouched; `db.mjs` imported unchanged.
3. **Author translations.** For all 16 lessons, emit source worksheets and author `refs/translation/en/<id>.json` via parallel subagents; run an independent prose-fidelity review pass. Verification point: every `en` file exists and passes `check-i18n.mjs` in dry (non-DB) mode before any save.
4. **Driver + save.** Write `translate-all.mjs`; run it to gate-and-save all 16. Each save must print the gate PASS and the upsert. Verification point: exit 0 for all 16.
5. **Empirical verification (gate6 evidence).** Run psql/node proofs: (a) 16 `en` rows exist; (b) for each lesson `en` node_id set == `zh` node_id set; (c) grep all `en` overlays for `correct_index`/`accept`/`answer` == 0; (d) pick a lesson with an SVG (e.g. `math-s2-01`) and show `<svg` appears in `sr_lessons.content` but NOT in the `en` overlay; (e) show a `$...$` formula is byte-identical between `zh` and `en` for a sample node; (f) confirm `zh` overlays + neutral base + `sr_questions` + `sr_users` unchanged (row counts / sample bytes). Capture all in `im-handoff.md`. Regression check: grep `app/` confirms no consumer reads `locale='en'` yet.

## Unit Test Plan

- Location: `.intentmill/tickets/STEMROBIN-23-en-translation/tests/`.
- `check-i18n` is the highest-risk, fully-unit-testable surface (it is the acceptance guarantee). Add a Node test file (plain `node --test` or a runnable `.mjs` asserting via `assert`, matching the skills' no-vitest reality) that exercises `validateI18n` with fixtures asserting:
  - exact node coverage passes; a missing node and an extra node each produce a problem (R2);
  - a `en` entry missing `t` or with a non-string `t` fails; `src_rev` carried from zh (R3);
  - an `en` entry carrying `correct_index`/`accept`/`answer` fails (R4) — the KEY-secrecy assertion;
  - an `en` string that changes a `$...$` span, or reorders/drops one, fails; a good translation preserving all `$...$` passes (R5);
  - an `en` string that drops or adds an HTML tag fails (R5);
  - an `en` string with leftover Han text outside `$...$` fails; the same with only English passes (R6).
- Rejected-option / drift assertions: the gate has no bypass path (no flag skips validation) — assert the save mode's control flow refuses on a failing fixture (exercise `validateI18n` returning non-empty ⇒ no write; can be asserted at the `validateI18n` level since the saver calls it as the sole gate).
- Persistence/data-shape compatibility: verified empirically in Phase 5 (psql before/after) rather than by unit test, because it requires the shared DB — named here as the closest available check.
- Commands: `node .agents/skills/sr-math-lesson/scripts/check-i18n.test.mjs` (or the test file path chosen); the Phase-5 psql/node proofs run against the shared DB via `db.mjs`.

## Handoff Expectations

Cap6 writes `.intentmill/tickets/STEMROBIN-23-en-translation/refs/im-handoff.md` summarizing: the scripts added (gate/saver/driver) and how formulas + KEY are kept out of/consistent across the overlay; the 16 `en` overlays produced; the Phase-5 psql proofs (16 en rows, node coverage == zh, KEY grep == 0, SVG-in-base-not-overlay, formula byte-equality); confirmation that `zh`/neutral-base/`sr_questions`/`sr_users` are untouched; any deviation from `im-spec.md`/`im-plan.md` and why; residual issues or future improvements (staleness workflow, further locales). Do not return to cap4.
