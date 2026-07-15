# IntentMill Handoff — STEMROBIN-21 · 迁移既有数学内容进 JSONB SSOT

## Summary

Migrated the 16 REAL production math lessons (`math-s2-01..08`, `math-s3-01..08`) and the two stage concept ledgers into the JSONB SSOT WITHOUT re-authoring prose, reusing the T2 generator's render/validate capability. Each lesson now has a card-tree `content` JSONB (ordered, numbered, no practice section), an `exercises` deck JSONB, a `zh` prose overlay, and ≥2 authored read-checks per substantial card. Both ledgers are queryable from `sr_content_ledger`. `sr_lessons.html`/`pdf` are re-rendered from the JSONB and the current app iframe reader renders a migrated lesson.

## Actual Changes

Code added (all dev-only, under `.agents/skills/sr-math-lesson/`; NO `app/` change):
- `scripts/migrate-lib.mjs` — PURE (no DB) extraction library: `splitSectionChildren` (depth-counting top-level element splitter, no new dependency), `htmlToCards` (teaching sections → card-tree body nodes + zh overlay; `<figure><svg>`→neutral svg node + caption overlay, every other block→prose `html` node verbatim; drops `practice`), `deckToExercises` (`sr_questions`→`exercises` items + prompt/option overlay; choice `key={correct_index}` only), `mergeReadChecks`.
- `scripts/migrate-lesson.mjs` — orchestrates one lesson: sources the PRISTINE original html from a snapshot (idempotency), builds content/exercises/overlay, merges authored read-checks, hard-gates with `validateContent`, informational `validateExercises`, renders html/pdf via `render-lesson.mjs`, upserts `sr_lessons.content/exercises/html/pdf` + `sr_lesson_i18n(zh)`, writes a prose-fidelity diff. `--digest` mode emits a per-card prose digest for read-check authoring.
- `scripts/migrate-all.mjs` — runs both ledgers (`save-ledger.mjs`) then all 16 lessons; idempotent; fail-fast.
- `tests/migrate-lib.test.mjs` + `tests/fixtures/*.html` — offline unit tests.

Code changed (minimal, additive):
- `scripts/render-lesson.mjs` — added ONE prose role `html` (`if (node.role === 'html') return t`) so DERIVED html reproduces the original block structure. Backward-compatible; no existing branch touched (BD3).

Data written (shared Azure prod, schema `stemrobin-schema`):
- `sr_content_ledger`: 2 rows (math stage 2, stage 3).
- `sr_lessons.content` + `sr_lessons.exercises` + re-rendered `html`/`pdf`: 16 rows.
- `sr_lesson_i18n(locale='zh')`: 16 overlay rows.
- NOT touched: `sr_users` (2 rows), `sr_questions` (331 rows — the current app quiz still reads them).

Audit artifacts (committed under `refs/migration/`): `snapshots/<id>.html` (16 pristine originals) + `snapshots/<id>.questions.json` (16), `diffs/<id>.prose.diff` (16, all `IDENTICAL`), `digests/<id>.md` (read-check authoring inputs), `readchecks/<id>.json` (15 authored decks, 130 read-checks total).

## Empirical Verification (psql proof)

- Ledger: `sr_content_ledger` has math s2 (8 lessons) + s3 (11 lessons) → both queryable.
- All 16 lessons: `content.cards` present, `num` contiguous from 1, NO `practice` card; each substantial card ≥2 read-checks (130 read-checks total); `exercises.items` ord-contiguous, ≥16 (331 items total = 1:1 with the 331 `sr_questions` rows); `sr_lesson_i18n(zh)` populated (16 rows).
- Answer-key secrecy: overlay `keyLeak=0` for all 16; no-KEY-in-html grep (`correct_index`/`"accept"`) = 0 rows.
- Prose fidelity: all 16 `*.prose.diff` = `IDENTICAL` (teaching prose byte-equal between the pristine original html and the migrated overlay) — proves prose was NOT re-authored, only structurally extracted. No D10 adjustment was needed (all 16 split cleanly on genre anchors).
- Idempotency: re-running a lesson yields byte-identical `content`+`exercises`+overlay.
- Preservation: `sr_users`=2 (untouched), `sr_questions`=331 (unchanged, read-only in the migration); all 16 catalog ids/subject/stage/lesson_order preserved.
- Reader: app dev server, `/lesson/math-s2-03` desktop viewport — renders numbered cards, KaTeX, SVG figure, authored read-check projection, practice section, catalog nav. Rendered html contains `<svg`, `data-sr-section="practice"`, `sr-readcheck`, KaTeX loader, all 6 card sections, and NO `correct_index`.

