# Unit Test Results

## Commands Run

- `node --test .intentmill/tickets/STEMROBIN-23-en-translation/tests/check-i18n.test.mjs` — 12 tests, all pass.
- `node .agents/skills/sr-math-lesson/scripts/check-content.mjs` — regression: still prints its usage banner unchanged after the `KEY_FIELDS` export edit.
- `node .agents/skills/sr-math-lesson/scripts/translate-lesson.mjs --id <id> --dry` — per-lesson gate self-check (all 16 pass; see Development Test Log).
- `node .agents/skills/sr-math-lesson/scripts/translate-all.mjs` — gate-and-save all 16 `en` overlays (Phase 4).
- Phase-5 empirical psql/node proofs (see `im-handoff.md`).

## Results

- check-i18n unit tests: 12 pass / 0 fail. The gate correctly (a) passes a faithful full translation, (b) reports missing/extra nodes, (c) rejects non-string `t` / non-integer `src_rev`, (d) rejects a leaked `correct_index`/`accept`/`answer`, (e) fails altered `$…$` and dropped `$$…$$` formulas, (f) fails dropped HTML tags, (g) fails an altered inline `<svg>` block, (h) fails untranslated CJK residue while NOT flagging CJK inside a neutral `<svg>` block, (i) passes a pure-formula node copied verbatim.
- `check-content.mjs` unchanged in behavior (export-only edit to share `KEY_FIELDS`).

## Development Test Log

- Slice 1 (gate `check-i18n.mjs`): wrote `validateI18n` + CLI; wrote 12-case fixture test; ran `node --test …` → discovered `KEY_FIELDS` not exported from `check-content.mjs`; added `export` to the single definition (SSOT-preserving); reran → 12/12 pass. Regression-ran `check-content.mjs` → unchanged.
- Slice 2 (saver `translate-lesson.mjs` + `translate-all.mjs`): wrote `--emit` / save / `--dry` modes; ran `translate-all.mjs --emit` → 16 worksheets emitted with node counts 151/154/172/183/170/162/176/125/158/163/160/188/171/173/158/162.
- Slice 3 (author 16 `en` overlays): parallel per-lesson authoring subagents; each self-checked with `translate-lesson.mjs --id <id> --dry` and iterated until the gate passed (the gate caught real issues, e.g. `math-s2-02` ex18-o0 formula-span order). Full 16-lesson `--dry` sweep result recorded below.
- Slice 4 (save): `translate-all.mjs` gate-and-saved all 16; each printed gate PASS + upsert.
- Slice 5 (empirical verification): psql/node proofs in `im-handoff.md`.

## Coverage Map

- Plan Unit Test Plan "coverage == zh (missing/extra node)" (R2) → check-i18n.test.mjs "missing node" + "extra node" tests.
- "entry shape / src_rev carried" (R3) → "non-string t and non-integer src_rev" test; saver builds `src_rev` from the zh entry (asserted live via the dry gate + Phase-5 psql).
- "KEY leak rejected" (R4) → "leaked answer KEY field" test (all three fields).
- "formula fidelity $…$ + $$…$$" (R5) → "altering a $…$ formula" + "dropping a $$…$$ block" tests.
- "markup fidelity (tags)" (R5) → "dropping an HTML tag" test.
- "inline SVG fidelity" (R5) → "altering the inline <svg> block" test.
- "residual-CJK; SVG text exempt" (R6) → "untranslated CJK residue" + "CJK inside a neutral SVG block is NOT flagged" tests.
- "no bypass path" (drift) → the saver calls `validateI18n` as the sole gate and `fail()`s on any non-empty result; the `--dry` and save modes share that gate; asserted at the `validateI18n` level and observed empirically (16/16 gated saves).
- "persistence/data-shape compatibility" → Phase-5 psql before/after proofs (closest available check; needs the shared DB, not unit-testable).

## Failures

None outstanding. (Transient authoring-time gate failures were fixed by the authoring subagents before save; see Development Test Log.)

## Notes

- The skills have no vitest runner (charter: `app/` vitest is separate and out of scope); ticket-scoped tests use Node's built-in `node --test`, consistent with the content-skill scripts' plain-`.mjs` style.
- No UI/frontend surface changed in this ticket, so no Playwright/component tests apply (reader is STEMROBIN-24).