## Spec And Plan Alignment

- Spec obligations R1–R11: all satisfied and psql-verified (see above). R3/R9 prose fidelity proven by the IDENTICAL diffs; R7 by the browser render; R8 by the idempotency byte-compare.
- Plan obligations: dedicated engine reusing `db.mjs`/`render-lesson.mjs`/`validateContent`/`validateExercises`/`save-ledger.mjs` and NOT `save-lesson.mjs` (its outline gate would reject stage-2) — followed. Phases 1–6 executed in order with per-phase verification.
- Critical existing contracts preserved: T1 JSONB shapes; `check-content` hard gate; answer-key secrecy (renderer never emits `key`, overlay KEY-free); `save-ledger` closure-only path; app reads html + `sr_questions` unchanged; server-only `db.mjs`.
- Confirmed decisions obeyed: BD1 (exercises to the shipped contract, choice explanation NOT carried into JSONB, `sr_questions` retained), BD2 (snapshot-first idempotent envelope, `sr_users` preserved), BD3 (additive `html` role only). Rejected option (extending the exercises contract for explanations) is absent.
- Non-scope respected: no `app/` change, no card-reading UI, no translation/`en`, no progress consumption, stage-2 outline conflict (STEMROBIN-17) untouched, `sr_questions`/`sr_users` untouched.
- Test obligations: covered per `tests/test-results.md ## Coverage Map`.

## Deviations From Plan

- One implementation defect was found and fixed during phase 4: `migrate-lesson` originally re-parsed `sr_lessons.html`, which it overwrites each run, so a second run absorbed its own injected read-check/practice projection (non-idempotent, R8). Fix: always source the PRISTINE original from `snapshots/<id>.html` (write it once on first run; never clobber it). The prose-diff now also compares against that pristine snapshot, making it a true fidelity proof. `math-s2-03` (run once before the batch) had its snapshot clobbered by the pre-fix code; its pristine original was restored from `tests/fixtures/math-s2-03.html` and it was re-migrated. Final state verified idempotent + IDENTICAL.

## Missed User-Review Points

None. (All product decisions were adjudicable from the charter/seed under full delegation; no grill-leak. See `im-grill.md`.)

## Residual Issues / Future Improvements

- `save-ledger.mjs` bumps `src_rev` on every re-run because the JSONB round-trip reorders keys, so the equality check reports a false "changed" (ledger DATA is stable and correct; only the revision counter increments). Pre-existing T2 behavior, out of scope here; noted for a future save-ledger idempotency fix.
- The old per-choice explanation (`sr_questions.answer`) is intentionally NOT carried into `exercises` (BD1). It remains in the retained `sr_questions` rows + snapshots. If a future card-quiz reader needs explanations inside the JSONB SSOT, that is a T1/T2 contract change (add an explanation field with answer-key-secrecy handling) — a separate ticket.
- SVG text (e.g. `加法层`) is stored neutral (shared cross-locale per the multilingual design); the future `en` translation ticket must decide whether any SVG label needs localizing (design currently says SVG is shared).
- Downstream tickets remain: `en` overlay (seed draft 5), card-reading soft-gate UI (draft 4), language switch + per-locale availability (draft 6), progress consumption (D6), stage-2 outline reconciliation (STEMROBIN-17).

## Charter Drift

None. No stack or ops change (no new dependency, no `app/` change, no deploy/schema-DDL change — the T1 schema was already shipped; this ticket only populates data and adds dev-only skill scripts).
